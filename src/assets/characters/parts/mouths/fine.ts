import { grid, type MouthPart } from '../../types';

/** Bouche fine (celle de la planche du style 5) : un trait de 2 pixels à l'ombre. */
export const fine: MouthPart = {
  id: 'fine',
  name: 'Fine',
  expressions: {
    neutre: grid([0, 0], '33'),
    joie: grid([-1, -1], '3..3', '.44.'),
    cri: grid([0, 0], '44', '44'),
    decu: grid([-1, 0], '.44.', '3..3'),
  },
};
