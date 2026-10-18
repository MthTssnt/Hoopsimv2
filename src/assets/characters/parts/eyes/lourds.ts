import { grid, type PairPart } from '../../types';

/** Yeux aux paupières lourdes : une paupière à l'ombre profonde au-dessus de la pupille. */
export const lourds: PairPart = {
  id: 'lourds',
  name: 'Paupières lourdes',
  expressions: {
    neutre: { near: grid([0, 0], '44', 'n.'), far: grid([0, 0], '4', 'n') },
    joie: { near: grid([-1, 0], '.4', '4.'), far: grid([0, 0], '4') },
    cri: { near: grid([0, 0], 'n', 'n'), far: grid([0, 0], 'n', 'n') },
    decu: { near: grid([0, 0], '44', '4n'), far: grid([0, 0], '4', 'n') },
  },
};
