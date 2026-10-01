import {
  BALL_RADIUS,
  RIM_HEIGHT,
  RIM_RADIUS,
  RIM_TUBE,
  type Court,
  type Hoop,
  type HoopSide,
  type Vec3,
} from './court';

/** Valeurs provisoires, réglables à l'œil (pas encore de mesures Hoop Land). */
export const BALL_PHYSICS = {
  gravity: 9.81,
  /** Pas fixe de la simulation (s). */
  dt: 1 / 120,
  floor: {
    restitution: 0.78,
    /** Vitesse horizontale conservée à chaque rebond. */
    friction: 0.88,
    /** En dessous de cette vitesse verticale (m/s), le ballon ne rebondit plus : il roule. */
    restSpeed: 0.35,
    /** Décélération du ballon qui roule (m/s²). */
    rollDecel: 0.9,
  },
  rim: { restitution: 0.55, tangentKeep: 0.92 },
  board: { restitution: 0.62, tangentKeep: 0.9 },
  /** Le filet freine le ballon qui traverse le cercle. */
  net: { horizontalKeep: 0.35, verticalKeep: 0.6 },
  /** Murs invisibles autour du terrain : le ballon reste récupérable. */
  wallMargin: 2,
  wallRestitution: 0.4,
} as const;

export interface BallState {
  pos: Vec3;
  vel: Vec3;
}

export type BallEvent =
  | { type: 'score'; hoop: HoopSide }
  | { type: 'rim'; hoop: HoopSide }
  | { type: 'board'; hoop: HoopSide }
  | { type: 'floor'; speed: number };

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function isOnFloor(ball: BallState): boolean {
  return ball.pos.z <= BALL_RADIUS + 1e-6 && ball.vel.z === 0;
}

export function isAtRest(ball: BallState): boolean {
  return isOnFloor(ball) && ball.vel.x === 0 && ball.vel.y === 0;
}

/**
 * Résout un contact sphère / obstacle : `n` est le vecteur obstacle → centre du ballon,
 * `minDist` la distance de contact. Repousse le ballon et fait rebondir sa vitesse.
 */
function bounce(ball: BallState, nx: number, ny: number, nz: number, minDist: number, restitution: number, tangentKeep: number): boolean {
  const dist = Math.hypot(nx, ny, nz);
  if (dist >= minDist || dist < 1e-9) return false;
  nx /= dist;
  ny /= dist;
  nz /= dist;
  const push = minDist - dist;
  ball.pos.x += nx * push;
  ball.pos.y += ny * push;
  ball.pos.z += nz * push;
  const v = ball.vel;
  const vn = v.x * nx + v.y * ny + v.z * nz;
  if (vn < 0) {
    const tx = v.x - vn * nx;
    const ty = v.y - vn * ny;
    const tz = v.z - vn * nz;
    v.x = tx * tangentKeep - restitution * vn * nx;
    v.y = ty * tangentKeep - restitution * vn * ny;
    v.z = tz * tangentKeep - restitution * vn * nz;
  }
  return true;
}

/** Le fer du cercle est un anneau horizontal : on cherche son point le plus proche du ballon. */
function collideRim(ball: BallState, hoop: Hoop): boolean {
  const { rim } = hoop;
  const dx = ball.pos.x - rim.x;
  const dy = ball.pos.y - rim.y;
  const rho = Math.hypot(dx, dy);
  const ux = rho > 1e-9 ? dx / rho : 1;
  const uy = rho > 1e-9 ? dy / rho : 0;
  const ring = RIM_RADIUS + RIM_TUBE;
  const nx = ball.pos.x - (rim.x + ux * ring);
  const ny = ball.pos.y - (rim.y + uy * ring);
  const nz = ball.pos.z - rim.z;
  const { restitution, tangentKeep } = BALL_PHYSICS.rim;
  return bounce(ball, nx, ny, nz, BALL_RADIUS + RIM_TUBE, restitution, tangentKeep);
}

