import { reach } from '../../engine/athletics';
import type { Rng } from '../../engine/rng';
import { gaugeTime, resolveShot, type ShotKind, type ShotMode, type ShotSpeed, type ShotZone, type TimingGrade } from '../../engine/shot';
import type { Player } from '../../engine/types';
import { BALL_PHYSICS, stepBall, type BallState } from '../physics/ball';
import { BALL_RADIUS, distanceToRim, type Court, type Hoop, type HoopSide, type Vec3 } from '../physics/court';
import { solveShot } from '../physics/shotSolver';
import { createPlayerBody, setJumpTiming, stepPlayer, type MoveInput, type PlayerBody } from './player';
import { attacksRim, layupFinish, releasePoint, SHOT_FLOW, shotZone, targetHoop } from './shooting';

/** Valeurs provisoires, réglables à l'œil. */
export const WORLD_TUNING = {
  /** Un ballon libre est ramassé à moins de cette distance horizontale des pieds (m)… */
  pickupRadius: 0.65,
  /** …et s'il est sous la main tendue (+ marge, m). */
  pickupReachMargin: 0.1,
  /** Délai pendant lequel le tireur ne peut pas rattraper son propre tir (s). */
  pickupCooldown: 0.5,
  /** Dribble : durée d'un aller-retour main → sol → main (s), hauteur de la main (m). */
  dribblePeriod: 0.5,
  dribbleHandHeight: 0.85,
  /**
   * Main qui tient le ballon : écart devant le joueur et vers le spectateur (m). Le ballon est
   * dribblé devant le corps, un peu en avant : l'écart suit le dessin (voir le rig).
   */
  handForward: 0.22,
  handDepth: 0.12,
} as const;

/** Un tir dans le monde : vrai tir (jauge) ou tir de démo (R/M). */
export interface ShotRecord {
  /** Tir de démo (touches R/M, résultat imposé) ou vrai tir (résultat tiré par `engine/`). */
  demo: boolean;
  kind: ShotKind;
  zone: ShotZone;
  /** Point de lâcher du ballon. */
  start: Vec3;
  /** Distance au cercle et 3 pts, mesurées là où le tireur a décollé. */
  distance: number;
  three: boolean;
  hoop: HoopSide;
  /** Résultat tiré par `engine/` (ou imposé pour une démo). */
  wanted: boolean;
  probability: number | null;
  grade: TimingGrade | null;
  /** Écart entre le lâcher et le sommet du saut (s), négatif = trop tôt. */
  timingError: number | null;
  /** Parti tout seul : Tir encore enfoncé à l'atterrissage. */
  forced: boolean;
  /** Panier marqué avant le premier contact avec le parquet. */
  scored: boolean;
  /** Résultat observé en direct (null tant que le ballon n'a pas touché le sol). */
  live: boolean | null;
}

/** Tir en cours : le joueur est en l'air, le ballon au-dessus de la tête, la jauge tourne. */
export interface ActiveShot {
  kind: ShotKind;
  /** Zone mesurée au décollage (un layup est toujours « près du cercle »). */
  zone: ShotZone;
  hoop: Hoop;
  /** Temps passé en l'air depuis le décollage (s). */
  airTime: number;
  /** Vitesse au sol au décollage (m/s) : pénalité du tir en mouvement. */
  takeoffSpeed: number;
  takeoff: Vec3;
}

/** Réglages du tir choisis dans le panneau. */
export interface ShotSettings {
  mode: ShotMode;
  speed: ShotSpeed;
}

/** Ce que le monde reçoit à chaque pas : direction, appui et relâche de Tir. */
export interface WorldInput extends MoveInput {
  /** Tir relâché à ce pas. */
  release?: boolean;
}

export class MatchWorld {
  court: Court;
  readonly players: PlayerBody[] = [];
  controlled = 0;
  ball: BallState;
  /** Index du joueur qui tient le ballon, ou null s'il est libre. */
  holder: number | null = null;
  /** Tir en cours (en l'air, ballon pas encore lâché). */
  shot: ActiveShot | null = null;
  lastShot: ShotRecord | null = null;
  /** Points marqués par les vrais tirs (pas les démos). */
  points = 0;
  shotSettings: ShotSettings;
  private readonly rng: Rng;
  private dribbleTime = 0;
  private cooldown = 0;

  constructor(court: Court, athlete: Player, start: Vec3, shotSettings: ShotSettings, rng: Rng) {
    this.court = court;
    this.rng = rng;
    this.shotSettings = { ...shotSettings };
    this.players.push(createPlayerBody(athlete, start, gaugeTime(shotSettings.speed)));
    this.holder = 0;
    this.ball = { pos: this.handPosition(this.players[0]), vel: { x: 0, y: 0, z: 0 } };
  }

