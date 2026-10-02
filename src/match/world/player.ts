import { jumpHeight, runSpeed } from '../../engine/athletics';
import type { Player } from '../../engine/types';
import type { Court, Vec3 } from '../physics/court';

/** Valeurs provisoires, réglables à l'œil. */
export const PLAYER_TUNING = {
  /** Accélération et freinage au sol (m/s²) : réactif, façon arcade. */
  accel: 28,
  decel: 34,
  /** Le joueur peut sortir des lignes d'autant (m) : le hors-jeu arrive avec les règles. */
  boundsMargin: 1.5,
} as const;

export interface MoveInput {
  /** Direction voulue, chaque axe dans [-1, 1] (y > 0 : vers le spectateur). */
  x: number;
  y: number;
  /** Saut demandé à ce pas. */
  jump: boolean;
}

export interface PlayerBody {
  athlete: Player;
  /** Position des pieds (z = 0 au sol). */
  pos: Vec3;
  vel: Vec3;
  /** Orientation à l'écran : 1 vers la droite, -1 vers la gauche. */
  facing: 1 | -1;
  runSpeed: number;
  jumpHeight: number;
  /** Gravité du saut, calée pour que le sommet arrive à `timeToApex`. */
  jumpGravity: number;
  timeToApex: number;
  airborne: boolean;
}

export function createPlayerBody(athlete: Player, pos: Vec3, timeToApex: number): PlayerBody {
  const body: PlayerBody = {
    athlete,
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    facing: 1,
    runSpeed: runSpeed(athlete),
    jumpHeight: jumpHeight(athlete),
    jumpGravity: 0,
    timeToApex,
    airborne: false,
  };
  setJumpTiming(body, timeToApex);
  return body;
}

/** Le sommet du saut coïncide avec la jauge de tir : sa durée dépend de la vitesse de tir. */
export function setJumpTiming(body: PlayerBody, timeToApex: number): void {
  body.timeToApex = timeToApex;
  body.jumpGravity = (2 * body.jumpHeight) / (timeToApex * timeToApex);
}

export function stepPlayer(body: PlayerBody, input: MoveInput, dt: number, court: Court): void {
  const { pos, vel } = body;
  if (!body.airborne) {
    // Au sol : on tend vers la vitesse voulue, sans dépasser l'accélération ou le freinage.
    const len = Math.hypot(input.x, input.y);
    const tx = len > 0 ? (input.x / len) * body.runSpeed : 0;
    const ty = len > 0 ? (input.y / len) * body.runSpeed : 0;
    const dx = tx - vel.x;
    const dy = ty - vel.y;
    const gap = Math.hypot(dx, dy);
    const maxStep = (len > 0 ? PLAYER_TUNING.accel : PLAYER_TUNING.decel) * dt;
    const k = gap > maxStep ? maxStep / gap : 1;
    vel.x += dx * k;
    vel.y += dy * k;
    if (input.x !== 0) body.facing = input.x > 0 ? 1 : -1;
    if (input.jump) {
      body.airborne = true;
      vel.z = body.jumpGravity * body.timeToApex;
    }
  }
  // En l'air, on garde l'élan pris au sol.
  if (body.airborne) {
    vel.z -= body.jumpGravity * dt;
    pos.z += vel.z * dt;
    if (pos.z <= 0) {
      pos.z = 0;
      vel.z = 0;
      body.airborne = false;
    }
  }
  const m = PLAYER_TUNING.boundsMargin;
  pos.x = Math.min(court.length + m, Math.max(-m, pos.x + vel.x * dt));
  pos.y = Math.min(court.width + m, Math.max(-m, pos.y + vel.y * dt));
}
