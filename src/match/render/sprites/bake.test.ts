import { describe, expect, it } from 'vitest';
import { teamRamp } from '../../../assets/palette';
import type { Appearance } from './appearance';
import { BakeQueue, SheetBaker, type Clock, type Stepper } from './bake';

const look: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 2, head: 0, hair: 1, hairColor: 0, number: 23 };
const options = { primary: teamRamp('#1d4ed8'), secondary: teamRamp('#f59e0b') };

/** Horloge de test : chaque lecture avance d'une milliseconde. */
function ticking(): Clock {
  let t = 0;
  return () => t++;
}

describe('cuisson pas à pas (SheetBaker)', () => {
  it('donne les mêmes pixels et les mêmes ancres, cuite d’un trait ou image par image', () => {
    const whole = new SheetBaker('a', look, options);
    expect(whole.step(Infinity)).toBe(true);

    const sliced = new SheetBaker('b', look, options);
    const clock = ticking();
    let steps = 1;
    while (!sliced.step(0.5, clock)) steps++;
    // Budget minuscule : une image par pas, 4 vues de 19 images.
    expect(steps).toBe(76);
    expect(sliced.anchors).toEqual(whole.anchors);
    expect(sliced.pixels).toEqual(whole.pixels);
    expect(sliced.pixels.some((v) => v !== 0)).toBe(true);
  });

  it('avance d’au moins une image par pas, même sans budget, et s’arrête une fois finie', () => {
    const baker = new SheetBaker('c', look, options);
    baker.step(0, ticking());
    expect(baker.anchors).toHaveLength(1);
    baker.step(Infinity);
    expect(baker.done).toBe(true);
    expect(baker.step(10)).toBe(true);
    expect(baker.anchors).toHaveLength(76);
  });
});

/** Double d'une cuisson : `units` pas de 1 ms. */
class FakeBaker implements Stepper {
  steps = 0;
  private clockTime: { t: number };
  private units: number;
  constructor(units: number, clockTime: { t: number }) {
    this.units = units;
    this.clockTime = clockTime;
  }
  step(budgetMs: number): boolean {
    const start = this.clockTime.t;
    do {
      this.steps++;
      this.clockTime.t += 1;
    } while (this.steps < this.units && this.clockTime.t - start < budgetMs);
    return this.steps >= this.units;
  }
}

describe('file de cuisson du banc (BakeQueue)', () => {
  it('cuit chaque joueur une fois, dans l’ordre, en respectant le budget de chaque image', () => {
    const time = { t: 0 };
    const clock = () => time.t;
    const queue = new BakeQueue<FakeBaker>();
    const bakers = [new FakeBaker(3, time), new FakeBaker(5, time), new FakeBaker(2, time)];
    bakers.forEach((b, i) => queue.add(`j${i}`, b));
    queue.add('j0', new FakeBaker(1, time));
    expect(queue.size).toBe(3);

    const done: string[] = [];
    let frames = 0;
    while (queue.size > 0) {
      const before = time.t;
      done.push(...queue.step(4, clock).map((item) => item.id));
      expect(time.t - before).toBeLessThanOrEqual(4);
      frames++;
    }
    expect(done).toEqual(['j0', 'j1', 'j2']);
    expect(bakers.map((b) => b.steps)).toEqual([3, 5, 2]);
    expect(frames).toBe(3);
  });

  it('rend tout de suite un joueur demandé avant la fin de sa cuisson (à finir d’un trait)', () => {
    const time = { t: 0 };
    const queue = new BakeQueue<FakeBaker>();
    const first = new FakeBaker(10, time);
    const second = new FakeBaker(10, time);
    queue.add('a', first);
    queue.add('b', second);
    queue.step(4, () => time.t);
    expect(queue.has('b')).toBe(true);
    expect(queue.take('b')).toBe(second);
    expect(queue.has('b')).toBe(false);
    expect(queue.take('b')).toBeNull();
    expect(queue.size).toBe(1);
  });
});
