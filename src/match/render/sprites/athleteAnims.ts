/**
 * Animations de l'échantillon du style en volumes (15 quinquies) : le bas et le haut du corps sont
 * posés séparément, puis combinés (dribble en course = jambes de course + bras du dribble). Les
 * poses sont données pour un joueur tourné vers la droite ; vers la gauche, elles sont retournées
 * (gauche et droite échangées) pour garder le bras proche de la caméra au dribble.
 */
import type { ArmPose, AthleteFacing, AthleteHeading, BallPose, LegPose, LowerPose, UpperPose } from './athlete';

export type SampleAnimation = 'idle' | 'run' | 'dribbleIdle' | 'dribble' | 'shoot';

export interface SampleFrame {
  lower: LowerPose;
  upper: UpperPose;
  /** Durée de l'image (ms). */
  ms: number;
}

/** Une jambe de course à la phase `k` (0-7) : attaque, amorti, passage, poussée, retour, talon haut, avancée, extension. */
const RUN_LEG: readonly LegPose[] = [
  { hip: 0.62, knee: 0.22, foot: 0.25 },
  { hip: 0.34, knee: 0.55, foot: 0 },
  { hip: 0.02, knee: 0.4, foot: 0 },
  { hip: -0.42, knee: 0.35, foot: -0.45 },
  { hip: -0.6, knee: 1.15, foot: -0.75 },
  { hip: -0.25, knee: 1.85, foot: -0.85 },
  { hip: 0.42, knee: 1.65, foot: -0.35 },
  { hip: 0.82, knee: 0.85, foot: 0.15 },
];
/** Hauteur du corps par image de course : écrasé à l'amorti, en suspension après la poussée. */
const RUN_BODY: readonly { bob?: number; lift?: number }[] = [{ bob: 0.6 }, { bob: 1.6 }, { bob: 0.6 }, { lift: 1.4 }, { bob: 0.6 }, { bob: 1.6 }, { bob: 0.6 }, { lift: 1.4 }];

function runLower(f: number): LowerPose {
  return { legs: [RUN_LEG[f % 8], RUN_LEG[(f + 4) % 8]], ...RUN_BODY[f % 8] };
}

/** Bras de course : opposés aux jambes, coudes pliés, épaules qui tournent. */
function runUpper(f: number): UpperPose {
  const swing = (k: number): ArmPose => {
    const hip = RUN_LEG[k % 8].hip;
    const pitch = -hip * 1.15 + 0.15;
    return { pitch, abd: 0.18, elbow: pitch > 0 ? 1.55 : 1.15 };
  };
  // Bras gauche avec la jambe droite, bras droit avec la jambe gauche.
  return { arms: [swing(f + 4), swing(f)], lean: 0.26, turn: 0.14 * Math.sin(((f + 1) / 8) * Math.PI * 2), rise: f % 4 === 1 ? -0.4 : 0 };
}

/** Dribble : 8 images pour une période (0,5 s). Le ballon quitte la main, touche le sol à l'image 3, revient. */
const DRIBBLE_DROP = [0.05, 0.32, 0.68, 1, 0.66, 0.3, 0.08, 0] as const;
/** Bras qui dribble : il pousse le ballon (coude qui s'ouvre), puis remonte avec lui. */
const DRIBBLE_ARM: readonly ArmPose[] = [
  { pitch: 0.75, abd: 0.36, elbow: 0.9 },
  { pitch: 0.62, abd: 0.36, elbow: 0.55 },
  { pitch: 0.58, abd: 0.36, elbow: 0.45 },
  { pitch: 0.64, abd: 0.36, elbow: 0.6 },
  { pitch: 0.72, abd: 0.36, elbow: 0.85 },
  { pitch: 0.8, abd: 0.36, elbow: 1.05 },
  { pitch: 0.82, abd: 0.36, elbow: 1.1 },
  { pitch: 0.8, abd: 0.36, elbow: 1.0 },
];
/** Bras libre : avant-bras devant le corps, il protège le ballon. */
const GUARD: ArmPose = { pitch: 0.55, abd: 0.3, elbow: 1.35 };

/**
 * Dribble. En diagonale bas, de la main du côté de la course (la droite, tourné vers la droite),
 * devant le corps. En diagonale haut, de la main proche de la caméra, sur le côté de la hanche :
 * le ballon reste visible.
 */
function dribbleUpper(f: number, lean: number, heading: AthleteHeading): UpperPose {
  const k = f % 8;
  if (heading === 'up') {
    const arm = DRIBBLE_ARM[k];
    const ball: BallPose = { kind: 'hand', hand: 0, drop: DRIBBLE_DROP[k] };
    return { arms: [{ ...arm, pitch: arm.pitch - 0.35, abd: 0.6 }, GUARD], lean, ball, rise: k === 3 ? -0.3 : 0 };
  }
  const ball: BallPose = { kind: 'hand', hand: 1, drop: DRIBBLE_DROP[k] };
  return { arms: [GUARD, DRIBBLE_ARM[k]], lean, ball, rise: k === 3 ? -0.3 : 0 };
}

