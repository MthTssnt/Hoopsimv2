import type { Rng } from '../../engine/rng';
import { canDunk, shotSkill, type ShotZone } from '../../engine/shot';
import type { Tendencies } from '../../engine/types';
import { isThreePoint, type Court, type Hoop } from '../physics/court';
import type { MatchWorld, WorldInput } from '../world/MatchWorld';
import { attacksRim } from '../world/shooting';

/** IA des joueurs non contrôlés, du 1 contre 1 au 3 contre 3 (valeurs provisoires, réglables à l'œil). */
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
  /** Vitesse de l'attaquant estimée sur cette fenêtre (s), pour anticiper sa course… */
  velocityWindow: 0.05,
  /** …prolongée de cette part du temps de réaction (0 : aucune anticipation, 1 : course droite parfaitement lue). */
  anticipation: 0.35,
  // --- Jeu d'équipe ---
  /** Coéquipier démarqué : aucun adversaire à moins de (m). Porteur serré : un adversaire à moins de (m). */
  openRange: 2,
  pressureRange: 1,
  /** Passe la plus longue que l'IA tente (m). */
  maxPass: 11,
  /** Le porteur décide de passer ou non à ce rythme (s). */
  decideEvery: 0.25,
  /** Patience du porteur avant de chercher la passe (s) : base + usage × pente (usage 0,35 à 2). */
  patience: { base: 0.8, perUsage: 1, max: 2.8 },
  /** Chance de passer à un démarqué à chaque décision, de la pire stat de passe/QI à la meilleure. */
  passChance: [0.35, 0.85],
  /** Au-delà de (s) de possession d'équipe, le porteur tire dès qu'il peut. */
  teamShootAfter: 7,
  /** Écartement : places derrière l'arc (degrés de part et d'autre de l'axe), libres à plus de (m) du porteur. */
  spacingAngles: [-80, -48, 0, 48, 80],
  spacingClear: 3,
  /** Coupe vers le cercle : tentée toutes les (s), si son défenseur est loin (m) ou derrière ; dure (s). */
  cutEvery: [3, 6],
  cutOpen: 2.2,
  cutDuration: 1.4,
  /** Aide en défense loin du ballon : part du chemin joueur → cercle, puis attirance vers le ballon. */
  helpDepth: 0.35,
  helpPull: 0.15,
  /** Joueurs de chaque équipe qui vont au rebond (les plus proches du ballon). */
  rebounders: 2,
} as const;

export type AiPlan = 'rim' | 'mid' | 'three';
export type AiMode = 'attaque' | 'ressortie' | 'défense' | 'aide' | 'écartement' | 'coupe' | 'réception' | 'rebond' | 'pause';

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

/**
 * Ce que le défenseur croit voir : la position d'il y a `delay` secondes, prolongée de la vitesse
 * qu'avait l'attaquant à ce moment-là. Une course droite est anticipée ; un changement de
 * direction se paie du temps de réaction.
 */
