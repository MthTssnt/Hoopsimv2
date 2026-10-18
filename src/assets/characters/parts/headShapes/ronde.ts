import type { HeadShapePart } from '../../types';
import { backSkull, SKULL_TOP, shapeViews, wideCheeks } from './common';

/** Tête ronde : joues pleines (une colonne de plus à l'arrière), mâchoire arrondie et pleine. */
export const ronde: HeadShapePart = {
  id: 'ronde',
  name: 'Ronde',
  views: shapeViews([...wideCheeks(SKULL_TOP), 'xxxxxxxxxxxx', 'xxxxxxxxxxx.', '.xxxxxxxxx..'], backSkull(wideCheeks(SKULL_TOP), ['.xxxxxxxxxx.', '..xxxxxxxx..', '...xxxxxx...'])),
};
