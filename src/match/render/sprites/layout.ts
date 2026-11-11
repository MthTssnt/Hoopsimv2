/**
 * Disposition d'une feuille de sprites cuite : combien d'images par bloc (une position), quelles
 * images forment chaque animation en boucle, et les images de chaque geste. Le rig (ancien rendu,
 * `&sprites=ancien`) et le rendu 2D (`sheet2d.ts`) ont chacun la leur ; le choix de l'image
 * (`spriteStateFor`) ne parle que de noms. Pur, sans Phaser.
 */
import { SHEET_VIEWS, type Facing, type Heading, type AnimationName } from './views';

export interface AnimationDef {
  frames: readonly number[];
  durations: readonly number[];
  loop: boolean;
}

/**
 * Gestes : chacun a ses propres images, jouées selon l'état du monde (phase du saut, temps
 * écoulé depuis la passe…), jamais par une horloge fixe.
 * - `jumpShot` : ramassage, montée, point de déclenchement, lâcher (col de cygne), retombée ;
 * - `layup` : deuxième appui, envol (genou côté main forte), extension vers le cercle, après le lâcher ;
 * - `dunk` : ramassage, armé derrière la tête, smash, accroche au cercle ;
 * - `block` / `blockOff` : impulsion, verticalité d'une main (la main forte, ou l'autre) ;
 * - `rebound` : deux mains hautes, ballon sous le menton ;
 * - `tipoff` : un bras tendu au maximum ;
 * - `pass` : armé à la poitrine, bras tendus pouces vers le bas ;
 * - `lobPass` : ballon au-dessus de la tête, bras qui fouettent ;
 * - `catch` : mains en cible devant la poitrine ;
 * - `freeThrow` : mise en place, point de déclenchement, lâcher sur la pointe des pieds, bras tenu ;
 * - `landing` : genoux fléchis à la réception ;
 * - `steal` : main tendue basse vers le ballon, bras qui revient ;
 * - `offBalance` : buste rejeté, bras écartés, un pied levé.
 */
export type Gesture =
  | 'jumpShot'
  | 'layup'
  | 'dunk'
  | 'block'
  | 'blockOff'
  | 'rebound'
  | 'tipoff'
  | 'pass'
  | 'lobPass'
  | 'catch'
  | 'freeThrow'
  | 'landing'
  | 'steal'
  | 'offBalance';

export const GESTURES: readonly Gesture[] = ['jumpShot', 'layup', 'dunk', 'block', 'blockOff', 'rebound', 'tipoff', 'pass', 'lobPass', 'catch', 'freeThrow', 'landing', 'steal', 'offBalance'];

/** Nombre d'images de chaque geste (le rendu 2D en a autant ; le rig répète les siennes). */
export const GESTURE_STEPS: Readonly<Record<Gesture, number>> = {
  jumpShot: 5,
  layup: 4,
  dunk: 4,
  block: 2,
  blockOff: 2,
  rebound: 2,
  tipoff: 1,
  pass: 2,
  lobPass: 2,
  catch: 1,
  freeThrow: 4,
  landing: 1,
  steal: 2,
  offBalance: 1,
};

export interface SheetLayout {
  framesPerBlock: number;
  animations: Readonly<Record<AnimationName, AnimationDef>>;
  /** Images de chaque geste dans le bloc, dans l'ordre de ses étapes (`GESTURE_STEPS`). */
  gestures: Readonly<Record<Gesture, readonly number[]>>;
}

/** Disposition officielle : arrêt, dos, course A/B, tir armé, lâcher, passe, saut bras haut. */
export const RUN_CYCLE_MS = 600;
export const OFFICIAL_LAYOUT: SheetLayout = {
  framesPerBlock: 8,
  animations: {
    idle: { frames: [0], durations: [600], loop: true },
    run: { frames: [2, 3], durations: [300, 300], loop: true },
    dribble: { frames: [2, 3], durations: [300, 300], loop: true },
    dribbleIdle: { frames: [0], durations: [600], loop: true },
    shoot: { frames: [4, 5], durations: [300, 300], loop: false },
    dunk: { frames: [4, 7], durations: [300, 300], loop: false },
  },
  gestures: {
    jumpShot: [0, 4, 4, 5, 5], layup: [0, 4, 7, 5], dunk: [0, 4, 7, 7],
    block: [0, 7], blockOff: [0, 7], rebound: [7, 4], tipoff: [7],
    pass: [4, 6], lobPass: [4, 5], catch: [6], freeThrow: [0, 4, 5, 5],
    landing: [0], steal: [0, 6], offBalance: [3],
  },
};

/** Image d'un geste à l'étape `step` (bornée à la dernière). */
export function gestureFrame(layout: SheetLayout, gesture: Gesture, step: number): number {
  const frames = layout.gestures[gesture];
  return frames[Math.min(frames.length - 1, Math.max(0, step))];
}

/** Indice d'une image dans la feuille : bloc de la position, puis image dans le bloc. */
export function sheetIndexIn(layout: SheetLayout, frame: number, facing: Facing, heading: Heading): number {
  const block = SHEET_VIEWS.findIndex((v) => v.facing === facing && v.heading === heading);
  return block * layout.framesPerBlock + frame;
}

/** Nombre d'images d'une feuille (4 blocs). */
export function sheetFrameCount(layout: SheetLayout): number {
  return layout.framesPerBlock * SHEET_VIEWS.length;
}
