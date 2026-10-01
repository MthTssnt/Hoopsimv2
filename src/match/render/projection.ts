import { DEPTH_SCALE, HEIGHT_SCALE, PIXELS_PER_METER, WORLD_MARGIN, WORLD_SIDE, WORLD_SKY } from '../config';

/** Position écran (pixels du monde) d'un point (x, y, z) en mètres. */
export function project(x: number, y: number, z = 0): { x: number; y: number } {
  return {
    x: (x + WORLD_MARGIN + WORLD_SIDE) * PIXELS_PER_METER,
    y: (WORLD_SKY + (y + WORLD_MARGIN) * DEPTH_SCALE - z * HEIGHT_SCALE) * PIXELS_PER_METER,
  };
}

/** Hauteur à l'écran (px) d'un objet de `meters` de haut. */
export function screenHeight(meters: number): number {
  return meters * HEIGHT_SCALE * PIXELS_PER_METER;
}

/** Ordre d'affichage : plus un objet est proche du spectateur (y grand), plus il passe devant. */
export function depthOf(y: number): number {
  return 10 + y;
}
