import { refreshRotations } from './coach';
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
  if (repairRosters(league)) refreshRotations(league, true);
  return league;
}

/**
 * Répare les effectifs abîmés par l'ancien bug des identifiants de rookies (un rookie pouvait
 * reprendre l'identifiant d'un joueur actif) : chaque joueur n'apparaît que dans l'effectif de
 * son équipe, une seule fois. Renvoie vrai si quelque chose a changé.
 */
export function repairRosters(league: League): boolean {
  let changed = false;
  const listed = new Set<string>();
  for (const team of league.teams) {
    const roster = team.roster.filter((id) => {
      const keep = league.players[id]?.teamId === team.id && !listed.has(id);
      listed.add(id);
      return keep;
    });
    if (roster.length !== team.roster.length) {
      team.roster = roster;
      changed = true;
    }
  }
  for (const player of Object.values(league.players)) {
    const team = league.teams.find((t) => t.id === player.teamId);
    if (team && !team.roster.includes(player.id)) {
      team.roster.push(player.id);
      changed = true;
    }
  }
  return changed;
}
