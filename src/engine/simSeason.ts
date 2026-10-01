import { refreshRotations } from './coach';
import { Rng } from './rng';
import { buildSchedule, scheduleLength } from './schedule';
import { simulateGame, type GameSimOptions } from './simGame';
import { addStatLine, playerName, type Game, type GameResult, type League, type Player, type Team } from './types';

const INJURY_LABELS = [
  'entorse de la cheville',
  'douleur au genou',
  'élongation aux ischio-jambiers',
  'contusion à la hanche',
  'poignet touché',
  'gêne au dos',
  'protocole commotion',
  'fracture de fatigue au pied',
  'épaule luxée',
  'déchirure au mollet',
];

export function withRng<T>(league: League, fn: (rng: Rng) => T): T {
  const rng = new Rng(league.rngState);
  const result = fn(rng);
  league.rngState = rng.state;
  return result;
}

export function startRegularSeason(league: League): void {
  withRng(league, (rng) => {
    league.schedule = buildSchedule(rng, league.teams);
  });
  league.day = 0;
  league.phase = 'regular';
  refreshRotations(league, true);
}

export function teamById(league: League, id: string): Team {
  const team = league.teams.find((t) => t.id === id);
  if (!team) throw new Error(`Équipe introuvable : ${id}`);
  return team;
}

export function playGame(league: League, game: Game, options: GameSimOptions = {}): GameResult {
  const home = teamById(league, game.homeId);
  const away = teamById(league, game.awayId);

  const result = withRng(league, (rng) =>
    simulateGame(rng, game.id, home, away, league.players, options),
  );

  game.played = true;
  game.homeScore = result.homeScore;
  game.awayScore = result.awayScore;

  const isPlayoffs = league.phase === 'playoffs';
  applyBoxScore(league, result, isPlayoffs);
  if (!isPlayoffs) applyStandings(home, away, result);

  // On archive la feuille de match pour l'équipe du joueur et pour les playoffs.
  if (isPlayoffs || home.id === league.userTeamId || away.id === league.userTeamId) {
    league.boxScores[game.id] = result.box;
  }

  withRng(league, (rng) => {
    tickInjuries(league, home);
    tickInjuries(league, away);
    rollInjuries(league, result, rng);
  });

  return result;
}

function applyBoxScore(league: League, result: GameResult, isPlayoffs: boolean): void {
  for (const rows of Object.values(result.box.rows)) {
    for (const row of rows) {
      const player = league.players[row.playerId];
      if (!player) continue;
      addStatLine(isPlayoffs ? player.playoffStats : player.stats, row.line);
      addStatLine(player.career, row.line);
    }
  }
}

function applyStandings(home: Team, away: Team, result: GameResult): void {
  const homeWon = result.homeScore > result.awayScore;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;

  winner.wins += 1;
  loser.losses += 1;
  winner.streak = winner.streak > 0 ? winner.streak + 1 : 1;
  loser.streak = loser.streak < 0 ? loser.streak - 1 : -1;

  home.pointsFor += result.homeScore;
  home.pointsAgainst += result.awayScore;
  away.pointsFor += result.awayScore;
  away.pointsAgainst += result.homeScore;

  if (home.conference === away.conference) {
    winner.confWins += 1;
    loser.confLosses += 1;
  }

  for (const [team, won] of [[winner, true], [loser, false]] as [Team, boolean][]) {
    team.lastTen.push(won);
    if (team.lastTen.length > 10) team.lastTen.shift();
  }
}

/** Décrémente les indisponibilités des joueurs d'une équipe qui vient de jouer. */
function tickInjuries(league: League, team: Team): void {
  for (const id of team.roster) {
    const p = league.players[id];
    if (!p || p.injuryGames === 0) continue;
    p.injuryGames -= 1;
    if (p.injuryGames === 0) {
      p.injuryLabel = null;
      league.feed.push({ day: league.day, text: `${playerName(p)} (${team.abbr}) est de retour dans le groupe.` });
    }
  }
}

function rollInjuries(league: League, result: GameResult, rng: Rng): void {
  for (const [teamId, rows] of Object.entries(result.box.rows)) {
    const team = league.teams.find((t) => t.id === teamId);
    for (const row of rows) {
      const player = league.players[row.playerId];
      if (!player || player.injuryGames > 0) continue;
      const minutes = row.line.secs / 60;
      if (minutes < 5) continue;
      const durability = (player.attrs.stamina + player.attrs.strength) / 2;
      const chance =
        0.004 +
        (minutes / 36) * 0.004 +
        Math.max(0, player.age - 30) * 0.0009 +
        Math.max(0, 65 - durability) * 0.00012;
      if (!rng.chance(chance)) continue;

      const roll = rng.next();
      const games = roll < 0.6 ? rng.int(1, 3) : roll < 0.9 ? rng.int(4, 10) : rng.int(11, 32);
      player.injuryGames = games;
      player.injuryLabel = rng.pick(INJURY_LABELS);
      league.feed.push({
        day: league.day,
        text: `${playerName(player)} (${team?.abbr ?? '???'}) : ${player.injuryLabel}, absent ${games} match${games > 1 ? 's' : ''}.`,
      });
    }
  }
  refreshRotations(league, true);
}

/** Rendement d'énergie pour les équipes au repos ce soir-là. */
function restIdleTeams(league: League, playingTeamIds: Set<string>): void {
  for (const team of league.teams) {
    if (playingTeamIds.has(team.id)) continue;
    for (const id of team.roster) {
      const p = league.players[id];
      if (p) p.energy = Math.min(100, p.energy + 45);
    }
  }
}

export interface DaySummary {
  day: number;
  games: { game: Game; result: GameResult }[];
  userGame: { game: Game; result: GameResult } | null;
}

/** Joue tous les matchs du jour courant puis avance d'une journée. */
export function simulateDay(league: League, options: { watchUserGame?: boolean } = {}): DaySummary {
  const today = league.schedule.filter((g) => g.day === league.day && !g.played);
  const playing = new Set<string>();
  const played: { game: Game; result: GameResult }[] = [];
  let userGame: { game: Game; result: GameResult } | null = null;

  for (const game of today) {
    playing.add(game.homeId);
    playing.add(game.awayId);
    const isUserGame = game.homeId === league.userTeamId || game.awayId === league.userTeamId;
    const result = playGame(league, game, { collectPbp: isUserGame && (options.watchUserGame ?? true) });
    played.push({ game, result });
    if (isUserGame) userGame = { game, result };
  }

  restIdleTeams(league, playing);
  const summary: DaySummary = { day: league.day, games: played, userGame };
  league.day += 1;
  return summary;
}

export function regularSeasonFinished(league: League): boolean {
  return league.schedule.length > 0 && league.schedule.every((g) => g.played);
}

export function seasonDays(league: League): number {
  return scheduleLength(league.schedule);
}

export function nextUserGame(league: League): Game | null {
  return (
    league.schedule.find(
      (g) => !g.played && (g.homeId === league.userTeamId || g.awayId === league.userTeamId),
    ) ?? null
  );
}

export function daysUntilNextUserGame(league: League): number {
  const game = nextUserGame(league);
  return game ? Math.max(0, game.day - league.day) : 0;
}

/** Somme des minutes d'un joueur, pratique pour l'affichage. */
export function averageMinutes(player: Player): number {
  return player.stats.gp === 0 ? 0 : player.stats.secs / 60 / player.stats.gp;
}
