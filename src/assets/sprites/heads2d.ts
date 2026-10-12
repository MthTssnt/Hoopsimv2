/**
 * Têtes du rendu 2D (`figure2d.ts`) : grilles originales dessinées à la main, ~12 px de haut
 * cheveux compris (~1/4 du joueur), tournées vers la droite (vers la gauche, l'image entière est
 * retournée). Peau et cheveux en 3 tons, lumière en haut à gauche.
 *   1/2/3 peau claire/base/ombre · r/h/H cheveux reflet/base/ombre · n œil · w dents
 *   S couleur secondaire de l'équipe (bandeau)
 * Toutes les variantes de `heads.ts` existent : 5 formes de tête, 10 coiffures (en diagonale bas
 * et en diagonale haut), 3 expressions. Les grilles sont posées sur le crâne (origine en haut à
 * gauche) ; le contour vient du contour unique de toute la silhouette.
 */
import type { Appearance } from '../../match/render/sprites/appearance';
import type { Heading } from '../../match/render/sprites/rig';
import type { Expression } from './heads';

type View = Heading;

interface Shape2D {
  name: string;
  /** Crâne et visage, en diagonale bas (de 3/4 face) et en diagonale haut (de 3/4 dos). */
  down: readonly string[];
  up: readonly string[];
  /** Décalage vertical de la bouche (visage plus long). */
  mouthDy: number;
}

/**
 * 5 formes de tête (même ordre que `HEADS`) : le haut du crâne est commun, pour que toutes les
 * coiffures s'y posent ; la mâchoire et le menton changent.
 */
export const SHAPES_2D: readonly Shape2D[] = [
  {
    name: 'ronde',
    mouthDy: 0,
    down: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.22222222222',
      '.2222222223.',
      '..222222223.',
      '...3222223..',
      '.....3333...',
    ],
    up: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.2222222222.',
      '.2222222223.',
      '..22222223..',
      '...222223...',
      '....3333....',
    ],
  },
  {
    name: 'carree',
    mouthDy: 0,
    down: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.22222222222',
      '.2222222222.',
      '.2222222223.',
      '..222222223.',
      '...33333333.',
    ],
    up: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.2222222222.',
      '.2222222223.',
      '.2222222223.',
      '..22222223..',
      '...333333...',
    ],
  },
  {
    name: 'longue',
    mouthDy: 1,
    down: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.22222222222',
      '.2222222222.',
      '..222222223.',
      '..22222223..',
      '...3222223..',
      '.....3333...',
    ],
    up: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.2222222222.',
      '.2222222223.',
      '..22222223..',
      '..22222223..',
      '...222223...',
      '....3333....',
    ],
  },
  {
    name: 'large',
    mouthDy: 0,
    down: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '1111222222..',
      '11122222222.',
      '12222222222.',
      '222222222222',
      '22222222222.',
      '.2222222223.',
      '..22222223..',
      '...333333...',
    ],
    up: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '1111222222..',
      '11122222222.',
      '12222222222.',
      '22222222222.',
      '22222222223.',
      '.2222222223.',
      '..2222223...',
      '...33333....',
    ],
  },
  {
    name: 'ovale',
    mouthDy: 0,
    down: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.22222222222',
      '.2222222223.',
      '..22222223..',
      '....222223..',
      '......333...',
    ],
    up: [
      '...11122....',
      '..1111222...',
      '.111122222..',
      '.111222222..',
      '.1122222222.',
      '.1222222222.',
      '.2222222222.',
      '.2222222223.',
      '..2222223...',
      '....22223...',
      '.....333....',
    ],
  },
];

/** Oreille : en diagonale bas, du côté qui s'éloigne ; en diagonale haut, du côté de la course. */
const EAR_2D: Record<View, readonly string[]> = {
  down: ['', '', '', '', '', '..33', '..32', '...3'],
  up: ['', '', '', '', '', '.......13', '.......33', '........3'],
};

/**
 * Visages (diagonale bas seulement), posés sur le crâne : œil proche et œil éloigné, sourcils au
 * ton d'ombre des cheveux, ombre sous le nez (le nez dépasse du crâne), puis la bouche, posée à
 * part (rangée 8, décalée selon la forme de tête) : « m » au ton d'ombre de la peau, « w » dents.
 */
const FACES_2D: Readonly<Record<Expression, { eyes: readonly string[]; mouth: string }>> = {
  neutre: { eyes: ['', '', '', '', '......HH.H', '......n..n', '......n..n', '..........3'], mouth: '........mm' },
  concentree: { eyes: ['', '', '', '', '.....HH..H', '.......H.H', '......n..n', '..........3'], mouth: '.......mmm' },
  joyeuse: { eyes: ['', '', '', '', '......HH.H', '......n..n', '......n..n', '..........3'], mouth: '.......mwwm' },
};

