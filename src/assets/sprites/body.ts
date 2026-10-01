/**
 * Corps des joueurs : torses, shorts et chaussures, en grilles originales indexées sur les
 * emplacements de couleur. Deux corpulences (léger / lourd) ; la taille s'obtient en répétant
 * la rangée « étirable » du torse (les jambes et les bras sont tracés par le rig).
 *   p/P/q équipe primaire claire/base/sombre · S secondaire (col, liseré) · k encre · w craie
 */

export interface StretchGrid {
  rows: readonly string[];
  /** Rangée dupliquée pour allonger la pièce. */
  stretchRow: number;
}

export const TORSOS: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: {
    stretchRow: 1,
    rows: ['pPPPSSPq', 'pPPPPPPq', 'pPPPPPPq', 'pPPPPPPq', 'qPPPPPqq'],
  },
  heavy: {
    stretchRow: 1,
    rows: ['.pPPPPSSq.', 'pPPPPPPPPq', 'pPPPPPPPPq', 'pPPPPPPPPq', 'pPPPPPPPqq', 'qqPPPPPqq.'],
  },
};

export const SHORTS: Readonly<Record<'light' | 'heavy', readonly string[]>> = {
  light: ['pPPPPPPq', 'pPPPqPPq', 'SSSS.SSS'],
  heavy: ['pPPPPPPPPq', 'pPPPPPPPPq', 'pPPPPqPPPq', 'SSSSS.SSSS'],
};

/** Chaussure tournée vers la droite (dessus encre, semelle craie). */
export const SHOES: Readonly<Record<'light' | 'heavy', readonly string[]>> = {
  light: ['kkkk.', 'wwwww'],
  heavy: ['kkkkk.', 'wwwwww'],
};

/** Allonge une grille en répétant sa rangée étirable jusqu'à `height` rangées. */
export function stretch(grid: StretchGrid, height: number): string[] {
  const extra = Math.max(0, height - grid.rows.length);
  const rows = [...grid.rows];
  rows.splice(grid.stretchRow, 0, ...Array.from({ length: extra }, () => grid.rows[grid.stretchRow]));
  return rows;
}
