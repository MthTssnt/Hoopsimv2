import { grid, type PairPart } from '../../types';

/** Sourcils doux (ceux de la planche du style 5) : 2 pixels et 1 pixel, au ton d'ombre des cheveux. */
export const doux: PairPart = {
  id: 'doux',
  name: 'Doux',
  expressions: {
    neutre: { near: grid([0, 0], 'DD'), far: grid([0, 0], 'D') },
    joie: { near: grid([0, -1], 'DD'), far: grid([0, -1], 'D') },
    cri: { near: grid([0, -1], 'D.', '.D'), far: grid([-1, -1], '.D', 'D.') },
    decu: { near: grid([0, -1], '.D', 'D.'), far: grid([-1, -1], 'D') },
  },
};
