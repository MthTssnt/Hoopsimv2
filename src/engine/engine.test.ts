import { describe, expect, it } from 'vitest';
import { createNewGame } from './index';
import { Rng } from './rng';
import { advancePlayoffs, playoffsFinished, startPlayoffs } from './playoffs';
import { closeSeason, startNextSeason } from './offseason';
import { regularSeasonFinished, simulateDay } from './simSeason';
import { buildStandings } from './stats';
import type { League } from './types';

function playFullSeason(league: League): void {
  let guard = 0;
  while (!regularSeasonFinished(league) && guard++ < 500) {
    simulateDay(league, { watchUserGame: false });
  }
}

describe('générateur aléatoire', () => {
  it('est déterministe pour une même graine', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produit des tirages pondérés cohérents', () => {
    const rng = new Rng(7);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[rng.weightedIndex([1, 0, 3])]++;
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBeGreaterThan(counts[0]);
  });
});

describe('calendrier', () => {
  it('donne 82 matchs à chaque équipe', () => {
    const league = createNewGame('bos', 999);
    const counts = new Map<string, number>();
    const home = new Map<string, number>();
    for (const g of league.schedule) {
      counts.set(g.homeId, (counts.get(g.homeId) ?? 0) + 1);
      counts.set(g.awayId, (counts.get(g.awayId) ?? 0) + 1);
      home.set(g.homeId, (home.get(g.homeId) ?? 0) + 1);
    }
    expect(league.schedule).toHaveLength(1230);
    for (const team of league.teams) {
      expect(counts.get(team.id)).toBe(82);
      // L'équilibre domicile/extérieur reste proche de 41-41.
      expect(home.get(team.id)!).toBeGreaterThanOrEqual(38);
      expect(home.get(team.id)!).toBeLessThanOrEqual(44);
    }
  });

  it('ne programme jamais deux matchs le même jour pour une équipe', () => {
    const league = createNewGame('lal', 4242);
    const seen = new Set<string>();
    for (const g of league.schedule) {
      expect(seen.has(`${g.day}:${g.homeId}`)).toBe(false);
      expect(seen.has(`${g.day}:${g.awayId}`)).toBe(false);
      seen.add(`${g.day}:${g.homeId}`);
      seen.add(`${g.day}:${g.awayId}`);
    }
  });
});

describe('simulation de match', () => {
  it('distribue exactement 240 minutes par équipe', () => {
    const league = createNewGame('mia', 2024);
    const summary = simulateDay(league, { watchUserGame: true });
    expect(summary.games.length).toBeGreaterThan(0);

    for (const { result } of summary.games) {
      const periods = result.periods.length;
      const expectedSecs = (4 * 720 + Math.max(0, periods - 4) * 300) * 5;
      for (const rows of Object.values(result.box.rows)) {
        const secs = rows.reduce((sum, r) => sum + r.line.secs, 0);
        expect(Math.abs(secs - expectedSecs)).toBeLessThan(60);
      }
    }
  });

  it('produit des feuilles de match cohérentes', () => {
    const league = createNewGame('den', 555);
    const summary = simulateDay(league, { watchUserGame: true });
    for (const { result } of summary.games) {
      expect(result.homeScore).not.toBe(result.awayScore); // pas de match nul
      for (const [, rows] of Object.entries(result.box.rows)) {
        const total = rows.reduce((s, r) => s + r.line.pts, 0);
        const computed = rows.reduce(
          (s, r) => s + (r.line.fgm - r.line.tpm) * 2 + r.line.tpm * 3 + r.line.ftm,
          0,
        );
        expect(total).toBe(computed);
        for (const row of rows) {
          expect(row.line.fgm).toBeLessThanOrEqual(row.line.fga);
          expect(row.line.tpm).toBeLessThanOrEqual(row.line.tpa);
          expect(row.line.ftm).toBeLessThanOrEqual(row.line.fta);
          expect(row.line.pf).toBeLessThanOrEqual(6);
        }
      }
      // Le total de l'équipe correspond au score affiché.
      expect(result.box.rows[result.box.homeId].reduce((s, r) => s + r.line.pts, 0)).toBe(result.homeScore);
    }
  });

  it('renvoie le même résultat pour une même graine', () => {
    const a = createNewGame('phi', 31337);
    const b = createNewGame('phi', 31337);
    simulateDay(a, { watchUserGame: false });
    simulateDay(b, { watchUserGame: false });
    expect(a.teams.map((t) => `${t.wins}-${t.losses}`)).toEqual(b.teams.map((t) => `${t.wins}-${t.losses}`));
  });
});

