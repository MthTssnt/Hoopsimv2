/**
 * Petits sprites de l'arène (originaux) : spectateurs vus de face, photographe accroupi
 * (tourné vers la droite), ballon. Mêmes symboles que les joueurs :
 *   1/2/3 peau · h/H cheveux · n œil · P couleur du vêtement · S casquette ou détail
 *   k encre · w craie · g gris clair · G gris foncé · b/B orange/orange sombre (ballon)
 */

/** Spectateurs assis, 8×10 : tête et épaules. */
export const SPECTATORS: readonly (readonly string[])[] = [
  // cheveux courts
  ['..hhhh..', '.hhhhhh.', '.h2222h.', '.2n22n2.', '.222222.', '..2222..', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'],
  // casquette aux couleurs de l'équipe
  ['..SSSS..', '.SSSSSS.', '.SSSSSSS', '.2n22n2.', '.222222.', '..2222..', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'],
  // cheveux longs
  ['..hhhh..', '.hhhhhh.', 'hh2222hh', 'h2n22n2h', 'h222222h', 'hh2222hh', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'],
  // crâne rasé
  ['........', '..2222..', '.222222.', '.2n22n2.', '.222222.', '..2222..', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'],
];

/** Photographe accroupi, appareil à l'œil, 14×14, tourné vers la droite. */
export const PHOTOGRAPHER: readonly string[] = [
  '....hhh.......',
  '...hhhhh......',
  '...h22GGGg....',
  '...222GGGgg...',
  '....22GGG.....',
  '...kkk22......',
  '..kkkkkk2.....',
  '..kkkkkkk.....',
  '.kkkkkkkkkk...',
  '.kkkkkkkkkk...',
  '.kkkk..kkkk...',
  '.kkk....kkk...',
  '.kkk....kkk...',
  '.wwww...wwww..',
];

/** Ballon, 6×6 : coutures en orange sombre, ombre en bas à droite. */
export const BALL: readonly string[] = ['.bbBb.', 'bbbBbB', 'BBBBBB', 'bbbBbB', 'bbbBBB', '.bBBB.'];
