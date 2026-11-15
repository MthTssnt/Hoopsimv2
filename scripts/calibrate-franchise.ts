/** Full-career distributions, bounded storage and ownership invariants; no fabricated results. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createNewGame, simulateDay, regularSeasonFinished, startPlayoffs, advancePlayoffs, playoffsFinished, closeSeason, startNextSeason, projectedStrength, migrateLeague } from '../src/engine';
import { budget } from '../src/engine/management/economy';
import { eligibleIds, validateGamePlan } from '../src/engine/gamePlan';
import type { League } from '../src/engine/types';
const args = process.argv.slice(2);
const years = Number(args.find(a => a.startsWith('--years='))?.slice(8) ?? 10);
const seeds = (args.find(a => a.startsWith('--seeds='))?.slice(8) ?? '31,8126,919').split(',').map(Number);
const output = args.find(a => a.startsWith('--output='))?.slice(9) ?? '/tmp/hoopsim-franchise-calibration.json';
assert(Number.isInteger(years) && years >= 1 && years <= 20 && seeds.every(Number.isFinite));
function invariants(l: League) {
  const owners = new Map<string, string>();
  for (const t of l.teams) {
    assert(t.roster.length >= 13 && t.roster.length <= 15);
    for (const id of t.roster) { assert(!owners.has(id)); owners.set(id, t.id); assert.equal(l.players[id].teamId, t.id); }
    assert.equal(new Set(t.roster.map(id => l.players[id].number)).size, t.roster.length);
    if (eligibleIds(t, l.players).length >= 5) assert.deepEqual(validateGamePlan(t.gamePlan, t, l.players), []);
    const b = budget(l, t), rescue = t.roster.map(id => l.players[id]).filter(p => p.minimumException);
    for (const p of rescue) assert(p.contract.salary === 0.8 && p.contract.years === 1 && p.replacement);
    assert(b.payroll - rescue.reduce((n, p) => n + p.contract.salary, 0) <= b.cap + 1e-6);
    assert(b.commitments.slice(1).every(v => v <= b.cap + 1e-6));
  }
  for (const p of Object.values(l.players)) {
    assert.equal(owners.get(p.id) ?? null, p.teamId);
    assert(p.age < 41 && Object.values(p.attrs).every(v => Number.isFinite(v) && v >= 25 && v <= 99));
    if (p.teamId) assert(p.contract.years > 0 && Number.isFinite(p.contract.salary) && p.contract.salary >= 0.6);
    else assert.deepEqual(p.contract, { salary: 0, years: 0 });
  }
  assert((l.seasonReviews?.length ?? 0) <= 10 && l.management!.transactions.length <= 200);
}
const records = []; let games = 0, playoffGames = 0;
let lastLeague: League | undefined;
for (const seed of seeds) {
  let l = createNewGame('bos', seed);
  const seen = new Set(Object.keys(l.players));
  for (let year = 0; year < years; year++) {
    const a = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, tov: 0, pf: 0 };
    const scores: number[] = []; let possessions = 0, favoriteGames = 0, favoriteWins = 0, homeWins = 0, maxSaveCharacters = 0;
    while (!regularSeasonFinished(l)) {
      const strength = Object.fromEntries(l.teams.map(t => [t.id, projectedStrength(l, t.id)]));
      const summary = simulateDay(l, { watchUserGame: false });
      for (const { game, result: r } of summary.games) {
        games++; scores.push(r.homeScore, r.awayScore); homeWins += Number(r.homeScore > r.awayScore);
        const diff = strength[game.homeId] - strength[game.awayId];
        if (Math.abs(diff) >= 3) { favoriteGames++; favoriteWins += Number((r.homeScore > r.awayScore) === (diff > 0)); }
        for (const [id, rows] of Object.entries(r.box.rows)) {
          assert.equal(rows.reduce((n, row) => n + row.line.pts, 0), id === r.box.homeId ? r.homeScore : r.awayScore);
          possessions += r.box.tactics!.teams[id].possessions!;
          for (const { line } of rows) {
            assert.equal(line.pts, 2 * line.fgm + line.tpm + line.ftm);
            assert(line.fgm <= line.fga && line.tpm <= line.tpa && line.tpm <= line.fgm && line.tpa <= line.fga && line.ftm <= line.fta);
            for (const key of Object.keys(a) as (keyof typeof a)[]) a[key] += line[key];
          }
        }
      }
      if (l.day % 28 === 0 || regularSeasonFinished(l)) {
        invariants(l); const saved = JSON.stringify(l); maxSaveCharacters = Math.max(maxSaveCharacters, saved.length);
        l = migrateLeague(JSON.parse(saved));
      }
    }
    const n = scores.length, sorted = [...scores].sort((a, b) => a - b), mean = scores.reduce((a, b) => a + b, 0) / n;
    const fg = a.fgm / a.fga, threePct = a.tpm / a.tpa, ftPct = a.ftm / a.fta;
    assert(n === 2460 && mean > 70 && mean < 165 && fg > 0.3 && fg < 0.65 && threePct > 0.2 && threePct < 0.5 && ftPct > 0.5 && ftPct < 0.95);
    const record = { seed, season: l.season, games: n / 2, points: mean, p10: sorted[Math.floor(n * 0.1)], median: sorted[Math.floor(n * 0.5)], p90: sorted[Math.floor(n * 0.9)], min: sorted[0], max: sorted.at(-1),
      fg, threePct, threeShare: a.tpa / a.fga, ftPct, fga: a.fga / n, rebounds: (a.oreb + a.dreb) / n, ast: a.ast / n, turnovers: a.tov / n, fouls: a.pf / n, possessions: possessions / n,
      favoriteGames, favoriteWinRate: favoriteWins / Math.max(1, favoriteGames), homeWinRate: homeWins / (n / 2), cap: l.management!.salaryCap, maxPayroll: Math.max(...l.teams.map(t => budget(l, t).payroll)),
      maxSaveCharacters, freeAgents: Object.values(l.players).filter(p => p.teamId === null).length, cpuStyles: Object.fromEntries(['balanced', 'paceSpace', 'motion', 'insideOut', 'pickRoll', 'isolation'].map(style => [style, l.teams.filter(t => t.id !== l.userTeamId && t.gamePlan?.offense === style).length])), meanOverall: Object.values(l.players).filter(p => p.teamId).reduce((n, p) => n + p.overall, 0) / l.teams.flatMap(t => t.roster).length };
    startPlayoffs(l); while (!playoffsFinished(l.playoffs)) playoffGames += advancePlayoffs(l, { watchUserGame: false }).games.length;
    const oldIds = new Set(Object.keys(l.players));
    closeSeason(l); startNextSeason(l); invariants(l);
    for (const id of Object.keys(l.players)) if (!oldIds.has(id)) { assert(!seen.has(id), `Reused historical id ${id}`); seen.add(id); }
    records.push(record); console.log(JSON.stringify(record));
  }
  lastLeague = l;
}
const snapshot = args.find(a => a.startsWith('--snapshot='))?.slice(11);
if (snapshot) writeFileSync(snapshot, JSON.stringify(lastLeague));
writeFileSync(output, JSON.stringify({ games, playoffGames, years, seeds, records }, null, 2));
console.log(`PASS: ${games} regular games + ${playoffGames} playoffs, ${records.length} complete seasons, invariants and save-load.`);
