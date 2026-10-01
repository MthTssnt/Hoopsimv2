import { refreshRotations } from './coach';
import { playGame } from './simSeason';
import { buildStandings, gameScore } from './stats';
import type { Conference, Game, GameResult, League, PlayoffSeries, Playoffs, Team } from './types';

export const ROUND_NAMES = ['1er tour', 'Demi-finales de conférence', 'Finales de conférence', 'Finales'];

/** Répartition des matchs à domicile d'une série au meilleur des sept (2-2-1-1-1). */
const HOME_PATTERN = [true, true, false, false, true, false, true];

function makeSeries(
  id: string,
  round: number,
  conference: Conference | 'Finales',
  high: { teamId: string; seed: number },
  low: { teamId: string; seed: number },
): PlayoffSeries {
  return { id, round, conference, highSeed: high, lowSeed: low, highWins: 0, lowWins: 0, games: [], winnerId: null };
}

export function startPlayoffs(league: League): void {
  const build = (conference: Conference): PlayoffSeries[] => {
    const seeds = buildStandings(league, conference).slice(0, 8);
    const pair = (a: number, b: number, index: number) =>
      makeSeries(
        `${conference}-r0-${index}`,
        0,
        conference,
        { teamId: seeds[a].team.id, seed: a + 1 },
        { teamId: seeds[b].team.id, seed: b + 1 },
      );
    // Ordre du tableau : les vainqueurs de deux séries voisines se rencontrent au tour suivant.
    return [pair(0, 7, 0), pair(3, 4, 1), pair(1, 6, 2), pair(2, 5, 3)];
  };

  league.playoffs = {
    round: 0,
    rounds: [[...build('Est'), ...build('Ouest')]],
    championId: null,
    finalsMvpId: null,
  };
  league.phase = 'playoffs';
  for (const player of Object.values(league.players)) player.energy = 100;
  refreshRotations(league, true);
  league.feed.push({ day: league.day, text: 'Les playoffs commencent !' });
}

function seriesTeams(league: League, series: PlayoffSeries): { high: Team; low: Team } {
  const high = league.teams.find((t) => t.id === series.highSeed.teamId)!;
  const low = league.teams.find((t) => t.id === series.lowSeed.teamId)!;
  return { high, low };
}

export function seriesIsOver(series: PlayoffSeries): boolean {
  return series.highWins === 4 || series.lowWins === 4;
}

export interface PlayoffDaySummary {
  round: number;
  games: { game: Game; result: GameResult; series: PlayoffSeries }[];
  userGame: { game: Game; result: GameResult } | null;
  roundCompleted: boolean;
  championId: string | null;
}

