import { grid, type EarsPart } from '../../types';

/** Oreilles décollées : grand pavillon qui dépasse de l'arrière du crâne ; de dos, des deux côtés. */
export const decollees: EarsPart = {
  id: 'decollees',
  name: 'Décollées',
  views: {
    down: { near: grid([-3, -1], '.55..', '55335', '34435', '.333.') },
    up: { near: grid([0, -1], '5.', '55', '3.'), far: grid([-1, -1], '.5', '55', '.3') },
  },
};
