import type { HeadShapePart } from '../../types';
import { backSkull, SKULL_TOP, shapeViews } from './common';

/** Tête carrée (planche du style 5) : mâchoire large, menton plat. */
export const carree: HeadShapePart = {
  id: 'carree',
  name: 'Carrée',
  views: shapeViews([...SKULL_TOP, '.xxxxxxxxxxx', '..xxxxxxxxx.', '...xxxxxxx..'], backSkull(SKULL_TOP)),
};
