import type { HeadShapePart } from '../../types';
import { backSkull, SKULL_TOP, shapeViews } from './common';

/** Tête carrée : mâchoire large jusqu'en bas, menton plat ; nuque épaisse. */
export const carree: HeadShapePart = {
  id: 'carree',
  name: 'Carrée',
  views: shapeViews([...SKULL_TOP, '.xxxxxxxxxxx', '.xxxxxxxxxxx', '..xxxxxxxxx.'], backSkull(SKULL_TOP, ['..xxxxxxxx..', '..xxxxxxxx..', '..xxxxxxxx..'])),
};
