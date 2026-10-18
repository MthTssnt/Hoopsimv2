import type { HeadShapePart } from '../../types';
import { backSkull, SKULL_TOP, shapeViews } from './common';

/** Tête normale : mâchoire en pente douce, menton moyen. */
export const normale: HeadShapePart = {
  id: 'normale',
  name: 'Normale',
  views: shapeViews([...SKULL_TOP, '..xxxxxxxxxx', '...xxxxxxxx.', '.....xxxxx..'], backSkull(SKULL_TOP)),
};
