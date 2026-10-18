import { grid, type FacialHairPart } from '../../types';

/** Barbe courte : joues, mâchoire et menton, favoris et moustache ; de dos, le bord de la mâchoire. */
export const barbe: FacialHairPart = {
  id: 'barbe',
  name: 'Barbe courte',
  views: {
    down: grid([-5, -3], '..b.......', '..b.......', 'bbbbBBB...', 'bbbbbbbbbb', 'bbbbbbbbbb', 'bbbbbbbbbb'),
    up: grid([1, -1], 'bbbb', 'bbbb', 'bbbb'),
  },
};
