import { refreshRotations } from './coach';
import { generateLeague } from './generate';
import { randomSeed, Rng } from './rng';
import { startRegularSeason } from './simSeason';
import { TEAM_SEEDS } from './teamsData';
import type { League } from './types';

export * from './types';
export { Rng, randomSeed } from './rng';
export { TEAM_SEEDS } from './teamsData';
export * from './ratings';
export * from './stats';
export * from './simSeason';
export * from './playoffs';
export * from './offseason';
export * from './coach';
export { formatClock, simulateGame } from './simGame';
export { generateDraftClass } from './generate';
export { migrateLeague } from './migrate';
export * from './shot';
export * from './athletics';
export * from './steal';
export * from './rotation';

export const FIRST_SEASON = 2026;

/** Crée une nouvelle partie : ligue générée, effectifs, rotations et calendrier. */
export function createNewGame(userTeamId: string, seed = randomSeed()): League {
  const rng = new Rng(seed);
  const league = generateLeague(rng, seed, userTeamId, FIRST_SEASON);
  refreshRotations(league, false);
  startRegularSeason(league);
  return league;
}

export function teamLabel(team: { city: string; name: string }): string {
  return `${team.city} ${team.name}`;
}

export function allTeamSeeds() {
  return TEAM_SEEDS;
}