interface Hair2D {
  name: string;
  /** Peinte seulement sur le crâne (coiffure plaquée), sinon elle dépasse (volume). */
  clip: boolean;
  /** Coin haut-gauche de la grille par rapport au crâne. */
  at: readonly [number, number];
  down: readonly string[];
  up: readonly string[];
  /** Barbe : la mâchoire et le menton passent aux cheveux (sauf la bouche). */
  beard?: boolean;
}

/** 10 coiffures (même ordre que `HAIRS`), vues de 3/4 face et de 3/4 dos. */
export const HAIRS_2D: readonly Hair2D[] = [
  {
    name: 'ras',
    clip: true,
    at: [0, 0],
    down: ['HHhHHhHHHH..', 'HhHHhHHhHH..', 'HHhHHHhHHH..', 'HhHHhHH.....', 'HHH.........', 'HH..........', 'H...........'],
    up: ['HHhHHhHHHH..', 'HhHHhHHhHH..', 'HHhHHHhHHH..', 'HhHHhHHhHH..', 'HHHhHHHH....', 'HhHHHHH.....', 'HHHhHHH.....', 'HHHHHH......', '.HHHH.......'],
  },
  {
    name: 'court',
    clip: false,
    at: [0, -1],
    down: ['...hhhhh....', '..rrhhhhh...', '.rrhhhhhhh..', 'rhhhhhhhhhH.', 'hhhhhhhHH...', 'hhhH........', 'hhH.........', 'hH..........', '.H..........'],
    up: ['...hhhhh....', '..rrhhhhh...', '.rrhhhhhhh..', 'rhhhhhhhhhh.', 'hhhhhhhhhhH.', 'hhhhhhhhhH..', 'hhhhhhhH....', 'hhhhhhhH....', 'Hhhhhhh.....', '.HHHHH......'],
  },
  {
    name: 'afro',
    clip: false,
    at: [-1, -3],
    down: [
      '...hhhhhh....',
      '..rrhhhhhhh..',
      '.rrrhhhhhhhh.',
      'rrhhhhhhhhhhH',
      'rhhhhhhhhhhhH',
      'hhhhhhhhhhhH.',
      'hhhhhhhhHH...',
      'hhhhhH.......',
      'hhhhH........',
      'hhhH.........',
      '.hH..........',
    ],
    up: [
      '...hhhhhh....',
      '..rrhhhhhhh..',
      '.rrrhhhhhhhh.',
      'rrhhhhhhhhhhH',
      'rhhhhhhhhhhhH',
      'hhhhhhhhhhhhH',
      'hhhhhhhhhhhH.',
      'hhhhhhhhhhH..',
      'hhhhhhhhhH...',
      'Hhhhhhhhh....',
      '.HHhhhhH.....',
      '..HHHHH......',
    ],
  },
  {
    name: 'tresses',
    clip: false,
    at: [0, -1],
    down: ['...hHhHh....', '..rHrHrHh...', '.hHhHhHhHh..', 'hHhHhHhHhHH.', 'hHhHhHhHH...', 'hHhH........', 'hHH.........', 'hH..........', 'H...........'],
    up: ['...hHhHh....', '..rHrHrHh...', '.hHhHhHhHh..', 'hHhHhHhHhHh.', 'hHhHhHhHhHH.', 'hHhHhHhHhH..', 'hHhHhHhH....', 'hHhHhHhH....', 'HhHhHhH.....', '.H.H.H......'],
  },
  {
    name: 'chignon',
    clip: false,
    at: [0, -3],
    down: ['..rhh.......', '.rhhhH......', '..hhhhhh....', '..rrhhhhh...', '.rrhhhhhhh..', 'rhhhhhhhhhH.', 'hhhhhhhHH...', 'hhhH........', 'hhH.........', 'hH..........', '.H..........'],
    up: ['..rhh.......', '.rhhhH......', '..hhhhhh....', '..rrhhhhh...', '.rrhhhhhhh..', 'rhhhhhhhhhh.', 'hhhhhhhhhhH.', 'hhhhhhhhhH..', 'hhhhhhhH....', 'hhhhhhhH....', 'Hhhhhhh.....', '.HHHHH......'],
  },
  {
    name: 'bandeau',
    clip: false,
    at: [0, -1],
    down: ['...hhhhh....', '..rrhhhhh...', '.rrhhhhhhh..', 'SSSSSSSSSSS.', 'hhhhhhhHH...', 'hhhH........', 'hhH.........', 'hH..........', '.H..........'],
    up: ['...hhhhh....', '..rrhhhhh...', '.rrhhhhhhh..', 'SSSSSSSSSSS.', 'hhhhhhhhhhH.', 'hhhhhhhhhH..', 'hhhhhhhH....', 'hhhhhhhH....', 'Hhhhhhh.....', '.HHHHH......'],
  },
  {
    name: 'chauve',
    clip: true,
    at: [0, 0],
    down: ['', '..11', '.11'],
    up: ['', '..11', '.11'],
  },
  {
    name: 'frange',
    clip: false,
    at: [0, -1],
    down: ['...hhhhh....', '..rrhhhhh...', '.rrhhhhhhh..', 'rhhhhhhhhhhH', 'hhhhhhhhhhH.', 'hhhhhhhH.H..', 'hhH.........', 'hH..........', '.H..........'],
    // De dos, la frange se devine à la mèche qui dépasse du front, côté course.
    up: ['...hhhhh....', '..rrhhhhh...', '.rrhhhhhhhh.', 'rhhhhhhhhhhH', 'hhhhhhhhhhH.', 'hhhhhhhhhH..', 'hhhhhhhH....', 'hhhhhhhH....', 'Hhhhhhh.....', '.HHHHH......'],
  },
  {
    name: 'degrade',
    clip: true,
    at: [0, 0],
    down: ['hhhhhhhhhh..', 'rrhhhhhhhh..', 'rhhhhhhhhH..', 'hhhhhhH.....', 'HHH.........', 'HH..........', 'H...........'],
    up: ['hhhhhhhhhh..', 'rrhhhhhhhh..', 'rhhhhhhhhH..', 'hhhhhhhhhH..', 'hhhhhhhHH...', 'HHHHHHH.....', 'HHHHHH......'],
  },
  {
    name: 'barbe',
    clip: true,
    at: [0, 0],
    down: ['hhhhhhhhhh..', 'rrhhhhhhhh..', 'rhhhhhhhhH..', 'hhhhhhH.....', 'hhH.........', 'hH..........', 'H...........'],
    up: ['hhhhhhhhhh..', 'rrhhhhhhhh..', 'rhhhhhhhhH..', 'hhhhhhhhhH..', 'hhhhhhhHH...', 'hhhhhhH.....', 'HhhhhhH.....', 'HHHHHH......'],
    beard: true,
  },
];