/** Joue une rencontre dans chaque série encore en cours, puis fait avancer le tableau. */
export function advancePlayoffs(league: League, options: { watchUserGame?: boolean } = {}): PlayoffDaySummary {
  const playoffs = league.playoffs;
  if (!playoffs) throw new Error('Les playoffs ne sont pas lancés');

  const current = playoffs.rounds[playoffs.round];
  const summary: PlayoffDaySummary = {
    round: playoffs.round,
    games: [],
    userGame: null,
    roundCompleted: false,
    championId: null,
  };

  for (const series of current) {
    if (seriesIsOver(series)) continue;
    const { high, low } = seriesTeams(league, series);
    const gameIndex = series.games.length;
    const highHosts = HOME_PATTERN[Math.min(gameIndex, HOME_PATTERN.length - 1)];
    const homeTeam = highHosts ? high : low;
    const awayTeam = highHosts ? low : high;

    const game: Game = {
      id: `${series.id}-g${gameIndex}`,
      day: league.day,
      homeId: homeTeam.id,
      awayId: awayTeam.id,
      played: false,
      homeScore: null,
      awayScore: null,
      seriesId: series.id,
    };
    league.schedule.push(game);

    const isUserGame = homeTeam.id === league.userTeamId || awayTeam.id === league.userTeamId;
    const result = playGame(league, game, { collectPbp: isUserGame && (options.watchUserGame ?? true) });

    const homeWon = result.homeScore > result.awayScore;
    const winnerId = homeWon ? homeTeam.id : awayTeam.id;
    if (winnerId === high.id) series.highWins += 1;
    else series.lowWins += 1;
    series.games.push({
      homeId: homeTeam.id,
      awayId: awayTeam.id,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      gameId: game.id,
    });

    if (seriesIsOver(series)) {
      series.winnerId = series.highWins === 4 ? high.id : low.id;
      const loser = series.winnerId === high.id ? low : high;
      const winner = series.winnerId === high.id ? high : low;
      league.feed.push({
        day: league.day,
        text: `${winner.city} ${winner.name} élimine ${loser.city} ${loser.name} (${Math.max(series.highWins, series.lowWins)}-${Math.min(series.highWins, series.lowWins)}).`,
      });
    }

    summary.games.push({ game, result, series });
    if (isUserGame) summary.userGame = { game, result };
  }

  league.day += 1;

  if (current.every(seriesIsOver)) {
    summary.roundCompleted = true;
    if (playoffs.round === 3) {
      const finals = current[0];
      playoffs.championId = finals.winnerId;
      playoffs.finalsMvpId = pickFinalsMvp(league, finals);
      summary.championId = playoffs.championId;
      const champ = league.teams.find((t) => t.id === playoffs.championId);
      if (champ) {
        league.feed.push({ day: league.day, text: `🏆 ${champ.city} ${champ.name} est champion !` });
      }
    } else {
      playoffs.rounds.push(buildNextRound(league, current, playoffs.round + 1));
      playoffs.round += 1;
    }
    // Repos entre deux tours.
    for (const player of Object.values(league.players)) player.energy = 100;
  }

  return summary;
}

function buildNextRound(league: League, current: PlayoffSeries[], round: number): PlayoffSeries[] {
  const seedOf = (series: PlayoffSeries) =>
    series.winnerId === series.highSeed.teamId ? series.highSeed.seed : series.lowSeed.seed;

  const next: PlayoffSeries[] = [];
  if (round === 3) {
    const east = current.find((s) => s.conference === 'Est')!;
    const west = current.find((s) => s.conference === 'Ouest')!;
    const eastTeam = league.teams.find((t) => t.id === east.winnerId)!;
    const westTeam = league.teams.find((t) => t.id === west.winnerId)!;
    // L'avantage du terrain revient au meilleur bilan de saison régulière.
    const eastBetter =
      eastTeam.wins > westTeam.wins ||
      (eastTeam.wins === westTeam.wins && eastTeam.pointsFor - eastTeam.pointsAgainst >= westTeam.pointsFor - westTeam.pointsAgainst);
    const high = eastBetter ? east : west;
    const low = eastBetter ? west : east;
    next.push(
      makeSeries('finals', 3, 'Finales', { teamId: high.winnerId!, seed: seedOf(high) }, { teamId: low.winnerId!, seed: seedOf(low) }),
    );
    return next;
  }

  for (const conference of ['Est', 'Ouest'] as Conference[]) {
    const confSeries = current.filter((s) => s.conference === conference);
    for (let i = 0; i < confSeries.length; i += 2) {
      const a = confSeries[i];
      const b = confSeries[i + 1];
      const seedA = seedOf(a);
      const seedB = seedOf(b);
      const [high, low] = seedA <= seedB ? [a, b] : [b, a];
      next.push(
        makeSeries(
          `${conference}-r${round}-${i / 2}`,
          round,
          conference,
          { teamId: high.winnerId!, seed: seedOf(high) },
          { teamId: low.winnerId!, seed: seedOf(low) },
        ),
      );
    }
  }
  return next;
}

function pickFinalsMvp(league: League, finals: PlayoffSeries): string | null {
  const champion = league.teams.find((t) => t.id === finals.winnerId);
  if (!champion) return null;
  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const id of champion.roster) {
    const player = league.players[id];
    if (!player || player.playoffStats.gp === 0) continue;
    const score = gameScore(player.playoffStats) + player.playoffStats.pts / player.playoffStats.gp * 0.3;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

export function playoffsFinished(playoffs: Playoffs | null): boolean {
  return Boolean(playoffs?.championId);
}

export function allSeries(playoffs: Playoffs): PlayoffSeries[] {
  return playoffs.rounds.flat();
}
