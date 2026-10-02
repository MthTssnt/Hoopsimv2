/**
 * Réglages de la direction artistique (docs/ART_DIRECTION.md), utilisés par la scène `?style`.
 * Le match garde ses propres réglages (`config.ts`) jusqu'à l'application du style (S4).
 */
export const ART_VIEW = { width: 640, height: 360 } as const;

/**
 * 30 px/m en longueur ; profondeur ×0,66 et hauteur ×0,68 (vue de 3/4). Même cadrage qu'en
 * 384×216 à 18 px/m (21 m visibles, toute la profondeur), avec 1,67× plus de pixels.
 */
export const ART_PPM = 30;
export const ART_DEPTH_SCALE = 0.66;
export const ART_HEIGHT_SCALE = 0.68;
/** Pixels à l'écran par mètre de hauteur. */
export const ART_PX_PER_M_HEIGHT = ART_PPM * ART_HEIGHT_SCALE;

/** Agrandissement du dessin des joueurs et du ballon (la physique reste à l'échelle réelle), validé sur `?style`. */
export const VISUAL_SCALE = 1.1;
