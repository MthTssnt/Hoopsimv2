/** Real fixed-step matches. Diagnostic intentions are distinguished from measured player arrival. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createNewGame } from '../src/engine';
import { Rng } from '../src/engine/rng';
import { gmMatchSetup, worldGamePlans, worldRotations, toPlayedGame } from '../src/match/gameResult';
import { PlayerAi } from '../src/match/ai/playerAi';
import { isThreePoint, makeCourt } from '../src/match/physics/court';
import { MatchWorld, WORLD_DT } from '../src/match/world/MatchWorld';
import type { PlayId } from '../src/engine/coaching/tactics';
const records = [];
for (const playId of ['fiveOut', 'horns', 'highPickRoll', 'postEntry', 'isolation'] as PlayId[]) for (const seed of [31, 8126]) for (const defensePolicy of ['man', 'switch', 'drop'] as const) {
  const league = createNewGame('bos', seed), game = league.schedule.find(g => g.homeId === 'bos' || g.awayId === 'bos')!;
  const setup = gmMatchSetup(league, game, 'regarder');
  const plans = worldGamePlans(setup); plans[0]!.playbook = [{ playId, weight: 1 }];
  plans[1]!.defense = defensePolicy;
  const [mine, theirs] = worldRotations(setup);
  const w = new MatchWorld(makeCourt('pro'), mine[0], { x: 0, y: 0, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(setup.seed));
  w.autoRestart = false; w.startFullCourt(mine, theirs, 1, plans);
  const ais = w.players.map((_, i) => new PlayerAi(i, new Rng(setup.seed + i)));
  let samples = 0, formationSamples = 0, maxArrived = 0, maxStep = 0, bothElbowsSamples = 0, fiveOutsideSamples = 0;
  const phases: Record<string, number> = {};
  for (let step = 0; step < 500_000 && !w.matchOver; step++) {
    const before = w.players.map(p => ({ ...p.pos })), phase = w.full!.phase, period = w.full!.period, lineup = w.lineupVersion;
    w.step(WORLD_DT, ais.map(ai => ai.think(w, WORLD_DT)));
    if (phase === 'jeu' && w.full!.phase === phase && w.full!.period === period && lineup === w.lineupVersion) {
      for (let i = 0; i < 10; i++) maxStep = Math.max(maxStep, Math.hypot(before[i].x - w.players[i].pos.x, before[i].y - w.players[i].pos.y));
    }
    if (step % 24 === 0) {
      assert(w.players.every(p => [...Object.values(p.pos), ...Object.values(p.vel)].every(Number.isFinite)));
      const state = w.tactics.peek(0);
      if (state && w.possession?.team === 0 && w.full!.phase === 'jeu') {
        samples++; phases[state.phase] = (phases[state.phase] ?? 0) + 1;
        const arrived = Object.entries(state.spots).filter(([i, p]) => Math.hypot(w.players[Number(i)].pos.x - p.x, w.players[Number(i)].pos.y - p.y) < 1.5).length;
        maxArrived = Math.max(maxArrived, arrived);
        if (arrived >= 3) formationSamples++;
        const rim = w.attackHoop(0).rim;
        const elbows = Object.entries(state.spots).filter(([, p]) => Math.hypot(p.x - rim.x, p.y - rim.y) < 6);
        if (playId === 'horns' && elbows.length === 2 && elbows.every(([i, p]) => Math.hypot(w.players[Number(i)].pos.x - p.x, w.players[Number(i)].pos.y - p.y) < 1.5)) bothElbowsSamples++;
        if (playId === 'fiveOut' && w.full!.frontcourt && w.lineup[0].every(i => isThreePoint(w.court, w.attackHoop(0), w.players[i].pos.x, w.players[i].pos.y))) fiveOutsideSamples++;
      }
    }
  }
  assert(w.matchOver, `${playId}/${seed}: match unfinished`);
  assert(maxStep < 0.5, `Unexpected body jump: ${maxStep}`);
  const played = toPlayedGame(w, setup);
  for (const [id, score] of [[setup.home.id, played.result.homeScore], [setup.away.id, played.result.awayScore]] as const) {
    assert.equal(played.result.box.rows[id].reduce((n, r) => n + r.line.pts, 0), score);
  }
  const record = { playId, seed, defensePolicy, score: w.points, samples, formationSamples, bothElbowsSamples, fiveOutsideSamples, maxArrived, maxStep, phases, observations: w.tactics.summary(0), defense: w.tactics.summary(1) };
  records.push(record); console.log(JSON.stringify(record));
}
for (const play of ['fiveOut', 'horns']) assert(records.filter(r => r.playId === play).every(r => r.formationSamples > 0), `${play}: formation never reached`);
for (const play of ['horns', 'highPickRoll']) assert(records.filter(r => r.playId === play).reduce((n, r) => n + r.observations.screenWindows, 0) > 0, `${play}: no planted screen windows`);
assert(records.filter(r => r.defensePolicy === 'switch').reduce((n, r) => n + r.defense.switches, 0) > 0, 'Switch policy never exchanged responsibilities');
assert(records.filter(r => r.playId === 'fiveOut').reduce((n, r) => n + r.fiveOutsideSamples, 0) > 0, 'Five-Out never placed five actual players outside');
assert(records.filter(r => r.playId === 'horns').reduce((n, r) => n + r.bothElbowsSamples, 0) > 0, 'Horns never reached both elbows');
const output = process.argv.find(s => s.startsWith('--output='))?.slice(9) ?? '/tmp/hoopsim-live-tactics.json';
writeFileSync(output, JSON.stringify(records, null, 2));
console.log(`PASS: ${records.length} complete physical games, finite physics, score accounting and bounded displacement.`);
