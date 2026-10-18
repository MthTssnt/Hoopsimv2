import { grid, type NosePart } from '../../types';

/** Nez aquilin : arête éclairée et bosse qui dépasse du profil au-dessus de la pointe. */
export const aquilin: NosePart = { id: 'aquilin', name: 'Aquilin', grid: grid([-1, -1], '.13', '...', '4..'), outside: true };
