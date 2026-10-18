/**
 * Corps des joueurs vus en diagonale (bas : de 3/4 face ; haut : de 3/4 dos) : torses, shorts et
 * chaussures, en grilles originales indexées sur les emplacements de couleur. Deux corpulences (léger / lourd) ; les gabarits plus grands
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
 * Torse en diagonale bas (de 3/4 face, le joueur tourné vers la droite ; vers la gauche, l'image
 * est retournée), à la largeur et à la hauteur minimales (meneur léger : 11×9). Le flanc qui
 * s'éloigne (2 colonnes à gauche) est au ton sombre ; le devant commence par son bord clair. Le
 * col, centré sur le devant, est décalé vers le sens de la course ; emmanchures aux deux coins,
 * une rangée libre avant le numéro, ourlet sombre.
 */
export const TORSOS_DOWN: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: {
    stretchRow: 3,
    stretchCol: 3,
    rows: ['sqPPPSSSSPs', 'sqPPPPSSPPs', 'qqpPPPPPPPq', 'qqpPPPPPPPq', 'qqpPPPPPPPq', 'qqpPPPPPPPq', 'qqpPPPPPPPq', 'qqpPPPPPPqq', 'qqqPPPPPPqq'],
  },
  heavy: {
    stretchRow: 3,
    stretchCol: 3,
    rows: ['sqPPPPSSSSPs', 'sqPPPPPSSPPs', 'qqpPPPPPPPPq', 'qqpPPPPPPPPq', 'qqpPPPPPPPPq', 'qqpPPPPPPPPq', 'qqpPPPPPPPPq', 'qqpPPPPPPPqq', 'qqqPPPPPPPqq'],
  },
};

/**
 * Torse en diagonale haut (de 3/4 dos, le joueur monte vers la droite) : col droit de dos décalé
 * vers l'arrière, flanc du côté de la course (2 colonnes à droite) au ton sombre ; le numéro va
 * dans le dos.
 */
export const TORSOS_UP: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: {
    stretchRow: 3,
    stretchCol: 6,
    rows: ['sPSSSPPPPqs', 'sPPPPPPPPqs', 'pPPPPPPPPqq', 'pPPPPPPPPqq', 'pPPPPPPPPqq', 'pPPPPPPPPqq', 'pPPPPPPPPqq', 'pPPPPPPPqqq', 'qqPPPPPPqqq'],
  },
  heavy: {
    stretchRow: 3,
    stretchCol: 6,
    rows: ['sPSSSPPPPPqs', 'sPPPPPPPPPqs', 'pPPPPPPPPPqq', 'pPPPPPPPPPqq', 'pPPPPPPPPPqq', 'pPPPPPPPPPqq', 'pPPPPPPPPPqq', 'pPPPPPPPPqqq', 'qqPPPPPPPqqq'],
  },
};

/**
 * Short de 4 rangées : ceinture sombre, bandes latérales, liseré du bas ouvert entre les jambes ;
 * le même flanc de 2 colonnes que le torse (à gauche en diagonale bas, à droite en diagonale haut).
 */
export const SHORTS_DOWN: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: { stretchRow: 1, stretchCol: 3, rows: ['qqqqqqqqqqq', 'qqsPPPPPPsq', 'qqsPPPPPPsq', 'SSSS...SSSS'] },
  heavy: { stretchRow: 1, stretchCol: 3, rows: ['qqqqqqqqqqqq', 'qqsPPPPPPPsq', 'qqsPPPPPPPsq', 'SSSSS...SSSS'] },
};
export const SHORTS_UP: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: { stretchRow: 1, stretchCol: 2, rows: ['qqqqqqqqqqq', 'psPPPPPPsqq', 'psPPPPPPsqq', 'SSSS...SSSS'] },
  heavy: { stretchRow: 1, stretchCol: 2, rows: ['qqqqqqqqqqqq', 'psPPPPPPPsqq', 'psPPPPPPPsqq', 'SSSSS...SSSS'] },
};

/** Chaussure en diagonale bas : la pointe vers la caméra et le sens de la course (5 px de long). */
export const SHOES_DOWN: Readonly<Record<'light' | 'heavy', readonly string[]>> = {
  light: ['kkkk.', 'kkkkk', 'wwwww'],
  heavy: ['kkkkk.', 'kkkkkk', 'wwwwww'],
};

/** Chaussure en diagonale haut : vue du talon, avec un bout de pointe du côté de la course. */
export const SHOES_UP: Readonly<Record<'light' | 'heavy', readonly string[]>> = {
  light: ['kkk.', 'kkkk', 'wwww'],
  heavy: ['kkkk.', 'kkkkk', 'wwwww'],
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
