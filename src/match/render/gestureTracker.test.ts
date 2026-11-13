import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../engine';
import { Rng } from '../../engine/rng';
import { PlayerAi } from '../ai/playerAi';
import { makeCourt } from '../physics/court';
import { MatchWorld, WORLD_DT } from '../world/MatchWorld';
import { GestureTracker } from './gestureTracker';

function game() {
  const players = Object.values(createNewGame('bos', 8126).players);
  const world = new MatchWorld(makeCourt('pro'), players[0], { x: 20, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(8126));
  world.startTeams(players.slice(0, 2), players.slice(14, 16), 21);
  return world;
}
describe('suivi visuel au pas physique', () => {
  it('capture une passe et garde sa direction même si la dernière réception est différente', () => {
    const w = game(), tracker = new GestureTracker(w);
    w.holder = 0;
    w.players[0].pos = { x: 20, y: 7, z: 0 };
    w.players[1].pos = { x: 18, y: 4, z: 0 };
    w.players[2].pos = { x: 26, y: 12, z: 0 };
    w.players[3].pos = { x: 26, y: 13, z: 0 };
    w.step(WORLD_DT, [{ x: -1, y: -1, jump: false, pass: true }]);
    tracker.advance(WORLD_DT);
    expect(w.pass?.passer).toBe(0);
    expect(tracker.clocks[0].pass).toBe(0);
    expect(tracker.states[0]).toMatchObject({ kind: 'frame', gesture: 'pass', step: 2, facing: 'left', heading: 'up' });
    w.lastPass = { passer: 0, receiver: 3, time: 0 };
    for (let i = 0; i < 4; i++) { w.step(WORLD_DT, []); tracker.advance(WORLD_DT); }
    expect(tracker.clocks[0].pass).toBeCloseTo(4 * WORLD_DT);
    expect(tracker.states[0]).toMatchObject({ facing: 'left', heading: 'up' });
  });
  it('réinitialise les gestes quand un nouveau joueur occupe le même corps', () => {
    const w = game(), tracker = new GestureTracker(w);
    tracker.clocks[0].pass = 0.05;
    const replacement = Object.values(createNewGame('bos', 44).players)[20];
    w.setAthlete(replacement, 0); tracker.advance(WORLD_DT);
    expect(tracker.clocks[0].id).toBe(replacement.id);
    expect(tracker.clocks[0].pass).toBeNull();
  });
  it('ne change ni la physique ni les résultats, quel que soit le nombre de lectures entre deux pas', () => {
    const a = game(), b = game(), tracker = new GestureTracker(a);
    const ais = a.players.map((_, i) => new PlayerAi(i, new Rng(80 + i)));
    for (let k = 0; k < 1800; k++) {
      const inputs = ais.map((ai) => ai.think(a, WORLD_DT));
      a.step(WORLD_DT, inputs); tracker.advance(WORLD_DT);
      b.step(WORLD_DT, inputs);
      if (k % 4 === 0) { JSON.stringify(tracker.states); JSON.stringify(tracker.views); }
    }
    expect(a.ball).toEqual(b.ball); expect(a.points).toEqual(b.points);
    expect(a.players).toEqual(b.players); expect(a.lastShot).toEqual(b.lastShot);
  });
});