function collideBoard(ball: BallState, hoop: Hoop): boolean {
  const { min, max } = hoop.board;
  const p = ball.pos;
  let nx = p.x - clamp(p.x, min.x, max.x);
  const ny = p.y - clamp(p.y, min.y, max.y);
  const nz = p.z - clamp(p.z, min.z, max.z);
  // Centre du ballon dans la planche (cas extrême) : on le renvoie côté terrain.
  if (nx === 0 && ny === 0 && nz === 0) nx = hoop.toCourt * 1e-6;
  const { restitution, tangentKeep } = BALL_PHYSICS.board;
  return bounce(ball, nx, ny, nz, BALL_RADIUS, restitution, tangentKeep);
}

function collideWalls(ball: BallState, court: Court): void {
  const m = BALL_PHYSICS.wallMargin;
  const e = BALL_PHYSICS.wallRestitution;
  const { pos, vel } = ball;
  const minX = -m + BALL_RADIUS;
  const maxX = court.length + m - BALL_RADIUS;
  const minY = -m + BALL_RADIUS;
  const maxY = court.width + m - BALL_RADIUS;
  if (pos.x < minX) [pos.x, vel.x] = [minX, Math.abs(vel.x) * e];
  if (pos.x > maxX) [pos.x, vel.x] = [maxX, -Math.abs(vel.x) * e];
  if (pos.y < minY) [pos.y, vel.y] = [minY, Math.abs(vel.y) * e];
  if (pos.y > maxY) [pos.y, vel.y] = [maxY, -Math.abs(vel.y) * e];
}

/** Avance le ballon d'un pas fixe et renvoie ce qui s'est passé pendant ce pas. */
export function stepBall(ball: BallState, court: Court, dt: number = BALL_PHYSICS.dt): BallEvent[] {
  const events: BallEvent[] = [];
  const { pos, vel } = ball;
  const prevZ = pos.z;

  if (isOnFloor(ball)) {
    // Ballon qui roule : il ralentit jusqu'à s'arrêter.
    const speed = Math.hypot(vel.x, vel.y);
    const next = Math.max(0, speed - BALL_PHYSICS.floor.rollDecel * dt);
    const k = speed > 0 ? next / speed : 0;
    vel.x *= k;
    vel.y *= k;
  } else {
    vel.z -= BALL_PHYSICS.gravity * dt;
  }
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;

  for (const hoop of [court.hoops.left, court.hoops.right]) {
    // Panier : le centre du ballon traverse le plan du cercle vers le bas, à l'intérieur du fer.
    if (prevZ >= RIM_HEIGHT && pos.z < RIM_HEIGHT && vel.z < 0) {
      const t = (prevZ - RIM_HEIGHT) / (prevZ - pos.z);
      const cx = pos.x - vel.x * dt * (1 - t);
      const cy = pos.y - vel.y * dt * (1 - t);
      if (Math.hypot(cx - hoop.rim.x, cy - hoop.rim.y) < RIM_RADIUS) {
        events.push({ type: 'score', hoop: hoop.side });
        vel.x *= BALL_PHYSICS.net.horizontalKeep;
        vel.y *= BALL_PHYSICS.net.horizontalKeep;
        vel.z *= BALL_PHYSICS.net.verticalKeep;
      }
    }
    if (collideRim(ball, hoop)) events.push({ type: 'rim', hoop: hoop.side });
    if (collideBoard(ball, hoop)) events.push({ type: 'board', hoop: hoop.side });
  }

  if (pos.z < BALL_RADIUS) {
    pos.z = BALL_RADIUS;
    if (vel.z < 0) {
      const impact = -vel.z;
      const up = impact * BALL_PHYSICS.floor.restitution;
      vel.z = up < BALL_PHYSICS.floor.restSpeed ? 0 : up;
      vel.x *= BALL_PHYSICS.floor.friction;
      vel.y *= BALL_PHYSICS.floor.friction;
      events.push({ type: 'floor', speed: impact });
    }
  }
  collideWalls(ball, court);
  return events;
}
