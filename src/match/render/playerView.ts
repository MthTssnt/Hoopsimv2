import type { Point } from './pixelDraw';
import type { Facing } from './sprites/compose';
import { FRAME, FRAMES, type AnimationName } from './sprites/rig';

/** Valeurs provisoires, réglables à l'œil. */
export const PLAYER_VIEW_TUNING = {
  /** Vitesse au sol (m/s) au-delà de laquelle le joueur court. */
  runSpeed: 0.5,
  /** Durée du raccord du ballon entre la main dessinée et sa position physique (ms). */
  ballBlendMs: 80,
} as const;

/** Images fixes en l'air : ballon levé au-dessus de la tête, bras après le lâcher. */
export const AIR_FRAMES = { withBall: 13, empty: 14 } as const;

/** Ce que le monde dit du joueur, réduit à ce qui choisit l'image. */
export interface BodyView {
  airborne: boolean;
  /** Vitesse horizontale (m/s). */
  speed: number;
  holding: boolean;
  /** +1 vers la droite, -1 vers la gauche. */
  facing: number;
}

/** Animation en boucle, ou image fixe de la feuille (indice vers la droite, avant orientation). */
export type SpriteState = { kind: 'anim'; name: AnimationName; facing: Facing } | { kind: 'frame'; frame: number; facing: Facing };

/**
 * Choix de l'image du joueur : au sol, arrêt ou course (dribble avec le ballon) ; en l'air,
 * ballon levé ou bras après le lâcher. Le tir et le dunk animés arrivent avec la jauge.
 */
export function spriteStateFor(body: BodyView): SpriteState {
  const facing: Facing = body.facing < 0 ? 'left' : 'right';
  if (body.airborne) return { kind: 'frame', frame: body.holding ? AIR_FRAMES.withBall : AIR_FRAMES.empty, facing };
  const moving = body.speed > PLAYER_VIEW_TUNING.runSpeed;
  const name: AnimationName = body.holding ? (moving ? 'dribble' : 'dribbleIdle') : moving ? 'run' : 'idle';
  return { kind: 'anim', name, facing };
}

/** Indice dans la feuille cuite : les images tournées vers la gauche suivent celles vers la droite. */
export function frameIndex(frame: number, facing: Facing): number {
  return facing === 'left' ? frame + FRAMES.length : frame;
}

/**
 * Centre du ballon tenu dans le monde (px), d'après le point d'accroche de l'image. Le sprite est
 * posé pieds sur `feet` : origine en bas au centre, une ligne sous la rangée des semelles.
 */
export function heldBallPoint(feet: Point, anchor: Point): Point {
  return { x: feet.x - FRAME.width / 2 + anchor.x, y: feet.y + 1 - FRAME.height + anchor.y };
}

/** Raccord linéaire de `from` vers `to` ; au-delà de la durée, `to` exactement. */
export function blendBall(from: Point, to: Point, elapsedMs: number, durationMs: number = PLAYER_VIEW_TUNING.ballBlendMs): Point {
  if (elapsedMs >= durationMs) return { x: to.x, y: to.y };
  const k = Math.max(0, elapsedMs) / durationMs;
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
