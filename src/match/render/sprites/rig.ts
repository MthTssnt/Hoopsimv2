import { HEAD_GRID, type Expression } from '../../../assets/sprites/heads';
import { heightClass } from './appearance';

/**
 * Cadre d'un sprite de joueur (640×360) : pieds au milieu du bord bas, la rangée du sol est le
 * contour sous la semelle.
 */
export const FRAME = { width: 56, height: 64, centerX: 28, groundY: 63 } as const;
/** Tête, cheveux compris, sans le contour (18×18 avec). */
export const HEAD_SIZE = HEAD_GRID;
export const NECK_ROWS = 1;
export const SHORTS_ROWS = 4;
export const SHOE_ROWS = 3;

/**
 * Gabarits (docs/ART_DIRECTION.md) : la tête ne change jamais, ni la longueur des bras. Le
 * pivot gagne 3 rangées (torse + jambes) et une colonne ; le meneur en perd 3.
 */
export const BUILDS = {
  meneur: { torso: 9, legs: 5, extraWidth: 0 },
  ailier: { torso: 11, legs: 6, extraWidth: 0 },
  pivot: { torso: 13, legs: 7, extraWidth: 1 },
} as const;
export type Build = keyof typeof BUILDS;

/** Largeur du torse d'un ailier léger (px, sans contour). */
const BASE_TORSO_WIDTH = 11;

export function buildFor(heightCm: number): Build {
  const size = heightClass(heightCm);
  return size === 'petit' ? 'meneur' : size === 'grand' ? 'pivot' : 'ailier';
}

/** Dimensions du corps (px) d'un joueur. */
export interface BodyDims {
  build: Build;
  heavy: boolean;
  torso: number;
  legs: number;
  torsoWidth: number;
  /** Épaisseur des jambes (3 ou 4 px, hors contour). */
  limb: number;
  /** Épaisseur des bras : toujours 2 px de remplissage, plus le contour de chaque côté. */
  armWidth: number;
}

export function bodyDims(heightCm: number, heavy: boolean): BodyDims {
  const build = buildFor(heightCm);
  const b = BUILDS[build];
  return {
    build,
    heavy,
    torso: b.torso,
    legs: b.legs,
    torsoWidth: BASE_TORSO_WIDTH + b.extraWidth + (heavy ? 1 : 0),
    limb: heavy || build === 'pivot' ? 4 : 3,
    armWidth: 2,
  };
}

/** Rangées et colonnes de chaque partie dans le cadre (pour l'assemblage, le gros plan et les tests). */
export interface BodyLayout {
  /** Première rangée de la tête (sans le contour, qui est juste au-dessus). */
  headTop: number;
  neckY: number;
  torsoTop: number;
  shortsTop: number;
  shortsBottom: number;
  shoeTop: number;
  torsoLeft: number;
  torsoRight: number;
}

export function bodyLayout(dims: BodyDims, bob = 0): BodyLayout {
  const shoeTop = FRAME.groundY - SHOE_ROWS;
  const shortsBottom = shoeTop - dims.legs - 1 + bob;
  const shortsTop = shortsBottom - SHORTS_ROWS + 1;
  const torsoTop = shortsTop - dims.torso;
  const neckY = torsoTop - NECK_ROWS;
  const torsoLeft = FRAME.centerX - Math.floor(dims.torsoWidth / 2);
  return { headTop: neckY - HEAD_SIZE, neckY, torsoTop, shortsTop, shortsBottom, shoeTop, torsoLeft, torsoRight: torsoLeft + dims.torsoWidth - 1 };
}

/**
 * Pose d'un bras : coude et main en pixels depuis l'épaule ; x positif = vers l'extérieur du
 * corps (à droite pour le bras avant, à gauche pour le bras arrière). Bras de 8 à 9 px au plus.
 */
export interface ArmPose {
  elbow: [number, number];
  hand: [number, number];
}

/**
 * Pose d'une jambe : genou et pied en pixels depuis la hanche (x positif = vers l'extérieur) ;
 * `lift` lève le pied. En 3/4, `depth` remonte le pied le plus éloigné de la caméra (il reste
 * posé : la jambe paraît plus courte, le pied plus haut à l'écran).
 */
export interface LegPose {
  knee: number;
  foot: number;
  lift: number;
  depth?: number;
}

