import { describe, expect, it } from 'vitest';
import { netShape } from './net';
import { MatchWorld, WORLD_DT } from '../../world/MatchWorld';
import { makeCourt } from '../../physics/court';
import { Rng } from '../../../engine/rng';
import { createNewGame } from '../../../engine';

const athlete = Object.values(createNewGame('bos', 8126).players)[0];
const court = makeCourt('pro');
const idle = { x: 0, y: 0, jump: false };
const world = () => new MatchWorld(court, athlete, { x: 14, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(8126));

describe('filets indépendants', () => {
  it('s’étire au passage, réagit plus au dunk puis revient exactement au repos', () => {
    const rest = netShape(-1);
    expect(netShape(0)).toEqual(rest);
    expect(netShape(0.11).drop).toBeGreaterThan(rest.drop);
    expect(netShape(0.11, true).flare).toBeGreaterThan(netShape(0.11).flare);
    expect(netShape(0.3).sway).not.toBe(0);
    expect(netShape(1.1, true)).toEqual(rest);
  });
  for (const side of ['left', 'right'] as const) {
    it(`publie une seule traversée du cercle ${side}, même sans tir comptabilisé`, () => {
      const w = world(), rim = court.hoops[side].rim;
      w.holder = null;
      w.ball = { pos: { ...rim, z: rim.z + 0.02 }, vel: { x: 0, y: 0, z: -3 } };
      for (let i = 0; i < 15; i++) w.step(WORLD_DT, idle);
      expect(w.netPassages).toHaveLength(1);
      expect(w.netPassages[0]).toMatchObject({ side, dunk: false });
      expect(w.lastShot).toBeNull();
    });
  }
  it('ne déclenche rien sur un fer qui ressort', () => {
    const w = world(), rim = court.hoops.right.rim;
    w.holder = null;
    w.ball = { pos: { x: rim.x - 0.27, y: rim.y, z: rim.z + 0.10 }, vel: { x: -2, y: 0, z: 1 } };
    for (let i = 0; i < 30; i++) w.step(WORLD_DT, idle);
    expect(w.netPassages).toEqual([]);
  });
});