  get player(): PlayerBody {
    return this.players[this.controlled];
  }

  /** Change le joueur contrôlé en gardant sa position, sa vitesse et son saut en cours. */
  setAthlete(athlete: Player): void {
    const old = this.player;
    const body = createPlayerBody(athlete, old.pos, old.timeToApex);
    body.facing = old.facing;
    body.vel = { ...old.vel };
    body.airborne = old.airborne;
    this.players[this.controlled] = body;
  }

  /** Mode et vitesse de tir : la vitesse règle aussi la durée du saut (sommet = fin de la jauge). */
  setShotSettings(settings: ShotSettings): void {
    this.shotSettings = { ...settings };
    for (const body of this.players) setJumpTiming(body, gaugeTime(settings.speed));
  }

  /** Position du ballon tenu : dribble au sol, levé au-dessus de la tête en l'air. */
  handPosition(body: PlayerBody): Vec3 {
    const t = WORLD_TUNING;
    const x = body.pos.x + body.facing * t.handForward;
    const y = body.pos.y + t.handDepth;
    if (body.airborne) return { x, y, z: body.pos.z + (body.athlete.heightCm / 100) * 1.1 };
    const phase = Math.abs(Math.cos((Math.PI * this.dribbleTime) / t.dribblePeriod));
    return { x, y, z: BALL_RADIUS + (t.dribbleHandHeight - BALL_RADIUS) * phase };
  }

  step(dt: number, input: WorldInput): void {
    const body = this.player;
    const holding = this.holder === this.controlled;
    // Appui sur Tir avec le ballon, au sol : le tir commence avec le saut.
    const startsShot = input.jump && holding && !body.airborne && this.shot === null;
    const takeoffSpeed = Math.hypot(body.vel.x, body.vel.y);
    const takeoff = { ...body.pos };
    const layup = startsShot && attacksRim(body.pos, body.vel, targetHoop(this.court, body.pos.x));
    stepPlayer(body, input, dt, this.court);
    if (startsShot) this.startShot(layup ? 'layup' : 'jump', takeoffSpeed, takeoff);
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.shot) {
      this.shot.airTime += dt;
      // Lâcher au relâchement de Tir ; Tir encore enfoncé à l'atterrissage : le tir part tout seul.
      if (input.release) this.releaseShot(false);
      else if (!body.airborne) this.releaseShot(true);
    }

    if (this.holder !== null) {
      const holder = this.players[this.holder];
      this.dribbleTime = holder.airborne ? 0 : this.dribbleTime + dt;
      this.ball.pos = this.handPosition(holder);
      this.ball.vel = { ...holder.vel };
      return;
    }

