import { describe, expect, it } from 'vitest';
import { cleanPose, repairContact, handMask } from './contactPixels';
import { dribbleBallAt } from './motion';

const set = (p: Uint8ClampedArray, w: number, x: number, y: number, rgb: number[]) => p.set([...rgb, 255], (y * w + x) * 4);
describe('pixels de contact', () => {
  it('retire les repères et les poussières sans rogner la silhouette connectée', () => {
    const pixels = new Uint8ClampedArray(10 * 10 * 4);
    for (let y = 2; y < 8; y++) for (let x = 3; x < 7; x++) set(pixels, 10, x, y, [210, 150, 90]);
    set(pixels, 10, 0, 0, [200, 130, 80]);
    set(pixels, 10, 8, 9, [255, 0, 255]);
    cleanPose(pixels, 10, 10);
    expect(pixels[3]).toBe(0);
    expect(pixels[(9 * 10 + 8) * 4 + 3]).toBe(0);
    expect(pixels[(2 * 10 + 3) * 4 + 3]).toBe(255);
  });
  it('répare les micro-trous sans ponter deux doigts séparés', () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (const [x, y] of [[3, 2], [2, 3], [4, 3]]) set(pixels, 8, x, y, [210, 145, 85]);
    set(pixels, 8, 2, 5, [210, 145, 85]); set(pixels, 8, 4, 5, [210, 145, 85]);
    repairContact(pixels, 8, 8, 3, 3);
    expect(pixels[(3 * 8 + 3) * 4 + 3]).toBe(255);
    expect(pixels[(5 * 8 + 3) * 4 + 3]).toBe(0);
  });
  it('garde les doigts au-dessus du ballon, jamais le carré de maillot', () => {
    const pixels = new Uint8ClampedArray(16 * 16 * 4);
    set(pixels, 16, 8, 7, [210, 145, 85]);
    set(pixels, 16, 8, 8, [15, 30, 65]);
    set(pixels, 16, 7, 7, [245, 240, 220]);
    set(pixels, 16, 0, 0, [210, 145, 85]);
    const mask = handMask(pixels, 16, 16, 8, 8, 5.5);
    expect(mask[(7 * 16 + 8) * 4 + 3]).toBe(255);
    expect(mask[(8 * 16 + 8) * 4 + 3]).toBe(0);
    expect(mask[(7 * 16 + 7) * 4 + 3]).toBe(0);
    expect(mask[3]).toBe(0);
  });
  it('fait toucher le parquet sans saut de position aux reprises et aux boucles', () => {
    const anchors = Array.from({ length: 8 }, (_, i) => ({ x: 60 + i * 0.1, y: 60 }));
    expect(dribbleBallAt(0.5, anchors, 79)?.y).toBe(79);
    for (const boundary of [1 / 8, 4 / 8, 6 / 8, 1]) {
      const a = dribbleBallAt(boundary - 0.00001, anchors, 79)!;
      const b = dribbleBallAt(boundary + 0.00001, anchors, 79)!;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.01);
    }
  });
});
