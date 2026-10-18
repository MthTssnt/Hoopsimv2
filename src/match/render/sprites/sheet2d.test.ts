import { describe, expect, it } from 'vitest';
import { appearance2DFor } from './appearance';
import { BakeQueue, SheetBaker } from './bake';
import { FRAME, FRAMES } from './rig';
import { composeFrame2D, metrics2D, sheetFrames2D } from './sheet2d';
import type { Heading } from './rig';

const look = appearance2DFor({ id: 'feuille-2d', heightCm: 200, weightKg: 98, number: 23, age: 27 });
const HEADINGS: readonly Heading[] = ['down', 'up'];

describe('feuille du match en rendu 2D', () => {
  it('19 images par bloc, aux indices du rig : ballon tenu aux mêmes images', () => {
    for (const heading of HEADINGS) {
      const frames = sheetFrames2D(heading);
      expect(frames).toHaveLength(FRAMES.length);
      frames.forEach((f, i) => expect(!!f.ball, `${heading} ${i}`).toBe(!!FRAMES[i].ball));
    }
  });

  it('chaque image tient dans le cadre ; le ballon tenu est dans le cadre ; au sol au rebond du dribble', () => {
    for (const heading of HEADINGS) {
      for (let i = 0; i < FRAMES.length; i++) {
        const both = composeFrame2D(look, i, heading);
        for (const facing of ['right', 'left'] as const) {
          const { canvas, ball } = both[facing];
          const b = canvas.bounds()!;
          expect(b.top, `${heading} ${i}`).toBeGreaterThan(0);
          expect(b.left).toBeGreaterThan(0);
          expect(b.right).toBeLessThan(FRAME.width - 1);
          expect(b.bottom).toBeLessThanOrEqual(FRAME.groundY);
          if (ball) {
            expect(ball.x, `${heading} ${i} ${facing}`).toBeGreaterThanOrEqual(4);
            expect(ball.x).toBeLessThan(FRAME.width - 4);
            expect(ball.y).toBeGreaterThanOrEqual(4);
          }
          if (sheetFrames2D(heading)[i].ball === 'dribbleLow') expect(ball!.y).toBe(FRAME.groundY - 4);
        }
        // Vers la gauche : le ballon est du côté opposé, à la même hauteur.
        if (both.right.ball) {
          expect(both.left.ball!.y).toBe(both.right.ball.y);
          expect(both.left.ball!.x).toBe(FRAME.width - 1 - both.right.ball.x);
        }
      }
    }
  });

  it('en diagonale bas, le dribble est devant le corps du côté de la course', () => {
    const { canvas, ball } = composeFrame2D(look, 10, 'down').right;
    const b = canvas.bounds()!;
    expect(ball!.x).toBeGreaterThan((b.left + b.right) / 2);
  });

  it('en l’air, le bassin reste à la hauteur de l’arrêt (le monde monte le sprite)', () => {
    const top = (i: number) => composeFrame2D(look, i, 'down').right.canvas.bounds()!.top;
    for (const i of [13, 14, 16, 18]) expect(Math.abs(top(i) - top(0)), `image ${i}`).toBeLessThanOrEqual(4);
    const m = metrics2D(look);
    expect(m.raisedHandTop).toBeLessThan(m.headTop + 4);
  });

  it('cuisson : même nombre d’images et d’ancres que le rig, pas à pas = d’un trait', () => {
    const a = new SheetBaker('a', look, { primary: [0x2244aa, 0x1d4ed8, 0x102060], secondary: [0xffd070, 0xf59e0b, 0xa06000], renderer: '2d' });
    const b = new SheetBaker('b', look, { primary: [0x2244aa, 0x1d4ed8, 0x102060], secondary: [0xffd070, 0xf59e0b, 0xa06000], renderer: '2d' });
    while (!a.step(0.01, () => 0));
    const queue = new BakeQueue<SheetBaker>();
    queue.add('b', b);
    while (queue.size > 0) queue.step(1000);
    expect(a.anchors).toHaveLength(FRAMES.length * 4);
    expect(a.anchors).toEqual(b.anchors);
    expect(a.pixels.every((v, k) => v === b.pixels[k])).toBe(true);
  });
});
