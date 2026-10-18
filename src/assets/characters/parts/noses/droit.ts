import { grid, type NosePart } from '../../types';

/** Nez droit et long : la pointe dépasse franchement du profil, narine à l'ombre profonde. */
export const droit: NosePart = { id: 'droit', name: 'Droit', grid: grid([-1, 0], '...3', '4.3.'), outside: true };
