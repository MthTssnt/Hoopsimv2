import { grid, type MouthPart } from '../../types';

/** Bouche pleine : la ligne à l'ombre profonde, la lèvre du bas éclairée. */
export const pleine: MouthPart = {
  id: 'pleine',
  name: 'Pleine',
  expressions: {
    neutre: grid([0, 0], '44', '11'),
    joie: grid([-1, -1], '4..4', '.44.', '.11.'),
    cri: grid([0, -1], '33', '44', '44'),
    decu: grid([-1, 0], '.44.', '4..4'),
  },
};
