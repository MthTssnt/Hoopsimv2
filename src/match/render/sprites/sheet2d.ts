/**
 * Feuille du match avec le rendu 2D (`figure2d.ts`) : les 19 images d'un bloc, aux mêmes indices
 * que le rig (`FRAMES`), donc les mêmes animations et le même choix d'image (`spriteStateFor`).
 * - 0-1 arrêt ; 2-5 course (4 des 8 images : amorti et envol de chaque foulée) ; 6-9 dribble en
 *   courant ; 10-11 dribble à l'arrêt ; 12-14 tir ; 15-17 dunk ; 18 contre.
 * - En l'air, le bassin reste à la hauteur de l'arrêt : c'est le monde (hauteur du saut) qui monte
 *   le sprite, comme avec le rig.
 * - Ballon tenu : posé d'après les paumes du squelette (main droite du joueur, côté caméra).
 * Pur, sans Phaser.
 */
import type { Appearance } from './appearance';
import type { BallSpot, Heading } from './rig';
import { FRAME } from './rig';
import type { Facing, Kit } from './compose';
import type { SlotCanvas } from './canvas';
import { renderFigure2DBoth, type Figure2D } from './figure2d';
import { poses2D } from './poses2d';
import { build2D, joints2D, type Arm2D, type Leg2D, type Pose2D } from './skeleton2d';

export interface SheetFrame2D {
  pose: Pose2D;
  ball?: BallSpot;
  /** Image en l'air : le bassin est remonté à la hauteur de l'arrêt. */
  air?: boolean;
}

const idle = poses2D('idle');
const run = poses2D('run');
/** Images de course gardées (amorti et envol de chaque foulée), au rythme de la feuille (4 × 90 ms). */
const RUN_PICK = [1, 3, 5, 7] as const;

const ARM = {
  dribbleHigh: { pitch: 0.55, abd: 0.25, elbow: 0.5 },
  dribbleLow: { pitch: 0.35, abd: 0.25, elbow: 0.15 },
  guard: { pitch: 0.45, abd: 0.3, elbow: 1.1 },
  chest: { pitch: 0.6, abd: 0.1, elbow: 1.6 },
  raise: { pitch: 2.5, abd: 0.15, elbow: 1.0 },
  guide: { pitch: 2.3, abd: 0.4, elbow: 0.8 },
  release: { pitch: 3.0, abd: 0.1, elbow: 0.1, wrist: 0.9 },
  reach: { pitch: 3.0, abd: 0.1, elbow: 0.05 },
  swingBack: { pitch: -0.5, abd: 0.2, elbow: 0.3 },
} satisfies Record<string, Arm2D>;

const LEGS = {
  crouch: [
    { hip: 0.8, knee: 1.5, out: 0.3 },
    { hip: 0.8, knee: 1.5, out: 0.3 },
  ],
  air: [
    { hip: 0.3, knee: 0.6, foot: -0.4 },
    { hip: 0.7, knee: 1.3, foot: -0.4 },
  ],
  dunkAir: [
    { hip: 0.1, knee: 0.2, foot: -0.5 },
    { hip: 1.2, knee: 1.6, foot: -0.3 },
  ],
  dangle: [
    { hip: 0.1, knee: 0.3, foot: -0.5 },
    { hip: 0.15, knee: 0.4, foot: -0.5 },
  ],
} satisfies Record<string, readonly [Leg2D, Leg2D]>;

/**
 * Main du dribble : celle du côté de la course (à droite de l'image) ; en diagonale bas, le joueur
 * fait face à la caméra, c'est sa main gauche ; en diagonale haut, sa main droite.
 */
export function dribbleHand(heading: Heading): 0 | 1 {
  return heading === 'down' ? 0 : 1;
}

/** Haut du corps du dribble : une main pousse le ballon, l'autre protège. */
const dribble = (pose: Pose2D, high: boolean, heading: Heading): Pose2D => {
  const push = high ? ARM.dribbleHigh : ARM.dribbleLow;
  return { ...pose, arms: dribbleHand(heading) === 0 ? [push, ARM.guard] : [ARM.guard, push] };
};

const air = (legs: keyof typeof LEGS, arms: readonly [Arm2D, Arm2D], ball?: BallSpot): SheetFrame2D => ({
  pose: { legs: LEGS[legs], arms, lean: 0.05, expression: 'concentree' },
  ball,
  air: legs !== 'crouch',
});

/** Les 19 images d'un bloc, dans l'ordre de `FRAMES`. */
export function sheetFrames2D(heading: Heading): readonly SheetFrame2D[] {
  return heading === 'down' ? DOWN_FRAMES : UP_FRAMES;
}

