import { jumpHeight, runSpeed } from '../../engine/athletics';
import type { Player } from '../../engine/types';
import type { Court, Vec3 } from '../physics/court';

/** Valeurs provisoires, réglables à l'œil. */
export const PLAYER_TUNING = {
  /** Accélération au sol (m/s²) : réactif, façon arcade. */
  accel: 28,
  /**
   * Freinage au sol (m/s²) : à l'arrêt, dans un demi-tour et pour la part de la vitesse qui ne va
   * pas dans la direction voulue (virage). Fort, pour que les appuis accrochent le parquet.
   */
  brake: 60,
  /** Part de la vitesse au sol gardée au décollage : un saut en course avance peu. */
  jumpCarry: 0.25,
  /** Distance horizontale maximale parcourue pendant un saut (m), quelle que soit sa durée. */
  jumpMaxDrift: 2,
  /** Le joueur peut sortir des lignes d'autant (m) : au-delà des lignes, c'est une sortie. */
  boundsMargin: 1.5,
  /**
   * Gravité d'un saut sans le ballon (contre, contestation, rebond, entre-deux, m/s²) : la vraie,
   * pour un saut vif. Un saut de tir garde son sommet à la fin de la jauge.
   */
  freeJumpGravity: 9.81,
} as const;

export interface MoveInput {
  /**
   * Direction voulue, chaque axe dans [-1, 1] (y > 0 : vers le spectateur). Une direction plus
   * courte que 1 demande une vitesse réduite (IA qui arrive à sa place, manette analogique) ; le
   * clavier donne toujours la pleine vitesse.
   */
  x: number;
  y: number;
  /** Saut demandé à ce pas. */
  jump: boolean;
  /** Ce saut lance un tir : son sommet tombe à la fin de la jauge (sinon, saut vif sans ballon). */
  shotJump?: boolean;
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
  /** Saut de tir : sommet à `timeToApex` (fin de la jauge), avec cette gravité. */
  shotGravity: number;
  timeToApex: number;
  /** Gravité du saut en cours, fixée au décollage (tir ou saut sans ballon ; relevée pour un dunk). */
  jumpGravity: number;
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
    shotGravity: 0,
    timeToApex,
    jumpGravity: PLAYER_TUNING.freeJumpGravity,
    airborne: false,
  };
  setJumpTiming(body, timeToApex);
  return body;
}

/**
 * Le corps prend les notes de `athlete` (un remplaçant qui entre, ou le même joueur plus fatigué) :
 * vitesse de course et hauteur de saut recalculées ; position, vitesse et saut en cours gardés.
 */
export function setBodyAthlete(body: PlayerBody, athlete: Player): void {
  body.athlete = athlete;
  body.runSpeed = runSpeed(athlete);
  body.jumpHeight = jumpHeight(athlete);
  setJumpTiming(body, body.timeToApex);
}

/** Le sommet d'un saut de tir coïncide avec la jauge : sa durée dépend de la vitesse de tir. */
export function setJumpTiming(body: PlayerBody, timeToApex: number): void {
  body.timeToApex = timeToApex;
  body.shotGravity = (2 * body.jumpHeight) / (timeToApex * timeToApex);
}

/** Durée de la montée d'un saut sans le ballon (s) : même hauteur, gravité réelle. */
export function freeTimeToApex(body: Pick<PlayerBody, 'jumpHeight'>): number {
  return Math.sqrt((2 * body.jumpHeight) / PLAYER_TUNING.freeJumpGravity);
}

/**
 * Vitesse au sol vers la direction voulue : la composante utile accélère (ou freine si elle va à
 * l'envers), le reste s'efface au freinage. Sans direction, le joueur freine jusqu'à l'arrêt.
 */
function steer(body: PlayerBody, input: MoveInput, dt: number): void {
  const { vel } = body;
  const t = PLAYER_TUNING;
  const len = Math.hypot(input.x, input.y);
  if (len === 0) {
    const speed = Math.hypot(vel.x, vel.y);
    const k = speed > 0 ? Math.max(0, speed - t.brake * dt) / speed : 0;
    vel.x *= k;
    vel.y *= k;
    return;
  }
  const ux = input.x / len;
  const uy = input.y / len;
  const wanted = body.runSpeed * Math.min(1, len);
  let along = vel.x * ux + vel.y * uy;
  let px = vel.x - along * ux;
  let py = vel.y - along * uy;
  const side = Math.hypot(px, py);
  if (side > 0) {
    const k = Math.max(0, side - t.brake * dt) / side;
    px *= k;
    py *= k;
  }
  if (along < 0) along = Math.min(0, along + t.brake * dt);
  else if (along < wanted) along = Math.min(wanted, along + t.accel * dt);
  else along = Math.max(wanted, along - t.brake * dt);
  vel.x = along * ux + px;
  vel.y = along * uy + py;
}

export function stepPlayer(body: PlayerBody, input: MoveInput, dt: number, court: Court): void {
  const { pos, vel } = body;
  if (!body.airborne) {
    steer(body, input, dt);
    if (input.x !== 0) body.facing = input.x > 0 ? 1 : -1;
    if (input.jump) {
      body.airborne = true;
      // Saut de tir : sommet à la fin de la jauge ; sans ballon : saut vif, à la gravité réelle.
      body.jumpGravity = input.shotJump ? body.shotGravity : PLAYER_TUNING.freeJumpGravity;
      vel.z = Math.sqrt(2 * body.jumpGravity * body.jumpHeight);
      const apex = vel.z / body.jumpGravity;
      // Élan réduit : une part de la vitesse au sol, sans dépasser la dérive maximale sur le saut.
      const speed = Math.hypot(vel.x, vel.y);
      if (speed > 0) {
        const carried = Math.min(speed * PLAYER_TUNING.jumpCarry, PLAYER_TUNING.jumpMaxDrift / (2 * apex));
        vel.x *= carried / speed;
        vel.y *= carried / speed;
      }
    }
  }
  // En l'air, on garde l'élan pris au décollage (aucun contrôle).
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
