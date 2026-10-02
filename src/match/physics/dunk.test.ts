import { describe, expect, it } from 'vitest';
import { Rng } from '../../engine/rng';
import { makeCourt } from './court';
import { DUNK_PHYSICS, solveDunk } from './dunk';
import { simulateShot } from './shotSolver';

const court = makeCourt('pro');

describe('smash', () => {
  for (const hoop of [court.hoops.right, court.hoops.left]) {
    const { rim, toCourt } = hoop;
    const approaches = [
      { name: 'de face', from: { x: rim.x + toCourt * 1.2, y: rim.y } },
      { name: 'de côté', from: { x: rim.x + toCourt * 0.5, y: rim.y + 1.2 } },
    ];
    for (const { name, from } of approaches) {
      it(`aboutit au résultat voulu (panier ${hoop.side}, ${name})`, () => {
        let fallbacks = 0;
        for (let seed = 1; seed <= 30; seed++) {
          for (const made of [true, false]) {
            const plan = solveDunk(made, hoop, from, court, new Rng(seed));
            // La trajectoire rejouée donne bien le résultat tiré.
            expect(simulateShot(plan.start, plan.velocity, court, hoop)?.made).toBe(made);
            expect(plan.start.z).toBeGreaterThan(rim.z);
            if (!made && plan.outcome.landing) {
              expect(Math.hypot(plan.outcome.landing.x - rim.x, plan.outcome.landing.y - rim.y)).toBeLessThanOrEqual(DUNK_PHYSICS.reboundRadius);
            }
            if (plan.fallback) fallbacks++;
          }
        }
        // Le repli reste l'exception.
        expect(fallbacks).toBeLessThan(6);
      });
    }
  }

  it('est déterministe par graine', () => {
    const hoop = court.hoops.right;
    const from = { x: hoop.rim.x - 1, y: hoop.rim.y };
    expect(solveDunk(false, hoop, from, court, new Rng(5))).toEqual(solveDunk(false, hoop, from, court, new Rng(5)));
  });
});
