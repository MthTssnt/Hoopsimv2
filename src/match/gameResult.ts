import { reportSnapshot } from '../engine/coaching/analytics';
import { matchTimeScale } from './world/rotation';
import { repairGamePlan, validateGamePlan, type GamePlan } from '../engine/gamePlan';
import { hashSeed } from '../engine/rng';
import { matchRotation } from '../engine/rotation';
import { teamById, type PlayedGame } from '../engine/simSeason';
import type { BoxScoreRow, Game, League, Player, Team } from '../engine/types';
import type { MatchMember } from './world/rotation';
import type { MatchWorld } from './world/MatchWorld';

/** Jouer (tu contrôles ton équipe) ou regarder (CPU contre CPU). */
export type MatchMode = 'jouer' | 'regarder';

/**
 * Ce que le match reçoit du GM : les deux équipes, leurs rotations (celles de la simulation), ton
 * côté, le mode et la graine. Ton équipe est l'équipe 0 du monde.
 */
export interface MatchSetup {
  homePlan?: GamePlan;
  awayPlan?: GamePlan;
  gameId: string;
  home: Team;
  away: Team;
  homeRotation: Player[];
  awayRotation: Player[];
  userSide: 'home' | 'away';
  mode: MatchMode;
  seed: number;
}

/** Mise en place du match de ton équipe `game`. */
export function gmMatchSetup(league: League, game: Game, mode: MatchMode): MatchSetup {
  const home = teamById(league, game.homeId);
  const away = teamById(league, game.awayId);
  for (const team of [home, away]) {
    repairGamePlan(team, league.players);
    const errors = validateGamePlan(team.gamePlan, team, league.players);
    if (errors.length) throw new Error(errors.join(' '));
  }
  return {
    homePlan: structuredClone(home.gamePlan), awayPlan: structuredClone(away.gamePlan),
    gameId: game.id,
    home,
    away,
    homeRotation: matchRotation(home, league.players),
    awayRotation: matchRotation(away, league.players),
    userSide: game.homeId === league.userTeamId ? 'home' : 'away',
    mode,
    seed: hashSeed(`${league.seed}-${league.season}-${game.id}`),
  };
}

/** Rotations dans l'ordre du monde : ton équipe d'abord (équipe 0), l'adversaire ensuite. */
export function worldRotations(setup: MatchSetup): [Player[], Player[]] {
  return setup.userSide === 'home' ? [setup.homeRotation, setup.awayRotation] : [setup.awayRotation, setup.homeRotation];
}

/** Lignes d'une équipe, comme la simulation : ceux qui ont joué et les titulaires, titulaires en tête puis par minutes. */
function rows(members: readonly MatchMember[]): BoxScoreRow[] {
  return members
    .filter((m) => m.line.secs > 0 || m.starter)
    .map((m) => ({ playerId: m.id, starter: m.starter, line: { ...m.line, gp: 1 } }))
    .sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0) || b.line.secs - a.line.secs);
}

/**
 * Le match joué, converti pour le moteur : box score brut au format de la simulation (`GameBox`),
 * scores et périodes remis à domicile / à l'extérieur, et l'énergie de fin de chaque joueur.
 */
export function toPlayedGame(world: MatchWorld, setup: MatchSetup): PlayedGame {
  const squads = world.squads;
  const box = world.box;
  if (!squads || !box) throw new Error('Pas de match sur terrain entier');
  const homeTeam = setup.userSide === 'home' ? 0 : 1;
  const awayTeam = 1 - homeTeam;
  const homeScore = world.points[homeTeam];
  const awayScore = world.points[awayTeam];
  const periods = box.periods[homeTeam].map((home, i) => ({ home, away: box.periods[awayTeam][i] ?? 0 }));
  const result = {
    homeScore,
    awayScore,
    periods,
    box: {
      tactics: { source: 'physical' as const, durationSeconds: squads[homeTeam].members.reduce((sum, m) => sum + m.line.secs, 0) / 5, normalizationFactor: matchTimeScale(world.full!.quarterMinutes), teams: { [setup.home.id]: { ...reportSnapshot(world.getGamePlan(homeTeam) ?? setup.homePlan), initialPlanName: setup.homePlan?.name, live: world.tactics.summary(homeTeam), coachingEvents: world.coachingEvents.filter(e => e.team === homeTeam).map(e => ({ time: e.time, message: e.message })) }, [setup.away.id]: { ...reportSnapshot(world.getGamePlan(awayTeam) ?? setup.awayPlan), initialPlanName: setup.awayPlan?.name, live: world.tactics.summary(awayTeam), coachingEvents: world.coachingEvents.filter(e => e.team === awayTeam).map(e => ({ time: e.time, message: e.message })) } } },
      gameId: setup.gameId,
      homeId: setup.home.id,
      awayId: setup.away.id,
      homeScore,
      awayScore,
      periods,
      rows: { [setup.home.id]: rows(squads[homeTeam].members), [setup.away.id]: rows(squads[awayTeam].members) },
    },
    pbp: [],
  };
  const energy = Object.fromEntries(squads.flatMap((s) => s.members.map((m) => [m.id, m.energy])));
  return { result, energy };
}

export function worldGamePlans(setup: MatchSetup): [GamePlan?, GamePlan?] {
  return setup.userSide === 'home' ? [setup.homePlan, setup.awayPlan] : [setup.awayPlan, setup.homePlan];
}
