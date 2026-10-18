import { grid, type MouthPart } from '../../types';

/** Bouche large : 4 pixels ; le sourire montre les dents. */
export const large: MouthPart = {
  id: 'large',
  name: 'Large',
  expressions: {
    neutre: grid([-1, 0], '3443'),
    joie: grid([-2, -1], '3....3', '.4ww4.'),
    cri: grid([-1, 0], '.44.', '4444'),
    decu: grid([-2, 0], '.4444.', '3....3'),
  },
};
