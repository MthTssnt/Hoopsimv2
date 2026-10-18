import { grid, type PairPart } from '../../types';

/** Sourcils épais : 3 pixels à l'ombre profonde, doublés au-dessus. */
export const epais: PairPart = {
  id: 'epais',
  name: 'Épais',
  expressions: {
    neutre: { near: grid([-1, -1], '.DD', 'EEE'), far: grid([0, -1], 'D', 'E') },
    joie: { near: grid([-1, -1], 'EEE'), far: grid([0, -1], 'E') },
    cri: { near: grid([-1, -1], 'EE.', '.EE'), far: grid([-1, -1], '.E', 'E.') },
    decu: { near: grid([-1, -1], '.EE', 'EE.'), far: grid([-1, -1], 'E.', '.E') },
  },
};
