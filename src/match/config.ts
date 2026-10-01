import { COURT_LENGTH, COURT_WIDTH } from './physics/court';

// Résolution interne du rendu pixel-art (×4 en 1080p, ×8 en 4K).
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 270;

/**
 * Projection du monde 3D (mètres) vers l'écran (pixels du monde) : vue plongeante de 3/4,
 * calée sur la référence de Matheo. La profondeur (y) et la hauteur (z) sont écrasées d'environ
 * 2/3 par rapport à la longueur (x). À 20 px/m, les 480 px de large couvrent 24 m ; toute la
 * profondeur du terrain tient à l'écran (~200 px) et un joueur de 2 m mesure ~27 px.
 */
export const PIXELS_PER_METER = 20;
/** Écrasement de la profondeur (y) à l'écran. */
export const DEPTH_SCALE = 0.66;
/** Écrasement de la hauteur (z) à l'écran. */
export const HEIGHT_SCALE = 0.68;
/** Marge hors-jeu autour des lignes (m). */
export const WORLD_MARGIN = 2;
/** Tribunes derrière chaque ligne de fond, au-delà de la marge (m) : la caméra peut s'y décaler. */
export const WORLD_SIDE = 2.5;
/**
 * Bande au-dessus de la marge du fond (m, à l'échelle de l'écran) : tribunes, cloche des tirs,
 * et assez de place pour que le monde reste plus grand que la vue au zoom minimal.
 */
export const WORLD_SKY = 5.5;

export const WORLD_WIDTH = Math.ceil((COURT_LENGTH + 2 * (WORLD_MARGIN + WORLD_SIDE)) * PIXELS_PER_METER);
export const WORLD_HEIGHT = Math.ceil((WORLD_SKY + (COURT_WIDTH + 2 * WORLD_MARGIN) * DEPTH_SCALE) * PIXELS_PER_METER);
