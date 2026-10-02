import type { Rng } from '../../engine/rng';
import { BALL_RADIUS, RIM_HEIGHT, type Hoop, type Vec3 } from '../physics/court';

/** Contre, faute et goaltending côté `match/` : mesures et mise en scène (valeurs réglables). */
export const DEFENSE_FLOW = {
  /** Épaule : part de la taille au-dessus des pieds. Le bras va de l'épaule à la main levée (`reach`). */
  shoulderRatio: 0.82,
  /** Le bras levé vise le ballon, mais pas plus bas que cet angle au-dessus de l'horizontale (°). */
  minElevation: 20,
  /** Qualité du contact : 0 au bout des doigts, 1 quand le ballon est au moins d'autant dans la portée (m). */
  graze: 0.25,
  /** Contact des corps pour une faute : distance horizontale (m) ; les corps ne descendent jamais sous 0,7 m. */
  contactRange: 0.75,
  /** Goaltending : ballon au-dessus du cercle, à au plus ce rayon horizontal de son centre (m). */
  goaltendRadius: 1,
  /** Ballon frappé (contre, goaltending) : vitesse horizontale et verticale (m/s), écart d'angle (°). */
  swatSpeed: [4, 7],
  swatLift: [-1.5, 1.5],
  swatSpread: 35,
  /** Personne ne peut ramasser le ballon frappé pendant ce délai (s). */
  swatCooldown: 0.3,
  /** Faute puis tir raté : ballon mort avant la remise en jeu (s). */
  foulPause: 1,
} as const;

type Point = { x: number; y: number };

export interface ArmContact {
  /** Distance du centre du ballon à l'épaule (m). */
  distance: number;
  /** 0 = le ballon effleure le bout des doigts, 1 = pris en plein. */
  quality: number;
}

/**
 * Le bras levé d'un joueur atteint-il le ballon ? La main peut viser le ballon dans un cône
 * au-dessus de l'épaule (jamais à l'horizontale : ce serait un bras tendu devant, pas un contre),
 * jusqu'à la hauteur de main levée `reachM` mesurée depuis les pieds.
 */
export function armContact(feet: Vec3, heightCm: number, reachM: number, ball: Vec3): ArmContact | null {
  const shoulderHeight = (heightCm / 100) * DEFENSE_FLOW.shoulderRatio;
  const arm = reachM - shoulderHeight;
  const dx = ball.x - feet.x;
  const dy = ball.y - feet.y;
  const dz = ball.z - (feet.z + shoulderHeight);
  const distance = Math.hypot(dx, dy, dz);
  const limit = arm + BALL_RADIUS;
  if (distance > limit) return null;
  if (distance > 1e-6 && Math.asin(dz / distance) < (DEFENSE_FLOW.minElevation * Math.PI) / 180) return null;
  return { distance, quality: Math.min(1, Math.max(0, (limit - distance) / DEFENSE_FLOW.graze)) };
}

/**
 * Contact des corps pendant un tir, mesuré pour `foulOnContact` : recouvrement (m) sous la
 * distance de contact, vitesse du défenseur vers le tireur (m/s). null s'ils ne se touchent pas.
 */
export function bodyContact(defender: { pos: Vec3; vel: Vec3 }, shooter: { pos: Vec3 }): { overlap: number; approachSpeed: number } | null {
  const dx = shooter.pos.x - defender.pos.x;
  const dy = shooter.pos.y - defender.pos.y;
  const distance = Math.hypot(dx, dy);
  if (distance > DEFENSE_FLOW.contactRange) return null;
  const approachSpeed = distance < 1e-6 ? 0 : Math.max(0, (defender.vel.x * dx + defender.vel.y * dy) / distance);
  return { overlap: DEFENSE_FLOW.contactRange - distance, approachSpeed };
}

/** Le ballon redescend au-dessus du cercle, assez près de lui pour avoir une chance d'entrer. */
export function inGoaltendZone(hoop: Hoop, ball: { pos: Vec3; vel: Vec3 }): boolean {
  const { pos, vel } = ball;
  return vel.z < 0 && pos.z > RIM_HEIGHT + BALL_RADIUS && Math.hypot(pos.x - hoop.rim.x, pos.y - hoop.rim.y) <= DEFENSE_FLOW.goaltendRadius;
}

/**
 * Ballon frappé par une main (contre, goaltending) : il part en s'éloignant du joueur qui le
 * frappe (ou vers `fallback` si le ballon est juste au-dessus de lui), avec un angle seedé.
 */
export function swatVelocity(from: Point, ball: Vec3, fallback: Point, rng: Rng): Vec3 {
  let dx = ball.x - from.x;
  let dy = ball.y - from.y;
  if (Math.hypot(dx, dy) < 0.15) {
    dx = fallback.x - from.x;
    dy = fallback.y - from.y;
  }
  const len = Math.hypot(dx, dy) || 1;
  const t = DEFENSE_FLOW;
  const angle = Math.atan2(dy / len, dx / len) + (rng.range(-1, 1) * t.swatSpread * Math.PI) / 180;
  const speed = rng.range(t.swatSpeed[0], t.swatSpeed[1]);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: rng.range(t.swatLift[0], t.swatLift[1]) };
}
