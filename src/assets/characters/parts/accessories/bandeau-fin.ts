import { grid, type AccessoryPart } from '../../types';

/** Bandeau fin : une seule rangée. */
export const bandeauFin: AccessoryPart = {
  id: 'bandeau-fin',
  name: 'Bandeau fin',
  wrap: true,
  views: {
    down: grid([-8, 2], 'CCCCCCCCCCCCCCCCCCCC'),
    up: grid([-8, 2], 'CCCCCCCCCCCCCCCCCCCC'),
  },
};