export function anticipatedPosition(history: readonly { t: number; p: Point }[], now: number, delay: number): Point {
  const seen = delayedPosition(history, now, delay);
  const before = delayedPosition(history, now, delay + AI_TUNING.velocityWindow);
  const k = (delay * AI_TUNING.anticipation) / AI_TUNING.velocityWindow;
  return { x: seen.x + (seen.x - before.x) * k, y: seen.y + (seen.y - before.y) * k };
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
 * Duels de la possession : chaque joueur de l'équipe 0 avec un joueur de l'équipe 1, appariés
 * au plus près (toutes les paires triées par distance). Calculé de la même façon par chaque IA.
 */
export function assignMarks(world: MatchWorld): Map<number, number> {
  const a = world.membersOf(0);
  const b = world.membersOf(1);
  const pairs: { i: number; j: number; d: number }[] = [];
  for (const i of a) for (const j of b) pairs.push({ i, j, d: Math.hypot(world.players[i].pos.x - world.players[j].pos.x, world.players[i].pos.y - world.players[j].pos.y) });
  pairs.sort((p, q) => p.d - q.d || p.i - q.i || p.j - q.j);
  const marks = new Map<number, number>();
  for (const { i, j } of pairs) {
    if (marks.has(i) || marks.has(j)) continue;
    marks.set(i, j);
    marks.set(j, i);
  }
  return marks;
}

/** Distance du joueur `i` à l'adversaire le plus proche. */
export function openness(world: MatchWorld, i: number): number {
  const me = world.players[i].pos;
  let best = Infinity;
  for (const j of world.opponentsOf(i)) best = Math.min(best, Math.hypot(world.players[j].pos.x - me.x, world.players[j].pos.y - me.y));
  return best;
}

/**
 * Écartement : les places derrière l'arc libres (à plus de `spacingClear` m du ballon), attribuées
 * aux joueurs sans ballon de `team`, au plus près.
 */
export function spacingSpots(world: MatchWorld, team: number): Map<number, Point> {
  const hoop = world.court.hoops.right;
  const radius = world.court.threeArc + AI_TUNING.threeOut;
  const ball = world.holder !== null ? world.players[world.holder].pos : world.pass ? world.pass.target : world.ball.pos;
  const spots = AI_TUNING.spacingAngles
    .map((deg) => spotAround(world.court, hoop, radius, (deg * Math.PI) / 180))
    .filter((p) => Math.hypot(p.x - ball.x, p.y - ball.y) > AI_TUNING.spacingClear);
  const off = world.membersOf(team).filter((i) => i !== world.holder && i !== world.pass?.receiver);
  const pairs: { i: number; k: number; d: number }[] = [];
  for (const i of off) spots.forEach((p, k) => pairs.push({ i, k, d: Math.hypot(world.players[i].pos.x - p.x, world.players[i].pos.y - p.y) }));
  pairs.sort((p, q) => p.d - q.d || p.i - q.i || p.k - q.k);
  const taken = new Set<number>();
  const result = new Map<number, Point>();
  for (const { i, k } of pairs) {
    if (result.has(i) || taken.has(k)) continue;
    result.set(i, spots[k]);
    taken.add(k);
  }
  return result;
}

/** Place d'aide loin du ballon : entre son joueur et le cercle, attirée vers le ballon. */
export function helpSpot(mark: Point, hoop: Hoop, ball: Point): Point {
  const x = mark.x + (hoop.rim.x - mark.x) * AI_TUNING.helpDepth;
  const y = mark.y + (hoop.rim.y - mark.y) * AI_TUNING.helpDepth;
  return { x: x + (ball.x - x) * AI_TUNING.helpPull, y: y + (ball.y - y) * AI_TUNING.helpPull };
}

/**
 * IA d'un joueur non contrôlé, du 1 contre 1 au 3 contre 3. Elle ne fait que choisir des entrées
 * (direction, saut, lâcher, passe), comme un humain au clavier : le monde applique les mêmes
 * règles et `engine/` tire les mêmes résultats. Seedée : un même match se rejoue à l'identique.
 * Rôles : porteur (plan de tir selon les tendances, passe au démarqué), sans ballon (écartement,
 * coupe, réception), défenseur du porteur (placement du 1 contre 1, contestation), défenseur
 * loin du ballon (aide), rebond (les deux plus proches de chaque équipe).
 */
export class PlayerAi {
  readonly index: number;
  mode: AiMode = 'pause';
  plan: AiPlan | null = null;
  /** Où elle va en ce moment (place de tir, point de ressortie, place en défense, ballon). */
  target: Point | null = null;
  /** Adversaire en duel pendant cette possession. */
  mark: number | null = null;
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
  private marksKey = '';
  private decideClock = 0;
  /** Au moment de tirer serré : passe ou tir déjà décidé pour cette possession. */
  private tightShotDecided = false;
  /** Prochaine coupe possible, et fin de la coupe en cours (temps de l'IA, s). */
  private nextCutAt: number;
  private cutUntil = -1;

  constructor(index: number, rng: Rng) {
    this.index = index;
    this.rng = rng;
    this.nextCutAt = rng.range(AI_TUNING.cutEvery[0], AI_TUNING.cutEvery[1]);
  }

  /** Temps de réaction actuel (s), selon la défense utile (intérieure près du cercle). */
  reaction(world: MatchWorld): number {
    const me = world.players[this.index].athlete;
    const other = world.players[this.mark ?? this.index];
    const hoop = world.hoopFor(other.pos.x);
    const near = Math.hypot(other.pos.x - hoop.rim.x, other.pos.y - hoop.rim.y) < AI_TUNING.interiorRange;
    return reactionTime(near ? me.attrs.interiorDef : me.attrs.perimeterDef);
  }

  think(world: MatchWorld, dt: number): WorldInput {
    this.clock += dt;
    this.refreshMark(world);
    if (this.mark !== null) {
      const op = world.players[this.mark].pos;
      this.history.push({ t: this.clock, p: { x: op.x, y: op.y } });
      while (this.history.length > 2 && this.history[1].t < this.clock - 0.6) this.history.shift();
    }

    // Fin de partie, ou ballon mort après une faute : on ne bouge pas.
    if ((world.rules?.winner !== null && world.rules?.winner !== undefined) || world.rules?.restart) {
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

    const myTeam = world.team[this.index];
    const pass = world.pass;
    if (pass && pass.receiver === this.index) return this.receive(world);
    const holder = world.holder;
    if (holder !== null) {
      if (world.team[holder] === myTeam) return this.offBall(world);
      return holder === this.mark ? this.defend(world) : this.help(world);
    }
    if (pass) return pass.team === myTeam ? this.offBall(world) : this.help(world);
    // Ballon libre : les plus proches de chaque équipe y vont, les autres reprennent leur place.
    if (this.isRebounder(world)) return this.chase(world);
    return world.possession?.team === myTeam ? this.offBall(world) : this.help(world);
  }

  /** Duels recalculés à chaque nouvelle possession. */
  private refreshMark(world: MatchWorld): void {
    const key = world.possession ? `${world.possession.team}:${world.possession.since}` : '';
    if (key === this.marksKey && this.mark !== null) return;
    this.marksKey = key;
    this.mark = assignMarks(world).get(this.index) ?? null;
    this.history = [];
  }

  private isRebounder(world: MatchWorld): boolean {
    const ball = world.ball.pos;
    const mine = world
      .membersOf(world.team[this.index])
      .map((i) => ({ i, d: Math.hypot(world.players[i].pos.x - ball.x, world.players[i].pos.y - ball.y) }))
      .sort((a, b) => a.d - b.d || a.i - b.i);
    return mine.slice(0, AI_TUNING.rebounders).some((m) => m.i === this.index);
  }

  private newPossession(world: MatchWorld): void {
    this.possessionTime = 0;
    this.stuck = 0;
    this.decideClock = 0;
    this.tightShotDecided = false;
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

  /** Passe vers le coéquipier `to` (direction tenue vers lui). */
  private passTo(world: MatchWorld, to: number): WorldInput {
    const me = world.players[this.index].pos;
    const p = world.players[to].pos;
    const d = Math.hypot(p.x - me.x, p.y - me.y) || 1;
    this.mode = 'attaque';
    this.target = { x: p.x, y: p.y };
    return { x: (p.x - me.x) / d, y: (p.y - me.y) / d, jump: false, pass: true };
  }

  /**
   * Coéquipier démarqué à portée de passe : le plus démarqué, ou pour ressortir le plus proche
   * derrière l'arc (`beyondArc`).
   */
  private openMate(world: MatchWorld, beyondArc = false): number | null {
    let best: number | null = null;
    let bestScore = -Infinity;
    const hoop = world.court.hoops.right;
    const me = world.players[this.index].pos;
    for (const j of world.teammatesOf(this.index)) {
      const p = world.players[j].pos;
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d > AI_TUNING.maxPass) continue;
      if (beyondArc && !isThreePoint(world.court, hoop, p.x, p.y)) continue;
      const open = openness(world, j);
      if (open <= AI_TUNING.openRange) continue;
      const score = beyondArc ? -d : open;
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    }
    return best;
  }

  private attack(world: MatchWorld, dt: number): WorldInput {
    const body = world.players[this.index];
    const hoop = world.hoopFor(body.pos.x);
    const team = world.team[this.index];
    const hasMates = world.teammatesOf(this.index).length > 0;
    // Ressortie d'abord : passe à un coéquipier démarqué derrière l'arc, sinon le point le plus proche derrière l'arc.
    if (world.rules?.mustClear[team]) {
      this.mode = 'ressortie';
      if (hasMates && world.pass === null) {
        const mate = this.openMate(world, true);
        if (mate !== null) return this.passTo(world, mate);
      }
      const dx = body.pos.x - hoop.rim.x;
      const dy = body.pos.y - hoop.rim.y;
      const angle = Math.atan2(dy, dx * hoop.toCourt);
      const limit = (AI_TUNING.spotAngle * Math.PI) / 180;
      this.target = spotAround(world.court, hoop, world.court.threeArc + AI_TUNING.clearMargin, Math.max(-limit, Math.min(limit, angle)));
      return this.moveTo(world, this.target, true);
    }
    this.mode = 'attaque';
    this.possessionTime += dt;
    // Passe : serré, ou trop longtemps avec le ballon, vers un coéquipier démarqué.
    const teamLate = world.possession !== null && world.clock - world.possession.since > AI_TUNING.teamShootAfter;
    const a = body.athlete;
    const passChance = lerp(AI_TUNING.passChance[0], AI_TUNING.passChance[1], ratingT((a.attrs.passing + a.attrs.iq) / 2));
    if (hasMates) {
      this.decideClock += dt;
      if (this.decideClock >= AI_TUNING.decideEvery) {
        this.decideClock = 0;
        const p = AI_TUNING.patience;
        const patience = Math.min(p.max, p.base + a.tendencies.usage * p.perUsage);
        const pressured = openness(world, this.index) < AI_TUNING.pressureRange && this.possessionTime > 0.5;
        if (!teamLate && (pressured || this.possessionTime > patience)) {
          const mate = this.openMate(world);
          if (mate !== null && this.rng.chance(passChance)) return this.passTo(world, mate);
        }
      }
    }
    // Au moment de tirer avec un défenseur collé, un démarqué peut avoir la préférence (une fois par possession). */
    const passInstead = (): WorldInput | null => {
      if (!hasMates || teamLate || this.tightShotDecided || openness(world, this.index) >= AI_TUNING.pressureRange) return null;
      this.tightShotDecided = true;
      const mate = this.openMate(world);
      return mate !== null && this.rng.chance(passChance) ? this.passTo(world, mate) : null;
    };
    const speed = Math.hypot(body.vel.x, body.vel.y);
    const toSpot = this.spot ? Math.hypot(this.spot.x - body.pos.x, this.spot.y - body.pos.y) : 0;
    this.stuck = speed < AI_TUNING.stuckSpeed && toSpot > AI_TUNING.reachTolerance ? this.stuck + dt : 0;
    if (this.stuck > AI_TUNING.stuckTime) {
      // Bouchée par le défenseur : une autre place de tir (ou un tir sur place près du cercle).
      this.stuck = 0;
      this.plan = this.plan === 'rim' ? 'mid' : this.plan;
      this.spot = this.spotFor(world, this.plan ?? 'mid');
    }
    const late = this.possessionTime >= AI_TUNING.shootAfter || teamLate;
    if (this.plan === 'rim') {
      const toRim = Math.hypot(hoop.rim.x - body.pos.x, hoop.rim.y - body.pos.y);
      if (canDunk(world.dunkContext(this.index))) return this.shoot(world, 'rim');
      if ((toRim <= AI_TUNING.layupFrom && attacksRim(body.pos, body.vel, hoop)) || late) return passInstead() ?? this.shoot(world, 'rim');
      this.target = { x: hoop.rim.x, y: hoop.rim.y };
      return this.moveTo(world, this.target, true);
    }
    this.target = this.spot;
    if (toSpot <= AI_TUNING.reachTolerance || late) return passInstead() ?? this.shoot(world, this.plan ?? 'mid');
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

  /** Passe vers moi : je vais au-devant du ballon. */
  private receive(world: MatchWorld): WorldInput {
    this.mode = 'réception';
    const t = world.pass!.target;
    this.target = { x: t.x, y: t.y };
    return this.moveTo(world, this.target);
  }

  /** Sans ballon en attaque : derrière l'arc si l'équipe doit ressortir, sinon écartement et coupes. */
  private offBall(world: MatchWorld): WorldInput {
    const team = world.team[this.index];
    const body = world.players[this.index];
    const hoop = world.court.hoops.right;
    const spot = spacingSpots(world, team).get(this.index) ?? { x: body.pos.x, y: body.pos.y };
    if (world.rules?.mustClear[team]) {
      this.mode = 'écartement';
      this.target = spot;
      return this.moveTo(world, spot);
    }
    if (this.clock < this.cutUntil) {
      this.mode = 'coupe';
      this.target = { x: hoop.rim.x + hoop.toCourt * 1.5, y: hoop.rim.y + Math.sign(body.pos.y - hoop.rim.y || 1) * 0.6 };
      return this.moveTo(world, this.target, true);
    }
    if (this.clock >= this.nextCutAt) {
      this.nextCutAt = this.clock + this.rng.range(AI_TUNING.cutEvery[0], AI_TUNING.cutEvery[1]);
      const guard = this.mark !== null ? world.players[this.mark].pos : null;
      const myRim = Math.hypot(hoop.rim.x - body.pos.x, hoop.rim.y - body.pos.y);
      const behind = guard !== null && Math.hypot(hoop.rim.x - guard.x, hoop.rim.y - guard.y) > myRim + 0.3;
      const far = guard === null || Math.hypot(guard.x - body.pos.x, guard.y - body.pos.y) > AI_TUNING.cutOpen;
      if (behind || far) {
        this.cutUntil = this.clock + AI_TUNING.cutDuration;
        return this.offBall(world);
      }
    }
    this.mode = 'écartement';
    this.target = spot;
    return this.moveTo(world, spot);
  }

  /** Défense sur le porteur (placement du 1 contre 1) : anticipation, contestation, rester planté. */
  private defend(world: MatchWorld): WorldInput {
    this.mode = 'défense';
    const other = this.mark!;
    const reaction = this.reaction(world);
    const body = world.players[this.index];
    const seen = anticipatedPosition(this.history, this.clock, reaction);
    const hoop = world.hoopFor(seen.x);
    const shot = world.shot;
    // Le tireur décolle près de nous : on saute pour contester, après le temps de réaction.
    if (shot && shot.shooter === other && this.contested !== shot && shot.airTime >= reaction) {
      const shooter = world.players[other].pos;
      if (!body.airborne && Math.hypot(shooter.x - body.pos.x, shooter.y - body.pos.y) <= AI_TUNING.contestRange) {
        this.contested = shot;
        return { x: 0, y: 0, jump: true };
      }
    }
    // Tireur en l'air (vu après le temps de réaction) : on reste planté, sans lui rentrer dedans.
    if (shot && shot.shooter === other && shot.airTime >= reaction) {
      this.target = { x: body.pos.x, y: body.pos.y };
      return { x: 0, y: 0, jump: false };
    }
    this.target = guardSpot(seen, hoop);
    // Attaquant déjà sur nous : on tient notre place au lieu d'avancer vers lui (on ne lui rentre
    // pas dedans parce qu'on le voit avec du retard).
    const now = world.players[other].pos;
    const gap = Math.hypot(now.x - body.pos.x, now.y - body.pos.y);
    if (gap < AI_TUNING.guardGap && Math.hypot(now.x - this.target.x, now.y - this.target.y) < gap) {
      this.target = { x: body.pos.x, y: body.pos.y };
    }
    return this.moveTo(world, this.target);
  }

  /** Défense loin du ballon : entre son joueur (vu avec retard) et le cercle, en aidant vers le ballon. */
  private help(world: MatchWorld): WorldInput {
    this.mode = 'aide';
    if (this.mark === null) return { x: 0, y: 0, jump: false };
    const seen = delayedPosition(this.history, this.clock, this.reaction(world));
    const hoop = world.court.hoops.right;
    const ball = world.holder !== null ? world.players[world.holder].pos : world.ball.pos;
    this.target = helpSpot(seen, hoop, ball);
    return this.moveTo(world, this.target);
  }

  private chase(world: MatchWorld): WorldInput {
    this.mode = 'rebond';
    const { pos, vel } = world.ball;
    this.target = { x: pos.x + vel.x * AI_TUNING.chaseLead, y: pos.y + vel.y * AI_TUNING.chaseLead };
    return this.moveTo(world, this.target, true);
  }
}
