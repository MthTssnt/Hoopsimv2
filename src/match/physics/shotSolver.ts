import type { Rng } from '../../engine/rng';
import { BALL_PHYSICS, stepBall, type BallState } from './ball';
import { RIM_HEIGHT, distanceToRim, type Court, type Hoop, type Vec3 } from './court';

/**
 * Le résultat d'un tir est tiré par `engine/` au lâcher. Le solveur cherche une vitesse
 * initiale dont la trajectoire simulée aboutit exactement à ce résultat : il essaie des
 * visées candidates (seedées) et vérifie chacune par simulation complète.
 */
export const SOLVER_TUNING = {
  maxTries: 30,
  /** Durée maximale simulée pour un candidat (s). */
  maxSimTime: 5,
  /** Un raté doit de préférence retomber à moins de cette distance du cercle (m). */
  reboundRadius: 4,
  /** Visée d'un panier : écart maximal au centre du cercle (m). */
  makeAimSpread: 0.12,
  /** Visée d'un raté : écart au centre, court (cercle avant), long (cercle arrière, planche) ou de côté. */
  missAim: { short: [0.18, 0.34], long: [0.2, 0.4], side: [0.2, 0.32] },
  /** Angle de tir au-dessus de l'horizontale (degrés), plus haut près du cercle. */
  angle: { far: [47, 56], near: [55, 66], nearDistance: 2.2 },
} as const;

export interface ShotOutcome {
  made: boolean;
  /** Premier contact du ballon avec le parquet. */
  landing: { x: number; y: number } | null;
}

export interface ShotPlan extends ShotOutcome {
  velocity: Vec3;
  tries: number;
  /** Aucun candidat aléatoire n'a convenu : visée de repli déterministe. */
  fallback: boolean;
}

/** Vitesse initiale pour que le centre du ballon passe par `target` avec l'angle donné. */
export function launchVelocity(start: Vec3, target: Vec3, angleDeg: number): Vec3 | null {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const dist = Math.hypot(dx, dy);
  const rise = target.z - start.z;
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const denom = 2 * cos * cos * (dist * Math.tan(angle) - rise);
  if (dist < 1e-6 || denom <= 0) return null;
  const speed = Math.sqrt((BALL_PHYSICS.gravity * dist * dist) / denom);
  return {
    x: (speed * cos * dx) / dist,
    y: (speed * cos * dy) / dist,
    z: speed * Math.sin(angle),
  };
}

/** Simule un tir jusqu'au premier contact avec le parquet. `null` si rien n'est décidé à temps. */
export function simulateShot(start: Vec3, velocity: Vec3, court: Court, hoop: Hoop): ShotOutcome | null {
  const ball: BallState = { pos: { ...start }, vel: { ...velocity } };
  let made = false;
  const steps = Math.ceil(SOLVER_TUNING.maxSimTime / BALL_PHYSICS.dt);
  for (let i = 0; i < steps; i++) {
    for (const event of stepBall(ball, court)) {
      if (event.type === 'score' && event.hoop === hoop.side) made = true;
      if (event.type === 'floor') return { made, landing: { x: ball.pos.x, y: ball.pos.y } };
    }
  }
  return null;
}

function aimFor(rng: Rng, start: Vec3, hoop: Hoop, made: boolean): Vec3 {
  const { rim } = hoop;
  // Axe tireur → cercle (horizontal) et sa perpendiculaire.
  const dx = rim.x - start.x;
  const dy = rim.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const fx = dx / len;
  const fy = dy / len;
  let along: number;
  let side: number;
  if (made) {
    const r = SOLVER_TUNING.makeAimSpread * Math.sqrt(rng.next());
    const a = rng.range(0, Math.PI * 2);
    along = r * Math.cos(a);
    side = r * Math.sin(a);
  } else {
    const { short, long, side: lateral } = SOLVER_TUNING.missAim;
    const kind = rng.weightedIndex([0.4, 0.35, 0.25]);
    along = kind === 0 ? -rng.range(short[0], short[1]) : kind === 1 ? rng.range(long[0], long[1]) : rng.range(-0.08, 0.08);
    side = kind === 2 ? (rng.chance(0.5) ? 1 : -1) * rng.range(lateral[0], lateral[1]) : rng.range(-0.1, 0.1);
  }
  return { x: rim.x + fx * along - fy * side, y: rim.y + fy * along + fx * side, z: RIM_HEIGHT };
}

function angleFor(rng: Rng, start: Vec3, hoop: Hoop): number {
  const { far, near, nearDistance } = SOLVER_TUNING.angle;
  const range = distanceToRim(hoop, start.x, start.y) < nearDistance ? near : far;
  return rng.range(range[0], range[1]);
}

/** Visées de repli, essayées dans l'ordre si aucun candidat aléatoire ne convient. */
function fallbackAims(start: Vec3, hoop: Hoop, made: boolean): { target: Vec3; angle: number }[] {
  const { rim } = hoop;
  const len = Math.hypot(rim.x - start.x, rim.y - start.y) || 1;
  const fx = (rim.x - start.x) / len;
  const fy = (rim.y - start.y) / len;
  const at = (along: number): Vec3 => ({ x: rim.x + fx * along, y: rim.y + fy * along, z: RIM_HEIGHT });
  if (made) return [45, 50, 55, 60, 65, 70, 75].map((angle) => ({ target: at(0), angle }));
  return [-0.45, -0.6, 0.55, -0.8].flatMap((along) => [50, 60].map((angle) => ({ target: at(along), angle })));
}

/**
 * Trouve une trajectoire qui produit `made`. Pour un raté, privilégie un rebond qui retombe
 * près du cercle. Le tirage des candidats consomme `rng` : à graine égale, même trajectoire.
 */
export function solveShot(start: Vec3, made: boolean, court: Court, hoop: Hoop, rng: Rng): ShotPlan {
  let backup: ShotPlan | null = null;
  for (let tries = 1; tries <= SOLVER_TUNING.maxTries; tries++) {
    const velocity = launchVelocity(start, aimFor(rng, start, hoop, made), angleFor(rng, start, hoop));
    if (!velocity) continue;
    const outcome = simulateShot(start, velocity, court, hoop);
    if (!outcome || outcome.made !== made) continue;
    const plan: ShotPlan = { ...outcome, velocity, tries, fallback: false };
    const nearRim = outcome.landing && distanceToRim(hoop, outcome.landing.x, outcome.landing.y) <= SOLVER_TUNING.reboundRadius;
    if (made || nearRim) return plan;
    backup ??= plan;
  }
  if (backup) return backup;
  for (const { target, angle } of fallbackAims(start, hoop, made)) {
    const velocity = launchVelocity(start, target, angle);
    if (!velocity) continue;
    const outcome = simulateShot(start, velocity, court, hoop);
    if (outcome && outcome.made === made) return { ...outcome, velocity, tries: SOLVER_TUNING.maxTries, fallback: true };
  }
  throw new Error(`Aucune trajectoire ne donne ${made ? 'un panier' : 'un raté'} depuis (${start.x.toFixed(2)}, ${start.y.toFixed(2)})`);
}
