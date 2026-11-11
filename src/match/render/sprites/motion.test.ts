import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../../assets/players/painted/manifest.json';
import { MOTIONS, dribbleFlightY } from './motion';
import { MOTION_FRAMES, MOTION_INDICES } from './layout';
import { FRAME, SPRITE_DETAIL } from './views';
import { RENDER_SCALE, VIEW_HEIGHT, VIEW_WIDTH } from '../../config';

describe('images complètes des animations officielles', () => {
  it('réserve 4 à 8 images à chacune des 18 animations', () => {
    expect(MOTIONS).toHaveLength(18);
    for (const motion of MOTIONS) {
      expect(motion.count).toBeGreaterThanOrEqual(4);
      expect(motion.count).toBeLessThanOrEqual(8);
      expect(MOTION_INDICES[motion.id]).toHaveLength(motion.count);
    }
    expect(new Set(Object.values(MOTION_INDICES).flat()).size).toBe(MOTION_FRAMES.length);
  });
  it('fournit 84 personnages complets pour chaque design de face et de dos', () => {
    expect(manifest).toHaveLength(20);
    expect(new Set(manifest.map((a) => `${a.team}:${a.variant}:${a.heading}`)).size).toBe(20);
    for (const atlas of manifest) {
      expect(atlas.frames).toHaveLength(84);
      const png = readFileSync(new URL(`../../../assets/players/painted/${atlas.file}`, import.meta.url));
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      expect(width).toBeLessThanOrEqual(2048);
      expect(height).toBeLessThanOrEqual(2048);
      for (const f of atlas.frames) {
        expect(f.width).toBeGreaterThan(15);
        expect(f.height).toBeGreaterThan(50);
        expect(f.x).toBeGreaterThan(0);
        expect(f.y).toBeGreaterThan(0);
        expect(f.x + f.width).toBeLessThan(width);
        expect(f.y + f.height).toBeLessThan(height);
        expect(f.left).toBeGreaterThan(0);
        expect(f.top).toBeGreaterThan(0);
        expect(f.left + f.width).toBeLessThan(FRAME.width * SPRITE_DETAIL);
        expect(f.top + f.height).toBeLessThan(FRAME.height * SPRITE_DETAIL);
      }
    }
  });
  it('conserve les repères du ballon peints avec le joueur sur chaque image de dribble', () => {
    for (const atlas of manifest) for (const id of ['dribble', 'dribbleIdle'] as const) {
      const frames = MOTION_INDICES[id].map((i) => atlas.frames[i]);
      expect(frames.every((f) => f.ball !== null)).toBe(true);
      const heights = frames.map((f) => f.ball!.y);
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(4);
      expect(frames.some((f) => f.contact)).toBe(true);
    }
  });
  it('double le détail sans modifier les unités logiques du terrain', () => {
    expect(SPRITE_DETAIL).toBe(2);
    expect(RENDER_SCALE).toBe(SPRITE_DETAIL);
    expect([VIEW_WIDTH, VIEW_HEIGHT]).toEqual([640, 360]);
  });
  it('atteint le parquet pendant la phase libre et préserve les images de contact', () => {
    for (const height of [39, 45, 51]) {
      const release = FRAME.groundY - height * .38, caught = FRAME.groundY - height * .4, floor = FRAME.groundY - 5;
      expect(dribbleFlightY(4, release, caught, floor)).toBe(floor);
      for (const f of [2, 3, 4, 5]) expect(dribbleFlightY(f, release, caught, floor)!).toBeLessThanOrEqual(floor);
      for (const f of [0, 1, 6, 7]) expect(dribbleFlightY(f, release, caught, floor)).toBeNull();
    }
  });
});
