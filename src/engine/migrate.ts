import { ensureAthleticAttrs } from './generate';
import type { League } from './types';

/** Met à niveau une partie chargée depuis une sauvegarde plus ancienne. */
export function migrateLeague(league: League): League {
  for (const player of Object.values(league.players)) ensureAthleticAttrs(player);
  return league;
}
