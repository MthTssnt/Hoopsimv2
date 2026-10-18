import { grid, type PairPart } from '../../types';

/** Sourcils courts : un seul pixel foncé au-dessus de chaque œil. */
export const courts: PairPart = {
  id: 'courts',
  name: 'Courts',
  expressions: {
    neutre: { near: grid([0, 0], 'E'), far: grid([0, 0], 'E') },
    joie: { near: grid([0, -1], 'E'), far: grid([0, -1], 'E') },
    cri: { near: grid([1, 0], 'E'), far: grid([-1, 0], 'E') },
    decu: { near: grid([1, -1], 'E'), far: grid([-1, -1], 'E') },
  },
};
