import { generateMarketPlayers, nextRookieId } from '../generate';
import { hashSeed, Rng } from '../rng';
import type { League } from '../types';
import { defaultFrontOffice, initialSalaryCap, LEAGUE_ECONOMY_CONFIG } from './economy';
import type { MarketEvent } from './types';

export function logMarket(league: League, event: Omit<MarketEvent, 'id' | 'season' | 'day'>): void {
  const management = league.management!;
  management.transactions.push({ ...event, id: management.nextEventId++, season: league.season, day: league.day });
  management.transactions = management.transactions.slice(-LEAGUE_ECONOMY_CONFIG.retainedTransactions);
  league.feed.push({ day: league.day, text: event.description }); league.feed = league.feed.slice(-200);
}
/** Independent RNG stream and unique ids: does not perturb the historic sports calibration. */
export function generateFreeAgents(league: League, count: number, label: string): string[] {
  const startId = reservePlayerIds(league, count);
  const rng = new Rng(hashSeed(`${league.seed}|${league.season}|${label}|${startId}`));
  const players = generateMarketPlayers(rng, count, startId, Object.values(league.players).map(p => p.lastName));
  for (const player of players) {
    player.age = rng.int(23, 31); player.potential = Math.min(player.potential, player.overall + 5);
    player.teamId = null; player.contract = { salary: 0, years: 0 }; player.freeAgentSince = league.season;
    league.players[player.id] = player;
  }
  return players.map(p => p.id);
}
export function ensureManagement(league: League): void {
  for (const team of league.teams) team.frontOffice ??= defaultFrontOffice(league, team);
  for (const p of Object.values(league.players)) if (p.teamId && p.contract.salary < LEAGUE_ECONOMY_CONFIG.minimumSalary) p.legacyMinimum = true;
  if (league.management) { league.management.nextPlayerId = Math.max(league.management.nextPlayerId ?? 0, nextRookieId(league.players)); return; }
  league.management = { version: 1, salaryCap: initialSalaryCap(league), nextEventId: 1, nextPlayerId: nextRookieId(league.players), transactions: [], proposals: [] };
  if (!Object.values(league.players).some(p => p.teamId === null)) {
    const ids = generateFreeAgents(league, LEAGUE_ECONOMY_CONFIG.initialFreeAgents, 'initial-free-agents');
    logMarket(league, { type: 'pool', teamIds: [], playerIds: ids, description: 'Ouverture du marché : 30 agents libres de profondeur disponibles.' });
  }
}

/** Persistent high-water mark also prevents reusing ids of retired players in transaction history. */
export function reservePlayerIds(league: League, count: number): number {
  const start = Math.max(league.management!.nextPlayerId, nextRookieId(league.players));
  league.management!.nextPlayerId = start + count;
  return start;
}
