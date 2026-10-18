/**
 * Feuille du match avec le rendu 2D (`figure2d.ts`) : les 28 images d'un bloc (`LAYOUT_2D`).
 * - 0-1 arrêt ; 2-9 course (les 8 images du cycle) ; 10-17 dribble en course (un rebond pour deux
 *   foulées) ; 18-21 dribble à l'arrêt ; 22 tir ballon levé ; 23 lâcher ; 24 layup ; 25 montée du
 *   dunk ; 26 accroche ; 27 contre.
 * - Main forte (`dominantHand` du personnage) : elle dribble et elle tire. Tourné vers la droite,
 *   on voit le côté droit du joueur : un droitier utilise sa main proche de la caméra ; vers la
 *   gauche (image retournée), sa main éloignée ; l'inverse pour un gaucher. Ces images sont peintes
 *   pour chaque orientation.
 * - Ballon tenu : posé sous la paume de la main forte (la main reste visible), écarté du corps
 *   dans le sens de la course ; il passe derrière le porteur quand cette main est plus loin de la
 *   caméra que le bassin (`behind`).
 * - En l'air, le bassin reste à la hauteur de l'arrêt : c'est le monde (hauteur du saut) qui monte
 *   le sprite.
 * Pur, sans Phaser.
 */
import type { Appearance } from './appearance';
import { characterOf } from './appearance';
import type { SlotCanvas } from './canvas';
import type { Facing, Kit } from './compose';
import { hands2D, renderFigure2D, renderFigure2DBoth, type Figure2D, type Hands2D } from './figure2d';
import { LAYOUT_2D } from './layout';
import { poses2D } from './poses2d';
import { FRAME, type Heading } from './rig';
import { build2D, joints2D, type Arm2D, type Leg2D, type Pose2D } from './skeleton2d';

/** Bras de la main forte (`strong`, 0 ou 1) et de l'autre, rangés [gauche du joueur, droite]. */
type ByHand = (strong: 0 | 1) => Pose2D;

/** Où est le ballon tenu : au dribble (hauteur `h`, 1 = dans la main, 0 = au sol) ou levé au-dessus de la main forte. */
export type BallHold = { at: 'dribble'; h: number } | { at: 'overhead' };

export interface SheetFrame2D {
  /** Pose, ou pose selon la main forte (image peinte pour chaque orientation). */
  pose: Pose2D | ByHand;
  ball?: BallHold;
  /** Image en l'air : le bassin est remonté à la hauteur de l'arrêt. */
  air?: boolean;
}

const idle = poses2D('idle');
const run = poses2D('run');

const arms = (strong: 0 | 1, strongArm: Arm2D, other: Arm2D): readonly [Arm2D, Arm2D] => (strong === 1 ? [other, strongArm] : [strongArm, other]);
const legsFor = (strong: 0 | 1, strongLeg: Leg2D, other: Leg2D): readonly [Leg2D, Leg2D] => (strong === 1 ? [other, strongLeg] : [strongLeg, other]);

/**
 * Bras du dribble selon la hauteur du ballon : la main pousse par-dessus à hauteur de hanche
 * (poignet cassé vers le bas), suit le ballon, attend à mi-cuisse, puis remonte le cueillir. La
 * main éloignée (`far`) s'écarte du corps : son ballon, derrière le porteur, reste visible.
 */
function dribbleArm(h: number, rising: boolean, far: boolean): Arm2D {
  const abd = far ? 0.75 : 0.3;
  // La main proche se voit de face : coude plus fléchi, avant-bras relevé pour garder la main à la hanche.
  const lift = far ? 0 : 0.55;
  if (h >= 0.9) return { pitch: 0.75 - lift * 0.4, abd, elbow: 1.05 + lift, wrist: -0.7 };
  if (!rising && h >= 0.6) return { pitch: 0.6 - lift * 0.4, abd, elbow: 0.75 + lift, wrist: -0.5 };
  if (h < 0.6) return { pitch: 0.5 - lift * 0.4, abd, elbow: 0.7 + lift * 0.6, wrist: -0.3 };
  return { pitch: 0.65 - lift * 0.4, abd, elbow: 0.95 + lift, wrist: -0.55 };
}

/** Bras qui protège le ballon : avant-bras levé devant le corps, du côté du défenseur. */
const GUARD: Arm2D = { pitch: 0.6, abd: 0.5, elbow: 1.25 };