const framesOf = (heading: Heading): SheetFrame2D[] => [
  { pose: idle[0].pose },
  { pose: idle[1].pose },
  ...RUN_PICK.map((k) => ({ pose: run[k].pose })),
  ...RUN_PICK.map((k, j) => ({ pose: dribble(run[k].pose, j % 2 === 0, heading), ball: (['hand', 'dribbleMid', 'dribbleLow', 'dribbleMid'] as const)[j] })),
  { pose: dribble(idle[0].pose, true, heading), ball: 'hand' },
  { pose: dribble(idle[1].pose, false, heading), ball: 'dribbleLow' },
  air('crouch', [ARM.chest, ARM.chest], 'chest'),
  air('air', [ARM.guide, ARM.raise], 'overhead'),
  air('air', [ARM.guide, ARM.release]),
  air('crouch', [ARM.chest, ARM.chest], 'chest'),
  air('dunkAir', [ARM.swingBack, ARM.reach], 'overhead'),
  air('dangle', [ARM.reach, ARM.reach]),
  air('air', [ARM.reach, ARM.reach]),
];
const DOWN_FRAMES = framesOf('down');
const UP_FRAMES = framesOf('up');

/** Indice de l'image où les deux bras sont tendus vers le haut (accroche au cercle). */
const HANG_FRAME = 17;

/** Hauteur du bassin (z) d'une pose posée au sol. */
function pelvisZ(look: Appearance, pose: Pose2D, heading: Heading): number {
  return joints2D(build2D(look.heightCm, look.heavy), { ...pose, lift: 0 }, heading).pelvis[2];
}

export interface ComposedFrame2D {
  canvas: SlotCanvas;
  /** Centre du ballon tenu (coordonnées du cadre), ou null. */
  ball: { x: number; y: number } | null;
}

/** Ballon de 8 px (10 avec le contour) : au sol, son centre est 4 px au-dessus du sol. */
const FLOOR_Y = FRAME.groundY - 4;

function ballAt(spot: BallSpot | undefined, fig: Figure2D, facing: Facing, heading: Heading): ComposedFrame2D['ball'] {
  if (!spot) return null;
  const [left, right] = fig.palms;
  // Vers la gauche, l'image est retournée : le ballon part du même côté du joueur.
  const out = facing === 'left' ? -1 : 1;
  // Ballon levé (tir, dunk) : la main droite ; dribble : la main du côté de la course.
  const main = spot === 'overhead' ? right : fig.palms[dribbleHand(heading)];
  const hand = { x: Math.round(main.x), y: Math.round(main.y) };
  switch (spot) {
    case 'hand':
      return { x: hand.x + out, y: hand.y + 4 };
    case 'dribbleMid':
      return { x: hand.x + out * 2, y: Math.round((hand.y + 4 + FLOOR_Y) / 2) };
    case 'dribbleLow':
      return { x: hand.x + out * 2, y: FLOOR_Y };
    case 'chest':
      return { x: Math.round((left.x + right.x) / 2) + out, y: Math.round((left.y + right.y) / 2) };
    case 'overhead':
      return { x: hand.x, y: hand.y - 4 };
  }
}

/** Une image de la feuille, dans les deux orientations (peinte une seule fois, puis retournée). */
export function composeFrame2D(look: Appearance, index: number, heading: Heading, kit: Kit = 'team'): Record<Facing, ComposedFrame2D> {
  const spec = sheetFrames2D(heading)[index];
  let pose = spec.pose;
  if (spec.air) pose = { ...pose, lift: Math.max(0, pelvisZ(look, idle[0].pose, heading) - pelvisZ(look, pose, heading)) };
  const both = renderFigure2DBoth(look, pose, heading, kit);
  return {
    right: { canvas: both.right.canvas, ball: ballAt(spec.ball, both.right, 'right', heading) },
    left: { canvas: both.left.canvas, ball: ballAt(spec.ball, both.left, 'left', heading) },
  };
}

/** Mesures d'un joueur dans la feuille 2D : haut de la tête à l'arrêt, haut des mains levées (accroche). */
export interface Metrics2D {
  headTop: number;
  raisedHandTop: number;
}

export function metrics2D(look: Appearance): Metrics2D {
  const stand = composeFrame2D(look, 0, 'down').right.canvas.bounds()!;
  // Accroche : haut des mains (paume, son rayon et le contour), même si la tête dépasse.
  const spec = sheetFrames2D('down')[HANG_FRAME];
  const pose = { ...spec.pose, lift: Math.max(0, pelvisZ(look, idle[0].pose, 'down') - pelvisZ(look, spec.pose, 'down')) };
  const palms = renderFigure2DBoth(look, pose, 'down').right.palms;
  return { headTop: stand.top, raisedHandTop: Math.round(Math.min(palms[0].y, palms[1].y)) - 3 };
}
