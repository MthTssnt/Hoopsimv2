/**
 * Police pixel maison (asset original, dessiné en code) : glyphes 5×7 en majuscules, chiffres
 * et ponctuation de base ; les accents sont ramenés à la lettre de base. Chiffres 3×5 pour les
 * numéros de maillot.
 */
export const GLYPH_W = 5;
export const GLYPH_H = 7;

const G = (rows: string): string[] => rows.trim().split(/\s+/);

const GLYPHS: Record<string, string[]> = {
  A: G('.###. #...# #...# ##### #...# #...# #...#'),
  B: G('####. #...# #...# ####. #...# #...# ####.'),
  C: G('.###. #...# #.... #.... #.... #...# .###.'),
  D: G('####. #...# #...# #...# #...# #...# ####.'),
  E: G('##### #.... #.... ####. #.... #.... #####'),
  F: G('##### #.... #.... ####. #.... #.... #....'),
  G: G('.###. #...# #.... #.### #...# #...# .####'),
  H: G('#...# #...# #...# ##### #...# #...# #...#'),
  I: G('.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.'),
  J: G('..### ...#. ...#. ...#. #..#. #..#. .##..'),
  K: G('#...# #..#. #.#.. ##... #.#.. #..#. #...#'),
  L: G('#.... #.... #.... #.... #.... #.... #####'),
  M: G('#...# ##.## #.#.# #.#.# #...# #...# #...#'),
  N: G('#...# #...# ##..# #.#.# #..## #...# #...#'),
  O: G('.###. #...# #...# #...# #...# #...# .###.'),
  P: G('####. #...# #...# ####. #.... #.... #....'),
  Q: G('.###. #...# #...# #...# #.#.# #..#. .##.#'),
  R: G('####. #...# #...# ####. #.#.. #..#. #...#'),
  S: G('.#### #.... #.... .###. ....# ....# ####.'),
  T: G('##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..'),
  U: G('#...# #...# #...# #...# #...# #...# .###.'),
  V: G('#...# #...# #...# #...# #...# .#.#. ..#..'),
  W: G('#...# #...# #...# #.#.# #.#.# #.#.# .#.#.'),
  X: G('#...# #...# .#.#. ..#.. .#.#. #...# #...#'),
  Y: G('#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..'),
  Z: G('##### ....# ...#. ..#.. .#... #.... #####'),
  '0': G('.###. #...# #..## #.#.# ##..# #...# .###.'),
  '1': G('..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.'),
  '2': G('.###. #...# ....# ...#. ..#.. .#... #####'),
  '3': G('####. ....# ....# .###. ....# ....# ####.'),
  '4': G('...#. ..##. .#.#. #..#. ##### ...#. ...#.'),
  '5': G('##### #.... ####. ....# ....# #...# .###.'),
  '6': G('..##. .#... #.... ####. #...# #...# .###.'),
  '7': G('##### ....# ...#. ..#.. .#... .#... .#...'),
  '8': G('.###. #...# #...# .###. #...# #...# .###.'),
  '9': G('.###. #...# #...# .#### ....# ...#. .##..'),
  '.': G('..... ..... ..... ..... ..... .##.. .##..'),
  ',': G('..... ..... ..... ..... .##.. ..#.. .#...'),
  '-': G('..... ..... ..... .###. ..... ..... .....'),
  "'": G('..#.. ..#.. .#... ..... ..... ..... .....'),
  ':': G('..... .##.. .##.. ..... .##.. .##.. .....'),
  '/': G('....# ....# ...#. ..#.. .#... #.... #....'),
  '%': G('##..# ##..# ...#. ..#.. .#... #..## #..##'),
  '!': G('..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..'),
  '?': G('.###. #...# ....# ...#. ..#.. ..... ..#..'),
  '+': G('..... ..#.. ..#.. ##### ..#.. ..#.. .....'),
};

const MINI_DIGITS: string[][] = [
  G('### #.# #.# #.# ###'),
  G('.#. ##. .#. .#. ###'),
  G('### ..# ### #.. ###'),
  G('### ..# .## ..# ###'),
  G('#.# #.# ### ..# ..#'),
  G('### #.. ### ..# ###'),
  G('### #.. ### #.# ###'),
  G('### ..# ..# .#. .#.'),
  G('### #.# ### #.# ###'),
  G('### #.# ### ..# ###'),
];

/** Petite police 3×5 à chasse variable (M, N, W plus larges) pour les étiquettes sous les joueurs. */
export const SMALL_H = 5;

