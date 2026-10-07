/**
 * Chiffres des numéros de maillot (asset original), dessinés pour l'échelle des sprites :
 * 6 rangées de haut, « 1 » étroit (2 px) sans empattement, 0, 6, 8 et 9 arrondis pour qu'ils
 * ne se confondent pas. Un pixel d'écart entre deux chiffres.
 */
export const JERSEY_DIGIT_HEIGHT = 6;

export const JERSEY_DIGITS: readonly (readonly string[])[] = [
  ['.#.', '#.#', '#.#', '#.#', '#.#', '.#.'],
  ['.#', '##', '.#', '.#', '.#', '.#'],
  ['##.', '..#', '..#', '.#.', '#..', '###'],
  ['##.', '..#', '.#.', '..#', '..#', '##.'],
  ['#.#', '#.#', '#.#', '###', '..#', '..#'],
  ['###', '#..', '##.', '..#', '..#', '##.'],
  ['.##', '#..', '##.', '#.#', '#.#', '.#.'],
  ['###', '..#', '..#', '.#.', '.#.', '.#.'],
  ['.#.', '#.#', '.#.', '#.#', '#.#', '.#.'],
  ['.#.', '#.#', '#.#', '.##', '..#', '##.'],
];

const digitsOf = (value: number): number[] => [...String(Math.abs(Math.trunc(value)))].map(Number);

/** Largeur (px) d'un numéro. */
export function jerseyNumberWidth(value: number): number {
  return digitsOf(value).reduce((w, d) => w + JERSEY_DIGITS[d][0].length + 1, -1);
}

/** Pose les pixels d'un numéro, coin haut-gauche en (x, y). */
export function drawJerseyNumber(value: number, x: number, y: number, plot: (x: number, y: number) => void): void {
  let cx = x;
  for (const d of digitsOf(value)) {
    const glyph = JERSEY_DIGITS[d];
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') plot(cx + gx, y + gy);
    });
    cx += glyph[0].length + 1;
  }
}
