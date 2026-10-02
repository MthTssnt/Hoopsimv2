import { ensureAthleticAttrs } from './generate';
import type { League } from './types';

/** Noms d'équipes trop proches de franchises réelles, renommés au chargement d'une sauvegarde. */
const RENAMED_TEAMS: Record<string, { from: string; to: string }> = {
  det: { from: 'Pistons Mécaniques', to: 'Gears' },
};

/** Met à niveau une partie chargée depuis une sauvegarde plus ancienne. */
export function migrateLeague(league: League): League {
  for (const player of Object.values(league.players)) ensureAthleticAttrs(player);
  for (const team of league.teams) {
    const rename = RENAMED_TEAMS[team.id];
    if (rename && team.name === rename.from) team.name = rename.to;
  }
  return league;
}