const ARMS = {
  hang: { elbow: [0, 4], hand: [0, 10] },
  swingFwd: { elbow: [1, 4], hand: [-3, 7] },
  swingBack: { elbow: [1, 4], hand: [3, 8] },
  // Dribble de profil : la main revient devant le corps, le ballon rebondit devant les jambes.
  dribbleHigh: { elbow: [1, 4], hand: [-2, 8] },
  dribbleLow: { elbow: [1, 6], hand: [-2, 11] },
  guard: { elbow: [3, 3], hand: [4, -1] },
  chest: { elbow: [0, 4], hand: [-6, 4] },
  raise: { elbow: [1, -4], hand: [0, -10] },
  guide: { elbow: [3, -3], hand: [1, -8] },
  release: { elbow: [1, -6], hand: [1, -11] },
  reach: { elbow: [0, -6], hand: [0, -11] },
  // Vue de dos : bras qui pompent (vers l'avant, la main remonte), dribble sur le côté.
  pumpFwd: { elbow: [1, 4], hand: [0, 7] },
  pumpBack: { elbow: [0, 4], hand: [1, 10] },
  dribbleSide: { elbow: [1, 4], hand: [3, 8] },
  dribbleSideLow: { elbow: [1, 6], hand: [3, 11] },
  // 3/4 : le balancier va vers la caméra (écart horizontal divisé par deux).
  swingFwd34: { elbow: [1, 4], hand: [-1, 8] },
  swingBack34: { elbow: [1, 4], hand: [2, 8] },
} satisfies Record<string, ArmPose>;

const LEGS = {
  stand: { back: { knee: 1, foot: 0, lift: 0 }, front: { knee: 1, foot: 0, lift: 0 } },
  strideA: { back: { knee: 1, foot: 3, lift: 3 }, front: { knee: 3, foot: 4, lift: 0 } },
  passA: { back: { knee: 0, foot: 1, lift: 1 }, front: { knee: 1, foot: 0, lift: 0 } },
  strideB: { back: { knee: 3, foot: 4, lift: 0 }, front: { knee: 1, foot: 3, lift: 3 } },
  passB: { back: { knee: 1, foot: 0, lift: 0 }, front: { knee: 0, foot: 1, lift: 1 } },
  crouch: { back: { knee: 3, foot: 1, lift: 0 }, front: { knee: 3, foot: 1, lift: 0 } },
  air: { back: { knee: 1, foot: 0, lift: 3 }, front: { knee: 3, foot: 1, lift: 4 } },
  dunkAir: { back: { knee: 0, foot: 0, lift: 1 }, front: { knee: 3, foot: 1, lift: 6 } },
  dangle: { back: { knee: 0, foot: 0, lift: 1 }, front: { knee: 0, foot: 1, lift: 1 } },
  // Course vue de dos : jambes côte à côte, un pied levé à chaque foulée.
  stepLeft: { back: { knee: 1, foot: 0, lift: 3 }, front: { knee: 1, foot: 0, lift: 0 } },
  stepRight: { back: { knee: 1, foot: 0, lift: 0 }, front: { knee: 1, foot: 0, lift: 3 } },
  // 3/4 face : la jambe du côté de la course (avant, à droite) est la plus éloignée de la caméra,
  // son pied est dessiné 2 px plus haut ; foulées deux fois moins larges qu'au profil.
  stand34: { back: { knee: 1, foot: 0, lift: 0 }, front: { knee: 1, foot: 0, lift: 0, depth: 2 } },
  stride34A: { back: { knee: 1, foot: 1, lift: 3 }, front: { knee: 2, foot: 2, lift: 0, depth: 2 } },
  pass34A: { back: { knee: 0, foot: 1, lift: 1 }, front: { knee: 1, foot: 0, lift: 0, depth: 2 } },
  stride34B: { back: { knee: 2, foot: 2, lift: 0 }, front: { knee: 1, foot: 1, lift: 3, depth: 2 } },
  pass34B: { back: { knee: 1, foot: 0, lift: 0 }, front: { knee: 0, foot: 1, lift: 1, depth: 2 } },
  // 3/4 dos : l'inverse, la jambe arrière (à gauche) est la plus éloignée.
  standB34: { back: { knee: 1, foot: 0, lift: 0, depth: 2 }, front: { knee: 1, foot: 0, lift: 0 } },
  stepB34A: { back: { knee: 1, foot: 1, lift: 3, depth: 2 }, front: { knee: 1, foot: 0, lift: 0 } },
  stepB34B: { back: { knee: 1, foot: 1, lift: 0, depth: 2 }, front: { knee: 1, foot: 0, lift: 3 } },
} satisfies Record<string, { back: LegPose; front: LegPose }>;

