/**
 * Page `?anims` : chaque animation et chaque geste du rendu 2D, joués en boucle à leur vrai rythme
 * (les durées du match : cycle de course, phases du saut, temps des poses au sol), pour juger le
 * mouvement à l'œil. Pur, sans Phaser.
 */
import { GESTURES, LAYOUT_2D, type Gesture } from './sprites/layout';
import { PLAYER_VIEW_TUNING } from './playerView';
import { sheetFrames2D } from './sprites/sheet2d';

/** Une image de la bobine : indice dans le bloc, durée (ms), en l'air ou non. */
export interface ReelFrame {
  frame: number;
  ms: number;
  air: boolean;
}

export interface Reel {
  /** Nom de l'animation ou du geste (`&geste=layup`). */
  id: string;
  label: string;
  frames: ReelFrame[];
}

/** Arrêt (pose de départ) tenu entre deux répétitions d'un geste, pour qu'on en voie le début. */
const REST_MS = 450;
/** Hauteur d'un saut à l'écran (px) : ~0,7 m à 30 px/m, hauteur écrasée à ×0,68. */
export const JUMP_PX = 14;

const t = PLAYER_VIEW_TUNING;

/** Durées (ms) des étapes de chaque geste, calées sur le match (jauge du tir à vitesse normale : ~0,6 s jusqu'au sommet). */
const GESTURE_MS: Record<Gesture, number[]> = {
  jumpShot: [t.gatherMs, 240, 280, t.releaseMs, 300],
  layup: [t.gatherMs, 220, 300, 320],
  dunk: [t.gatherMs, 260, 140, 300],
  block: [140, 300],
  blockOff: [140, 300],
  rebound: [300, 280],
  tipoff: [450],
  pass: [t.passCockMs, t.passMs - t.passCockMs],
  lobPass: [t.passCockMs, t.passMs - t.passCockMs],
  catch: [t.catchMs],
  freeThrow: [600, 600, t.freeThrowReleaseMs, t.freeThrowHoldMs - t.freeThrowReleaseMs],
  landing: [t.landingMs],
  steal: [t.stealMs / 2, t.stealMs / 2],
  offBalance: [300],
};

export const GESTURE_LABELS: Record<Gesture, string> = {
  jumpShot: 'TIR EN SUSPENSION',
  layup: 'LAYUP',
  dunk: 'DUNK',
  block: 'CONTRE (MAIN FORTE)',
  blockOff: 'CONTRE (AUTRE MAIN)',
  rebound: 'REBOND',
  tipoff: 'ENTRE-DEUX',
  pass: 'PASSE A DEUX MAINS',
  lobPass: 'PASSE LOBEE',
  catch: 'RECEPTION D UNE PASSE',
  freeThrow: 'LANCER FRANC',
  landing: 'RECEPTION AU SOL',
  steal: 'VOL',
  offBalance: 'DESEQUILIBRE',
};

function loop(label: string, name: 'idle' | 'run' | 'dribble' | 'dribbleIdle'): Reel {
  const a = LAYOUT_2D.animations[name];
  return { id: name, label, frames: a.frames.map((frame, i) => ({ frame, ms: a.durations[i], air: false })) };
}

/** Les bobines : les animations en boucle, puis chaque geste (suivi d'un temps d'arrêt). */
export function animsReels(): Reel[] {
  const specs = sheetFrames2D();
  const gestures = GESTURES.map((g): Reel => {
    const frames = LAYOUT_2D.gestures[g].map((frame, i) => ({ frame, ms: GESTURE_MS[g][i], air: specs[frame].air ?? false }));
    // Un geste en l'air se termine par la réception au sol.
    if (frames.some((f) => f.air) && g !== 'landing') frames.push({ frame: LAYOUT_2D.gestures.landing[0], ms: t.landingMs, air: false });
    frames.push({ frame: 0, ms: REST_MS, air: false });
    return { id: g, label: GESTURE_LABELS[g], frames };
  });
  return [loop('ARRET', 'idle'), loop('COURSE (600 MS)', 'run'), loop('DRIBBLE EN COURSE', 'dribble'), loop('DRIBBLE A L ARRET', 'dribbleIdle'), ...gestures];
}

export function reelLength(reel: Reel): number {
  return reel.frames.reduce((n, f) => n + f.ms, 0);
}

/** Image de la bobine au temps `ms` (en boucle) : son rang, et la hauteur du saut (px) si elle est en l'air. */
export function reelAt(reel: Reel, ms: number): { index: number; lift: number } {
  const total = reelLength(reel);
  let at = ((ms % total) + total) % total;
  let index = 0;
  while (at >= reel.frames[index].ms) {
    at -= reel.frames[index].ms;
    index++;
  }
  return { index, lift: liftAt(reel, index, at) };
}

/** Hauteur (px) à `at` ms dans l'image `index` : parabole sur la suite d'images en l'air qui la contient. */
export function liftAt(reel: Reel, index: number, at: number): number {
  if (!reel.frames[index].air) return 0;
  let first = index;
  while (first > 0 && reel.frames[first - 1].air) first--;
  let last = index;
  while (last + 1 < reel.frames.length && reel.frames[last + 1].air) last++;
  let total = 0;
  let t0 = 0;
  for (let k = first; k <= last; k++) {
    if (k < index) t0 += reel.frames[k].ms;
    total += reel.frames[k].ms;
  }
  const x = (t0 + at) / total;
  return Math.round(4 * JUMP_PX * x * (1 - x));
}
