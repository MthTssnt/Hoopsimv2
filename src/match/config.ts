import { COURT_LENGTH, COURT_WIDTH } from './physics/court';

// Résolution interne du rendu pixel-art (mise à l'échelle entière par Phaser).
export const VIEW_WIDTH = 320;
export const VIEW_HEIGHT = 180;

/**
 * Projection du monde 3D (mètres) vers l'écran (pixels du monde), valeurs provisoires :
 * vue de côté, la profondeur y est écrasée et la hauteur z remonte à l'écran.
 * À 20 px/m, les 320 px de large couvrent 16 m : un peu plus d'un demi-terrain.
 */
export const PIXELS_PER_METER = 20;
/** Écrasement de la profondeur (y) à l'écran. */
export const DEPTH_SCALE = 0.35;
/** Bande de parquet autour des lignes (m). */
export const WORLD_MARGIN = 2;
/**
 * Hauteur de ciel au-dessus de la ligne de touche du fond (m) : place pour la cloche des tirs,
 * et assez pour que le monde reste plus grand que la vue au zoom minimal de la caméra.
 */
export const WORLD_SKY = 11.5;

export const WORLD_WIDTH = Math.ceil((COURT_LENGTH + 2 * WORLD_MARGIN) * PIXELS_PER_METER);
export const WORLD_HEIGHT = Math.ceil((WORLD_SKY + (COURT_WIDTH + 2 * WORLD_MARGIN) * DEPTH_SCALE) * PIXELS_PER_METER);
