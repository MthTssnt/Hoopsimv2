/**
 * Prototype haute résolution : tout le sprite dessiné à la densité ×1,5 (cadre 84×96 au lieu de
 * 56×64), affiché ×2 au lieu de ×3 en 1080p pour garder la même taille à l'écran. La tête, le
 * corps, le numéro et le ballon sont tous à cette densité ; rien n'est agrandi d'une autre densité.
 */
import type { Density2D } from '../figure2d';
import { headGridHD } from './headHD';

/** Chiffres du numéro à cette densité : 9 rangées (au lieu de 6), traits verticaux de 2 px. */
const DIGITS_HD: readonly (readonly string[])[] = [
  ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  ['.##', '###', '.##', '.##', '.##', '.##', '.##', '.##', '.##'],
  ['.###.', '##.##', '...##', '...##', '..##.', '.##..', '##...', '##...', '#####'],
  ['####.', '...##', '...##', '...##', '.###.', '...##', '...##', '...##', '####.'],
  ['##.##', '##.##', '##.##', '##.##', '#####', '...##', '...##', '...##', '...##'],
  ['#####', '##...', '##...', '####.', '...##', '...##', '...##', '...##', '####.'],
  ['.###.', '##...', '##...', '####.', '##.##', '##.##', '##.##', '##.##', '.###.'],
  ['#####', '...##', '...##', '..##.', '..##.', '.##..', '.##..', '.##..', '.##..'],
  ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '##.##', '##.##', '.###.'],
  ['.###.', '##.##', '##.##', '##.##', '.####', '...##', '...##', '...##', '.###.'],
];

const digitsOf = (value: number): number[] => [...String(Math.abs(Math.trunc(value)))].map(Number);

export const DENSITY_HD: Density2D = {
  k: 1.5,
  frame: { width: 84, height: 96, centerX: 42, groundY: 95 },
  head: headGridHD,
  digits: {
    height: 9,
    width: (value) => digitsOf(value).reduce((w, d) => w + DIGITS_HD[d][0].length + 1, -1),
    draw: (value, x, y, plot) => {
      let cx = x;
      for (const d of digitsOf(value)) {
        DIGITS_HD[d].forEach((row, gy) => [...row].forEach((c, gx) => c === '#' && plot(cx + gx, y + gy)));
        cx += DIGITS_HD[d][0].length + 1;
      }
    },
  },
};

/**
 * Ballon à cette densité : 12 px (au lieu de 8), même dessin que le ballon du match (couture
 * verticale un peu à gauche, couture horizontale, reflet en haut à gauche, ombre en bas à droite).
 * « b » base, « B » ombre, « l » reflet, « n » coutures ; le contour est posé autour.
 */
export const BALL_HD: readonly string[] = Array.from({ length: 12 }, (_, y) =>
  Array.from({ length: 12 }, (_, x) => {
    const dx = x - 5.5;
    const dy = y - 5.5;
    if (dx * dx + dy * dy > 34) return '.';
    if (x === 4 || y === 4) return 'n';
    if ((x === 2 || x === 3) && (y === 2 || y === 3) && !(x === 3 && y === 3)) return 'l';
    return dx + dy > 4.5 ? 'B' : 'b';
  }).join(''),
);
