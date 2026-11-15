/** Paired seeds + mirrored home court, no career mutation, reports measured box counters. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createNewGame, migrateLeague, projectedStrength } from '../src/engine';
import { OFFENSE_STYLES, type OffenseStyle } from '../src/engine/gamePlan';
import { simulateGame } from '../src/engine/simGame';
import { Rng } from '../src/engine/rng';
import type { GameResult } from '../src/engine/types';

const samples = Number(process.argv.find(s => s.startsWith('--samples='))?.slice(10) ?? 80);
assert(Number.isInteger(samples) && samples >= 20 && samples <= 200, 'Samples must be 20..200');
const empty = () => ({ games: 0, wins: 0, pts: 0, opponentPts: 0, possessions: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, tov: 0, pf: 0 });
type Totals = ReturnType<typeof empty>;
const totals = Object.fromEntries(OFFENSE_STYLES.map(s => [s, empty()])) as Record<OffenseStyle, Totals>;
const roundRobin = Object.fromEntries(OFFENSE_STYLES.map(s => [s, { games: 0, wins: 0 }])) as Record<OffenseStyle, { games: number; wins: number }>;
let games = 0;
function add(to: Totals, result: GameResult, teamId: string) {
  to.games++;
  const mine = teamId === result.box.homeId ? result.homeScore : result.awayScore;
  const theirs = teamId === result.box.homeId ? result.awayScore : result.homeScore;
  to.wins += Number(mine > theirs); to.pts += mine; to.opponentPts += theirs;
  to.possessions += result.box.tactics!.teams[teamId].possessions!;
  for (const { line: l } of result.box.rows[teamId]) {
    for (const k of ['fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'ast', 'tov', 'pf'] as const) to[k] += l[k];
    assert.equal(l.pts, 2 * l.fgm + l.tpm + l.ftm);
    assert(l.fgm <= l.fga && l.tpm <= l.fgm && l.ftm <= l.fta);
  }
  assert.equal(result.box.rows[teamId].reduce((s, r) => s + r.line.pts, 0), mine);
}
const fixturePath = process.argv.find(s => s.startsWith('--fixture='))?.slice(10);
const fixtures = fixturePath ? [migrateLeague(JSON.parse(readFileSync(fixturePath, 'utf8')))] : [31, 8126, 919].map(seed => createNewGame('bos', seed));
const matchups: { season: number; teams: string[]; strengths: number[] }[] = [];
for (const league of fixtures) {
  const ranked = [...league.teams].filter(t => t.id !== league.userTeamId).sort((a, b) => projectedStrength(league, a.id) - projectedStrength(league, b.id));
  const mine = fixturePath ? ranked[Math.floor(ranked.length / 2)] : league.teams.find(t => t.id === 'bos')!, theirs = fixturePath ? ranked[Math.floor(ranked.length / 2) + 1] : league.teams.find(t => t.id === 'phx')!;
  matchups.push({ season: league.season, teams: [mine.id, theirs.id], strengths: [projectedStrength(league, mine.id), projectedStrength(league, theirs.id)] });
  for (const style of OFFENSE_STYLES) {
    for (let seed = 1; seed <= samples; seed++) {
      for (const home of [true, false]) {
        const a = { ...mine, gamePlan: { ...mine.gamePlan!, offense: style } };
        const b = { ...theirs, gamePlan: { ...theirs.gamePlan!, offense: 'balanced' as const } };
        const result = simulateGame(new Rng(seed), `paired-${games++}`, home ? a : b, home ? b : a, structuredClone(league.players));
        add(totals[style], result, mine.id);
      }
    }
  }
  for (let a = 0; a < OFFENSE_STYLES.length; a++) for (let b = a + 1; b < OFFENSE_STYLES.length; b++) {
    const styleA = OFFENSE_STYLES[a], styleB = OFFENSE_STYLES[b];
    for (let seed = 1; seed <= Math.ceil(samples / 4); seed++) for (const home of [true, false]) for (const swapRoster of [false, true]) {
      const rosterA = swapRoster ? theirs : mine, rosterB = swapRoster ? mine : theirs;
      const sideA = { ...rosterA, gamePlan: { ...rosterA.gamePlan!, offense: styleA } };
      const sideB = { ...rosterB, gamePlan: { ...rosterB.gamePlan!, offense: styleB } };
      const result = simulateGame(new Rng(seed), `round-robin-${games++}`, home ? sideA : sideB, home ? sideB : sideA, structuredClone(league.players));
      roundRobin[styleA].games++; roundRobin[styleB].games++;
      const aWon = home ? result.homeScore > result.awayScore : result.awayScore > result.homeScore;
      roundRobin[styleA].wins += Number(aWon); roundRobin[styleB].wins += Number(!aWon);
    }
  }
  console.log(`Fixture ${league.seed}/${league.season}: ${games} matchs cumulés.`);
}
const metrics = Object.fromEntries(OFFENSE_STYLES.map(style => {
  const t = totals[style];
  const row = { games: t.games, points: t.pts / t.games, possessions: t.possessions / t.games, fg: t.fgm / t.fga, threeShare: t.tpa / t.fga, threePct: t.tpm / t.tpa, ftPct: t.ftm / t.fta, fga: t.fga / t.games, oreb: t.oreb / t.games, rebounds: (t.oreb + t.dreb) / t.games, ast: t.ast / t.games, turnovers: t.tov / t.games, fouls: t.pf / t.games, winRate: t.wins / t.games, roundRobinWinRate: roundRobin[style].wins / roundRobin[style].games };
  assert(row.points > 70 && row.points < 165, `${style}: points out of bounds`);
  assert(row.fg > 0.3 && row.fg < 0.65 && row.threeShare > 0.15 && row.threeShare < 0.75, `${style}: shooting out of bounds`);
  return [style, row];
}));
assert(metrics.paceSpace.possessions > metrics.balanced.possessions, 'Pace & Space did not accelerate');
assert(metrics.paceSpace.threeShare > metrics.balanced.threeShare, 'Pace & Space did not change shot selection');
console.log(JSON.stringify({ games, samples, metrics }, null, 2));
const output = process.argv.find(s => s.startsWith('--output='))?.slice(9) ?? '/tmp/hoopsim-tactics-calibration.json';
writeFileSync(output, JSON.stringify({ games, samples, matchups, leagueSeeds: fixtures.map(l => l.seed), fixtureSeasons: fixtures.map(l => l.season), totals, roundRobin, metrics }, null, 2));