/** Garde au dribble à l'arrêt : jambes écartées et fléchies, petit rebond avec le ballon. */
function stanceLower(f: number): LowerPose {
  const k = f % 8;
  return { legs: [{ hip: 0.42, knee: 0.85, out: 0.18 }, { hip: 0.12, knee: 0.75, out: 0.2 }], bob: 1.6 + (k === 3 || k === 4 ? 0.5 : 0) };
}

/** Respiration : 4 images, le buste monte et descend d'un pixel. */
function idleFrame(f: number): SampleFrame {
  const breath = [0, 0.5, 1, 0.5][f % 4];
  return {
    lower: { legs: [{ hip: 0.14, knee: 0.32, out: 0.1 }, { hip: 0.04, knee: 0.26, out: 0.12 }], bob: 0.6 + breath * 0.5 },
    upper: { arms: [{ pitch: 0.18 - breath * 0.04, abd: 0.16, elbow: 0.5 }, { pitch: 0.1, abd: 0.16, elbow: 0.45 }], lean: 0.08, rise: -breath * 0.4 },
    ms: 220,
  };
}

/** Tir : flexion, montée (ballon au-dessus de la tête), lâcher bras tendu, réception. */
const SHOOT: readonly SampleFrame[] = [
  {
    lower: { legs: [{ hip: 0.6, knee: 1.3 }, { hip: 0.4, knee: 1.2 }], bob: 3.4 },
    upper: { arms: [{ pitch: 0.9, abd: 0.2, elbow: 1.7 }, { pitch: 0.85, abd: 0.2, elbow: 1.75 }], lean: 0.18, ball: { kind: 'chest' }, expression: 'concentree' },
    ms: 90,
  },
  {
    lower: { legs: [{ hip: 0.15, knee: 0.35, foot: -0.4 }, { hip: 0.05, knee: 0.3, foot: -0.4 }], lift: 3 },
    upper: { arms: [{ pitch: 2.3, abd: 0.3, elbow: 1.2 }, { pitch: 2.5, abd: 0.15, elbow: 1.3 }], lean: -0.04, ball: { kind: 'overhead', hand: 1 }, expression: 'concentree' },
    ms: 260,
  },
  {
    lower: { legs: [{ hip: 0.1, knee: 0.3, foot: -0.5 }, { hip: 0.0, knee: 0.25, foot: -0.5 }], lift: 4.5 },
    upper: { arms: [{ pitch: 2.2, abd: 0.35, elbow: 0.9 }, { pitch: 2.75, abd: 0.12, elbow: 0.25 }], lean: -0.06, expression: 'concentree' },
    ms: 300,
  },
  {
    lower: { legs: [{ hip: 0.45, knee: 0.95 }, { hip: 0.3, knee: 0.85 }], bob: 2.4 },
    upper: { arms: [{ pitch: 1.0, abd: 0.3, elbow: 0.9 }, { pitch: 1.6, abd: 0.15, elbow: 0.5 }], lean: 0.12, expression: 'concentree' },
    ms: 160,
  },
];

/** Durée d'une image de course ou de dribble : 8 images en 0,5 s (une période de dribble, deux foulées). */
export const CYCLE_MS = 62.5;

export function sampleFrames(anim: SampleAnimation, heading: AthleteHeading = 'down'): SampleFrame[] {
  const eight = Array.from({ length: 8 }, (_, f) => f);
  switch (anim) {
    case 'idle':
      return [0, 1, 2, 3].map(idleFrame);
    case 'run':
      return eight.map((f) => ({ lower: runLower(f), upper: runUpper(f), ms: CYCLE_MS }));
    case 'dribbleIdle':
      return eight.map((f) => ({ lower: stanceLower(f), upper: dribbleUpper(f, 0.22, heading), ms: CYCLE_MS }));
    case 'dribble':
      return eight.map((f) => ({ lower: runLower(f), upper: dribbleUpper(f, 0.3, heading), ms: CYCLE_MS }));
    case 'shoot':
      return SHOOT.slice();
  }
}

/** Retourne une pose pour un joueur tourné vers la gauche : gauche et droite échangées. */
export function mirrorPose(frame: SampleFrame, facing: AthleteFacing): SampleFrame {
  if (facing === 'right') return frame;
  const { lower, upper } = frame;
  const swap = <T>(pair: readonly [T, T]): [T, T] => [pair[1], pair[0]];
  let ball = upper.ball;
  if (ball && ball.kind !== 'chest') ball = { ...ball, hand: ball.hand === 0 ? 1 : 0 };
  return { ...frame, lower: { ...lower, legs: swap(lower.legs) }, upper: { ...upper, arms: swap(upper.arms), turn: -(upper.turn ?? 0), ball } };
}