    for (const event of stepBall(this.ball, this.court, dt)) {
      const shot = this.lastShot;
      if (!shot || shot.live !== null) continue;
      if (event.type === 'score' && event.hoop === shot.hoop && !shot.scored) {
        shot.scored = true;
        if (!shot.demo) this.points += shot.three ? 3 : 2;
      }
      if (event.type === 'floor') shot.live = shot.scored;
    }
    this.tryPickup();
  }

  /** Début du tir : tourné vers le panier ; un layup file vers un point devant le cercle. */
  private startShot(kind: ShotKind, takeoffSpeed: number, takeoff: Vec3): void {
    const body = this.player;
    const hoop = targetHoop(this.court, takeoff.x);
    body.facing = hoop.rim.x >= takeoff.x ? 1 : -1;
    if (kind === 'layup') {
      // Le layup garde son propre élan (pas celui, réduit, d'un tir en suspension).
      const finish = layupFinish(takeoff, hoop);
      const airTime = 2 * body.timeToApex;
      const vx = (finish.x - takeoff.x) / airTime;
      const vy = (finish.y - takeoff.y) / airTime;
      const speed = Math.hypot(vx, vy);
      const k = speed > SHOT_FLOW.layupMaxSpeed ? SHOT_FLOW.layupMaxSpeed / speed : 1;
      body.vel.x = vx * k;
      body.vel.y = vy * k;
    }
    const zone: ShotZone = kind === 'layup' ? 'rim' : shotZone(this.court, hoop, takeoff.x, takeoff.y);
    this.shot = { kind, zone, hoop, airTime: 0, takeoffSpeed, takeoff };
  }

  /** Lâcher : `engine/` tire le résultat, la physique produit une trajectoire qui y aboutit. */
  private releaseShot(forced: boolean): void {
    const shot = this.shot!;
    this.shot = null;
    const body = this.player;
    const { hoop, takeoff, zone } = shot;
    const timingError = shot.airTime - body.timeToApex;
    const result = resolveShot(
      {
        shooter: body.athlete,
        zone,
        kind: shot.kind,
        mode: this.shotSettings.mode,
        speed: this.shotSettings.speed,
        timingError,
        contest: null,
        moveSpeed: shot.takeoffSpeed,
      },
      this.rng,
    );
    const start = releasePoint(body.pos, body.athlete.heightCm, hoop, WORLD_TUNING.handDepth);
    this.launch(start, result.made, hoop);
    this.lastShot = {
      demo: false,
      kind: shot.kind,
      zone,
      start,
      distance: distanceToRim(hoop, takeoff.x, takeoff.y),
      three: zone === 'three',
      hoop: hoop.side,
      wanted: result.made,
      probability: result.probability,
      grade: result.grade,
      timingError,
      forced,
      scored: false,
      live: null,
    };
  }

  /**
   * Le ballon quitte la main vers `hoop` avec le résultat voulu. Si aucune trajectoire n'existe
   * (cas extrême), il tombe de la main : raté.
   */
  private launch(start: Vec3, made: boolean, hoop: Hoop): void {
    let velocity: Vec3 = { x: 0, y: 0, z: 0 };
    try {
      velocity = solveShot(start, made, this.court, hoop, this.rng).velocity;
    } catch {
      // Position impossible (sous ou derrière la planche) malgré `releasePoint`.
    }
    this.ball = { pos: { ...start }, vel: velocity };
    this.holder = null;
    this.cooldown = WORLD_TUNING.pickupCooldown;
  }

  private tryPickup(): void {
    if (this.cooldown > 0) return;
    const { pos } = this.ball;
    this.players.forEach((body, index) => {
      if (this.holder !== null) return;
      const near = Math.hypot(pos.x - body.pos.x, pos.y - body.pos.y) <= WORLD_TUNING.pickupRadius;
      const reachable = pos.z <= body.pos.z + reach(body.athlete) + WORLD_TUNING.pickupReachMargin;
      if (near && reachable) {
        this.holder = index;
        this.dribbleTime = 0;
        // Rattrapé avant de toucher le parquet (rebond pris en l'air, ballon sous le filet) :
        // le tir est jugé là.
        const shot = this.lastShot;
        if (shot && shot.live === null) shot.live = shot.scored;
      }
    });
  }

  /**
   * Tir de démonstration (debug, touches R/M) : depuis le joueur s'il tient le ballon, sinon
   * depuis un point aléatoire autour du panier de droite. Le résultat est imposé, la physique
   * suit ; il ne compte pas au score.
   */
  demoShot(made: boolean): ShotRecord | null {
    let start: Vec3;
    let hoop: Hoop;
    if (this.holder !== null) {
      const body = this.players[this.holder];
      hoop = targetHoop(this.court, body.pos.x);
      start = releasePoint(body.pos, body.athlete.heightCm, hoop, WORLD_TUNING.handDepth);
    } else {
      hoop = this.court.hoops.right;
      const dist = this.rng.range(1.2, 8.5);
      const angle = this.rng.range(-1.4, 1.4);
      start = {
        x: hoop.rim.x - Math.cos(angle) * dist,
        y: Math.min(this.court.width - 0.4, Math.max(0.4, hoop.rim.y + Math.sin(angle) * dist)),
        z: this.rng.range(2.2, 2.7),
      };
    }
    let velocity: Vec3;
    try {
      velocity = solveShot(start, made, this.court, hoop, this.rng).velocity;
    } catch {
      return null; // position impossible (sous ou derrière la planche)
    }
    this.shot = null;
    this.ball = { pos: { ...start }, vel: velocity };
    this.holder = null;
    this.cooldown = WORLD_TUNING.pickupCooldown;
    const zone = shotZone(this.court, hoop, start.x, start.y);
    this.lastShot = {
      demo: true,
      kind: 'jump',
      zone,
      start,
      distance: distanceToRim(hoop, start.x, start.y),
      three: zone === 'three',
      hoop: hoop.side,
      wanted: made,
      probability: null,
      grade: null,
      timingError: null,
      forced: false,
      scored: false,
      live: null,
    };
    return this.lastShot;
  }
}

/** Pas fixe partagé par le monde et la physique du ballon. */
export const WORLD_DT = BALL_PHYSICS.dt;
