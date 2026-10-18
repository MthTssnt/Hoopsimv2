import type { HeadShapePart } from '../../types';
import { backSkull, SKULL_TOP, shapeViews } from './common';

/** Tête fine (planche du style 5) : mâchoire étroite, menton pointu. */
export const fine: HeadShapePart = {
  id: 'fine',
  name: 'Fine',
  views: shapeViews([...SKULL_TOP, '..xxxxxxxxxx', '....xxxxxxx.', '......xxxx..'], backSkull(SKULL_TOP)),
};
