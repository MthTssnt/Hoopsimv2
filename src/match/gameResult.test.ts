import { describe, expect, it } from 'vitest';
import { createNewGame } from '../engine';
import { nextUserGame, simulateDay } from '../engine/simSeason';
import { Rng } from '../engine/rng';
import type { Game, League } from '../engine/types';
import { runToEnd } from './ai/finish';
import { PlayerAi } from './ai/playerAi';
import { gmMatchSetup, toPlayedGame, worldRotations, type MatchSetup } from './gameResult';
import { makeCourt } from './physics/court';
import { awayLook, colorDistance, JERSEY_CLASH, teamLook } from './render/arena/draw';
import { MatchWorld, WORLD_DT } from './world/MatchWorld';

function userGameToday(league: League): Game {
  for (let guard = 0; guard < 50; guard++) {
    const next = nextUserGame(league)!;
    if (next.day === league.day) return next;
    simulateDay(league, { watchUserGame: false });
  }
  throw new Error('pas de match');
}

/** Match du GM joué entièrement par l'IA (4 × 1 min), comme « Regarder » puis « Simuler la fin ». */
function playOut(setup: MatchSetup, quarterMinutes = 1): MatchWorld {
  const [mine, theirs] = worldRotations(setup);
  const w = new MatchWorld(makeCourt('pro'), mine[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(setup.seed));
  w.autoRestart = false;
  w.startFullCourt(mine, theirs, quarterMinutes);
  const ais = w.players.map((_, i) => new PlayerAi(i, new Rng(setup.seed + i)));
  // Un peu de jeu « normal », puis la fin simulée.
  for (let t = 0; t < 20; t += WORLD_DT) w.step(WORLD_DT, ais.map((ai) => ai.think(w, WORLD_DT)));
  expect(runToEnd(w, ais, 400_000)).toBe(true);
  return w;
}

describe('tenues du GM', () => {
  it('l’équipe extérieure garde ses couleurs si elles tranchent ; sinon sa secondaire, sinon un maillot clair', () => {
    const league = createNewGame('bos', 3);
    const [home] = league.teams;
    const far = league.teams.find((t) => colorDistance(teamLook(t).primary[1], teamLook(home).primary[1]) > JERSEY_CLASH)!;
    expect(awayLook(home, far)).toEqual(teamLook(far));
    // Même maillot que l'équipe qui reçoit : la tenue change et tranche.
    const twin = { ...far, colors: { ...home.colors } };
    const look = awayLook(home, twin);
    expect(colorDistance(look.primary[1], teamLook(home).primary[1])).toBeGreaterThan(JERSEY_CLASH);
  });
});

describe('match du GM → résultat du moteur', () => {
  it('mise en place : rotations de la simulation, ton côté, ton équipe en équipe 0', () => {
    const league = createNewGame('bos', 8);
    const game = userGameToday(league);
    const setup = gmMatchSetup(league, game, 'jouer');
    expect(setup.home.id).toBe(game.homeId);
    expect(setup.away.id).toBe(game.awayId);
    expect(setup.userSide).toBe(game.homeId === league.userTeamId ? 'home' : 'away');
    expect(worldRotations(setup)[0][0].teamId).toBe(league.userTeamId);
    expect(setup.homeRotation.length).toBeGreaterThanOrEqual(8);
  });

  it('box score converti (à domicile et à l’extérieur) puis enregistré comme un match simulé', { timeout: 120_000 }, () => {
    const league = createNewGame('bos', 8);
    const game = userGameToday(league);
    for (const side of ['home', 'away'] as const) {
      const setup = gmMatchSetup(league, game, 'regarder');
      setup.userSide = side;
      const w = playOut(setup);
      const { result, energy } = toPlayedGame(w, setup);
      const homeTeam = side === 'home' ? 0 : 1;
      expect(result.homeScore).toBe(w.points[homeTeam]);
      expect(result.awayScore).toBe(w.points[1 - homeTeam]);
      expect(result.homeScore).not.toBe(result.awayScore);
      expect(result.periods.reduce((s, p) => s + p.home, 0)).toBe(result.homeScore);
      expect(result.periods.reduce((s, p) => s + p.away, 0)).toBe(result.awayScore);
      for (const [teamId, score] of [
        [game.homeId, result.homeScore],
        [game.awayId, result.awayScore],
      ] as const) {
        const rows = result.box.rows[teamId];
        expect(rows.filter((r) => r.starter)).toHaveLength(5);
        expect(rows.slice(0, 5).every((r) => r.starter)).toBe(true);
        expect(rows.every((r) => r.line.gp === 1 && league.players[r.playerId].teamId === teamId)).toBe(true);
        expect(rows.reduce((s, r) => s + r.line.pts, 0)).toBe(score);
      }
      expect(Object.keys(energy).length).toBe(setup.homeRotation.length + setup.awayRotation.length);
    }
  });

  it('un match regardé puis fini à l’IA se rejoue à l’identique', { timeout: 120_000 }, () => {
    const league = createNewGame('bos', 8);
    const setup = gmMatchSetup(league, userGameToday(league), 'regarder');
    const a = toPlayedGame(playOut(setup), setup);
    const b = toPlayedGame(playOut(setup), setup);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('enregistré par la journée : classement, stats, feuille', { timeout: 120_000 }, () => {
    const league = createNewGame('bos', 8);
    const game = userGameToday(league);
    const setup = gmMatchSetup(league, game, 'jouer');
    const played = toPlayedGame(playOut(setup), setup);
    const user = league.teams.find((t) => t.id === league.userTeamId)!;
    const record = user.wins + user.losses;
    const star = played.result.box.rows[league.userTeamId][0];
    const gp = league.players[star.playerId].stats.gp;
    simulateDay(league, { played });
    expect(user.wins + user.losses).toBe(record + 1);
    expect(league.boxScores[game.id].homeScore).toBe(played.result.homeScore);
    expect(league.players[star.playerId].stats.gp).toBe(gp + 1);
    expect(league.players[star.playerId].energy).toBe(played.energy[star.playerId]);
  });
});
