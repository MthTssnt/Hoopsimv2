import type { PlayKind } from '../world/MatchWorld';
import type { Point } from './pixelDraw';
import type { Facing, Heading } from './sprites/compose';
import { gestureFrame, RIG_LAYOUT, sheetIndexIn, type Gesture, type SheetLayout } from './sprites/layout';
import { FRAME, type AnimationName } from './sprites/rig';

/** Valeurs provisoires, réglables à l'œil. */
export const PLAYER_VIEW_TUNING = {
  /** Vitesse au sol (m/s) au-delà de laquelle le joueur court. */
  runSpeed: 0.5,
  /** Durée du raccord du ballon entre la main dessinée et sa position physique (ms). */
  ballBlendMs: 80,
  /**
   * Vitesse (m/s) à laquelle la course et le dribble se jouent à leur cadence de base (2 pas en
   * 600 ms, rendu 2D) ; plus vite, les pas s'accélèrent un peu, plus lentement ils ralentissent.
   */
  strideSpeed: 5,
  /**
   * Bornes de l'accélération des pas : ~3,8 pas par seconde au plus (un sprint réel). Au-delà, les
   * pieds glissent un peu plutôt que de mouliner (décision de Matheo : la course était trop rapide).
   */
  cadence: [0.8, 1.15] as const,
  /** Gestes (ms) : ramassage au décollage, lâcher tenu avant la retombée. */
  gatherMs: 80,
  releaseMs: 200,
  /** Passe : armé, puis bras tendus jusqu'à la fin de la pose ; au-delà de `lobDistance` (m), passe lobée. */
  passCockMs: 90,
  passMs: 250,
  lobDistance: 8,
  /** Réception d'une passe : quand le ballon arrive dans moins de ce temps, et juste après la prise. */
  catchMs: 150,
  /** Réception au sol après un saut. */
  landingMs: 120,
  /** Lancer franc : lâcher sur la pointe des pieds, puis bras tenu jusqu'à la fin. */
  freeThrowReleaseMs: 150,
  freeThrowHoldMs: 400,
  /** Vol : la main tendue pendant la première moitié du geste, puis le bras revient. */
  stealMs: 250,
  /**
   * Position du joueur, toujours en diagonale : au-delà de cet angle (degrés) au-dessus de
   * l'horizontale, diagonale haut (de dos) ; au-delà en dessous, diagonale bas (de face). Entre
   * les deux (course horizontale), il garde sa position : c'est aussi l'hystérésis.
   */
  deadZone: 15,
} as const;

/** Saut sans le ballon (et sans tir) : contre (de la main forte ou de l'autre), rebond, entre-deux. */
export type JumpKind = 'block' | 'blockOff' | 'rebound' | 'tipoff';

/** Phase du saut en cours : temps de vol (s), montée ou descente, hauteur atteinte (0 au sol, 1 au sommet normal). */
export interface AirPhase {
  time: number;
  rising: boolean;
  progress: number;
}

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
  /** Geste du saut en cours (tir, layup ou dunk), gardé jusqu'à l'atterrissage, ou null. */
  shot?: PlayKind | null;
  /** Il a lâché le ballon pendant ce saut : retombée du tir, bras après le lâcher. */
  followThrough?: boolean;
  /** Phase du saut en cours (en l'air). */
  air?: AirPhase | null;
  /** Temps depuis le lâcher du tir pendant ce saut (s). */
  sinceRelease?: number | null;
  /** Saut sans le ballon : ce qu'il fait (choisi selon le jeu autour de lui). */
  jumpKind?: JumpKind | null;
  /** Lancer franc : mise en place (ballon en main), visée (Tir appuyé), ou temps depuis le lâcher (s). */
  freeThrow?: { stage: 'setup' | 'aim' } | { stage: 'after'; since: number } | null;
  /** Temps depuis sa passe (s), et si elle est lobée (longue). */
  sincePass?: number | null;
  lob?: boolean;
  /** Une passe arrive dans ses mains (ou vient d'y arriver). */
  catching?: boolean;
  /** Temps depuis son atterrissage (s). */
  sinceLanding?: number | null;
  /** Temps depuis le début de son geste de vol (s). */
  sinceReach?: number | null;
  /** Déséquilibré après un vol raté. */
  offBalance?: boolean;
}

/** Animation en boucle, ou image `step` d'un geste (voir `SheetLayout`). */
export type SpriteState =
  | { kind: 'anim'; name: AnimationName; facing: Facing; heading: Heading }
  | { kind: 'frame'; gesture: Gesture; step: number; facing: Facing; heading: Heading };

/**
 * Position pour une direction au sol (vitesse, ou direction vers le panier, le receveur, le
 * ballon) : diagonale haut en montant, diagonale bas en descendant ; à l'horizontale (à moins de
 * `deadZone` degrés), la position précédente est gardée. Le côté (gauche ou droite) est celui du
 * corps (`facing`).
 */
export function headingFor(direction: { x: number; y: number }, previous: Heading): Heading {
  // y croît vers la caméra : monter, c'est aller vers les y négatifs.
  const angle = (Math.atan2(-direction.y, Math.abs(direction.x)) * 180) / Math.PI;
  if (angle > PLAYER_VIEW_TUNING.deadZone) return 'up';
  if (angle < -PLAYER_VIEW_TUNING.deadZone) return 'down';
  return previous;
}

