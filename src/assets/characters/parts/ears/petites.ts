import { grid, type EarsPart } from '../../types';

/** Petites oreilles : un seul pixel d'ombre, collé au crâne ; de dos, à peine visibles. */
export const petites: EarsPart = {
  id: 'petites',
  name: 'Petites',
  views: {
    down: { near: grid([0, 1], '3') },
    up: { near: grid([0, 1], '3'), far: grid([0, 1], '3') },
  },
};
