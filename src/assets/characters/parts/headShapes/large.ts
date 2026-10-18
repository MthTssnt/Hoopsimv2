import type { HeadShapePart } from '../../types';
import { backSkull, SKULL_TOP, shapeViews, wideCheeks } from './common';

/** Tête large (planche du style 5) : joues pleines, mâchoire massive. */
export const large: HeadShapePart = {
  id: 'large',
  name: 'Large',
  views: shapeViews([...wideCheeks(SKULL_TOP), 'xxxxxxxxxxxx', '.xxxxxxxxxx.', '...xxxxxxx..'], backSkull(SKULL_TOP)),
};
