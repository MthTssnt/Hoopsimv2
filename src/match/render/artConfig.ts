/**
 * Réglages de la direction artistique cible (docs/ART_DIRECTION.md), utilisés par la scène
 * `?style`. Le match garde ses propres réglages (`config.ts`) jusqu'à la validation du style.
 */
export const ART_VIEW = { width: 384, height: 216 } as const;

/** 18 px/m en longueur ; profondeur ×0,66 et hauteur ×0,68 (vue de 3/4). */
export const ART_PPM = 18;
export const ART_DEPTH_SCALE = 0.66;
export const ART_HEIGHT_SCALE = 0.68;
/** Pixels à l'écran par mètre de hauteur. */
export const ART_PX_PER_M_HEIGHT = ART_PPM * ART_HEIGHT_SCALE;

/** Agrandissement du dessin des joueurs (la physique reste à l'échelle réelle). */
export const VISUAL_SCALES = [1.1, 1.25, 1.4] as const;
export type VisualScale = (typeof VISUAL_SCALES)[number];
/** Valeur demandée par Matheo, à confirmer sur `?style`. */
export const DEFAULT_VISUAL_SCALE: VisualScale = 1.4;
