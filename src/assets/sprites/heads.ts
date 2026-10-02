/**
 * Têtes, visages et coiffures des joueurs : grilles de pixels originales, indexées sur les
 * emplacements de couleur (voir `src/match/render/sprites/canvas.ts`). Tête vue de 3/4,
 * tournée vers la droite ; lumière en haut à gauche.
 *   1/2/3 peau claire/base/ombre · h/H cheveux base/ombre · e blanc de l'œil · n pupille
 *   o trait sombre · S couleur secondaire de l'équipe (bandeau)
 */

/** Côté d'une tête (px). */
export const HEAD_GRID = 14;

/** 4 formes de tête, 14×14. */
export const HEADS: readonly (readonly string[])[] = [
  // rond
  [
    '....111122....',
    '..1111222222..',
    '.111122222222.',
    '.112222222222.',
    '11122222222222',
    '11222222222222',
    '12222222222222',
    '12222222222222',
    '22222222222223',
    '22222222222223',
    '.222222222223.',
    '.222222222233.',
    '..2222222233..',
    '....333333....',
  ],
  // long
  [
    '....11122.....',
    '...1111222....',
    '..1112222222..',
    '..1122222222..',
    '.112222222222.',
    '.122222222222.',
    '.122222222222.',
    '.222222222222.',
    '.222222222223.',
    '.222222222223.',
    '.222222222223.',
    '..2222222223..',
    '..2222222233..',
    '....3333333...',
  ],
  // carré
  [
    '..1111122222..',
    '.111112222222.',
    '11112222222222',
    '11222222222222',
    '12222222222222',
    '12222222222222',
    '22222222222222',
    '22222222222222',
    '22222222222222',
    '22222222222223',
    '22222222222223',
    '22222222222233',
    '22222222222233',
    '.333333333333.',
  ],
  // large
  [
    '......1122....',
    '...111122222..',
    '..111222222222',
    '.1112222222222',
    '11122222222222',
    '11222222222222',
    '12222222222222',
    '22222222222222',
    '22222222222222',
    '22222222222223',
    '22222222222223',
    '.222222222233.',
    '..22222222233.',
    '....3333333...',
  ],
];

/**
 * 4 visages, 14×14, posés sur la tête : sourcils (cheveux sombres), deux yeux de 2×2 (blanc
 * + pupille, l'œil du fond plus près du bord), bouche. L'oreille (un trait d'un pixel, pas un
 * bloc qui ferait tache) et le nez prennent le ton d'ombre propre à chaque teint.
 */
export const FACES: readonly (readonly string[])[] = [
  // calme
  [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.......HH..H..',
    '.......en..en.',
    '.......en..en.',
    '...3........3.',
    '...3..........',
    '.........oo...',
    '..............',
    '..............',
    '..............',
  ],
  // déterminé
  [
    '..............',
    '..............',
    '..............',
    '..............',
    '.......H......',
    '........HH.HH.',
    '.......en..en.',
    '.......nn..nn.',
    '...3........3.',
    '...3..........',
    '........oooo..',
    '..............',
    '..............',
    '..............',
  ],
  // souriant
  [
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '.......HH..H..',
    '.......en..en.',
    '.......en..en.',
    '...3........3.',
    '...3....o...o.',
    '.........ooo..',
    '..............',
    '..............',
    '..............',
  ],
  // grands yeux
  [
    '..............',
    '..............',
    '..............',
    '..............',
    '.......HHH.HH.',
    '.......ee..e..',
    '.......en..en.',
    '.......en..en.',
    '...3........3.',
    '...3..........',
    '..........33..',
    '..............',
    '..............',
    '..............',
  ],
];

export interface HairStyle {
  name: string;
  /** 18×18, posée 2 px à gauche et 3 px au-dessus de la tête. */
  grid: readonly string[];
  /** Coiffure plaquée : ne peint que sur la tête (pas de volume qui dépasse). */
  clip: boolean;
}

