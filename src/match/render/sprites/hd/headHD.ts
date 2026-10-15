/**
 * Prototype haute résolution (densité ×1,5) : tête dessinée à la main, en vraie perspective 3/4.
 * - Crâne de 25×24 (au lieu de 17×16), tourné vers la droite ; visage x ≥ 11.
 * - Peau en 4 tons : lumière sur la pommette (1), base (2), ombre le long de la mâchoire, sous le
 *   menton et sous le nez (3), plis et intérieur de la bouche (4).
 * - Œil proche (4 de large) plus grand que l'œil éloigné (2), petit blanc d'œil, iris coloré,
 *   pupille ; sourcils au ton foncé des cheveux, neutres au repos ; nez construit par l'ombre ;
 *   bouche décalée vers le profil ; oreille à l'arrière du crâne.
 * - Une coiffure (ébouriffée), redessinée à cette densité. Prototype : arrêt seulement, une seule
 *   expression (neutre).
 */
import type { FaceExpression, Head2D, HeadLook } from '../../../../assets/sprites/heads2d';
import type { Heading } from '../rig';
import { HAIR_HD } from './hairHD';

/** Silhouette du crâne de 3/4 face (« x ») : front, arcade, creux de l'œil, nez (12-13), bouche (17), menton. */
const SKULL_DOWN = [
  '........xxxxxxxx.........',
  '.....xxxxxxxxxxxxxx......',
  '....xxxxxxxxxxxxxxxx.....',
  '...xxxxxxxxxxxxxxxxxx....',
  '..xxxxxxxxxxxxxxxxxxxx...',
  '.xxxxxxxxxxxxxxxxxxxxx...',
  '.xxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxx...',
  'xxxxxxxxxxxxxxxxxxxxxx...',
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxxxxxxxxxxx',
  '.xxxxxxxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxxxxxx...',
  '...xxxxxxxxxxxxxxxxxxxx..',
  '....xxxxxxxxxxxxxxxxxxx..',
  '.....xxxxxxxxxxxxxxxxx...',
  '......xxxxxxxxxxxxxxxx...',
  '........xxxxxxxxxxxxx....',
  '..........xxxxxxxxx......',
];

/** Arrière de la tête (3/4 dos) : crâne sans nez, puis nuque étroite et centrée. */
const SKULL_UP = [
  ...SKULL_DOWN.slice(0, 9),
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxxxxx....',
  '...xxxxxxxxxxxxxxxxx.....',
  '.....xxxxxxxxxxxxx.......',
  '......xxxxxxxxxxx........',
  '.......xxxxxxxxx.........',
  '.......xxxxxxxxx.........',
  '.......xxxxxxxxx.........',
  '........xxxxxxx..........',
];

/**
 * Traits du visage (diagonale bas), posés sur la peau ; « . » laisse la peau. Rangées 7 à 22,
 * colonnes 3 à 24 (repère du crâne).
 *   E sourcil (ton le plus foncé des cheveux) · 4 cil, narine, bouche · w blanc · i iris · n pupille
 *   1 pommette éclairée · 3 ombre (nez, joue, mâchoire, menton) · 2 base (redessine la peau)
 */
const FACE_DOWN = {
  at: [0, 7] as const,
  rows: [
    //x 0123456789012345678901234
    '............EEEE...EEE...', // 7  sourcils, neutres
    '...........E.............', // 8
    '............333...33.....', // 9  creux de l'orbite sous l'arcade
    '............4444..444....', // 10 cils de la paupière
    '............wiin..win....', // 11 œil proche (4 de large), œil éloigné (3) ; iris, pupille
    '............wiii...ii3...', // 12
    '............3.....3333...', // 13 coin de l'œil, ombre du nez
    '...........111.....3433..', // 14 pommette éclairée, narine, ombre sous le nez
    '..........111...........3', // 15
    '.........................', // 16
    '................34444....', // 17 bouche, décalée vers le profil
    '.....3...........333.....', // 18 lèvre inférieure ; ombre le long de la mâchoire
    '.....33..................', // 19
    '......33.............3...', // 20
    '.......333..........33...', // 21
    '.........3333333333333...', // 22 sous le menton
  ],
};