/**
 * Haut de la main levée (pose `reach` : dunk, accroche au cercle, contre), en rangée du cadre.
 * L'épaule est à la hauteur du haut du torse. Sert à poser les mains sur le cercle pendant un dunk.
 */
export function raisedHandTop(dims: BodyDims): number {
  return bodyLayout(dims).torsoTop + ARMS.reach.hand[1];
}

/** Où dessiner le ballon tenu : main de dribble, au rebond, à la poitrine ou au-dessus de la main. */
export type BallSpot = 'hand' | 'dribbleMid' | 'dribbleLow' | 'chest' | 'overhead';

export interface FrameDef {
  legs: { back: LegPose; front: LegPose };
  front: ArmPose;
  back: ArmPose;
  /** Décalage vertical du haut du corps (px, vers le bas : jambes fléchies). */
  bob: number;
  /** Tout le corps monte d'autant (px), pieds compris : phase de suspension d'une foulée. */
  rise: number;
  ball?: BallSpot;
  expression: Expression;
}

const f = (legs: keyof typeof LEGS, front: keyof typeof ARMS, back: keyof typeof ARMS, bob = 0, ball?: BallSpot, expression: Expression = 'neutre'): FrameDef => ({
  legs: LEGS[legs],
  front: ARMS[front] as ArmPose,
  back: ARMS[back] as ArmPose,
  bob,
  rise: 0,
  ball,
  expression,
});

/** Foulée en suspension : le corps entier monte d'un pixel (aucun membre allongé). */
const airborne = (def: FrameDef): FrameDef => ({ ...def, rise: 1 });

/** Toutes les images d'un joueur, dans l'ordre de la feuille de sprites. */
export const FRAMES: readonly FrameDef[] = [
  // 0-1 arrêt (respiration)
  f('stand', 'hang', 'hang'),
  f('stand', 'hang', 'hang', 1),
  // 2-5 course : bras opposés aux jambes, foulées en suspension
  airborne(f('strideA', 'swingBack', 'swingFwd')),
  f('passA', 'hang', 'hang'),
  airborne(f('strideB', 'swingFwd', 'swingBack')),
  f('passB', 'hang', 'hang'),
  // 6-9 dribble en courant : main devant le corps, ballon devant les jambes
  airborne(f('strideA', 'dribbleHigh', 'guard', 0, 'hand')),
  f('passA', 'dribbleLow', 'guard', 0, 'dribbleMid'),
  airborne(f('strideB', 'dribbleHigh', 'guard', 0, 'dribbleLow')),
  f('passB', 'dribbleLow', 'guard', 0, 'dribbleMid'),
  // 10-11 dribble à l'arrêt
  f('stand', 'dribbleHigh', 'guard', 0, 'hand'),
  f('stand', 'dribbleLow', 'guard', 1, 'dribbleLow'),
  // 12-14 saut / tir (visage concentré)
  f('crouch', 'chest', 'chest', 3, 'chest', 'concentree'),
  f('air', 'raise', 'guide', 0, 'overhead', 'concentree'),
  f('air', 'release', 'guide', 0, undefined, 'concentree'),
  // 15-17 dunk
  f('crouch', 'chest', 'chest', 3, 'chest', 'concentree'),
  f('dunkAir', 'reach', 'swingBack', 0, 'overhead', 'concentree'),
  f('dangle', 'reach', 'reach', 0, undefined, 'concentree'),
  // 18 contre : deux bras tendus vers le haut, jambes du saut (contre, contestation, rebond)
  f('air', 'reach', 'reach', 0, undefined, 'concentree'),
];

/**
 * Les mêmes images vues de dos (mêmes indices, mêmes animations) : course jambes côte à côte et
 * bras qui pompent, dribble sur le côté de la hanche. Le tir et le dunk gardent leurs poses.
 */
export const BACK_FRAMES: readonly FrameDef[] = [
  f('stand', 'hang', 'hang'),
  f('stand', 'hang', 'hang', 1),
  airborne(f('stepLeft', 'pumpFwd', 'pumpBack')),
  f('stand', 'hang', 'hang'),
  airborne(f('stepRight', 'pumpBack', 'pumpFwd')),
  f('stand', 'hang', 'hang'),
  airborne(f('stepLeft', 'dribbleSide', 'pumpBack', 0, 'hand')),
  f('stand', 'dribbleSideLow', 'hang', 0, 'dribbleMid'),
  airborne(f('stepRight', 'dribbleSide', 'pumpFwd', 0, 'dribbleLow')),
  f('stand', 'dribbleSideLow', 'hang', 0, 'dribbleMid'),
  f('stand', 'dribbleSide', 'hang', 0, 'hand'),
  f('stand', 'dribbleSideLow', 'hang', 1, 'dribbleLow'),
  ...FRAMES.slice(12),
];