/** Hauteur du ballon du dribble, image `f` sur `n` : `|cos|`, comme le dribble du monde (au sol une fois par cycle). */
const bounce = (f: number, n: number) => Math.abs(Math.cos((Math.PI * f) / n));

/** Dribble en course : les jambes du cycle de course, un rebond pour deux foulées ; buste un peu moins penché. */
function runDribble(f: number): SheetFrame2D {
  const h = bounce(f, 8);
  const rising = f > 4;
  const legs = run[f].pose;
  return {
    pose: (strong) => ({ ...legs, lean: 0.24, arms: arms(strong, dribbleArm(h, rising, strong === 0), GUARD) }),
    ball: { at: 'dribble', h },
  };
}

/** Dribble à l'arrêt : posture plus basse qu'à l'arrêt, le corps accompagne le rebond d'un pixel. */
function idleDribble(f: number): SheetFrame2D {
  const h = bounce(f, 4);
  const legs: [Leg2D, Leg2D] = [
    { hip: 0.62, knee: 1.15, out: 0.34 },
    { hip: 0.58, knee: 1.1, out: 0.34 },
  ];
  return {
    pose: (strong) => ({ legs, lean: 0.22, face: 0.45, bob: f === 2 ? 1.4 : 0.8, arms: arms(strong, dribbleArm(h, f === 3, strong === 0), GUARD) }),
    ball: { at: 'dribble', h },
  };
}

const AIR_LEGS: readonly [Leg2D, Leg2D] = [
  { hip: 0.3, knee: 0.6, foot: -0.4 },
  { hip: 0.7, knee: 1.3, foot: -0.4 },
];

const air = (pose: Pose2D | ByHand, ball?: BallHold): SheetFrame2D => ({ pose, ball, air: true });

/** Les 28 images d'un bloc, dans l'ordre de `LAYOUT_2D`. */
const FRAMES_2D: readonly SheetFrame2D[] = [
  { pose: idle[0].pose },
  { pose: idle[1].pose },
  ...run.map((r) => ({ pose: r.pose })),
  ...Array.from({ length: 8 }, (_, f) => runDribble(f)),
  ...Array.from({ length: 4 }, (_, f) => idleDribble(f)),
  // Tir, ballon levé : coude de la main forte à 90° sous le ballon, poignet armé ; l'autre main guide sur le côté.
  air(
    (strong) => ({
      legs: AIR_LEGS,
      lean: 0.04,
      expression: 'concentree',
      arms: arms(strong, { pitch: 2.25, abd: 0.12, elbow: 0.85, wrist: 0.9 }, { pitch: 2.3, abd: 0.15, elbow: 1.0 }),
    }),
    { at: 'overhead' },
  ),
  // Lâcher : bras tendu, poignet cassé vers l'avant ; la main faible s'ouvre sur le côté.
  air((strong) => ({
    legs: AIR_LEGS,
    lean: 0.04,
    stretch: 1,
    expression: 'concentree',
    arms: arms(strong, { pitch: 2.9, abd: 0.1, elbow: 0.1, wrist: 1.2 }, { pitch: 2.4, abd: 0.4, elbow: 0.3 }),
  })),
  // Layup : genou du côté de la main faible levé, bras fort tendu vers le cercle avec le ballon.
  air(
    (strong) => ({
      legs: legsFor(strong, { hip: -0.15, knee: 0.35, foot: -0.6 }, { hip: 1.45, knee: 1.7, foot: -0.2 }),
      lean: 0.1,
      stretch: 1,
      expression: 'concentree',
      arms: arms(strong, { pitch: 2.75, abd: 0.12, elbow: 0.12, wrist: 0.3 }, { pitch: 1.15, abd: 0.55, elbow: 0.9 }),
    }),
    { at: 'overhead' },
  ),
  // Montée du dunk : ballon levé bras tendu, l'autre bras rejeté en arrière pour l'élan.
  air(
    (strong) => ({
      legs: legsFor(strong, { hip: 0.1, knee: 0.2, foot: -0.5 }, { hip: 1.2, knee: 1.6, foot: -0.3 }),
      lean: 0.08,
      stretch: 1,
      expression: 'concentree',
      arms: arms(strong, { pitch: 2.95, abd: 0.1, elbow: 0.08 }, { pitch: -0.45, abd: 0.25, elbow: 0.35 }),
    }),
    { at: 'overhead' },
  ),
  // Accroche : deux mains au cercle, jambes pendantes.
  air({
    legs: [
      { hip: 0.1, knee: 0.3, foot: -0.5 },
      { hip: 0.15, knee: 0.4, foot: -0.5 },
    ],
    stretch: 1,
    expression: 'concentree',
    arms: [
      { pitch: 3.0, abd: 0.1, elbow: 0.05 },
      { pitch: 3.0, abd: 0.1, elbow: 0.05 },
    ],
  }),
  // Contre : deux bras tendus vers le haut, buste étiré.
  air({
    legs: AIR_LEGS,
    stretch: 1,
    expression: 'concentree',
    arms: [
      { pitch: 3.0, abd: 0.25, elbow: 0.05 },
      { pitch: 3.0, abd: 0.25, elbow: 0.05 },
    ],
  }),
];

