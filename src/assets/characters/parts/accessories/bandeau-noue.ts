import { grid, type AccessoryPart } from '../../types';

/** Bandeau noué : 2 rangées, avec les pans du nœud qui pendent à l'arrière de la tête. */
export const bandeauNoue: AccessoryPart = {
  id: 'bandeau-noue',
  name: 'Bandeau noué',
  wrap: true,
  views: {
    down: grid([-8, 1], 'cccccccccccccccccccc', 'CCCCCCCCCCCCCCCCCCCC'),
    up: grid([-8, 1], 'cccccccccccccccccccc', 'CCCCCCCCCCCCCCCCCCCC'),
  },
  loose: {
    down: grid([-2, 0], 'CC', 'Cd', 'd.'),
    up: grid([2, 0], 'C', 'd', 'd'),
  },
};
