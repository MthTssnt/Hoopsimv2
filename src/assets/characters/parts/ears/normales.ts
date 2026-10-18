import { grid, type EarsPart } from '../../types';

/** Oreilles normales : pavillon de 2 colonnes sur 3 rangées, creux à l'ombre profonde. */
export const normales: EarsPart = {
  id: 'normales',
  name: 'Normales',
  views: {
    down: { near: grid([0, 0], '3.', '43', '3.') },
    up: { near: grid([0, 0], '5', '3'), far: grid([0, 0], '5', '3') },
  },
};
