import { EMPTY, grid, type HairPart } from '../../types';

/** Tresses : tresses plaquées qui convergent. */
export const tresses: HairPart = {
  id: 'tresses',
  name: 'Tresses',
  views: {
    down: {
      back: grid([-2, -1],
        '.DDDDD....',
        'Dr.....D..',
        'H........D',
      ),
      front: grid([-2, 0],
        '..HrHrH..',
        '.DHDHDHDH',
        '333333333',
        'DrHD.....',
        'HDHD.....',
        '33.......',
        'rHD......',
        'DD.......',
      ),
    },
    up: {
      back: EMPTY,
      front: grid([-2, 0],
        '..333HD...',
        '.HD33rH3H.',
        '3rH33HD3rH',
        '3HD33rH3HD',
        '33hH3HD3hH',
        '33HD3hHHD3',
        '33hH3HDhH3',
        '333HDhHHD3',
        '.33hHHhH3.',
      ),
    },
  },
};
