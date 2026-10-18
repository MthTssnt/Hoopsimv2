import { grid, type EarsPart } from '../../types';

/** Oreilles normales (planche du style 5) : pavillon de 2 colonnes sur 3 rangées, lobe à l'ombre. */
export const normales: EarsPart = {
  id: 'normales',
  name: 'Normales',
  views: {
    down: { near: grid([0, 0], '5.', '35', '3.') },
    up: { near: grid([0, 0], '5', '3'), far: grid([0, 0], '5', '3') },
  },
};
