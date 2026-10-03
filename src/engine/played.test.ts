import { describe, expect, it } from 'vitest';
import { createNewGame } from './index';
import { advancePlayoffs, startPlayoffs, userPlayoffGame } from './playoffs';
import { Rng } from './rng';
import { simulateGame } from './simGame';
import { nextUserGame, playGame, recordGame, simulateDay, teamById, withRng, type PlayedGame } from './simSeason';
import type { Game, League } from './types';

/** Avance jusqu'au jour du prochain match de l'équipe du joueur. */
function toUserGameDay(league: League): Game {
  for (let guard = 0; guard < 50; guard++) {
    const next = nextUserGame(league)!;
    if (next.day === league.day) return next;
    simulateDay(league, { watchUserGame: false });
  }
  throw new Error('pas de match');
}

/** Un « match joué » : un box score crédible produit hors de la ligue (autre générateur), et l'énergie de fin. */
function fakePlayed(league: League, game: Game, seed = 99): PlayedGame {
  const home = teamById(league, game.homeId);
  const away = teamById(league, game.awayId);
  const copy = structuredClone(league.players);
  const result = simulateGame(new Rng(seed), 'joué', home, away, copy);
  const energy = Object.fromEntries(Object.values(result.box.rows).flat().map((r) => [r.playerId, 42]));
  return { result, energy };
}

describe('un enregistrement pour le simulé et le joué', () => {
  it('playGame = simulateGame puis recordGame (même ligue au bit près)', () => {
    const a = createNewGame('bos', 12);
    const b = createNewGame('bos', 12);
    const gameA = a.schedule[0];
    const gameB = b.schedule[0];
    playGame(a, gameA);
    const result = withRng(b, (rng) => simulateGame(rng, gameB.id, teamById(b, gameB.homeId), teamById(b, gameB.awayId), b.players));
    recordGame(b, gameB, result);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('journée avec ton match joué : enregistré tel quel (score, classement, stats, feuille, énergie), les autres simulés', () => {
    const league = createNewGame('bos', 21);
    const game = toUserGameDay(league);
    const played = fakePlayed(league, game);
    const home = teamById(league, game.homeId);
    const away = teamById(league, game.awayId);
    const wins = home.wins + away.wins;
    const someone = Object.values(played.result.box.rows).flat()[0];
    const before = { gp: league.players[someone.playerId].stats.gp, pts: league.players[someone.playerId].stats.pts };
    const day = league.day;
    const summary = simulateDay(league, { played });
    expect(league.day).toBe(day + 1);
    expect(game).toMatchObject({ played: true, homeScore: played.result.homeScore, awayScore: played.result.awayScore });
    expect(summary.userGame?.result).toBe(played.result);
    expect(home.wins + away.wins).toBe(wins + 1);
    expect(league.boxScores[game.id]).toBe(played.result.box);
    expect(played.result.box.gameId).toBe(game.id);
    const after = league.players[someone.playerId];
    expect(after.stats.gp).toBe(before.gp + 1);
    expect(after.stats.pts).toBe(before.pts + someone.line.pts);
    expect(after.energy).toBe(42);
    // Les autres matchs du jour sont simulés.
    expect(league.schedule.filter((g) => g.day === day).every((g) => g.played)).toBe(true);
  });

  it('soirée de playoffs avec ton match joué : la série avance avec ce score', () => {
    const league = createNewGame('bos', 33);
    startPlayoffs(league);
    const first = league.playoffs!.rounds[0][0];
    league.userTeamId = first.highSeed.teamId;
    const game = userPlayoffGame(league)!;
    expect(game).toMatchObject({ id: `${first.id}-g0`, homeId: first.highSeed.teamId, awayId: first.lowSeed.teamId });
    const played = fakePlayed(league, game, 7);
    const summary = advancePlayoffs(league, { played });
    expect(first.games[0]).toMatchObject({ homeScore: played.result.homeScore, awayScore: played.result.awayScore, gameId: game.id });
    expect(first.highWins + first.lowWins).toBe(1);
    expect(first.highWins).toBe(played.result.homeScore > played.result.awayScore ? 1 : 0);
    expect(summary.userGame?.result).toBe(played.result);
    expect(league.boxScores[game.id]).toBe(played.result.box);
    // Le match suivant de la série se joue encore chez le mieux classé (2-2-1-1-1).
    expect(userPlayoffGame(league)).toMatchObject({ id: `${first.id}-g1`, homeId: first.highSeed.teamId });
  });
});
