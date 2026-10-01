/**
 * Petits sprites de l'arène (originaux) : spectateurs vus de face, photographe accroupi
 * (tourné vers la droite), ballon. Mêmes symboles que les joueurs :
 *   1/2/3 peau · h/H cheveux · n œil · P couleur du vêtement · S casquette ou détail
 *   k encre · w craie · g gris clair · G gris foncé · b/B orange/orange sombre (ballon)
 */

/** Spectateurs assis, 6×7 : tête et épaules. */
export const SPECTATORS: readonly (readonly string[])[] = [
  // cheveux courts
  ['.hhhh.', 'h2222h', '.2n2n.', '.2222.', 'PPPPPP', 'PPPPPP', 'PPPPPP'],
  // casquette aux couleurs de l'équipe
  ['.SSSS.', 'SSSSSS', '.2n2n.', '.2222.', 'PPPPPP', 'PPPPPP', 'PPPPPP'],
  // cheveux longs
  ['.hhhh.', 'hh22hh', 'h2n2nh', 'h2222h', 'PPPPPP', 'PPPPPP', 'PPPPPP'],
  // crâne rasé
  ['......', '.2222.', '.2n2n.', '.2222.', 'PPPPPP', 'PPPPPP', 'PPPPPP'],
];

/** Photographe accroupi, appareil à l'œil, 12×12, tourné vers la droite. */
export const PHOTOGRAPHER: readonly string[] = [
  '....hhh.....',
  '...hhhhh....',
  '...h22GGgg..',
  '...222GGgg..',
  '....2GGG....',
  '...kkkk22...',
  '..kkkkkk2...',
  '..kkkkkkk...',
  '.kkkkkkk....',
  '.kkk..kkk...',
  '.kkk..kkk...',
  '.www..www...',
];

/** Ballon, 5×5. */
export const BALL: readonly string[] = ['.bbb.', 'bbBbb', 'bBbBb', 'bbBbb', '.bbb.'];