/**
 * Vue de 3/4 face (le joueur descend en biais, ou tout droit) : mêmes indices et mêmes animations
 * que le profil ; foulées deux fois moins larges, pied du côté de la course 2 px plus haut (plus
 * loin), balancier des bras vers la caméra.
 * Le tir, le dunk et le contre gardent leurs poses (tête, torse et chaussures de la vue).
 */
export const FRONT34_FRAMES: readonly FrameDef[] = [
  f('stand34', 'hang', 'hang'),
  f('stand34', 'hang', 'hang', 1),
  airborne(f('stride34A', 'swingBack34', 'swingFwd34')),
  f('pass34A', 'hang', 'hang'),
  airborne(f('stride34B', 'swingFwd34', 'swingBack34')),
  f('pass34B', 'hang', 'hang'),
  airborne(f('stride34A', 'dribbleHigh', 'guard', 0, 'hand')),
  f('pass34A', 'dribbleLow', 'guard', 0, 'dribbleMid'),
  airborne(f('stride34B', 'dribbleHigh', 'guard', 0, 'dribbleLow')),
  f('pass34B', 'dribbleLow', 'guard', 0, 'dribbleMid'),
  f('stand34', 'dribbleHigh', 'guard', 0, 'hand'),
  f('stand34', 'dribbleLow', 'guard', 1, 'dribbleLow'),
  ...FRAMES.slice(12),
];

/**
 * Vue de 3/4 dos (le joueur monte en biais) : comme de dos (bras qui pompent, dribble sur le côté
 * de la hanche), le pied arrière (à gauche, le plus loin) 2 px plus haut.
 */
export const BACK34_FRAMES: readonly FrameDef[] = [
  f('standB34', 'hang', 'hang'),
  f('standB34', 'hang', 'hang', 1),
  airborne(f('stepB34A', 'pumpFwd', 'pumpBack')),
  f('standB34', 'hang', 'hang'),
  airborne(f('stepB34B', 'pumpBack', 'pumpFwd')),
  f('standB34', 'hang', 'hang'),
  airborne(f('stepB34A', 'dribbleSide', 'pumpBack', 0, 'hand')),
  f('standB34', 'dribbleSideLow', 'hang', 0, 'dribbleMid'),
  airborne(f('stepB34B', 'dribbleSide', 'pumpFwd', 0, 'dribbleLow')),
  f('standB34', 'dribbleSideLow', 'hang', 0, 'dribbleMid'),
  f('standB34', 'dribbleSide', 'hang', 0, 'hand'),
  f('standB34', 'dribbleSideLow', 'hang', 1, 'dribbleLow'),
  ...FRAMES.slice(12),
];

/** Vue d'un joueur : profil, 3/4 face, 3/4 dos ou dos (voir `nextHeading`). */
export type Heading = 'side' | 'front34' | 'back34' | 'back';

/** Images d'une vue (mêmes indices et mêmes animations dans les quatre). */
export function framesFor(heading: Heading): readonly FrameDef[] {
  if (heading === 'back') return BACK_FRAMES;
  if (heading === 'front34') return FRONT34_FRAMES;
  if (heading === 'back34') return BACK34_FRAMES;
  return FRAMES;
}

/** Vue de dos ou de 3/4 dos : pas de visage, numéro dans le dos, bras derrière le torse. */
export function seenFromBehind(heading: Heading): boolean {
  return heading === 'back' || heading === 'back34';
}

export type AnimationName = 'idle' | 'run' | 'dribble' | 'dribbleIdle' | 'shoot' | 'dunk';

/** Animations : images de la feuille et durée de chacune (ms). */
export const ANIMATIONS: Readonly<Record<AnimationName, { frames: number[]; durations: number[]; loop: boolean }>> = {
  idle: { frames: [0, 1], durations: [400, 400], loop: true },
  run: { frames: [2, 3, 4, 5], durations: [90, 90, 90, 90], loop: true },
  dribble: { frames: [6, 7, 8, 9], durations: [125, 125, 125, 125], loop: true },
  dribbleIdle: { frames: [10, 11], durations: [250, 250], loop: true },
  shoot: { frames: [12, 13, 14], durations: [80, 280, 320], loop: false },
  dunk: { frames: [15, 16, 17], durations: [120, 200, 300], loop: false },
};
