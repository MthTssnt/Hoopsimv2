import { EMPTY, grid, type FacialHairPart } from '../../types';

/** Bouc : les coins de la bouche et le menton. */
export const bouc: FacialHairPart = {
  id: 'bouc',
  name: 'Bouc',
  views: { down: grid([-2, 0], 'b...b', '.bbb.'), up: EMPTY },
};
