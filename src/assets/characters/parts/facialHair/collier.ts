import { grid, type FacialHairPart } from '../../types';

/** Collier : favoris et bord de la mâchoire, sans moustache. */
export const collier: FacialHairPart = {
  id: 'collier',
  name: 'Collier',
  views: {
    down: grid([-5, -3], '..b.......', '..b.......', '.bb.......', 'bb........', 'bbbbbbbbbb', 'bbbbbbbbbb'),
    up: grid([1, -1], 'bb', 'b.'),
  },
};