/** Oreille proche (diagonale bas), à l'arrière du crâne, posée par-dessus les cheveux qui tombent derrière. */
const EAR_DOWN = {
  at: [3, 10] as const,
  rows: ['.33.', '3223', '3213', '3213', '.323', '..3.'],
};

/** Pavillon de l'oreille de dos, de chaque côté (repère du crâne). */
const EARS_UP: readonly [number, number, string][] = [
  [-1, 10, '2'], [-1, 11, '3'], [-1, 12, '3'], [0, 13, '3'],
  [23, 10, '2'], [23, 11, '3'], [23, 12, '3'], [22, 13, '3'],
];

const PAD_X = 7;
const PAD_Y = 14;
const SIZE_W = 40;
const SIZE_H = 52;
/** Point du cou (repère du crâne) : il se pose sur le haut du cou du squelette. */
const NECK = [12, 20] as const;
/** Colonnes du visage : la frange s'y arrête à la rangée 4 (deux rangées de front avant les sourcils). */
const FACE_X = 11;
const FRINGE_Y = 4;
const HAIR_CHARS = 'rhHDE';

const cache = new Map<string, Head2D>();

/** Tête du prototype haute résolution (même contrat que `headGrid2D`). */
export function headGridHD(look: HeadLook, heading: Heading, expression: FaceExpression = 'neutre'): Head2D {
  void expression;
  const key = `${heading}|${look.headband ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const g: string[][] = Array.from({ length: SIZE_H }, () => Array.from({ length: SIZE_W }, () => '.'));
  const get = (x: number, y: number) => g[y + PAD_Y]?.[x + PAD_X] ?? '.';
  const set = (x: number, y: number, ch: string) => {
    if (y + PAD_Y >= 0 && y + PAD_Y < SIZE_H && x + PAD_X >= 0 && x + PAD_X < SIZE_W) g[y + PAD_Y][x + PAD_X] = ch;
  };
  const skull = heading === 'down' ? SKULL_DOWN : SKULL_UP;
  const inSkull = (x: number, y: number) => skull[y]?.[x] === 'x';
  // Peau : base, ombre sur le bord droit et bas (lumière en haut à gauche), sous le menton.
  skull.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== 'x') return;
      const right = row.lastIndexOf('x');
      const shade = !inSkull(x, y + 1) || (y > 13 && (x === right || x === row.indexOf('x')));
      set(x, y, shade ? '3' : '2');
    }),
  );
  // Cheveux ; de face, la frange s'arrête au-dessus du front.
  const view = HAIR_HD[heading];
  view.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const hx = view.at[0] + x;
      const hy = view.at[1] + y;
      if (ch === '.' || (heading === 'down' && hx >= FACE_X && hy > FRINGE_Y && inSkull(hx, hy))) return;
      set(hx, hy, ch);
    }),
  );
  // Ombre de la ligne des cheveux sur la peau juste dessous.
  for (let y = 0; y < skull.length; y++) for (let x = 0; x < 25; x++) if (get(x, y) === '2' && HAIR_CHARS.includes(get(x, y - 1)) && get(x, y - 1) !== '.') set(x, y, '3');
  if (heading === 'down') {
    FACE_DOWN.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const fx = FACE_DOWN.at[0] + x;
        const fy = FACE_DOWN.at[1] + y;
        if (ch !== '.' && inSkull(fx, fy) && !HAIR_CHARS.includes(get(fx, fy))) set(fx, fy, ch);
      }),
    );
    EAR_DOWN.rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && set(EAR_DOWN.at[0] + x, EAR_DOWN.at[1] + y, ch)));
  } else for (const [x, y, ch] of EARS_UP) set(x, y, ch);
  if (look.headband) {
    for (let x = -PAD_X; x < SIZE_W - PAD_X; x++) {
      if (get(x, 2) !== '.') set(x, 2, 's');
      if (get(x, 3) !== '.') set(x, 3, 'S');
      if (get(x, 4) !== '.') set(x, 4, 'S');
    }
  }
  const used = g.map((r) => r.some((c) => c !== '.'));
  const top = used.indexOf(true);
  const bottom = used.lastIndexOf(true);
  const made = { rows: g.slice(top, bottom + 1).map((r) => r.join('')), anchor: { x: NECK[0] + PAD_X, y: NECK[1] + PAD_Y - top } };
  cache.set(key, made);
  return made;
}
