import type { Rng } from '../../engine/rng';
import { RIM_HEIGHT, type Court, type Hoop, type Vec3 } from './court';
import { simulateShot, type ShotOutcome } from './shotSolver';

/** Smash (valeurs provisoires, réglables à l'œil). */
export const DUNK_PHYSICS = {
  /** Hauteur du centre du ballon au-dessus du cercle au moment du smash (m). */
  above: 0.2,
  /** Vitesse du smash vers le bas (m/s). */
  downSpeed: 4,
  /** Dunk réussi : écart maximal au centre du cercle (m). */
  makeSpread: 0.05,
  /** Dunk raté : le ballon frappe le fer à cette distance du centre (m)… */
  missOffset: [0.18, 0.28],
  /** …poussé vers l'extérieur à cette vitesse (m/s). */
  missPush: [0.4, 1.4],
  /** Part des ratés sur le fer avant (côté d'où vient le joueur), le reste sur le fer arrière. */
  frontShare: 0.6,
  maxTries: 20,
  /** Un raté doit retomber à moins de cette distance du cercle (m). */
  reboundRadius: 4,
  /** Repli d'un raté : ballon lâché à côté du cercle, hors du fer (m du centre). */
  fallbackOffset: 0.5,
} as const;

export interface DunkPlan {
  start: Vec3;
  velocity: Vec3;
  outcome: ShotOutcome;
  /** Aucun candidat aléatoire n'a convenu : smash de repli déterministe. */
  fallback: boolean;
}

/** Direction horizontale du cercle vers le joueur (côté du fer avant). */
function approachDirection(hoop: Hoop, from: { x: number; y: number }): { x: number; y: number } {
  const dx = from.x - hoop.rim.x;
  const dy = from.y - hoop.rim.y;
  const len = Math.hypot(dx, dy);
  return len > 1e-6 ? { x: dx / len, y: dy / len } : { x: hoop.toCourt, y: 0 };
}

/**
 * Smash au-dessus du cercle qui aboutit au résultat tiré par `engine/` : réussi, le ballon
 * traverse le cercle ; raté, il frappe le fer avant ou arrière et rebondit dehors. Chaque
 * candidat (seedé) est vérifié par simulation ; un repli déterministe garantit le résultat.
 * `from` : position horizontale d'où vient le joueur.
 */
export function solveDunk(made: boolean, hoop: Hoop, from: { x: number; y: number }, court: Court, rng: Rng): DunkPlan {
  const { rim } = hoop;
  const z = RIM_HEIGHT + DUNK_PHYSICS.above;
  const dir = approachDirection(hoop, from);
  const down = -DUNK_PHYSICS.downSpeed;
  for (let i = 0; i < DUNK_PHYSICS.maxTries; i++) {
    let start: Vec3;
    let velocity: Vec3;
    if (made) {
      const r = DUNK_PHYSICS.makeSpread * Math.sqrt(rng.next());
      const a = rng.range(0, Math.PI * 2);
      start = { x: rim.x + Math.cos(a) * r, y: rim.y + Math.sin(a) * r, z };
      velocity = { x: 0, y: 0, z: down };
    } else {
      const side = rng.chance(DUNK_PHYSICS.frontShare) ? 1 : -1;
      const r = rng.range(DUNK_PHYSICS.missOffset[0], DUNK_PHYSICS.missOffset[1]);
      const push = rng.range(DUNK_PHYSICS.missPush[0], DUNK_PHYSICS.missPush[1]);
      start = { x: rim.x + dir.x * side * r, y: rim.y + dir.y * side * r, z };
      velocity = { x: dir.x * side * push, y: dir.y * side * push, z: down };
    }
    const outcome = simulateShot(start, velocity, court, hoop);
    if (!outcome || outcome.made !== made) continue;
    if (!made) {
      const landing = outcome.landing;
      if (!landing || Math.hypot(landing.x - rim.x, landing.y - rim.y) > DUNK_PHYSICS.reboundRadius) continue;
    }
    return { start, velocity, outcome, fallback: false };
  }
  // Repli : en plein centre pour un dunk réussi, à côté du fer pour un raté.
  const offset = made ? 0 : DUNK_PHYSICS.fallbackOffset;
  const start = { x: rim.x + dir.x * offset, y: rim.y + dir.y * offset, z };
  const velocity = { x: 0, y: 0, z: down };
  const outcome = simulateShot(start, velocity, court, hoop) ?? { made, landing: null };
  return { start, velocity, outcome, fallback: true };
}
