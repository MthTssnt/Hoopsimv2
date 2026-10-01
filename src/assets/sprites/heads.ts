/**
 * Têtes, visages et coiffures des joueurs : grilles de pixels originales, indexées sur les
 * emplacements de couleur (voir `src/match/render/sprites/canvas.ts`). Tête vue de 3/4 profil,
 * tournée vers la droite ; lumière en haut à gauche.
 *   1/2/3 peau claire/base/ombre · h/H cheveux base/ombre · e blanc de l'œil · n pupille
 *   o trait sombre · S couleur secondaire de l'équipe (bandeau)
 */

/** 4 formes de tête, 10×10. */
export const HEADS: readonly (readonly string[])[] = [
  // rond
  [
    '..111122..',
    '.11122222.',
    '1112222222',
    '1122222222',
    '1222222222',
    '1222222222',
    '2222222223',
    '2222222223',
    '.22222223.',
    '..333333..',
  ],
  // long
  [
    '..11122...',
    '.1112222..',
    '.11222222.',
    '.12222222.',
    '.12222222.',
    '.22222222.',
    '.22222222.',
    '.22222223.',
    '..2222233.',
    '...33333..',
  ],
  // carré
  [
    '.1111222..',
    '111222222.',
    '1122222222',
    '1222222222',
    '1222222222',
    '2222222222',
    '2222222222',
    '2222222223',
    '2222222233',
    '.33333333.',
  ],
  // large
  [
    '...1122...',
    '.11122222.',
    '1112222222',
    '1122222222',
    '1222222222',
    '2222222222',
    '2222222222',
    '.222222223',
    '.22222233.',
    '..33333...',
  ],
];

/** 4 visages (sourcils, œil, oreille, bouche), 10×10, posés sur la tête. */
export const FACES: readonly (readonly string[])[] = [
  // calme
  ['..........', '..........', '..........', '......HH..', '......en..', '..3.......', '..3.......', '.......33.', '..........', '..........'],
  // déterminé
  ['..........', '..........', '......H...', '.......H..', '......en..', '..3.......', '..3.......', '......ooo.', '..........', '..........'],
  // souriant
  ['..........', '..........', '..........', '......HH..', '......en..', '..3.......', '..3.......', '......3.3.', '.......3..', '..........'],
  // grands yeux
  ['..........', '..........', '......HHH.', '......ee..', '......en..', '..3.......', '..3.......', '.......3..', '..........', '..........'],
];

export interface HairStyle {
  name: string;
  /** 12×12, posée 1 px à gauche et 2 px au-dessus de la tête. */
  grid: readonly string[];
  /** Coiffure plaquée : ne peint que sur la tête (pas de volume qui dépasse). */
  clip: boolean;
}

const EMPTY = '............';

/** 8 coiffures. */
export const HAIRS: readonly HairStyle[] = [
  {
    name: 'ras',
    clip: true,
    grid: [EMPTY, EMPTY, '..HHHHHH....', '.HHHHHHHH...', '.HHH........', '.HH.........', '.H..........', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'court',
    clip: false,
    grid: [EMPTY, '...hhhhh....', '..hhhhhhhh..', '.hhhhhhhhhH.', '.hhhhHHH....', '.hhH........', '.hH.........', '.H..........', EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'afro',
    clip: false,
    grid: [
      '...hhhhhh...',
      '..hhhhhhhh..',
      '.hhhhhhhhhh.',
      'hhhhhhhhhhhh',
      'hhhhhhhhHHh.',
      'hhhhhhH.....',
      'hhhhhH......',
      'hhhhH.......',
      '.hhH........',
      '..H.........',
      EMPTY,
      EMPTY,
    ],
  },
  {
    name: 'tresses',
    clip: true,
    grid: [EMPTY, EMPTY, '..hHhHhH....', '.hHhHhHhH...', '.HhHhH......', '.hHh........', '.Hh.........', '.h..........', EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'chignon',
    clip: false,
    grid: ['.HhH........', 'hhhhh.......', 'hhhhhhhh....', '.hhhhhhhhH..', '.hhhHH......', '.hH.........', '.H..........', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'bandeau',
    clip: true,
    grid: [EMPTY, EMPTY, '..HHHHHH....', '.HHHHHHHH...', '.SSSSSSSSSS.', '.HH.........', '.H..........', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'chauve',
    clip: true,
    grid: [EMPTY, EMPTY, EMPTY, '...1........', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'barbe',
    clip: true,
    grid: [
      EMPTY,
      EMPTY,
      '..HHHHHH....',
      '.HHHHHHHH...',
      '.HHH........',
      '.HH.........',
      '.H..........',
      EMPTY,
      '....hhh.hhh.',
      '....hhh...h.',
      '.....hhhhhh.',
      '......hhhh..',
    ],
  },
];
