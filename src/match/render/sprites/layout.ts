/**
 * Disposition d'une feuille de sprites cuite : combien d'images par bloc (une position), quelles
 * images forment chaque animation en boucle, et les images de chaque geste. Le rig (ancien rendu,
 * `&sprites=ancien`) et le rendu 2D (`sheet2d.ts`) ont chacun la leur ; le choix de l'image
 * (`spriteStateFor`) ne parle que de noms. Pur, sans Phaser.
 */
import { SHEET_VIEWS, type Facing, type Heading } from './compose';
import { ANIMATIONS, FRAMES, type AnimationName } from './rig';

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

/**
 * Le rig : 19 images par bloc (`FRAMES`), inchangé. Ses gestes réutilisent ses images (12 flexion,
 * 13 ballon levé, 14 lâcher, 15 élan du dunk, 16 bras tendu, 17 accroche, 18 deux bras levés) :
 * c'est l'ancien rendu, gardé tel quel.
 */
export const RIG_LAYOUT: SheetLayout = {
  framesPerBlock: FRAMES.length,
  animations: ANIMATIONS,
  gestures: {
    jumpShot: [12, 13, 13, 14, 14],
    layup: [16, 16, 16, 14],
    dunk: [15, 16, 16, 17],
    block: [18, 18],
    blockOff: [18, 18],
    rebound: [18, 13],
    tipoff: [18],
    pass: [14, 14],
    lobPass: [13, 14],
    catch: [0],
    freeThrow: [13, 13, 14, 14],
    landing: [12],
    steal: [14, 14],
    offBalance: [0],
  },
};

/** Durées (ms, entières) qui partagent `total` en `n` images. */
function share(total: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(((i + 1) * total) / n) - Math.round((i * total) / n));
}

const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

/** Images des gestes du rendu 2D, à la suite des animations (22 images), dans l'ordre de `GESTURES`. */
function gestures2D(first: number): Record<Gesture, number[]> {
  let next = first;
  const out = {} as Record<Gesture, number[]>;
  for (const g of GESTURES) {
    out[g] = range(next, GESTURE_STEPS[g]);
    next += GESTURE_STEPS[g];
  }
  return out;
}

const GESTURES_2D = gestures2D(22);

/**
 * Cycle de course du rendu 2D (ms) : deux pas en 600 ms à la vitesse de référence, soit ~3,3 pas
 * par seconde (~3,8 à pleine vitesse) ; les deux dribbles suivent le même rythme (un rebond par cycle).
 */
export const RUN_CYCLE_MS = 600;

/**
 * Le rendu 2D : 55 images par bloc.
 * - 0-1 arrêt (2 × 400 ms) ;
 * - 2-9 course, les 8 images du cycle (600 ms) ;
 * - 10-17 dribble en course : un rebond pour deux pas (600 ms, la période du dribble du monde) ;
 * - 18-21 dribble à l'arrêt (600 ms) ;
 * - 22-54 les gestes (`GESTURES`, chacun ses images).
 * `shoot` et `dunk` (planche `?style`) rejouent les images du tir en suspension et du dunk.
 */
export const LAYOUT_2D: SheetLayout = {
  framesPerBlock: 22 + GESTURES.reduce((n, g) => n + GESTURE_STEPS[g], 0),
  animations: {
    idle: { frames: [0, 1], durations: [400, 400], loop: true },
    run: { frames: range(2, 8), durations: share(RUN_CYCLE_MS, 8), loop: true },
    dribble: { frames: range(10, 8), durations: share(RUN_CYCLE_MS, 8), loop: true },
    dribbleIdle: { frames: range(18, 4), durations: share(RUN_CYCLE_MS, 4), loop: true },
    shoot: { frames: GESTURES_2D.jumpShot, durations: [80, 160, 240, 200, 220], loop: false },
    dunk: { frames: GESTURES_2D.dunk, durations: [80, 160, 120, 300], loop: false },
  },
  gestures: GESTURES_2D,
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