if (FRAMES_2D.length !== LAYOUT_2D.framesPerBlock) throw new Error('sheet2d : nombre d’images différent de LAYOUT_2D');

/** Les 28 images d'un bloc (les mêmes dans les deux diagonales ; c'est le squelette qui tourne). */
export function sheetFrames2D(): readonly SheetFrame2D[] {
  return FRAMES_2D;
}

/** Bras de la main forte dans l'image tournée vers `facing` (voir l'en-tête). */
export function strongArm(look: Appearance, facing: Facing): 0 | 1 {
  const right = characterOf(look).dominantHand !== 'gauche';
  return (facing === 'right') === right ? 1 : 0;
}

/** Hauteur du bassin (z) d'une pose posée au sol. */
function pelvisZ(look: Appearance, pose: Pose2D, heading: Heading): number {
  return joints2D(build2D(look.heightCm, look.heavy), { ...pose, lift: 0 }, heading).pelvis[2];
}

export interface ComposedFrame2D {
  canvas: SlotCanvas;
  /** Centre du ballon tenu (coordonnées du cadre) et s'il passe derrière le porteur, ou null. */
  ball: { x: number; y: number; behind: boolean } | null;
}

/** Ballon de 8 px (10 avec le contour) : au sol, son centre est 4 px au-dessus du sol. */
export const FLOOR_Y = FRAME.groundY - 4;
/**
 * Le ballon (rayon 5 avec son contour) est posé sous la main, sans la couvrir : son centre est à
 * 6 px sous le plus bas de la paume et des doigts (rayon de la main : 1,5 px) ; levé, à 6 px au-dessus.
 */
export const UNDER_HAND = 6;

/**
 * Ballon tenu dans l'image peinte `fig`. Au dribble, `contact` : mains de l'image où le ballon est
 * dans la main (hauteur du contact) ; `floor` : celles de l'image où il touche le sol (la main y
 * attend, et dit de quel côté du corps passe le dribble, pour tout le cycle).
 */
function ballAt(hold: BallHold | undefined, fig: Pick<Figure2D, 'palms' | 'tips' | 'pelvis'>, cycle: { contact: Hands2D; floor: Hands2D } | null, strong: 0 | 1, facing: Facing): ComposedFrame2D['ball'] {
  if (!hold) return null;
  // Vers la gauche, l'image est retournée : le ballon part du même côté du joueur.
  const out = facing === 'left' ? -1 : 1;
  const palm = fig.palms[strong];
  const tip = fig.tips[strong];
  if (hold.at === 'overhead') return { x: Math.round(palm.x), y: Math.round(Math.min(palm.y, tip.y)) - UNDER_HAND, behind: palm.near < fig.pelvis.near };
  const contact = (hands: Pick<Hands2D, 'palms' | 'tips'>) => Math.max(hands.palms[strong].y, hands.tips[strong].y) + UNDER_HAND;
  const behind = cycle ? cycle.floor.palms[strong].near < cycle.floor.pelvis.near : palm.near < fig.pelvis.near;
  // Le ballon est écarté du corps, du côté de la main (il reste lisible devant comme derrière le porteur).
  const side = Math.sign(palm.x - fig.pelvis.x) || out;
  const x = Math.round(palm.x) + side * 2;
  if (hold.h >= 0.9) return { x, y: Math.round(contact(fig)), behind };
  const top = cycle ? contact(cycle.contact) : contact(fig);
  return { x: x + side, y: Math.round(FLOOR_Y + (top - FLOOR_Y) * hold.h), behind };
}