/** Marge de la grille composée autour du crâne (volume des coiffures). */
const PAD_X = 2;
const PAD_Y = 4;
const SIZE_W = 16;
const SIZE_H = 17;

/** Point du cou sous le crâne (là où la tête se pose sur le corps), dans la grille du crâne. */
const NECK: Record<View, { x: number; y: number }> = {
  down: { x: 4, y: 9 },
  up: { x: 5, y: 9 },
};

export interface Head2D {
  rows: string[];
  /** Point du cou dans `rows` : il se pose sur le haut du cou du squelette. */
  anchor: { x: number; y: number };
}

const cache = new Map<string, Head2D>();

/** Tête composée : crâne, oreille, visage (diagonale bas), coiffure, barbe. Mise en cache (une par variante). */
export function headGrid2D(look: Pick<Appearance, 'head' | 'hair'>, heading: Heading, expression: Expression = 'neutre'): Head2D {
  const head = look.head % SHAPES_2D.length;
  const hairIndex = look.hair % HAIRS_2D.length;
  const key = `${head}|${hairIndex}|${heading}|${heading === 'down' ? expression : ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const made = composeHead(SHAPES_2D[head], HAIRS_2D[hairIndex], heading, expression);
  cache.set(key, made);
  return made;
}

function composeHead(shape: Shape2D, hair: Hair2D, heading: Heading, expression: Expression): Head2D {
  const g: string[][] = Array.from({ length: SIZE_H }, () => Array.from({ length: SIZE_W }, () => '.'));
  const skull = (x: number, y: number) => {
    const row = shape[heading][y - PAD_Y];
    return row !== undefined && x - PAD_X >= 0 && x - PAD_X < row.length && row[x - PAD_X] !== '.';
  };
  const stamp = (rows: readonly string[], dx: number, dy: number, rule: (x: number, y: number, ch: string) => string | null = (_x, _y, ch) => ch) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.') continue;
        const gx = x + dx + PAD_X;
        const gy = y + dy + PAD_Y;
        if (gx < 0 || gy < 0 || gx >= SIZE_W || gy >= SIZE_H) continue;
        const ch = rule(gx, gy, row[x]);
        if (ch) g[gy][gx] = ch;
      }
    });
  };
  stamp(shape[heading], 0, 0);
  stamp(EAR_2D[heading], 0, 0);
  const face = FACES_2D[expression];
  if (heading === 'down') stamp(face.eyes, 0, 0);
  if (hair.beard) {
    // Barbe pleine : mâchoire et menton (sous les pommettes) ; de dos, seulement le côté visible.
    for (let y = 7 + PAD_Y; y < SIZE_H; y++) {
      for (let x = 0; x < SIZE_W; x++) {
        if (!skull(x, y) || (heading === 'up' && x < PAD_X + 6)) continue;
        g[y][x] = skull(x, y + 1) ? 'h' : 'H';
      }
    }
  }
  if (heading === 'down') stamp([face.mouth], 0, 8 + shape.mouthDy, (_x, _y, ch) => (ch === 'm' ? '3' : ch));
  stamp(hair[heading], hair.at[0], hair.at[1], (x, y, ch) => (hair.clip && !skull(x, y) ? null : ch));
  const rows = g.map((row) => row.join(''));
  const neck = NECK[heading];
  return { rows, anchor: { x: neck.x + PAD_X, y: neck.y + PAD_Y } };
}
