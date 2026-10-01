import { ART_PX_PER_M_HEIGHT } from '../artConfig';

/** Cadre d'un sprite de joueur : pieds au milieu du bord bas (la rangée du sol est le contour sous la semelle). */
export const FRAME = { width: 40, height: 56, centerX: 20, groundY: 55 } as const;
/** Rangée des chaussettes d'un pied posé (chaussure sur les 2 rangées dessous, puis le contour). */
export const SOCK_Y = FRAME.groundY - 3;
export const HEAD_SIZE = 10;
const SHOE_ROWS = 2;

/** Dimensions du corps (px) pour un joueur, selon sa taille, sa corpulence et l'échelle visuelle. */
export interface BodyDims {
  height: number;
  torso: number;
  shorts: number;
  legs: number;
  arm: number;
  heavy: boolean;
  /** Épaisseur des jambes (px). */
  limb: number;
}

export function bodyDims(heightCm: number, heavy: boolean, scale: number): BodyDims {
  const height = Math.max(24, Math.min(46, Math.round((heightCm / 100) * ART_PX_PER_M_HEIGHT * scale)));
  const shorts = heavy ? 4 : 3;
  const rest = height - HEAD_SIZE - SHOE_ROWS - shorts;
  const torso = Math.max(heavy ? 6 : 5, Math.round(rest * 0.42));
  const legs = Math.max(3, rest - torso);
  return { height, torso, shorts, legs, arm: torso + shorts - 1 + (heightCm > 205 ? 1 : 0), heavy, limb: heavy ? 3 : 2 };
}

/** Jambe : genou [kx, ky] et pied [fx, lift], en fractions de la longueur de jambe. */
export interface LegPose {
  knee: [number, number];
  foot: [number, number];
}
/** Bras : coude et main, en fractions de la longueur du bras (y vers le bas). */
export interface ArmPose {
  elbow: [number, number];
  hand: [number, number];
}

const LEGS = {
  stand: { back: { knee: [-0.06, 0.5], foot: [-0.12, 0] }, front: { knee: [0.06, 0.5], foot: [0.12, 0] } },
  strideA: { back: { knee: [-0.25, 0.55], foot: [-0.6, 0.3] }, front: { knee: [0.3, 0.45], foot: [0.55, 0] } },
  passA: { back: { knee: [0.08, 0.45], foot: [-0.15, 0.4] }, front: { knee: [0, 0.5], foot: [0, 0] } },
  strideB: { back: { knee: [0.3, 0.45], foot: [0.55, 0] }, front: { knee: [-0.25, 0.55], foot: [-0.6, 0.3] } },
  passB: { back: { knee: [0, 0.5], foot: [0, 0] }, front: { knee: [0.08, 0.45], foot: [-0.15, 0.4] } },
  crouch: { back: { knee: [0.2, 0.45], foot: [-0.1, 0] }, front: { knee: [0.3, 0.45], foot: [0.1, 0] } },
  air: { back: { knee: [0.15, 0.5], foot: [-0.35, 0.35] }, front: { knee: [0.3, 0.4], foot: [0.15, 0.25] } },
  dunkAir: { back: { knee: [0.1, 0.55], foot: [-0.3, 0.2] }, front: { knee: [0.55, 0.15], foot: [0.4, 0.55] } },
  hang: { back: { knee: [-0.05, 0.5], foot: [-0.1, 0.05] }, front: { knee: [0.05, 0.5], foot: [0.15, 0.1] } },
} satisfies Record<string, { back: LegPose; front: LegPose }>;

const ARMS = {
  hang: { elbow: [0.05, 0.5], hand: [0.1, 0.95] },
  swingF: { elbow: [0.2, 0.45], hand: [0.55, 0.7] },
  swingB: { elbow: [-0.2, 0.45], hand: [-0.4, 0.75] },
  dribbleHigh: { elbow: [0.3, 0.4], hand: [0.6, 0.7] },
  dribbleLow: { elbow: [0.35, 0.45], hand: [0.65, 0.85] },
  guard: { elbow: [-0.25, 0.35], hand: [-0.35, 0.6] },
  gather: { elbow: [0.3, 0.6], hand: [0.55, 0.35] },
  raise: { elbow: [0.4, -0.15], hand: [0.3, -0.7] },
  release: { elbow: [0.45, -0.45], hand: [0.6, -0.85] },
  guide: { elbow: [0.25, -0.1], hand: [0.2, -0.6] },
  dunkReach: { elbow: [0.5, -0.4], hand: [0.85, -0.75] },
  hangRim: { elbow: [0.35, -0.55], hand: [0.5, -1] },
} satisfies Record<string, ArmPose>;

/** Où dessiner le ballon tenu : dans la main, au-dessus, ou en cours de dribble. */
export type BallSpot = 'hand' | 'overhead' | 'dribbleMid' | 'dribbleLow';

export interface FrameDef {
  legs: { back: LegPose; front: LegPose };
  front: ArmPose;
  back: ArmPose;
  /** Décalage vertical du haut du corps (px, vers le bas). */
  bob: number;
  ball?: BallSpot;
}

const f = (legs: keyof typeof LEGS, front: keyof typeof ARMS, back: keyof typeof ARMS, bob = 0, ball?: BallSpot): FrameDef => ({
  legs: LEGS[legs] as FrameDef['legs'],
  front: ARMS[front] as ArmPose,
  back: ARMS[back] as ArmPose,
  bob,
  ball,
});

/** Toutes les images d'un joueur, dans l'ordre de la feuille de sprites. */
export const FRAMES: readonly FrameDef[] = [
  // 0-1 arrêt
  f('stand', 'hang', 'hang'),
  f('stand', 'hang', 'hang', 1),
  // 2-5 course
  f('strideA', 'swingB', 'swingF'),
  f('passA', 'hang', 'hang', -1),
  f('strideB', 'swingF', 'swingB'),
  f('passB', 'hang', 'hang', -1),
  // 6-9 dribble en courant
  f('strideA', 'dribbleHigh', 'guard', 0, 'hand'),
  f('passA', 'dribbleLow', 'guard', -1, 'dribbleMid'),
  f('strideB', 'dribbleHigh', 'guard', 0, 'dribbleLow'),
  f('passB', 'dribbleLow', 'guard', -1, 'dribbleMid'),
  // 10-11 dribble à l'arrêt
  f('stand', 'dribbleHigh', 'guard', 0, 'hand'),
  f('stand', 'dribbleLow', 'guard', 1, 'dribbleLow'),
  // 12-14 saut / tir
  f('crouch', 'gather', 'gather', 2, 'hand'),
  f('air', 'raise', 'guide', 0, 'overhead'),
  f('air', 'release', 'guide'),
  // 15-17 dunk
  f('crouch', 'gather', 'hang', 2, 'hand'),
  f('dunkAir', 'dunkReach', 'swingB', 0, 'hand'),
  f('hang', 'hangRim', 'hang'),
];

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