/** Décalage de la grille de coiffure par rapport au coin haut-gauche de la tête. */
export const HAIR_OFFSET = { x: -2, y: -3 } as const;

const EMPTY = '..................';

/** 8 coiffures. */
export const HAIRS: readonly HairStyle[] = [
  {
    name: 'ras',
    clip: true,
    grid: [
      EMPTY,
      EMPTY,
      EMPTY,
      '..HHHHHHHHHHHHHH..',
      '..HHhHHHHhHHHHHH..',
      '..HHHHHhHHHHHH....',
      '..HHhHHHH.........',
      '..HHHHHH..........',
      '..HHhH............',
      '..HHH.............',
      '..HH..............',
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
    ],
  },
  {
    name: 'court',
    clip: false,
    grid: [
      EMPTY,
      '.....hhhhhhh......',
      '...hhhhhhhhhhh....',
      '..hhhhhhhhhhhhhh..',
      '.hhhhhhhhhhhhhhhH.',
      '.hhhhhhhhhHHHHHH..',
      '.hhhhhhhHH........',
      '.hhhhhHH..........',
      '.hhhhH............',
      '.hhhH.............',
      '..hH..............',
      '..H...............',
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
    ],
  },
  {
    name: 'afro',
    clip: false,
    grid: [
      '.....hhhhhhh......',
      '...hhhhhhhhhhh....',
      '..hhhhhhhhhhhhhh..',
      '.hhhhhhhhhhhhhhhh.',
      'hhhhhhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhhhhH.',
      'hhhhhhhhhhhHHHH...',
      'hhhhhhhhhH........',
      'hhhhhhhhH.........',
      'hhhhhhhH..........',
      'hhhhhhH...........',
      '.hhhhH............',
      '..hhH.............',
      '...H..............',
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
    ],
  },
  {
    name: 'tresses',
    clip: true,
    grid: [
      EMPTY,
      EMPTY,
      EMPTY,
      '..hHhHhHhHhHhHhH..',
      '..hHhHhHhHhHhHhH..',
      '..hHhHhHhHhHhH....',
      '..hHhHhHh.........',
      '..hHhHhH..........',
      '..hHhH............',
      '..hHh.............',
      '..hH..............',
      '..h...............',
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
    ],
  },
  {
    name: 'chignon',
    clip: false,
    grid: [
      '..HhhH............',
      '.hhhhhh...........',
      '.hhhhhhhhhh.......',
      '..hhhhhhhhhhhh....',
      '..hhhhhhhhhhhhH...',
      '..hhhhhhhHHHH.....',
      '..hhhhHH..........',
      '..hhhH............',
      '..hhH.............',
      '..hH..............',
      '..H...............',
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
    ],
  },
  {
    name: 'bandeau',
    clip: true,
    grid: [
      EMPTY,
      EMPTY,
      EMPTY,
      '..HHHHHHHHHHHHHH..',
      '..HHhHHHHhHHHHHH..',
      '..HHHHHHHHHHHH....',
      '..SSSSSSSSSSSSSSSS',
      '..SSSSSSSSSSSSSSSS',
      '..HHhH............',
      '..HHH.............',
      '..HH..............',
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
      EMPTY,
    ],
  },
  {
    name: 'chauve',
    clip: true,
    grid: [EMPTY, EMPTY, EMPTY, EMPTY, '.......11.........', '......11..........', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'barbe',
    clip: true,
    grid: [
      EMPTY,
      EMPTY,
      EMPTY,
      '..HHHHHHHHHHHHHH..',
      '..HHhHHHHhHHHHHH..',
      '..HHHHHhHHHHHH....',
      '..HHhHHHH.........',
      '..HHHHHH..........',
      '..HHhH............',
      '..HHH.............',
      '..HH..............',
      '..hhh.............',
      '..hhh.....hhhhh...',
      '..hhhhhhh.....hh..',
      '..hhhhhhhhhhhhhh..',
      '...hhhhhhhhhhhh...',
      '.....hhhhhhhhh....',
      EMPTY,
    ],
  },
];
