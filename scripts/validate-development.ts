/** Multiple real seasons, CPU windows, expiry/draft/agency, migration and ownership/accounting invariants. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createNewGame, simulateDay, regularSeasonFinished, startPlayoffs, advancePlayoffs, playoffsFinished, closeSeason, startNextSeason, migrateLeague } from '../src/engine';
import { eligibleIds, validateGamePlan } from '../src/engine/gamePlan';
import { budget, LEAGUE_ECONOMY_CONFIG as CONFIG } from '../src/engine/management/economy';
import { runFrontOffices } from '../src/engine/management/aiGm';
import { beginOffseason, finishOffseason } from '../src/engine/offseason';
import { advanceCPUDraft, chooseDraftPlayer, recommendedProspect, prospectScore } from '../src/engine/development/draft';
import type { League } from '../src/engine/types';

function invariants(league: League) {
  const owners = new Map<string, string>();
  for (const team of league.teams) {
    assert(team.roster.length >= CONFIG.minRoster && team.roster.length <= CONFIG.maxRoster, `${team.id}: illegal roster size`);
    for (const id of team.roster) { assert(!owners.has(id), `Duplicate ${id}`); owners.set(id, team.id); assert.equal(league.players[id]?.teamId, team.id); }
    const b = budget(league, team), exceptions = team.roster.map(id => league.players[id]).filter(p => p.minimumException);
    assert(b.payroll - exceptions.reduce((sum, p) => sum + p.contract.salary, 0) <= b.cap + 1e-6, `${team.id}: illegal cap excess`);
    for (const p of exceptions) assert(p.contract.salary === 0.8 && p.contract.years === 1 && p.replacement, 'Unbounded minimum exception');
    assert(b.commitments.slice(1).every(sum => sum <= b.cap + 1e-6), `${team.id}: future overcommitment`);
    if (eligibleIds(team, league.players).length >= 5) assert.deepEqual(validateGamePlan(team.gamePlan, team, league.players), []);
    assert.equal(new Set(team.roster.map(id => league.players[id].number)).size, team.roster.length);
  }
  for (const p of Object.values(league.players)) {
    assert.equal(owners.get(p.id) ?? null, p.teamId);
    if (!p.teamId) assert.deepEqual(p.contract, { salary: 0, years: 0 });
    else assert(Number.isInteger(p.contract.years) && p.contract.years > 0 && Number.isFinite(p.contract.salary) && (p.contract.salary >= 0.8 || p.legacyMinimum && p.contract.salary >= 0.6));
  }
  assert(league.management!.transactions.length <= 200);
  assert.equal(new Set(league.management!.transactions.map(e => e.id)).size, league.management!.transactions.length);
}
const records = [];
let games = 0;
const draftChoices: { rebuildPotential: number; contendPotential: number; seed: number; season: number }[] = [];
for (const seed of [31, 8126, 919]) {
  let league = createNewGame('bos', seed);
  const everSeen = new Set(Object.keys(league.players));
  for (let season = 0; season < 5; season++) {
    invariants(league);
    while (!regularSeasonFinished(league)) {
      const summary = simulateDay(league, { watchUserGame: false }); games += summary.games.length;
      for (const { result } of summary.games) for (const [id, rows] of Object.entries(result.box.rows)) {
        assert.equal(rows.reduce((n, r) => n + r.line.pts, 0), id === result.box.homeId ? result.homeScore : result.awayScore);
        for (const { line: l } of rows) assert.equal(l.pts, 2 * l.fgm + l.tpm + l.ftm);
      }
      invariants(league);
      if (league.day === 28) {
        league = migrateLeague(JSON.parse(JSON.stringify(league)) as League);
        const before = JSON.stringify(league); runFrontOffices(league); assert.equal(JSON.stringify(league), before);
      }
    }
    startPlayoffs(league);
    while (!playoffsFinished(league.playoffs)) { const summary = advancePlayoffs(league, { watchUserGame: false }); games += summary.games.length; }
    closeSeason(league);
    const highWater = league.management!.nextPlayerId;
    const oldIds = new Set(Object.keys(league.players));
    beginOffseason(league);
    const d = league.offseason!, team = league.teams.find(t => t.id === league.userTeamId)!;
    const savedDirection = team.frontOffice!.direction;
    const candidates = Object.values(d.prospects);
    team.frontOffice!.direction = 'rebuild';
    const rebuild = [...candidates].sort((a, b) => prospectScore(league, team, b) - prospectScore(league, team, a))[0];
    team.frontOffice!.direction = 'contend';
    const contend = [...candidates].sort((a, b) => prospectScore(league, team, b) - prospectScore(league, team, a))[0];
    draftChoices.push({ seed, season: league.season, rebuildPotential: rebuild.estimatedPotential, contendPotential: contend.estimatedPotential });
    team.frontOffice!.direction = savedDirection;
    advanceCPUDraft(league);
    league = migrateLeague(JSON.parse(JSON.stringify(league)));
    const pending = JSON.stringify(league); beginOffseason(league); advanceCPUDraft(league); assert.equal(JSON.stringify(league), pending);
    while (league.offseason!.stage === 'draft') {
      const active = league.offseason!, pick = active.picks[active.cursor];
      assert.equal(pick.ownerTeamId, league.userTeamId);
      const user = league.teams.find(t => t.id === league.userTeamId)!;
      const candidate = user.roster.length < 14 ? recommendedProspect(league, user) : undefined;
      assert.deepEqual(chooseDraftPlayer(league, pick.id, candidate?.player.id ?? null), []);
      const chosen = JSON.stringify(league); assert(chooseDraftPlayer(league, pick.id, candidate?.player.id ?? null).length > 0); assert.equal(JSON.stringify(league), chosen);
      advanceCPUDraft(league);
    }
    assert.equal(league.offseason!.picks.length, 60);
    finishOffseason(league);
    for (const id of Object.keys(league.players)) if (!oldIds.has(id)) { assert(!everSeen.has(id), `Historical id reused ${id}`); everSeen.add(id); }
    assert(league.management!.nextPlayerId > highWater);
    invariants(league);
    const before = JSON.stringify(league); assert.throws(() => startNextSeason(league)); assert.equal(JSON.stringify(league), before);
    const record = { seed, season: league.season - 1, gamesCumulative: games, players: Object.keys(league.players).length, freeAgents: Object.values(league.players).filter(p => p.teamId === null).length,
      reports: league.seasonReviews!.length, saveCharacters: JSON.stringify(league).length, cap: league.management!.salaryCap, maxPayroll: Math.max(...league.teams.map(t => budget(league, t).payroll)), events: league.management!.nextEventId - 1,
      retainedTrades: league.management!.transactions.filter(e => e.type === 'trade').length };
    records.push(record); console.log(JSON.stringify(record));
  }
}
assert(games >= 18450, 'Expected fifteen complete regular seasons plus playoffs');
const output = process.argv.find(s => s.startsWith('--output='))?.slice(9) ?? '/tmp/hoopsim-development-campaign.json';
writeFileSync(output, JSON.stringify({ games, records, draftChoices }, null, 2));
console.log(`PASS: ${games} real games, fifteen season transitions with resumed interactive drafts, ownership/contracts/caps/plans and save-load invariants.`);
