/**
 * Corps des joueurs : torses, shorts et chaussures, en grilles originales indexées sur les
 * emplacements de couleur. Deux corpulences (léger / lourd) ; la taille s'obtient en répétant
 * la rangée « étirable » du torse, la largeur en répétant sa colonne étirable (les jambes et
 * les bras sont tracés par le rig).
 *   p/P/q équipe primaire claire/base/sombre · S secondaire (col, liseré) · k encre · w craie
 */

export interface StretchGrid {
  rows: readonly string[];
  /** Rangée dupliquée pour allonger la pièce. */
  stretchRow: number;
  /** Colonne dupliquée pour l'élargir (gabarits plus larges). */
  stretchCol: number;
}

/** Torses de base (largeur minimale de chaque corpulence) ; col rond, sans encolure en V qui collerait au numéro. */
export const TORSOS: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: {
    stretchRow: 2,
    stretchCol: 3,
    rows: ['spPPPSSSPPPs', 'spPPPPPPPPqs', 'pPPPPPPPPPPq', 'pPPPPPPPPPPq', 'pPPPPPPPPPqq', 'pPPPPPPPPPqq', 'qqPPPPPPPqqq'],
  },
  heavy: {
    stretchRow: 2,
    stretchCol: 4,
    rows: [
      '.spPPPSSSPPPPs.',
      'spPPPPPPPPPPPqs',
      'pPPPPPPPPPPPPPq',
      'pPPPPPPPPPPPPPq',
      'pPPPPPPPPPPPPqq',
      'pPPPPPPPPPPPPqq',
      'pPPPPPPPPPPPqqq',
      '.qqPPPPPPPPqqq.',
    ],
  },
};

/** Short : ceinture sombre, bande latérale, liseré du bas ouvert entre les jambes. */
export const SHORTS: Readonly<Record<'light' | 'heavy', StretchGrid>> = {
  light: { stretchRow: 1, stretchCol: 3, rows: ['qqqqqqqqqqqq', 'psPPPPPPPPPq', 'psPPPPqPPPPq', 'psPPP..PPPPq', 'SSSSS..SSSSS'] },
  heavy: {
    stretchRow: 1,
    stretchCol: 3,
    rows: ['qqqqqqqqqqqqqqq', 'psPPPPPPPPPPPPq', 'psPPPPPPPPPPPPq', 'psPPPPPqPPPPPPq', 'psPPPP..PPPPPPq', 'SSSSSS..SSSSSSS'],
  },
};

/** Chaussure tournée vers la droite (dessus encre, semelle craie), 3 rangées. */
export const SHOES: Readonly<Record<'light' | 'heavy', readonly string[]>> = {
  light: ['kkkkk.', 'kkkkkk', 'wwwwww'],
  heavy: ['kkkkkk.', 'kkkkkkk', 'wwwwwww'],
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