/**
 * Position du joueur d'après sa course (voir `headingFor`). À l'arrêt et en l'air, il la garde.
 * Un tireur (tir, layup, dunk) fait face au panier : `faceToward` est la direction du cercle.
 */
export function nextHeading(previous: Heading, vel: { x: number; y: number }, airborne: boolean, faceToward: { x: number; y: number } | null = null): Heading {
  if (faceToward) return headingFor(faceToward, previous);
  if (airborne || Math.hypot(vel.x, vel.y) <= PLAYER_VIEW_TUNING.runSpeed) return previous;
  return headingFor(vel, previous);
}

/** Image `step` d'un geste, selon la phase du saut. */
type Pick = [Gesture, number];

/** En l'air : le geste du saut et son image, selon la phase (montée, sommet, lâcher, descente). */
function airGesture(body: BodyView): Pick {
  const t = PLAYER_VIEW_TUNING;
  const air = body.air ?? { time: 1, rising: false, progress: 1 };
  const gathering = air.time * 1000 < t.gatherMs;
  const released = body.followThrough ?? false;
  const sinceRelease = (body.sinceRelease ?? 1) * 1000;
  switch (body.shot) {
    case 'dunk':
      // Ramassage, armé derrière la tête en montant, smash au sommet, puis l'accroche au cercle.
      if (!body.holding) return ['dunk', 3];
      return ['dunk', gathering ? 0 : air.rising && air.progress < 0.7 ? 1 : 2];
    case 'layup':
      if (body.holding) return ['layup', gathering ? 0 : air.rising && air.progress < 0.5 ? 1 : 2];
      if (released) return ['layup', 3];
      break;
    case 'jump':
      if (body.holding) return ['jumpShot', gathering ? 0 : air.rising && air.progress < 0.6 ? 1 : 2];
      if (released) return ['jumpShot', sinceRelease < t.releaseMs || air.rising ? 3 : 4];
      break;
  }
  // Ballon pris en l'air (rebond) : serré sous le menton.
  if (body.holding) return ['rebound', 1];
  if (released) return ['jumpShot', 4];
  switch (body.jumpKind) {
    case 'block':
    case 'blockOff':
      return [body.jumpKind, air.rising && air.progress < 0.5 ? 0 : 1];
    case 'tipoff':
      return ['tipoff', 0];
    default:
      return ['rebound', 0];
  }
}

/** Au sol : un geste en cours (lancer, vol, déséquilibre, passe, réception), ou null. */
function groundGesture(body: BodyView): Pick | null {
  const t = PLAYER_VIEW_TUNING;
  const ft = body.freeThrow;
  if (ft) {
    if (ft.stage === 'setup') return ['freeThrow', 0];
    if (ft.stage === 'aim') return ['freeThrow', 1];
    if (ft.stage === 'after' && ft.since * 1000 < t.freeThrowHoldMs) return ['freeThrow', ft.since * 1000 < t.freeThrowReleaseMs ? 2 : 3];
  }
  if (body.sinceReach != null && body.sinceReach * 1000 < t.stealMs) return ['steal', body.sinceReach * 1000 < t.stealMs / 2 ? 0 : 1];
  if (body.offBalance) return ['offBalance', 0];
  if (body.sincePass != null && body.sincePass * 1000 < t.passMs) return [body.lob ? 'lobPass' : 'pass', body.sincePass * 1000 < t.passCockMs ? 0 : 1];
  if (body.catching) return ['catch', 0];
  if (!body.holding && body.sinceLanding != null && body.sinceLanding * 1000 < t.landingMs) return ['landing', 0];
  return null;
}

/**
 * Choix de l'image du joueur : chaque geste a ses propres images, choisies selon l'état du monde.
 * - en l'air : tir en suspension, layup, dunk (selon la phase du saut et le lâcher), ou, sans le
 *   ballon, contre, rebond, entre-deux ;
 * - au sol : lancer franc, vol, déséquilibre, passe (lobée si longue), réception d'une passe,
 *   réception au sol ; sinon arrêt ou course (dribble avec le ballon).
 */
export function spriteStateFor(body: BodyView): SpriteState {
  const facing: Facing = body.facing < 0 ? 'left' : 'right';
  const { heading } = body;
  const pick = body.airborne ? airGesture(body) : groundGesture(body);
  if (pick) return { kind: 'frame', gesture: pick[0], step: pick[1], facing, heading };
  const moving = body.speed > PLAYER_VIEW_TUNING.runSpeed;
  const name: AnimationName = body.holding ? (moving ? 'dribble' : 'dribbleIdle') : moving ? 'run' : 'idle';
  return { kind: 'anim', name, facing, heading };
}

/**
 * Contre : le défenseur, face au tireur, lève la main en face de la main de tir adverse (contre un
 * droitier, sa main gauche). C'est sa main forte (`block`) ou l'autre (`blockOff`).
 */
export function blockGesture(shooterHand: 'droite' | 'gauche', defenderHand: 'droite' | 'gauche'): 'block' | 'blockOff' {
  const raised = shooterHand === 'droite' ? 'gauche' : 'droite';
  return raised === defenderHand ? 'block' : 'blockOff';
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

/** Indice dans la feuille cuite (de disposition `layout`) de l'image d'un geste. */
export function frameIndex(state: Extract<SpriteState, { kind: 'frame' }>, layout: SheetLayout = RIG_LAYOUT): number {
  return sheetIndexIn(layout, gestureFrame(layout, state.gesture, state.step), state.facing, state.heading);
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
