/**
 * Têtes, coiffures et expressions des joueurs : grilles de pixels originales, indexées sur les
 * emplacements de couleur (voir `src/match/render/sprites/canvas.ts`). Tête vue de face
 * (symétrique), lumière en haut à gauche : la seule ombre de peau est sur le côté droit.
 * Intérieur de 12×12, cheveux compris ; le contour automatique en fait 14×14.
 *   1/2/3 peau claire/base/ombre · h/H cheveux base/ombre · w blanc · n trait sombre
 *   S couleur secondaire de l'équipe (bandeau)
 */

/** Côté intérieur d'une tête (px), sans le contour. */
export const HEAD_GRID = 12;

/** 5 formes de tête, 12×12 (le haut est en général couvert par les cheveux). */
export const HEADS: readonly (readonly string[])[] = [
  // ronde
  [
    '...111122...',
    '.1111222222.',
    '.11222222222',
    '122222222223',
    '122222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '.2222222223.',
    '.2222222233.',
    '...222233...',
  ],
  // carrée
  [
    '.1111122222.',
    '111122222222',
    '112222222222',
    '122222222223',
    '122222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '222222222233',
    '.222222233..',
  ],
  // longue
  [
    '...111122...',
    '..11122222..',
    '.1122222222.',
    '.1222222223.',
    '122222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '.222222222..',
    '.222222223..',
    '..22222233..',
    '...222233...',
  ],
  // large
  [
    '..11112222..',
    '.1112222222.',
    '112222222222',
    '122222222223',
    '122222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '.2222222233.',
    '..22222233..',
  ],
  // ovale
  [
    '...111122...',
    '..11122222..',
    '.1122222222.',
    '.1222222223.',
    '122222222223',
    '122222222223',
    '222222222223',
    '222222222223',
    '222222222223',
    '.2222222223.',
    '..22222223..',
    '...222233...',
  ],
];

export type Expression = 'neutre' | 'concentree' | 'joyeuse';

/**
 * Expressions, posées par-dessus la tête et les cheveux. Yeux : 2×2 de blanc et une colonne
 * d'iris côté intérieur, 2 px d'écart, sur la même rangée. Sourcils : 3 px au-dessus de chaque
 * œil. Nez : 1 px d'ombre de peau. Bouche : ligne fermée de 4 px (sourire avec dents seulement
 * pour « joyeuse »). Aucun pixel sombre sur les joues.
 */
export const EXPRESSIONS: Readonly<Record<Expression, readonly string[]>> = {
  neutre: [
    '............',
    '............',
    '............',
    '............',
    '..nnn..nnn..',
    '..wwn..nww..',
    '..wwn..nww..',
    '............',
    '......3.....',
    '....nnnn....',
    '............',
    '............',
  ],
  concentree: [
    '............',
    '............',
    '............',
    '..n......n..',
    '...nn..nn...',
    '..wwn..nww..',
    '..wwn..nww..',
    '............',
    '......3.....',
    '....nnnn....',
    '............',
    '............',
  ],
  joyeuse: [
    '............',
    '............',
    '............',
    '..nnn..nnn..',
    '............',
    '..wwn..nww..',
    '..wwn..nww..',
    '............',
    '......3.....',
    '...nwwwwn...',
    '....nnnn....',
    '............',
  ],
};

/** Rangées occupées par les yeux dans une expression (pour les tests et le gros plan). */
export const EYE_ROWS = [5, 6] as const;

export interface HairStyle {
  name: string;
  /** 12×12, dans la même boîte que la tête. */
  grid: readonly string[];
  /** Coiffure plaquée : ne peint que sur la tête (pas de volume qui dépasse). */
  clip: boolean;
}

const EMPTY = '............';

/** 10 coiffures, toutes dans la boîte de 12×12 : la tête, cheveux compris, fait 14×14 avec le contour. */
export const HAIRS: readonly HairStyle[] = [
  {
    name: 'ras',
    clip: true,
    grid: ['HHHHHHHHHHHH', 'HhHHHHhHHHHH', 'HHHHhHHHHHhH', 'HH........HH', 'H..........H', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'court',
    clip: false,
    grid: ['..hhhhhhhh..', '.hhhhhhhhhh.', 'hhhhhhhhhhhH', 'hhhhhhhhhhHH', 'hh........HH', 'h..........H', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'afro',
    clip: false,
    grid: ['.hhhhhhhhhh.', 'hhhhhhhhhhhh', 'hhhhhhhhhhhH', 'hhhhhhhhhhHH', 'hhh......hHH', 'hh........HH', 'hh........HH', 'h..........H', EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'tresses',
    clip: true,
    grid: ['hHhHhHhHhHhH', 'hHhHhHhHhHhH', 'hHhHhHhHhHhH', 'hH........hH', 'h..........H', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'chignon',
    clip: false,
    grid: ['....HhhH....', '..hhhhhhhh..', 'hhhhhhhhhhhH', 'hh..hhhh..HH', 'h..........H', 'h..........H', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'bandeau',
    clip: true,
    grid: ['hhhhhhhhhhhh', 'hhhhhhhhhhhH', 'SSSSSSSSSSSS', 'hh........HH', 'h..........H', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'chauve',
    clip: true,
    grid: [EMPTY, '...11.......', '..11........', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'frange',
    clip: false,
    grid: ['..hhhhhhhh..', '.hhhhhhhhhh.', 'hhhhhhhhhhhH', 'hhhhhhh..hHH', 'hhh.......HH', 'h..........H', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'degrade',
    clip: true,
    grid: ['hhhhhhhhhhhh', 'hhhhhhhhhhhh', 'HhhhhhhhhhhH', 'H..........H', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
  },
  {
    name: 'barbe',
    clip: true,
    grid: [
      'HHHHHHHHHHHH',
      'HhHHHHhHHHHH',
      'HHHHhHHHHHhH',
      'HH........HH',
      'H..........H',
      EMPTY,
      EMPTY,
      'h..........h',
      'hh........hh',
      'hhh......hhh',
      'hhhh....hhhh',
      '.hhhhhhhhhh.',
    ],
  },
];
