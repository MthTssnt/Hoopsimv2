import { DEPTH_SCALE, PIXELS_PER_METER, WORLD_MARGIN, WORLD_SIDE, WORLD_SKY } from '../config';
import { makeProjection, type ArtProjection } from './arena/artProjection';

/**
 * Projection du match : la même vue 3/4 que `?style`, avec l'origine au coin du monde (marge,
 * tribunes derrière la ligne de fond, ciel). Le terrain, les paniers et les joueurs la partagent.
 */
export const MATCH_PROJECTION: ArtProjection = makeProjection(
  (WORLD_MARGIN + WORLD_SIDE) * PIXELS_PER_METER,
  (WORLD_SKY + WORLD_MARGIN * DEPTH_SCALE) * PIXELS_PER_METER,
  PIXELS_PER_METER,
);

/** Position écran (pixels du monde) d'un point (x, y, z) en mètres. */
export function project(x: number, y: number, z = 0): { x: number; y: number } {
  return MATCH_PROJECTION.project(x, y, z);
}

/** Ordre d'affichage : plus un objet est proche du spectateur (y grand), plus il passe devant. */
export function depthOf(y: number): number {
  return 10 + y;
}
