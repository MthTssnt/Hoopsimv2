/**
 * Disposition d'une feuille de sprites cuite : combien d'images par bloc (une position), quelles
 * images forment chaque animation, et où sont les images fixes nommées. Le rig (ancien rendu,
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
 * Images fixes : ballon levé au-dessus de la tête (tir), bras après le lâcher, layup (bras tendu
 * vers le cercle), montée du dunk, accroché au cercle, deux bras levés (saut sans le ballon).
 */
export type FixedPose = 'withBall' | 'release' | 'layup' | 'dunkRise' | 'dunkHang' | 'block';

export interface SheetLayout {
  framesPerBlock: number;
  animations: Readonly<Record<AnimationName, AnimationDef>>;
  fixed: Readonly<Record<FixedPose, number>>;
}

/** Le rig : 19 images par bloc (`FRAMES`), inchangé. */
export const RIG_LAYOUT: SheetLayout = {
  framesPerBlock: FRAMES.length,
  animations: ANIMATIONS,
  fixed: { withBall: 13, release: 14, layup: 16, dunkRise: 16, dunkHang: 17, block: 18 },
};

/** Durées (ms, entières) qui partagent `total` en `n` images. */
function share(total: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(((i + 1) * total) / n) - Math.round((i * total) / n));
}

const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

/**
 * Le rendu 2D : 28 images par bloc.
 * - 0-1 arrêt (2 × 400 ms) ;
 * - 2-9 course, les 8 images du cycle (360 ms) ;
 * - 10-17 dribble en course : un rebond pour deux foulées (500 ms, la période du dribble du monde) ;
 * - 18-21 dribble à l'arrêt (500 ms) ;
 * - 22 tir ballon levé, 23 lâcher, 24 layup, 25 montée du dunk, 26 accroche, 27 contre.
 */
export const LAYOUT_2D: SheetLayout = {
  framesPerBlock: 28,
  animations: {
    idle: { frames: [0, 1], durations: [400, 400], loop: true },
    run: { frames: range(2, 8), durations: share(360, 8), loop: true },
    dribble: { frames: range(10, 8), durations: share(500, 8), loop: true },
    dribbleIdle: { frames: range(18, 4), durations: share(500, 4), loop: true },
    shoot: { frames: [22, 23], durations: [280, 320], loop: false },
    dunk: { frames: [25, 26], durations: [200, 300], loop: false },
  },
  fixed: { withBall: 22, release: 23, layup: 24, dunkRise: 25, dunkHang: 26, block: 27 },
};

/** Indice d'une image dans la feuille : bloc de la position, puis image dans le bloc. */
export function sheetIndexIn(layout: SheetLayout, frame: number, facing: Facing, heading: Heading): number {
  const block = SHEET_VIEWS.findIndex((v) => v.facing === facing && v.heading === heading);
  return block * layout.framesPerBlock + frame;
}

/** Nombre d'images d'une feuille (4 blocs). */
export function sheetFrameCount(layout: SheetLayout): number {
  return layout.framesPerBlock * SHEET_VIEWS.length;
}
