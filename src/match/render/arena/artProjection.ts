import { ART_DEPTH_SCALE, ART_HEIGHT_SCALE, ART_PPM } from '../artConfig';
import type { Point } from '../pixelDraw';

/** Projection 3/4 de la direction artistique cible, avec une origine libre (scène `?style`). */
export interface ArtProjection {
  /** Point (x, y, z) en mètres → pixels à l'écran. */
  project(x: number, y: number, z?: number): Point;
  /** Pixels par mètre : en longueur, en profondeur, en hauteur. */
  ppm: number;
  depthPx: number;
  heightPx: number;
}

export function makeProjection(originX: number, originY: number, ppm = ART_PPM): ArtProjection {
  const depthPx = ppm * ART_DEPTH_SCALE;
  const heightPx = ppm * ART_HEIGHT_SCALE;
  return {
    project: (x, y, z = 0) => ({ x: originX + x * ppm, y: originY + y * depthPx - z * heightPx }),
    ppm,
    depthPx,
    heightPx,
  };
}
