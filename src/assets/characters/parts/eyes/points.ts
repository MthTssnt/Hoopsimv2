import { grid, type PairPart } from '../../types';

/** Petits yeux en points (ceux de la planche du style 5) : un pixel sombre, posé bas. */
export const points: PairPart = {
  id: 'points',
  name: 'Points',
  expressions: {
    neutre: { near: grid([0, 1], 'n'), far: grid([0, 1], 'n') },
    joie: { near: grid([-1, 0], '.n', 'n.'), far: grid([0, 0], 'n') },
    cri: { near: grid([0, 0], 'n', 'n'), far: grid([0, 0], 'n', 'n') },
    decu: { near: grid([0, 1], 'n3'), far: grid([0, 1], 'n') },
  },
};
