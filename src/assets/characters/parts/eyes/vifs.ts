import { grid, type PairPart } from '../../types';

/** Yeux vifs : un pixel de blanc côté nez éloigné, l'iris coloré ; regard tourné vers la course. */
export const vifs: PairPart = {
  id: 'vifs',
  name: 'Vifs',
  expressions: {
    neutre: { near: grid([-1, 0], '.n', 'wi'), far: grid([0, 1], 'n') },
    joie: { near: grid([-1, 0], '.n', 'n.'), far: grid([0, 0], 'n') },
    cri: { near: grid([-1, 0], 'wn', 'wi'), far: grid([0, 0], 'n', 'n') },
    decu: { near: grid([-1, 1], '4i'), far: grid([0, 1], 'n') },
  },
};
