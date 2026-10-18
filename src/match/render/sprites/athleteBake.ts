import type Phaser from 'phaser';
import { athleteSlotColor, renderAthlete, type AthleteColors, type AthleteFacing, type AthleteFrame, type AthleteHeading, type AthleteLook } from './athlete';
import { mirrorPose, sampleFrames, type SampleAnimation } from './athleteAnims';
import { bakeFrames } from './bake';

/** Animations de l'échantillon, dans l'ordre de la feuille. */
export const SAMPLE_ANIMATIONS: readonly SampleAnimation[] = ['idle', 'run', 'dribbleIdle', 'dribble', 'shoot'];
/** Les 4 positions, dans l'ordre des blocs de la feuille. */
export const SAMPLE_VIEWS: readonly { heading: AthleteHeading; facing: AthleteFacing }[] = [
  { heading: 'down', facing: 'right' },
  { heading: 'down', facing: 'left' },
  { heading: 'up', facing: 'right' },
  { heading: 'up', facing: 'left' },
];

export interface BakedAthlete {
  key: string;
  /** Ballon tenu de chaque image de la feuille, ou null. */
  balls: (AthleteFrame['ball'] | null)[];
  /** Indice dans la feuille de l'image `k` d'une animation, dans une position. */
  frameOf(anim: SampleAnimation, heading: AthleteHeading, facing: AthleteFacing, k: number): number;
  /** Clé de l'animation Phaser d'une animation dans une position. */
  animKey(anim: SampleAnimation, heading: AthleteHeading, facing: AthleteFacing): string;
}

/** Images d'un joueur pour toutes les animations demandées, dans les 4 positions (ordre de la feuille). */
export function athleteSheet(look: AthleteLook, anims: readonly SampleAnimation[] = SAMPLE_ANIMATIONS) {
  const frames: AthleteFrame[] = [];
  const starts = new Map<string, number>();
  const durations = new Map<string, number[]>();
  for (const { heading, facing } of SAMPLE_VIEWS) {
    for (const anim of anims) {
      starts.set(`${anim}:${heading}:${facing}`, frames.length);
      const list = sampleFrames(anim, heading).map((f) => mirrorPose(f, facing));
      durations.set(anim, list.map((f) => f.ms));
      for (const f of list) frames.push(renderAthlete(look, f.lower, f.upper, heading, facing));
    }
  }
  return { frames, starts, durations };
}

/**
 * Cuit un joueur de l'échantillon (15 quinquies) : une texture en grille et une animation Phaser
 * par animation et par position, jouées en boucle (le tir se rejoue après une pause).
 */
export function bakeAthlete(scene: Phaser.Scene, key: string, look: AthleteLook, colors: AthleteColors, anims: readonly SampleAnimation[] = SAMPLE_ANIMATIONS): BakedAthlete {
  const { frames, starts, durations } = athleteSheet(look, anims);
  bakeFrames(
    scene,
    key,
    frames.map((f) => f.canvas),
    (slot) => athleteSlotColor(slot, colors),
  );
  const animKey = (anim: SampleAnimation, heading: AthleteHeading, facing: AthleteFacing) => `${key}:${anim}:${heading}:${facing}`;
  for (const { heading, facing } of SAMPLE_VIEWS) {
    for (const anim of anims) {
      const k = animKey(anim, heading, facing);
      if (scene.anims.exists(k)) scene.anims.remove(k);
      const ms = durations.get(anim)!;
      const base = Math.min(...ms);
      const start = starts.get(`${anim}:${heading}:${facing}`)!;
      scene.anims.create({
        key: k,
        frames: ms.map((d, j) => ({ key, frame: start + j, duration: d - base })),
        frameRate: 1000 / base,
        repeat: -1,
        repeatDelay: anim === 'shoot' ? 500 : 0,
      });
    }
  }
  return {
    key,
    balls: frames.map((f) => f.ball),
    frameOf: (anim, heading, facing, k) => starts.get(`${anim}:${heading}:${facing}`)! + k,
    animKey,
  };
}
