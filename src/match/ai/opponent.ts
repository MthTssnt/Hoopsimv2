import type { Rng } from '../../engine/rng';
import { canDunk, shotSkill, type ShotZone } from '../../engine/shot';
import type { Tendencies } from '../../engine/types';
import { isThreePoint, type Court, type Hoop } from '../physics/court';
import type { MatchWorld, WorldInput } from '../world/MatchWorld';
import { attacksRim } from '../world/shooting';

/** IA adverse du 1 contre 1 (valeurs provisoires, réglables à l'œil). */
export const AI_TUNING = {
  /** Défense : distance à l'attaquant, sur la ligne attaquant → cercle (m). */
  guardGap: 1.1,
  /** Temps de réaction (s) : du plus lent (défense 25) au plus vif (défense 99). */
  reaction: { slow: 0.3, quick: 0.12 },
  /** En deçà de cette distance du cercle (m), c'est la défense intérieure qui compte. */
  interiorRange: 4,
  /** Saute pour contester si le tireur décolle à moins de (m). */
  contestRange: 2.5,
  /** Ralentit à moins de (m) de sa cible ; en deçà de `deadZone` (m), ne bouge plus. */
  arriveSlow: 0.8,
  deadZone: 0.08,
  /** Attaque : ressortir à (m) derrière l'arc ; cible atteinte à moins de (m). */
  clearMargin: 0.6,
  reachTolerance: 0.45,
  /** Tire au plus tard après (s) avec le ballon (ressortie non comprise). */
  shootAfter: 3,
  /** Bloquée (plus lente que `stuckSpeed` m/s pendant `stuckTime` s) : autre cible. */
  stuckSpeed: 0.8,
  stuckTime: 0.6,
  /** Places de tir : 3 pts à `threeOut` m derrière l'arc, mi-distance entre `midRange` m. */
  threeOut: 0.5,
  midRange: [4.5, 6],
  /** Angle maximal des places de tir de part et d'autre de l'axe du cercle (degrés). */
  spotAngle: 65,
  /** Layup : tenté à moins de (m) du cercle en attaquant. */
  layupFrom: 2.4,
  /** Écart-type du lâcher (s) : du pire tireur (25) au meilleur (99). */
  timingSd: { worst: 0.09, best: 0.035 },
  /** Ballon libre : vise sa position projetée de (s) en avant. */
  chaseLead: 0.25,
} as const;

export type AiPlan = 'rim' | 'mid' | 'three';
export type AiMode = 'attaque' | 'ressortie' | 'défense' | 'rebond' | 'pause';

