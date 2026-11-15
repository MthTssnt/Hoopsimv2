/** Full physical games with paired seeds, independent of rendering; output never overwrites tracked reports. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createNewGame } from '../src/engine';
import { distributeMinutes } from '../src/engine/gamePlan';
import { gmMatchSetup, toPlayedGame, worldGamePlans, worldRotations } from '../src/match/gameResult';
import { Rng } from '../src/engine/rng';
import { PlayerAi } from '../src/match/ai/playerAi';
import { runToEnd } from '../src/match/ai/finish';
import { makeCourt } from '../src/match/physics/court';
import { MatchWorld } from '../src/match/world/MatchWorld';
import { matchTimeScale } from '../src/match/world/rotation';

const records: { seed: number; quarterMinutes: number; target: number; normalizedMinutes: number; fouls: number }[] = [];
for (const quarterMinutes of [1, 3]) {
  for (const target of [6, 36]) {
    for (const seed of [31, 8126]) {
      const league = createNewGame('bos', seed);
      const team = league.teams.find(t => t.id === 'bos')!;
      const id = team.rotation[6];
      const plan = team.gamePlan!;
      const rest = Object.keys(plan.rotation.minutesByPlayerId).filter(x => x !== id);
      plan.rotation.minutesByPlayerId = { ...distributeMinutes(rest, plan.rotation.minutesByPlayerId, 240 - target), [id]: target };
      const game = league.schedule.find(g => g.homeId === team.id || g.awayId === team.id)!;
      const setup = gmMatchSetup(league, game, 'regarder');
      const [mine, theirs] = worldRotations(setup);
      const w = new MatchWorld(makeCourt('pro'), mine[0], { x: 0, y: 0, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(setup.seed));
      w.autoRestart = false;
      w.startFullCourt(mine, theirs, quarterMinutes, worldGamePlans(setup));
      const ais = w.players.map((_, i) => new PlayerAi(i, new Rng(setup.seed + i)));
      assert(runToEnd(w, ais, 600_000), 'Match physique non terminé');
      const played = toPlayedGame(w, setup);
      for (const [teamId, score] of [[setup.home.id, played.result.homeScore], [setup.away.id, played.result.awayScore]] as const) {
        const rows = played.result.box.rows[teamId];
        assert.equal(rows.reduce((sum, r) => sum + r.line.pts, 0), score);
        assert.equal(rows.filter(r => r.starter).length, 5);
      }
      const line = played.result.box.rows[team.id].find(r => r.playerId === id)?.line;
      const record = { seed, quarterMinutes, target, normalizedMinutes: (line?.secs ?? 0) / 60 * matchTimeScale(quarterMinutes), fouls: line?.pf ?? 0 };
      records.push(record); console.log(JSON.stringify(record));
    }
  }
  const average = (target: number) => { const rows = records.filter(r => r.quarterMinutes === quarterMinutes && r.target === target); return rows.reduce((s, r) => s + r.normalizedMinutes, 0) / rows.length; };
  assert(average(36) - average(6) > 10, `Minutes insensibles aux cibles à ${quarterMinutes} min/quart`);
}
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? '/tmp/hoopsim-coaching-campaign.json';
writeFileSync(output, JSON.stringify(records, null, 2));
console.log(`PASS: ${records.length} matchs physiques complets, deux durées, graines appariées.`);