describe('saison complète', () => {
  const league = createNewGame('bos', 8080);
  playFullSeason(league);

  it('joue 82 matchs par équipe', () => {
    for (const team of league.teams) {
      expect(team.wins + team.losses).toBe(82);
    }
    const totalWins = league.teams.reduce((s, t) => s + t.wins, 0);
    expect(totalWins).toBe(1230);
  });

  it('donne des moyennes de ligue crédibles', () => {
    const teamGames = 1230 * 2;
    const totals = { pts: 0, fga: 0, fgm: 0, tpa: 0, ast: 0, tov: 0, fta: 0, ftm: 0 };
    for (const p of Object.values(league.players)) {
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += p.stats[key];
    }
    expect(totals.pts / teamGames).toBeGreaterThan(100);
    expect(totals.pts / teamGames).toBeLessThan(126);
    expect(totals.fgm / totals.fga).toBeGreaterThan(0.44);
    expect(totals.fgm / totals.fga).toBeLessThan(0.52);
    expect(totals.ftm / totals.fta).toBeGreaterThan(0.72);
    expect(totals.ftm / totals.fta).toBeLessThan(0.86);
    expect(totals.tpa / totals.fga).toBeGreaterThan(0.25);
    expect(totals.ast / teamGames).toBeGreaterThan(18);
  });

  it('classe les équipes par pourcentage de victoires', () => {
    const east = buildStandings(league, 'Est');
    expect(east).toHaveLength(15);
    for (let i = 1; i < east.length; i++) {
      expect(east[i - 1].pct).toBeGreaterThanOrEqual(east[i].pct);
    }
  });

  it('désigne un champion à l\'issue des playoffs', () => {
    startPlayoffs(league);
    let guard = 0;
    while (!playoffsFinished(league.playoffs) && guard++ < 100) {
      advancePlayoffs(league, { watchUserGame: false });
    }
    expect(league.playoffs?.championId).toBeTruthy();
    expect(league.playoffs?.rounds).toHaveLength(4);
    expect(league.playoffs?.finalsMvpId).toBeTruthy();
    // Chaque série se termine à quatre victoires.
    for (const series of league.playoffs!.rounds.flat()) {
      expect(Math.max(series.highWins, series.lowWins)).toBe(4);
      expect(series.games.length).toBeGreaterThanOrEqual(4);
      expect(series.games.length).toBeLessThanOrEqual(7);
    }
  });

  it('enchaîne sur une nouvelle saison propre', () => {
    const previousSeason = league.season;
    closeSeason(league);
    expect(league.history).toHaveLength(1);
    expect(league.history[0].championId).toBe(league.playoffs?.championId);

    startNextSeason(league);
    expect(league.season).toBe(previousSeason + 1);
    expect(league.phase).toBe('regular');
    expect(league.day).toBe(0);
    expect(league.schedule.every((g) => !g.played)).toBe(true);
    for (const team of league.teams) {
      expect(team.wins + team.losses).toBe(0);
      expect(team.roster.length).toBeGreaterThanOrEqual(13);
      expect(team.roster.length).toBeLessThanOrEqual(14);
      expect(team.rotation.length).toBeGreaterThanOrEqual(5);
      for (const id of team.roster) {
        expect(league.players[id]).toBeDefined();
        expect(league.players[id].stats.gp).toBe(0);
      }
    }
    // Aucun joueur orphelin ne traîne dans la base.
    for (const player of Object.values(league.players)) {
      expect(player.teamId).toBeTruthy();
      expect(player.age).toBeLessThan(41);
    }
  });
});