/** Pose posée pour une orientation : main forte, et bassin remonté à la hauteur de l'arrêt en l'air. */
function posed(look: Appearance, spec: SheetFrame2D, heading: Heading, strong: 0 | 1): Pose2D {
  const pose = typeof spec.pose === 'function' ? spec.pose(strong) : spec.pose;
  return spec.air ? { ...pose, lift: Math.max(0, pelvisZ(look, idle[0].pose, heading) - pelvisZ(look, pose, heading)) } : pose;
}

/** Mains d'une image de la feuille pour une orientation (image retournée vers la gauche), sans peinture. */
function handsOf(look: Appearance, index: number, heading: Heading, strong: 0 | 1, facing: Facing): Hands2D {
  const h = hands2D(look, posed(look, FRAMES_2D[index], heading, strong), heading);
  if (facing === 'right') return h;
  const flip = (p: Hands2D['palms'][0]) => ({ ...p, x: FRAME.width - 1 - p.x });
  // Vers la gauche, l'image est retournée : la main forte reste au même indice.
  return { palms: [flip(h.palms[0]), flip(h.palms[1])], tips: [flip(h.tips[0]), flip(h.tips[1])], pelvis: flip(h.pelvis) };
}

/** Première image du cycle de dribble qui contient l'image `index` (ballon dans la main). */
const cycleStart = (index: number) => (index >= LAYOUT_2D.animations.dribbleIdle.frames[0] ? LAYOUT_2D.animations.dribbleIdle.frames[0] : LAYOUT_2D.animations.dribble.frames[0]);
/** Image du cycle où le ballon est au sol : la main y attend, et dit de quel côté du corps est le dribble. */
const cycleFloor = (index: number) => {
  const first = cycleStart(index);
  const n = first === LAYOUT_2D.animations.dribble.frames[0] ? LAYOUT_2D.animations.dribble.frames.length : LAYOUT_2D.animations.dribbleIdle.frames.length;
  return first + n / 2;
};

/** Une image de la feuille, dans les deux orientations (peinte une fois et retournée, sauf si elle dépend de la main forte). */
export function composeFrame2D(look: Appearance, index: number, heading: Heading, kit: Kit = 'team'): Record<Facing, ComposedFrame2D> {
  const spec = FRAMES_2D[index];
  const compose = (facing: Facing, fig: Figure2D): ComposedFrame2D => {
    const strong = strongArm(look, facing);
    const cycle = spec.ball?.at === 'dribble' ? { contact: handsOf(look, cycleStart(index), heading, strong, facing), floor: handsOf(look, cycleFloor(index), heading, strong, facing) } : null;
    return { canvas: fig.canvas, ball: ballAt(spec.ball, fig, cycle, strong, facing) };
  };
  if (typeof spec.pose !== 'function') {
    const both = renderFigure2DBoth(look, posed(look, spec, heading, 1), heading, kit);
    return { right: compose('right', both.right), left: compose('left', both.left) };
  }
  const right = renderFigure2D(look, posed(look, spec, heading, strongArm(look, 'right')), heading, 'right', kit);
  const left = renderFigure2D(look, posed(look, spec, heading, strongArm(look, 'left')), heading, 'left', kit);
  return { right: compose('right', right), left: compose('left', left) };
}

/** Mesures d'un joueur dans la feuille 2D : haut de la tête à l'arrêt, haut des mains levées (accroche). */
export interface Metrics2D {
  headTop: number;
  raisedHandTop: number;
}

export function metrics2D(look: Appearance): Metrics2D {
  const stand = composeFrame2D(look, 0, 'down').right.canvas.bounds()!;
  // Accroche : haut des mains (paume, son rayon et le contour), même si la tête dépasse.
  const hang = FRAMES_2D[LAYOUT_2D.fixed.dunkHang];
  const palms = hands2D(look, posed(look, hang, 'down', 1), 'down').palms;
  return { headTop: stand.top, raisedHandTop: Math.round(Math.min(palms[0].y, palms[1].y)) - 3 };
}

/** Main forte et bassin à l'écran pour une image de la feuille et une orientation (contrôles, tests). */
export function sheetHands2D(look: Appearance, index: number, heading: Heading, facing: Facing): { palm: Hands2D['pelvis']; tip: Hands2D['pelvis']; pelvis: Hands2D['pelvis'] } {
  const strong = strongArm(look, facing);
  const h = handsOf(look, index, heading, strong, facing);
  return { palm: h.palms[strong], tip: h.tips[strong], pelvis: h.pelvis };
}
