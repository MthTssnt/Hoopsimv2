import { COURT_LENGTH, COURT_WIDTH } from './physics/court';
import { ART_DEPTH_SCALE, ART_HEIGHT_SCALE, ART_PPM, ART_VIEW } from './render/artConfig';

// Résolution interne du rendu pixel-art, mise à l'échelle entière (×3 en 1080p plein écran).
export const VIEW_WIDTH = ART_VIEW.width;
export const VIEW_HEIGHT = ART_VIEW.height;

/**
 * Projection du monde 3D (mètres) vers l'écran (pixels du monde) : vue plongeante de 3/4,
 * validée dans `?style` (voir `docs/ART_DIRECTION.md`). La profondeur (y) et la hauteur (z) sont
 * écrasées d'environ 2/3 par rapport à la longueur (x). À 30 px/m, les 640 px de large
 * couvrent ~21 m et toute la profondeur du terrain tient à l'écran (~302 px).
 */
export const PIXELS_PER_METER = ART_PPM;
/** Écrasement de la profondeur (y) à l'écran. */
export const DEPTH_SCALE = ART_DEPTH_SCALE;
/** Écrasement de la hauteur (z) à l'écran. */
export const HEIGHT_SCALE = ART_HEIGHT_SCALE;
/** Marge hors-jeu autour des lignes (m). */
export const WORLD_MARGIN = 2;
/** Tribunes derrière chaque ligne de fond, au-delà de la marge (m) : la caméra peut s'y décaler. */
export const WORLD_SIDE = 2.5;
/**
 * Bande au-dessus de la marge du fond (m, à l'échelle de l'écran) : tribunes, cloche des tirs,
 * et assez de place pour que le monde reste plus grand que la vue au zoom minimal.
 */
export const WORLD_SKY = 5.5;

/**
 * Bandes aux couleurs de l'équipe autour des lignes (m) : au fond, devant, derrière chaque ligne
 * de fond. Elles couvrent toute la zone où un joueur peut aller (`PLAYER_TUNING.boundsMargin`).
 */
export const ARENA_APRON = { far: 1.6, near: WORLD_MARGIN, baseline: WORLD_MARGIN } as const;

export const WORLD_WIDTH = Math.ceil((COURT_LENGTH + 2 * (WORLD_MARGIN + WORLD_SIDE)) * PIXELS_PER_METER);
export const WORLD_HEIGHT = Math.ceil((WORLD_SKY + (COURT_WIDTH + 2 * WORLD_MARGIN) * DEPTH_SCALE) * PIXELS_PER_METER);
