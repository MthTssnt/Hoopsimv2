import { BALL_PHYSICS } from '../physics/ball';
import type { Vec3 } from '../physics/court';

/** La passe côté `match/` : visée, trajectoire, réception (valeurs provisoires, réglables). */
export const PASS_FLOW = {
  /** Cône de visée (°) de part et d'autre de la direction tenue. */
  cone: 60,
  /** À angle proche, la distance départage : (m) de distance valent autant que tout le cône. */
  distanceWeight: 20,
  /** Vitesse horizontale de la passe (m/s), de la pire stat de passe (25) à la meilleure (99). */
  speed: [10, 14],
  /** Le ballon part de la poitrine du passeur et arrive à celle du receveur (part de la taille). */
  chestRatio: 0.62,
  /** Avance donnée au receveur en course : sa vitesse × temps de vol, au plus (m). */
  maxLead: 3,
  /** Délai minimal avant de pouvoir repasser, après une passe ou une réception (s). */
  cooldown: 0.25,
  /** Passe que personne n'a attrapée : ballon libre après (s). */
  maxFlight: 1.6,
} as const;

type Point = { x: number; y: number };

const ratingT = (rating: number) => Math.min(1, Math.max(0, (rating - 25) / 74));

/**
 * Coéquipier visé : le plus aligné avec `dir` dans le cône, le plus proche à angle voisin ; sans
 * personne dans le cône, le plus aligné. `dir` nul : aucun choix possible (null).
 */
export function passTarget(passer: Point, dir: Point, mates: readonly { index: number; pos: Point }[]): number | null {
  const len = Math.hypot(dir.x, dir.y);
  if (len < 1e-6 || mates.length === 0) return null;
  const ux = dir.x / len;
  const uy = dir.y / len;
  let best: { index: number; score: number } | null = null;
  let aligned: { index: number; angle: number } | null = null;
  for (const mate of mates) {
    const dx = mate.pos.x - passer.x;
    const dy = mate.pos.y - passer.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    const angle = (Math.acos(Math.max(-1, Math.min(1, (dx * ux + dy * uy) / d))) * 180) / Math.PI;
    if (!aligned || angle < aligned.angle) aligned = { index: mate.index, angle };
    if (angle > PASS_FLOW.cone) continue;
    const score = angle / PASS_FLOW.cone + d / PASS_FLOW.distanceWeight;
    if (!best || score < best.score) best = { index: mate.index, score };
  }
  return best?.index ?? aligned?.index ?? null;
}

/** Vitesse de la passe selon la stat de passe (25-99). */
export function passSpeed(passing: number): number {
  return PASS_FLOW.speed[0] + (PASS_FLOW.speed[1] - PASS_FLOW.speed[0]) * ratingT(passing);
}

/**
 * Point visé : là où sera le receveur à l'arrivée du ballon (sa vitesse × le temps de vol,
 * avance plafonnée), à hauteur de poitrine.
 */
export function leadPoint(from: Vec3, receiver: { pos: Vec3; vel: Vec3 }, chest: number, speed: number): Vec3 {
  let target = { x: receiver.pos.x, y: receiver.pos.y };
  // Deux itérations suffisent : le temps de vol dépend du point visé.
  for (let i = 0; i < 2; i++) {
    const t = Math.hypot(target.x - from.x, target.y - from.y) / speed;
    let lx = receiver.vel.x * t;
    let ly = receiver.vel.y * t;
    const lead = Math.hypot(lx, ly);
    if (lead > PASS_FLOW.maxLead) {
      lx *= PASS_FLOW.maxLead / lead;
      ly *= PASS_FLOW.maxLead / lead;
    }
    target = { x: receiver.pos.x + lx, y: receiver.pos.y + ly };
  }
  return { x: target.x, y: target.y, z: chest };
}

/** Vitesse de départ d'une passe tendue de `from` à `to`, à `speed` m/s à l'horizontale. */
export function passVelocity(from: Vec3, to: Vec3, speed: number): { vel: Vec3; time: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  const time = Math.max(0.05, d / speed);
  const g = BALL_PHYSICS.gravity;
  return { vel: { x: dx / time, y: dy / time, z: (to.z - from.z) / time + 0.5 * g * time }, time };
}
