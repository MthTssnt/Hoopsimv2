/**
 * Corps des joueurs vus de face : torses, shorts et chaussures, en grilles originales indexées
 * sur les emplacements de couleur. Deux corpulences (léger / lourd) ; les gabarits plus grands
 * répètent la rangée « étirable » du torse, les plus larges sa colonne étirable (bras et
 * jambes, de longueur fixe, sont tracés par le rig).
 *   p/P/q équipe primaire claire/base/sombre · S secondaire (col, liseré) · k encre · w craie
 */

export interface StretchGrid {
  rows: readonly string[];
  /** Rangée dupliquée pour allonger la pièce. */
  stretchRow: number;
  /** Colonne dupliquée pour l'élargir (gabarits plus larges). */
  stretchCol: number;
}

/**
 * Torse vu de face, à la largeur et à la hauteur minimales (meneur léger : 11×9) ; col rond sur
 * les deux rangées du haut, emmanchures aux deux coins, une rangée libre avant le numéro,
 * ourlet sombre.
 */
export const TORSOS: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: {
    stretchRow: 3,
    stretchCol: 2,
    rows: ['sPPSSSSSPPs', 'sPPPSSSPPPs', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPqq', 'qqPPPPPPPqq'],
  },
  heavy: {
    stretchRow: 3,
    stretchCol: 2,
    rows: ['sPPPSSSSSPPs', 'sPPPPSSSPPPs', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPqq', 'qqPPPPPPPPqq'],
  },
};

/** Torse vu de dos : col droit et étroit (pas d'encolure), le reste comme de face ; le numéro va dans le dos. */
export const TORSOS_BACK: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: {
    stretchRow: 3,
    stretchCol: 2,
    rows: ['sPPPSSSPPPs', 'sPPPPPPPPPs', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPPq', 'pPPPPPPPPqq', 'qqPPPPPPPqq'],
  },
  heavy: {
    stretchRow: 3,
    stretchCol: 2,
    rows: ['sPPPPSSSPPPs', 'sPPPPPPPPPPs', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPqq', 'qqPPPPPPPPqq'],
  },
};

/** Short de 4 rangées : ceinture sombre, bandes latérales, liseré du bas ouvert entre les jambes. */
export const SHORTS: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: { stretchRow: 1, stretchCol: 2, rows: ['qqqqqqqqqqq', 'psPPPPPPPsq', 'psPPPPPPPsq', 'SSSS...SSSS'] },
  heavy: { stretchRow: 1, stretchCol: 2, rows: ['qqqqqqqqqqqq', 'psPPPPPPPPsq', 'psPPPPPPPPsq', 'SSSSS...SSSS'] },
};

/** Chaussure (3 rangées : dessus encre, semelle craie), la pointe vers la droite. */
export const SHOES: Readonly<Record<'light' | 'heavy', readonly string[]>> = {
  light: ['kkkk..', 'kkkkkk', 'wwwwww'],
  heavy: ['kkkkk..', 'kkkkkkk', 'wwwwwww'],
};

/** Chaussure vue du talon, à la largeur de la jambe (3 ou 4 px). */
export const SHOES_BACK: Readonly<Record<'light' | 'heavy', readonly string[]>> = {
  light: ['kkk', 'kkk', 'www'],
  heavy: ['kkkk', 'kkkk', 'wwww'],
};

/** Allonge une grille en répétant sa rangée étirable jusqu'à `height` rangées. */
export function stretch(grid: StretchGrid, height: number): string[] {
  const extra = Math.max(0, height - grid.rows.length);
  const rows = [...grid.rows];
  rows.splice(grid.stretchRow, 0, ...Array.from({ length: extra }, () => grid.rows[grid.stretchRow]));
  return rows;
}

/** Élargit une grille en répétant sa colonne étirable jusqu'à `width` colonnes. */
export function widen(rows: readonly string[], stretchCol: number, width: number): string[] {
  const extra = Math.max(0, width - rows[0].length);
  return rows.map((row) => row.slice(0, stretchCol) + row[stretchCol].repeat(extra + 1) + row.slice(stretchCol + 1));
}
