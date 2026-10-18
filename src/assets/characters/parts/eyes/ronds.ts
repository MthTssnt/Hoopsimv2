import { grid, type PairPart } from '../../types';

/** Yeux ronds : deux rangées, pupille sur l'iris coloré. */
export const ronds: PairPart = {
  id: 'ronds',
  name: 'Ronds',
  expressions: {
    neutre: { near: grid([0, 0], 'n', 'i'), far: grid([0, 0], 'n', 'i') },
    joie: { near: grid([-1, 0], '.n.', 'n.n'), far: grid([0, 0], 'n', '.') },
    cri: { near: grid([0, -1], 'w', 'n', 'i'), far: grid([0, 0], 'n', 'i') },
    decu: { near: grid([0, 0], '4', 'i'), far: grid([0, 1], 'i') },
  },
};
