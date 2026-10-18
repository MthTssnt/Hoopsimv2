import type { HeadShapePart } from '../../types';
import { backSkull, SKULL_TOP, shapeViews, wideCheeks } from './common';

/** Tête ronde (planche du style 5) : joues pleines (une colonne de plus à l'arrière), menton arrondi. */
export const ronde: HeadShapePart = {
  id: 'ronde',
  name: 'Ronde',
  views: shapeViews([...wideCheeks(SKULL_TOP), '.xxxxxxxxxxx', '..xxxxxxxxx.', '....xxxxx...'], backSkull(SKULL_TOP)),
};
