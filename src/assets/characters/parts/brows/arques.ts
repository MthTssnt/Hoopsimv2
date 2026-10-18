import { grid, type PairPart } from '../../types';

/** Sourcils arqués : un accent circonflexe. */
export const arques: PairPart = {
  id: 'arques',
  name: 'Arqués',
  expressions: {
    neutre: { near: grid([-1, -1], '.D.', 'D.D'), far: grid([-1, -1], '.D', 'D.') },
    joie: { near: grid([-1, -1], 'DDD'), far: grid([0, -1], 'D') },
    cri: { near: grid([-1, -1], 'D..', '.DD'), far: grid([-1, -1], '.D', 'D.') },
    decu: { near: grid([-1, -1], '..D', 'DD.'), far: grid([-1, -1], 'D.', '.D') },
  },
};