type Point = { x: number; y: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ratingT = (rating: number) => Math.min(1, Math.max(0, (rating - 25) / 74));

/** Plan d'une possession, tiré selon les tendances de tir du joueur (comme la simulation). */
export function choosePlan(tendencies: Tendencies, rng: Rng): AiPlan {
  return (['rim', 'mid', 'three'] as const)[rng.weightedIndex([tendencies.rim, tendencies.mid, tendencies.three])];
}

/** Temps de réaction en défense selon la note de défense (25-99). */
export function reactionTime(defense: number): number {
  return lerp(AI_TUNING.reaction.slow, AI_TUNING.reaction.quick, ratingT(defense));
}

/** Écart-type du lâcher selon la stat de tir de la zone (25-99). */
export function timingSd(skill: number): number {
  return lerp(AI_TUNING.timingSd.worst, AI_TUNING.timingSd.best, ratingT(skill));
}

/** Place de défense : sur la ligne attaquant → cercle, à `guardGap` de l'attaquant (au plus à mi-chemin). */
export function guardSpot(attacker: Point, hoop: Hoop): Point {
  const dx = hoop.rim.x - attacker.x;
  const dy = hoop.rim.y - attacker.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { ...attacker };
  const gap = Math.min(AI_TUNING.guardGap, d / 2);
  return { x: attacker.x + (dx / d) * gap, y: attacker.y + (dy / d) * gap };
}

/** Position d'un joueur il y a `delay` secondes, d'après l'historique (le plus ancien point s'il manque). */
export function delayedPosition(history: readonly { t: number; p: Point }[], now: number, delay: number): Point {
  const when = now - delay;
  for (let i = history.length - 1; i >= 0; i--) if (history[i].t <= when) return history[i].p;
  return history[0]?.p ?? { x: 0, y: 0 };
}

/** Tirage normal (Box-Muller) à partir du générateur seedé. */
function gaussian(rng: Rng): number {
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Point à `radius` du cercle, à l'angle `angle` (radians) de l'axe du terrain, ramené dans le terrain. */
function spotAround(court: Court, hoop: Hoop, radius: number, angle: number): Point {
  const x = hoop.rim.x + hoop.toCourt * Math.cos(angle) * radius;
  const y = hoop.rim.y + Math.sin(angle) * radius;
  return { x: Math.min(court.length - 0.5, Math.max(0.5, x)), y: Math.min(court.width - 0.6, Math.max(0.6, y)) };
}

/**
 * IA d'un joueur du 1 contre 1. Elle ne fait que choisir des entrées (direction, saut, lâcher),
 * comme un humain au clavier : le monde applique les mêmes règles et `engine/` tire les mêmes
 * résultats. Seedée : un même match se rejoue à l'identique.
 */
export class OpponentAi {
  readonly index: number;
  mode: AiMode = 'pause';
  plan: AiPlan | null = null;
  /** Où elle va en ce moment (place de tir, point de ressortie, place en défense, ballon). */
  target: Point | null = null;
  private readonly rng: Rng;
  private clock = 0;
  private history: { t: number; p: Point }[] = [];
  private hadBall = false;
  private possessionTime = 0;
  /** Place de tir du plan de la possession. */
  private spot: Point | null = null;
  private stuck = 0;
  /** Lâcher prévu (temps en l'air, s) du tir en cours. */
  private releaseAt: number | null = null;
  /** Tir adverse déjà contesté (pour ne sauter qu'une fois). */
  private contested: object | null = null;

  constructor(index: number, rng: Rng) {
    this.index = index;
    this.rng = rng;
  }

  /** Temps de réaction actuel (s), selon la défense utile (intérieure près du cercle). */
  reaction(world: MatchWorld): number {
    const me = world.players[this.index].athlete;
    const other = world.players[this.other(world)];
    const hoop = world.hoopFor(other.pos.x);
    const near = Math.hypot(other.pos.x - hoop.rim.x, other.pos.y - hoop.rim.y) < AI_TUNING.interiorRange;
    return reactionTime(near ? me.attrs.interiorDef : me.attrs.perimeterDef);
  }

  think(world: MatchWorld, dt: number): WorldInput {
    this.clock += dt;
    const other = this.other(world);
    const op = world.players[other].pos;
    this.history.push({ t: this.clock, p: { x: op.x, y: op.y } });
    while (this.history.length > 2 && this.history[1].t < this.clock - 0.6) this.history.shift();

    if (world.rules?.winner !== null && world.rules?.winner !== undefined) {
      this.mode = 'pause';
      return { x: 0, y: 0, jump: false };
    }
    const shot = world.shot;
    if (shot && shot.shooter === this.index) {
      // En l'air : on lâche au moment prévu (pas de lâcher pour un dunk).
      const release = shot.kind !== 'dunk' && this.releaseAt !== null && shot.airTime + dt >= this.releaseAt;
      if (release) this.releaseAt = null;
      return { x: 0, y: 0, jump: false, release };
    }
    const holding = world.holder === this.index;
    if (holding && !this.hadBall) this.newPossession(world);
    this.hadBall = holding;
    if (holding) return this.attack(world, dt);
    if (world.holder === other) return this.defend(world);
    return this.chase(world);
  }

  private other(world: MatchWorld): number {
    return (this.index + 1) % world.players.length;
  }

  private newPossession(world: MatchWorld): void {
    this.possessionTime = 0;
    this.stuck = 0;
    this.plan = choosePlan(world.players[this.index].athlete.tendencies, this.rng);
    this.spot = this.spotFor(world, this.plan);
  }

  /** Place visée pour un plan : derrière l'arc, à mi-distance, ou le cercle. */
  private spotFor(world: MatchWorld, plan: AiPlan): Point {
    const hoop = world.hoopFor(world.players[this.index].pos.x);
    const angle = ((this.rng.range(-1, 1) * AI_TUNING.spotAngle) / 180) * Math.PI;
    if (plan === 'rim') return { x: hoop.rim.x, y: hoop.rim.y };
    if (plan === 'mid') return spotAround(world.court, hoop, this.rng.range(AI_TUNING.midRange[0], AI_TUNING.midRange[1]), angle);
    const spot = spotAround(world.court, hoop, world.court.threeArc + AI_TUNING.threeOut, angle);
    return isThreePoint(world.court, hoop, spot.x, spot.y) ? spot : spotAround(world.court, hoop, world.court.threeArc + AI_TUNING.threeOut, 0);
  }

  /** Entrée qui mène vers `target`, en ralentissant à l'arrivée. */
  private moveTo(world: MatchWorld, target: Point, full = false): WorldInput {
    const me = world.players[this.index].pos;
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const d = Math.hypot(dx, dy);
    if (d < AI_TUNING.deadZone) return { x: 0, y: 0, jump: false };
    const k = full ? 1 : Math.min(1, d / AI_TUNING.arriveSlow);
    return { x: (dx / d) * k, y: (dy / d) * k, jump: false };
  }

  private attack(world: MatchWorld, dt: number): WorldInput {
    const body = world.players[this.index];
    const hoop = world.hoopFor(body.pos.x);
    // Ressortie d'abord : le point le plus proche derrière l'arc.
    if (world.rules?.mustClear[this.index]) {
      this.mode = 'ressortie';
      const dx = body.pos.x - hoop.rim.x;
      const dy = body.pos.y - hoop.rim.y;
      const angle = Math.atan2(dy, dx * hoop.toCourt);
      const limit = (AI_TUNING.spotAngle * Math.PI) / 180;
      this.target = spotAround(world.court, hoop, world.court.threeArc + AI_TUNING.clearMargin, Math.max(-limit, Math.min(limit, angle)));
      return this.moveTo(world, this.target, true);
    }
    this.mode = 'attaque';
    this.possessionTime += dt;
    const speed = Math.hypot(body.vel.x, body.vel.y);
    const toSpot = this.spot ? Math.hypot(this.spot.x - body.pos.x, this.spot.y - body.pos.y) : 0;
    this.stuck = speed < AI_TUNING.stuckSpeed && toSpot > AI_TUNING.reachTolerance ? this.stuck + dt : 0;
    if (this.stuck > AI_TUNING.stuckTime) {
      // Bouchée par le défenseur : une autre place de tir (ou un tir sur place près du cercle).
      this.stuck = 0;
      this.plan = this.plan === 'rim' ? 'mid' : this.plan;
      this.spot = this.spotFor(world, this.plan ?? 'mid');
    }
    const late = this.possessionTime >= AI_TUNING.shootAfter;
    if (this.plan === 'rim') {
      const toRim = Math.hypot(hoop.rim.x - body.pos.x, hoop.rim.y - body.pos.y);
      if (canDunk(world.dunkContext(this.index))) return this.shoot(world, 'rim');
      if ((toRim <= AI_TUNING.layupFrom && attacksRim(body.pos, body.vel, hoop)) || late) return this.shoot(world, 'rim');
      this.target = { x: hoop.rim.x, y: hoop.rim.y };
      return this.moveTo(world, this.target, true);
    }
    this.target = this.spot;
    if (toSpot <= AI_TUNING.reachTolerance || late) return this.shoot(world, this.plan ?? 'mid');
    return this.moveTo(world, this.spot!);
  }

  /** Appui sur Tir ; le lâcher est prévu au sommet plus une erreur selon la stat de la zone. */
  private shoot(world: MatchWorld, zone: ShotZone): WorldInput {
    const body = world.players[this.index];
    if (body.airborne) return { x: 0, y: 0, jump: false };
    const skill = shotSkill({ shooter: body.athlete, zone });
    this.releaseAt = body.timeToApex + gaussian(this.rng) * timingSd(skill);
    return { x: 0, y: 0, jump: true };
  }

  private defend(world: MatchWorld): WorldInput {
    this.mode = 'défense';
    const other = this.other(world);
    const reaction = this.reaction(world);
    const seen = delayedPosition(this.history, this.clock, reaction);
    const hoop = world.hoopFor(seen.x);
    const shot = world.shot;
    const body = world.players[this.index];
    // Le tireur décolle près de nous : on saute pour contester, après le temps de réaction.
    if (shot && shot.shooter === other && this.contested !== shot && shot.airTime >= reaction) {
      const shooter = world.players[other].pos;
      if (!body.airborne && Math.hypot(shooter.x - body.pos.x, shooter.y - body.pos.y) <= AI_TUNING.contestRange) {
        this.contested = shot;
        return { x: 0, y: 0, jump: true };
      }
    }
    this.target = guardSpot(seen, hoop);
    return this.moveTo(world, this.target);
  }

  private chase(world: MatchWorld): WorldInput {
    this.mode = 'rebond';
    const { pos, vel } = world.ball;
    this.target = { x: pos.x + vel.x * AI_TUNING.chaseLead, y: pos.y + vel.y * AI_TUNING.chaseLead };
    return this.moveTo(world, this.target, true);
  }
}
