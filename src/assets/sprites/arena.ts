/**
 * Petits sprites de l'arène (originaux) : spectateurs vus de face, photographe accroupi
 * (tourné vers la droite), ballon. Mêmes symboles que les joueurs :
 *   1/2/3 peau · h/H cheveux · n œil · P couleur du vêtement · S casquette ou détail
 *   k encre · w craie · g gris clair · G gris foncé · b/B orange/orange sombre (ballon)
 */

/** Spectateurs assis, 10×12 : tête et épaules. */
export const SPECTATORS: readonly (readonly string[])[] = [
  // cheveux courts
  ['...hhhh...', '..hhhhhh..', '..h2222h..', '..2n22n2..', '..222222..', '...2222...', '.PPPPPPPP.', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP'],
  // casquette aux couleurs de l'équipe
  ['...SSSS...', '..SSSSSS..', '..SSSSSSS.', '..2n22n2..', '..222222..', '...2222...', '.PPPPPPPP.', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP'],
  // cheveux longs
  ['...hhhh...', '..hhhhhh..', '.hh2222hh.', '.h2n22n2h.', '.h222222h.', '.hh2222hh.', '.PPPPPPPP.', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP'],
  // crâne rasé
  ['..........', '...2222...', '..222222..', '..2n22n2..', '..222222..', '...2222...', '.PPPPPPPP.', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP', 'PPPPPPPPPP'],
];

/** Photographe accroupi, appareil à l'œil, 18×18, tourné vers la droite. */
export const PHOTOGRAPHER: readonly string[] = [
  '......hhhh........',
  '.....hhhhhh.......',
  '.....hh22GGGG.....',
  '.....h222GGGGgg...',
  '.....2222GGGGgg...',
  '......22.GGGG.....',
  '.....kkkk22.......',
  '....kkkkkk22......',
  '...kkkkkkkk2......',
  '...kkkkkkkkk......',
  '..kkkkkkkkkk......',
  '..kkkkkkkkkkkk....',
  '..kkkkkkkkkkkkk...',
  '.kkkkk...kkkkkk...',
  '.kkkk.....kkkk....',
  '.kkkk.....kkkk....',
  '.wwwww....wwwww...',
  '..................',
];

/** Ballon, 8×8 : coutures en orange sombre, ombre en bas à droite. */
export const BALL: readonly string[] = ['..bbBb..', '.bbbBbb.', 'bbbbBbbB', 'BBBBBBBB', 'bbbbBbbB', 'bbbbBbBB', '.bbbBBB.', '..BBBB..'];
