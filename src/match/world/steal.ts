import type { Rng } from '../../engine/rng';
import type { Vec3 } from '../physics/court';

/** Vol sur le porteur et ligne de passe côté `match/` : mesures et mise en scène (valeurs réglables). */
export const STEAL_FLOW = {
  /** Geste de vol : ballon à bonne distance de la main (m, à l'horizontale, depuis le centre du défenseur)… */
  reachBest: 0.8,
  /** …au bout des doigts jusqu'à (m) ; au-delà, le geste est dans le vide. */
  reachMax: 1.05,
  /** Ballon plus haut que (m) : hors de portée d'un geste de vol (ballon levé pour tirer). */
  maxBallHeight: 1.6,
  /** Corps plus près que (m) : trop près, le rapprochement compte pour la faute. */
  closeRange: 0.85,
  /** Délai entre deux gestes (s), déséquilibre après un geste raté (s) et vitesse gardée pendant. */
  cooldown: 0.6,
  offBalance: 0.3,
  offBalanceSpeed: 0.3,
  /** A appuyé : bras allongé pendant (s), pour couper une passe. */
  gesture: 0.25,
  /** Ballon arraché : vitesse (m/s) vers le défenseur, montée (m/s), écart d'angle (°), délai avant ramassage (s). */
  pokeSpeed: [2.5, 4],
  pokeLift: [0.5, 1.5],
  pokeSpread: 30,
  pokeCooldown: 0.12,
  /** Ligne de passe : portée du corps et des mains au sol (m), bras allongé (m), ballon au-dessus de (m). */
  laneReach: 0.55,
  laneReachExtended: 0.85,
  laneMinHeight: 0.35,
  /** Passe déviée : vitesse (m/s), montée (m/s), délai avant ramassage (s). */
  deflectSpeed: [2, 4],
  deflectLift: [0, 2],
  deflectCooldown: 0.15,
} as const;

type Point = { x: number; y: number };

export interface StealMeasure {
  /** Distance horizontale du défenseur au ballon (m). */
  distance: number;
  /** Qualité de la main : 1 à bonne distance, 0 au bout des doigts. */
  reach: number;
  /** 1 : ballon du côté du défenseur ; 0 : caché derrière le corps du porteur. */
  exposed: number;
  /** Rapprochement des corps sous `closeRange` (m). */
  closeness: number;
}

/**
 * Mesure d'un geste de vol sur le porteur, à l'appui : null si le ballon est hors de portée
 * (geste dans le vide).
 */
export function measureSteal(defender: Vec3, holder: Vec3, ball: Vec3): StealMeasure | null {
  if (ball.z > STEAL_FLOW.maxBallHeight) return null;
  const distance = Math.hypot(ball.x - defender.x, ball.y - defender.y);
  if (distance > STEAL_FLOW.reachMax) return null;
  const reach = distance <= STEAL_FLOW.reachBest ? 1 : 1 - (distance - STEAL_FLOW.reachBest) / (STEAL_FLOW.reachMax - STEAL_FLOW.reachBest);
  const closeness = Math.max(0, STEAL_FLOW.closeRange - Math.hypot(defender.x - holder.x, defender.y - holder.y));
  return { distance, reach, exposed: ballExposure(defender, holder, ball), closeness };
}

/** Exposition du ballon tenu : 1 s'il est tourné vers le défenseur, 0 s'il est caché derrière le porteur. */
export function ballExposure(defender: Point, holder: Point, ball: Point): number {
  const bx = ball.x - holder.x;
  const by = ball.y - holder.y;
  const dx = defender.x - holder.x;
  const dy = defender.y - holder.y;
  const lb = Math.hypot(bx, by);
  const ld = Math.hypot(dx, dy);
  const cos = lb < 1e-6 || ld < 1e-6 ? 0 : (bx * dx + by * dy) / (lb * ld);
  return Math.min(1, Math.max(0, 0.5 + 0.5 * cos));
}

/**
 * Le corps ou les mains d'un défenseur (au sol ou en l'air, hauteurs comptées depuis ses pieds)
 * sont-ils sur la trajectoire d'une passe ? La qualité dit à quel point la passe lui arrive dessus :
 * 1 si sa trajectoire passe en plein sur lui, 0 si elle frôle le bord de sa portée (plus longue
 * bras allongé). Elle se mesure au point de passage le plus proche, pas à l'entrée dans la portée.
 */
export function laneContact(defender: Vec3, reachM: number, ball: Vec3, extended: boolean, ballVel?: { x: number; y: number }): { quality: number } | null {
  if (ball.z < defender.z + STEAL_FLOW.laneMinHeight || ball.z > defender.z + reachM) return null;
  const radius = extended ? STEAL_FLOW.laneReachExtended : STEAL_FLOW.laneReach;
  const dx = defender.x - ball.x;
  const dy = defender.y - ball.y;
  const d = Math.hypot(dx, dy);
  if (d > radius) return null;
  let closest = d;
  const speed = ballVel ? Math.hypot(ballVel.x, ballVel.y) : 0;
  if (ballVel && speed > 1e-6 && dx * ballVel.x + dy * ballVel.y > 0) {
    // Le ballon arrive encore vers lui : distance de passage = écart à sa trajectoire.
    closest = Math.abs(dx * ballVel.y - dy * ballVel.x) / speed;
  }
  return { quality: 1 - closest / radius };
}

/** Ballon arraché : il part du porteur vers le défenseur, avec un angle seedé. */
export function pokeVelocity(holder: Point, defender: Point, rng: Rng): Vec3 {
  const t = STEAL_FLOW;
  const angle = Math.atan2(defender.y - holder.y, defender.x - holder.x) + (rng.range(-1, 1) * t.pokeSpread * Math.PI) / 180;
  const speed = rng.range(t.pokeSpeed[0], t.pokeSpeed[1]);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: rng.range(t.pokeLift[0], t.pokeLift[1]) };
}

/** Passe déviée : direction quelconque (seedée), plus lente qu'un contre. */
export function deflectVelocity(rng: Rng): Vec3 {
  const t = STEAL_FLOW;
  const angle = rng.range(0, Math.PI * 2);
  const speed = rng.range(t.deflectSpeed[0], t.deflectSpeed[1]);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: rng.range(t.deflectLift[0], t.deflectLift[1]) };
}
