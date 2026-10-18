import { grid, type AccessoryPart } from '../../types';

/** Bandeau : 2 rangées autour du front, découpées sur la tête (cheveux compris). */
export const bandeau: AccessoryPart = {
  id: 'bandeau',
  name: 'Bandeau',
  wrap: true,
  views: {
    down: grid([-8, 1], 'cccccccccccccccccccc', 'CCCCCCCCCCCCCCCCCCCC'),
    up: grid([-8, 1], 'cccccccccccccccccccc', 'CCCCCCCCCCCCCCCCCCCC'),
  },
};
