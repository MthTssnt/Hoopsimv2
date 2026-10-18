/**
 * Réglages de la direction artistique (docs/ART_DIRECTION.md), utilisés par la scène `?style`.
 * Le match garde ses propres réglages (`config.ts`) jusqu'à l'application du style (S4).
 */
export const ART_VIEW = { width: 640, height: 360 } as const;

/**
 * 30 px/m en longueur ; profondeur ×0,66 et hauteur ×0,68 (vue de 3/4). Cadrage validé :
 * 21,3 m visibles, toute la profondeur du terrain. Les sprites des joueurs ont leurs propres
 * règles en pixels (joueur standard de 43 px), indépendantes de cette échelle.
 */
export const ART_PPM = 30;
export const ART_DEPTH_SCALE = 0.66;
export const ART_HEIGHT_SCALE = 0.68;
/** Pixels à l'écran par mètre de hauteur. */
export const ART_PX_PER_M_HEIGHT = ART_PPM * ART_HEIGHT_SCALE;

/** Convertit une épaisseur réglée à 30 px/m (640×360) à l'échelle courante, au moins 1 px. */
export function artPx(px30: number): number {
  return Math.max(1, Math.round((px30 * ART_PPM) / 30));
}
