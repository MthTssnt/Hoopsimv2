import { teamStrength } from './ratings';
import type { Conference, League, Player, StatLine, Team } from './types';
import { totalReb } from './types';

export interface StandingRow {
  team: Team;
  wins: number;
  losses: number;
  pct: number;
  gamesBack: number;
  diff: number;
  streak: number;
  lastTen: string;
  rank: number;
}

export function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  return total === 0 ? 0 : wins / total;
}

export function buildStandings(league: League, conference?: Conference): StandingRow[] {
  const teams = conference ? league.teams.filter((t) => t.conference === conference) : league.teams;
  const sorted = [...teams].sort((a, b) => {
    const pctDiff = winPct(b.wins, b.losses) - winPct(a.wins, a.losses);
    if (Math.abs(pctDiff) > 1e-9) return pctDiff;
    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return a.abbr.localeCompare(b.abbr);
  });

  const leader = sorted[0];
  return sorted.map((team, i) => ({
    team,
    wins: team.wins,
    losses: team.losses,
    pct: winPct(team.wins, team.losses),
    gamesBack: leader ? ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2 : 0,
    diff: team.pointsFor - team.pointsAgainst,
    streak: team.streak,
    lastTen: `${team.lastTen.filter(Boolean).length}-${team.lastTen.filter((w) => !w).length}`,
    rank: i + 1,
  }));
}

export type PerGameKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tov' | 'min' | 'tpm' | 'fga';

export function perGame(line: StatLine, key: PerGameKey): number {
  if (line.gp === 0) return 0;
  switch (key) {
    case 'reb':
      return totalReb(line) / line.gp;
    case 'min':
      return line.secs / 60 / line.gp;
    default:
      return line[key] / line.gp;
  }
}

export function shootingPct(made: number, attempted: number): number {
  return attempted === 0 ? 0 : made / attempted;
}

/** Pourcentage effectif au tir : pondère les 3 points à leur juste valeur. */
export function effectiveFg(line: StatLine): number {
  return line.fga === 0 ? 0 : (line.fgm + 0.5 * line.tpm) / line.fga;
}

/**
 * Indice d'efficacité simplifié, utilisé pour les votes MVP et le classement
 * des meilleurs joueurs. Proche du « game score » classique.
 */
export function gameScore(line: StatLine): number {
  if (line.gp === 0) return 0;
  const per = (v: number) => v / line.gp;
  return (
    per(line.pts) * 1 +
    per(line.fgm) * 0.4 -
    per(line.fga) * 0.7 -
    (per(line.fta) - per(line.ftm)) * 0.4 +
    per(line.oreb) * 0.7 +
    per(line.dreb) * 0.3 +
    per(line.stl) * 1 +
    per(line.ast) * 0.7 +
    per(line.blk) * 0.7 -
    per(line.pf) * 0.4 -
    per(line.tov) * 1
  );
}

export interface LeaderRow {
  player: Player;
  team: Team | undefined;
  value: number;
}

export function leaders(
  league: League,
  key: PerGameKey,
  minGamesRatio = 0.4,
  limit = 10,
  playoffs = false,
): LeaderRow[] {
  const maxGp = Math.max(1, ...Object.values(league.players).map((p) => (playoffs ? p.playoffStats.gp : p.stats.gp)));
  const minGp = Math.max(1, Math.floor(maxGp * minGamesRatio));
  return Object.values(league.players)
    .filter((p) => p.teamId !== null)
    .map((p) => ({
      player: p,
      team: league.teams.find((t) => t.id === p.teamId),
      line: playoffs ? p.playoffStats : p.stats,
    }))
    .filter((row) => row.line.gp >= minGp)
    .map((row) => ({ player: row.player, team: row.team, value: perGame(row.line, key) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Course au MVP : efficacité individuelle pondérée par la réussite de l'équipe. */
export function mvpRace(league: League, limit = 10): { player: Player; team: Team | undefined; score: number }[] {
  return Object.values(league.players)
    .filter((p) => p.teamId !== null && p.stats.gp >= 20)
    .map((p) => {
      const team = league.teams.find((t) => t.id === p.teamId);
      const teamPct = team ? winPct(team.wins, team.losses) : 0.5;
      const minutes = p.stats.secs / 60 / Math.max(1, p.stats.gp);
      const score = gameScore(p.stats) * (0.55 + teamPct * 0.9) + Math.min(minutes, 38) * 0.12;
      return { player: p, team, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function teamPlayers(league: League, teamId: string): Player[] {
  const team = league.teams.find((t) => t.id === teamId);
  if (!team) return [];
  return team.roster.map((id) => league.players[id]).filter(Boolean);
}

export function projectedStrength(league: League, teamId: string): number {
  return teamStrength(teamPlayers(league, teamId));
}

export function payroll(league: League, teamId: string): number {
  return teamPlayers(league, teamId).reduce((sum, p) => sum + p.contract.salary, 0);
}

export function formatMinutes(secs: number, gp: number): string {
  if (gp === 0) return '0:00';
  const perGameSecs = secs / gp;
  const m = Math.floor(perGameSecs / 60);
  const s = Math.round(perGameSecs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
