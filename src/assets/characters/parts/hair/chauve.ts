import { EMPTY, grid, type HairPart } from '../../types';

/** Chauve : crâne nu et brillant. */
export const chauve: HairPart = {
  id: 'chauve',
  name: 'Chauve',
  views: {
    down: {
      back: EMPTY,
      front: grid([-1, 0],
        '.00',
        '00.',
        '0..',
      ),
    },
    up: {
      back: EMPTY,
      front: grid([-1, 0],
        '.000..',
        '00....',
        '0.....',
        '......',
        '......',
        '......',
        '......',
        '......',
        '.33333',
      ),
    },
  },
};
