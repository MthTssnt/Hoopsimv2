import type { CameraMode } from '../settings';

/** Valeurs provisoires, réglables à l'œil. */
export const CAMERA_TUNING = {
  minZoom: 0.5,
  /** Paliers du mode « par paliers », du plus proche au plus large. */
  steps: [1, 0.75, 0.5],
  /** Marge pour quitter un palier vers un zoom plus large : évite les allers-retours. */
  stepHysteresis: 0.06,
  /** Marges autour du joueur et du ballon (px du monde). */
  margin: { x: 36, top: 22, bottom: 14 },
  /** Lissage de la position et du zoom continu (fraction par image à 60 i/s). */
  followLerp: 0.12,
  zoomLerp: 0.06,
} as const;

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Framing {
  centerX: number;
  centerY: number;
  zoom: number;
}

/** Zoom maximal (≤ 1) qui fait tenir la boîte dans la vue. */
export function neededZoom(box: Box, viewWidth: number, viewHeight: number): number {
  const z = Math.min(1, viewWidth / (box.right - box.left), viewHeight / (box.bottom - box.top));
  return Math.max(CAMERA_TUNING.minZoom, z);
}

/** Palier à utiliser, en restant sur le palier courant tant que c'est possible. */
export function stepZoom(needed: number, current: number): number {
  for (const level of CAMERA_TUNING.steps) {
    const tolerance = level === current ? CAMERA_TUNING.stepHysteresis : 0;
    if (level <= needed + tolerance) return level;
  }
  return CAMERA_TUNING.steps[CAMERA_TUNING.steps.length - 1];
}

/**
 * Cadrage visé : centré sur le joueur, puis décalé juste assez pour garder le ballon dans le
 * champ ; dézoom si les deux ne tiennent pas ensemble.
 * `player` est la boîte du joueur (px du monde), `ball` la position du ballon.
 */
export function targetFraming(
  player: Box,
  ball: { x: number; y: number },
  mode: CameraMode,
  currentZoom: number,
  viewWidth: number,
  viewHeight: number,
): Framing {
  const m = CAMERA_TUNING.margin;
  const box: Box = {
    left: Math.min(player.left, ball.x) - m.x,
    right: Math.max(player.right, ball.x) + m.x,
    top: Math.min(player.top, ball.y) - m.top,
    bottom: Math.max(player.bottom, ball.y) + m.bottom,
  };
  const needed = neededZoom(box, viewWidth, viewHeight);
  const zoom = mode === 'steps' ? stepZoom(needed, currentZoom) : needed;
  const halfW = viewWidth / (2 * zoom);
  const halfH = viewHeight / (2 * zoom);
  const fit = (center: number, lo: number, hi: number, half: number): number => {
    if (hi - lo >= 2 * half) return (lo + hi) / 2;
    if (lo < center - half) return lo + half;
    if (hi > center + half) return hi - half;
    return center;
  };
  return {
    centerX: fit((player.left + player.right) / 2, box.left, box.right, halfW),
    centerY: fit((player.top + player.bottom) / 2, box.top, box.bottom, halfH),
    zoom,
  };
}
