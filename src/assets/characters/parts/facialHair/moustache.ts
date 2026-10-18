import { EMPTY, grid, type FacialHairPart } from '../../types';

/** Moustache : 3 pixels au-dessus de la bouche. */
export const moustache: FacialHairPart = {
  id: 'moustache',
  name: 'Moustache',
  views: { down: grid([-1, -1], 'BBB'), up: EMPTY },
};
