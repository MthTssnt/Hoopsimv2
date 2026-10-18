import type { HeadShapePart } from '../../types';
import { ANCHORS_DOWN, ANCHORS_UP, backSkull, FACE_ZONE, SKULL_TOP } from './common';

/** Tête longue : mâchoire étroite et menton qui descend d'une rangée de plus ; nuque étroite. */
export const longue: HeadShapePart = {
  id: 'longue',
  name: 'Longue',
  views: {
    down: { skull: [...SKULL_TOP, '..xxxxxxxxxx', '...xxxxxxxx.', '....xxxxxx..', '.....xxxx...'], anchors: { ...ANCHORS_DOWN, chin: [7, 11] }, face: FACE_ZONE },
    up: { skull: backSkull(SKULL_TOP, ['...xxxxxxx..', '....xxxxx...', '....xxxx....', '.....xx.....']), anchors: { ...ANCHORS_UP, chin: [6, 11] }, face: FACE_ZONE },
  },
};
