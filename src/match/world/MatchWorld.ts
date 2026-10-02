import { reach } from '../../engine/athletics';
import type { Rng } from '../../engine/rng';
import type { Player } from '../../engine/types';
import { BALL_PHYSICS, stepBall, type BallState } from '../physics/ball';
import { BALL_RADIUS, distanceToRim, isThreePoint, type Court, type Vec3 } from '../physics/court';
import { solveShot } from '../physics/shotSolver';
import { createPlayerBody, setJumpTiming, stepPlayer, type MoveInput, type PlayerBody } from './player';

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

export interface DemoShot {
  start: Vec3;
  wanted: boolean;
  distance: number;
  three: boolean;
  /** Panier marqué avant le premier contact avec le parquet. */
  scored: boolean;
  /** Résultat observé en direct (null tant que le ballon n'a pas touché le sol). */
  live: boolean | null;
}

export class MatchWorld {
  court: Court;
  readonly players: PlayerBody[] = [];
  controlled = 0;
  ball: BallState;
  /** Index du joueur qui tient le ballon, ou null s'il est libre. */
  holder: number | null = null;
  lastShot: DemoShot | null = null;
  private readonly rng: Rng;
  private dribbleTime = 0;
  private cooldown = 0;

  constructor(court: Court, athlete: Player, start: Vec3, timeToApex: number, rng: Rng) {
    this.court = court;
    this.rng = rng;
    this.players.push(createPlayerBody(athlete, start, timeToApex));
    this.holder = 0;
    this.ball = { pos: this.handPosition(this.players[0]), vel: { x: 0, y: 0, z: 0 } };
  }

  get player(): PlayerBody {
    return this.players[this.controlled];
  }

  /** Change le joueur contrôlé en gardant sa position. */
  setAthlete(athlete: Player): void {
    const old = this.player;
    const body = createPlayerBody(athlete, old.pos, old.timeToApex);
    body.facing = old.facing;
    this.players[this.controlled] = body;
  }

  setJumpTiming(timeToApex: number): void {
    for (const body of this.players) setJumpTiming(body, timeToApex);
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

  step(dt: number, input: MoveInput): void {
    stepPlayer(this.player, input, dt, this.court);
    this.cooldown = Math.max(0, this.cooldown - dt);

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
      if (event.type === 'score') shot.scored = true;
      if (event.type === 'floor') shot.live = shot.scored;
    }
    this.tryPickup();
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
      }
    });
  }

  /**
   * Tir de démonstration (avant la jauge de l'incrément 5) : depuis le joueur s'il tient le
   * ballon, sinon depuis un point aléatoire. Le résultat est fixé d'abord, la physique suit.
   */
  demoShot(made: boolean): DemoShot | null {
    const hoop = this.court.hoops.right;
    let start: Vec3;
    if (this.holder !== null) {
      const body = this.players[this.holder];
      start = { x: body.pos.x, y: body.pos.y + WORLD_TUNING.handDepth, z: body.pos.z + (body.athlete.heightCm / 100) * 1.15 };
    } else {
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
    this.ball = { pos: { ...start }, vel: velocity };
    this.holder = null;
    this.cooldown = WORLD_TUNING.pickupCooldown;
    this.lastShot = {
      start,
      wanted: made,
      distance: distanceToRim(hoop, start.x, start.y),
      three: isThreePoint(this.court, hoop, start.x, start.y),
      scored: false,
      live: null,
    };
    return this.lastShot;
  }
}

/** Pas fixe partagé par le monde et la physique du ballon. */
export const WORLD_DT = BALL_PHYSICS.dt;