const SMALL_GLYPHS: Record<string, string[]> = {
  A: G('.#. #.# ### #.# #.#'),
  B: G('##. #.# ##. #.# ##.'),
  C: G('.## #.. #.. #.. .##'),
  D: G('##. #.# #.# #.# ##.'),
  E: G('### #.. ##. #.. ###'),
  F: G('### #.. ##. #.. #..'),
  G: G('.## #.. #.# #.# .##'),
  H: G('#.# #.# ### #.# #.#'),
  I: G('### .#. .#. .#. ###'),
  J: G('..# ..# ..# #.# .#.'),
  K: G('#.# #.# ##. #.# #.#'),
  L: G('#.. #.. #.. #.. ###'),
  M: G('#...# ##.## #.#.# #...# #...#'),
  N: G('#..# ##.# #.## #..# #..#'),
  O: G('.#. #.# #.# #.# .#.'),
  P: G('##. #.# ##. #.. #..'),
  Q: G('.#. #.# #.# ##. .##'),
  R: G('##. #.# ##. #.# #.#'),
  S: G('.## #.. .#. ..# ##.'),
  T: G('### .#. .#. .#. .#.'),
  U: G('#.# #.# #.# #.# ###'),
  V: G('#.# #.# #.# #.# .#.'),
  W: G('#...# #...# #.#.# ##.## #...#'),
  X: G('#.# #.# .#. #.# #.#'),
  Y: G('#.# #.# .#. .#. .#.'),
  Z: G('### ..# .#. #.. ###'),
  ...Object.fromEntries(MINI_DIGITS.map((glyph, digit) => [String(digit), glyph])),
  '.': G('. . . . #'),
  ',': G('. . . # #'),
  "'": G('# # . . .'),
  '-': G('.. .. ## .. ..'),
  ':': G('. # . # .'),
  '(': G('.# #. #. #. .#'),
  ')': G('#. .# .# .# #.'),
  '?': G('##. ..# .#. ... .#.'),
  ' ': G('.. .. .. .. ..'),
};

const smallGlyph = (char: string): string[] => SMALL_GLYPHS[char] ?? SMALL_GLYPHS['?'];

export function hasSmallGlyph(char: string): boolean {
  return char in SMALL_GLYPHS;
}

/** Largeur (px) d'un texte en petite police, un pixel entre les lettres. */
export function smallTextWidth(text: string): number {
  const chars = [...normalizeText(text)];
  return chars.length === 0 ? 0 : chars.reduce((w, char) => w + smallGlyph(char)[0].length + 1, -1);
}

/** Dessine un texte en petite police 3×5 (caractère inconnu → « ? »). */
export function drawSmallText(target: PixelTarget, text: string, x: number, y: number): void {
  let cx = x;
  for (const char of normalizeText(text)) {
    const glyph = smallGlyph(char);
    for (let gy = 0; gy < SMALL_H; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) if (glyph[gy][gx] === '#') target.fillRect(cx + gx, y + gy, 1, 1);
    }
    cx += glyph[0].length + 1;
  }
}

/** Toute surface où l'on peut poser des pixels (un Graphics de Phaser, un tampon de test…). */
export interface PixelTarget {
  fillRect(x: number, y: number, width: number, height: number): unknown;
}

/** Majuscules sans accents ; les apostrophes typographiques deviennent droites. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .toUpperCase();
}

export function hasGlyph(char: string): boolean {
  return char === ' ' || char in GLYPHS;
}

/** Largeur (px) d'un texte, espacement d'un pixel entre les lettres. */
export function textWidth(text: string, scale = 1): number {
  const n = normalizeText(text).length;
  return n === 0 ? 0 : (n * (GLYPH_W + 1) - 1) * scale;
}

/**
 * Dessine un texte. `rotate` : 0 = horizontal ; 90 = lu de haut en bas ; -90 = lu de bas en
 * haut (pour les noms le long des lignes de fond). Caractère inconnu → « ? ».
 */
export function drawText(target: PixelTarget, text: string, x: number, y: number, scale = 1, rotate: 0 | 90 | -90 = 0): void {
  const chars = [...normalizeText(text)];
  const length = chars.length * (GLYPH_W + 1) - 1;
  chars.forEach((char, i) => {
    if (char === ' ') return;
    const glyph = GLYPHS[char] ?? GLYPHS['?'];
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (glyph[gy][gx] !== '#') continue;
        const along = i * (GLYPH_W + 1) + gx;
        let px: number;
        let py: number;
        if (rotate === 0) [px, py] = [along, gy];
        else if (rotate === 90) [px, py] = [GLYPH_H - 1 - gy, along];
        else [px, py] = [gy, length - 1 - along];
        target.fillRect(x + px * scale, y + py * scale, scale, scale);
      }
    }
  });
}

/** Numéro de maillot en chiffres 3×5 (1 pixel entre deux chiffres). */
export function drawMiniNumber(target: PixelTarget, value: number, x: number, y: number): void {
  [...String(Math.abs(Math.trunc(value)))].forEach((digit, i) => {
    const glyph = MINI_DIGITS[Number(digit)];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] === '#') target.fillRect(x + i * 4 + gx, y + gy, 1, 1);
      }
    }
  });
}

export function miniNumberWidth(value: number): number {
  return String(Math.abs(Math.trunc(value))).length * 4 - 1;
}
