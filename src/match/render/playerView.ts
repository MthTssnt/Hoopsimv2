import type { PlayKind } from '../world/MatchWorld';
import type { Point } from './pixelDraw';
import { sheetIndex, type Facing, type Heading } from './sprites/compose';
import { FRAME, type AnimationName } from './sprites/rig';

/** Valeurs provisoires, réglables à l'œil. */
export const PLAYER_VIEW_TUNING = {
  /** Vitesse au sol (m/s) au-delà de laquelle le joueur court. */
  runSpeed: 0.5,
  /** Durée du raccord du ballon entre la main dessinée et sa position physique (ms). */
  ballBlendMs: 80,
  /**
   * Vitesse (m/s) à laquelle la course et le dribble se jouent à leur cadence de base (2 pas en
   * 360 ms, soit des foulées de ~0,9 m) ; plus vite, les pas s'accélèrent pour accrocher le sol.
   */
  strideSpeed: 5,
  /** Bornes de l'accélération des pas. */
  cadence: [0.6, 1.6] as const,
  /** Vue de dos quand le joueur monte : |vy| ≥ pente × |vx| (diagonales comprises). */
  backSlope: 0.4,
} as const;

/**
 * Images fixes en l'air : ballon levé au-dessus de la tête (tir), bras tendu vers le cercle
 * (layup et montée du dunk), bras après le lâcher, accroché au cercle (après le smash), deux bras
 * levés (saut sans le ballon : contre, contestation, rebond).
 */
export const AIR_FRAMES = { withBall: 13, layup: 16, empty: 14, dunkHang: 17, block: 18 } as const;

/** Ce que le monde dit du joueur, réduit à ce qui choisit l'image. */
export interface BodyView {
  airborne: boolean;
  /** Vitesse horizontale (m/s). */
  speed: number;
  holding: boolean;
  /** +1 vers la droite, -1 vers la gauche. */
  facing: number;
  /** Vue courante (voir `nextHeading`). */
  heading: Heading;
  /** Geste en cours (tir, layup ou dunk), ou null. */
  shot?: PlayKind | null;
  /** Il a lâché le ballon pendant ce saut : retombée du tir, bras après le lâcher. */
  followThrough?: boolean;
}

/** Animation en boucle, ou image fixe de la feuille (indice dans un bloc, avant orientation). */
export type SpriteState =
  | { kind: 'anim'; name: AnimationName; facing: Facing; heading: Heading }
  | { kind: 'frame'; frame: number; facing: Facing; heading: Heading };

/**
 * Vue du joueur : de dos dès qu'il monte (diagonales comprises), de profil sinon. À l'arrêt et
 * en l'air, il garde la vue précédente. Un tireur est toujours de profil, tourné vers le panier.
 */
export function nextHeading(previous: Heading, vel: { x: number; y: number }, airborne: boolean, shooting = false): Heading {
  if (shooting) return 'side';
  if (airborne || Math.hypot(vel.x, vel.y) <= PLAYER_VIEW_TUNING.runSpeed) return previous;
  return vel.y < 0 && -vel.y >= PLAYER_VIEW_TUNING.backSlope * Math.abs(vel.x) ? 'back' : 'side';
}

/**
 * Choix de l'image du joueur : au sol, arrêt ou course (dribble avec le ballon) ; en l'air,
 * ballon levé (tir en suspension), bras tendu vers le cercle (layup, montée du dunk), deux bras
 * au cercle après le smash, bras après le lâcher, ou deux bras levés (saut sans le ballon).
 */
export function spriteStateFor(body: BodyView): SpriteState {
  const facing: Facing = body.facing < 0 ? 'left' : 'right';
  const { heading } = body;
  if (body.airborne) {
    let frame: number = body.followThrough ? AIR_FRAMES.empty : AIR_FRAMES.block;
    if (body.holding) frame = body.shot === 'layup' || body.shot === 'dunk' ? AIR_FRAMES.layup : AIR_FRAMES.withBall;
    else if (body.shot === 'dunk') frame = AIR_FRAMES.dunkHang;
    return { kind: 'frame', frame, facing, heading };
  }
  const moving = body.speed > PLAYER_VIEW_TUNING.runSpeed;
  const name: AnimationName = body.holding ? (moving ? 'dribble' : 'dribbleIdle') : moving ? 'run' : 'idle';
  return { kind: 'anim', name, facing, heading };
}

/** Accélération des animations : les pas de course et de dribble suivent la vitesse au sol. */
export function animTimeScale(state: SpriteState, speed: number): number {
  if (state.kind !== 'anim' || (state.name !== 'run' && state.name !== 'dribble')) return 1;
  const [min, max] = PLAYER_VIEW_TUNING.cadence;
  return Math.min(max, Math.max(min, speed / PLAYER_VIEW_TUNING.strideSpeed));
}

/**
 * Dunk : le sprite a la taille de son gabarit, plus petite que la vraie taille du joueur. Pour
 * que ses mains touchent le cercle, il est monté de l'écart (px) entre ses mains (`handY`) et le
 * cercle (`rimY`), proportionnellement à la montée du saut (`progress`, de 0 au sol à 1 au
 * sommet). La physique ne change pas : c'est de la mise en scène, comme le cercle dessiné plus grand.
 */
export function dunkLift(handY: number, rimY: number, progress: number): number {
  return Math.round(Math.max(0, handY - rimY) * Math.min(1, Math.max(0, progress)));
}

/** Indice dans la feuille cuite d'une image fixe. */
export function frameIndex(state: Extract<SpriteState, { kind: 'frame' }>): number {
  return sheetIndex(state.frame, state.facing, state.heading);
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
