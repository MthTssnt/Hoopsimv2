import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import type { Athlete } from './shot';
import {
  interceptionChances,
  reachFoulProbability,
  resolveInterception,
  resolveSteal,
  STEAL_TUNING,
  stealProbability,
  type InterceptContext,
  type StealContext,
} from './steal';
import type { Attributes } from './types';

/** Joueur « moyen » : toutes les notes à 60. */
function athlete(attrs: Partial<Attributes> = {}): Athlete {
  const base = Object.fromEntries(
    [
      'inside', 'midRange', 'three', 'freeThrow', 'passing', 'handling', 'offReb', 'defReb', 'interiorDef',
      'perimeterDef', 'steal', 'block', 'speed', 'strength', 'stamina', 'iq', 'vertical', 'standingDunk', 'drivingDunk',
    ].map((k) => [k, 60]),
  ) as unknown as Attributes;
  return { attrs: { ...base, ...attrs }, heightCm: 200, weightKg: 100 };
}

const steal = (o: Partial<StealContext> = {}): StealContext => ({ thief: athlete(), handler: athlete(), reach: 1, exposed: 1, ...o });
const pass = (o: Partial<InterceptContext> = {}): InterceptContext => ({
  defender: athlete(),
  passer: athlete(),
  contact: 1,
  passSpeed: 12,
  reaching: false,
  airborne: false,
  ...o,
});

describe('vol sur le porteur', () => {
  it('autour de 20 % pour des joueurs moyens, main bien placée, ballon exposé', () => {
    expect(stealProbability(steal())).toBeCloseTo(STEAL_TUNING.steal.base, 9);
  });

  it('plus de vols avec la stat d’interception, moins contre un bon dribbleur', () => {
    expect(stealProbability(steal({ thief: athlete({ steal: 90 }) }))).toBeGreaterThan(stealProbability(steal()));
    expect(stealProbability(steal({ handler: athlete({ handling: 90 }) }))).toBeLessThan(stealProbability(steal()));
  });

  it('main bien placée plutôt qu’au bout des doigts, ballon exposé plutôt que caché', () => {
    expect(stealProbability(steal({ reach: 0 }))).toBeLessThan(stealProbability(steal()));
    expect(stealProbability(steal({ exposed: 0 }))).toBeLessThan(stealProbability(steal({ exposed: 0.5 })));
  });

  it('reste dans ses bornes', () => {
    const [lo, hi] = STEAL_TUNING.steal.bounds;
    expect(stealProbability(steal({ thief: athlete({ steal: 99 }), handler: athlete({ handling: 25 }) }))).toBeLessThanOrEqual(hi);
    expect(stealProbability(steal({ thief: athlete({ steal: 25 }), handler: athlete({ handling: 99 }), reach: 0, exposed: 0 }))).toBeGreaterThanOrEqual(lo);
  });
});

describe('faute de main', () => {
  const foul = (o: Partial<Parameters<typeof reachFoulProbability>[0]> = {}) =>
    reachFoulProbability({ thief: athlete(), handler: athlete(), closeness: 0, across: 0, ...o });

  it('rare à bonne distance, fréquente trop près ou à travers le corps', () => {
    expect(foul()).toBeLessThan(0.1);
    expect(foul({ closeness: 0.15 })).toBeGreaterThan(foul() + 0.3);
    expect(foul({ across: 1 })).toBeGreaterThan(foul() + 0.2);
  });

  it('un défenseur malin en fait moins, un porteur plus fort en provoque plus', () => {
    expect(foul({ thief: athlete({ iq: 90 }), closeness: 0.1 })).toBeLessThan(foul({ closeness: 0.1 }));
    expect(foul({ handler: athlete({ strength: 90 }), closeness: 0.1 })).toBeGreaterThan(foul({ closeness: 0.1 }));
  });
});

describe('interception', () => {
  it('un défenseur en plein dans la ligne touche plus souvent qu’un défenseur effleuré', () => {
    expect(interceptionChances(pass()).touch).toBeGreaterThan(interceptionChances(pass({ contact: 0 })).touch + 0.3);
  });

  it('une passe rapide ou un bon passeur la rendent plus dure ; A au bon moment aide', () => {
    expect(interceptionChances(pass({ passSpeed: 14 })).touch).toBeLessThan(interceptionChances(pass()).touch);
    expect(interceptionChances(pass({ passer: athlete({ passing: 95 }) })).touch).toBeLessThan(interceptionChances(pass()).touch);
    expect(interceptionChances(pass({ reaching: true, contact: 0.3 })).touch).toBeGreaterThan(interceptionChances(pass({ contact: 0.3 })).touch);
  });

  it('en l’air, plutôt des déviations que des prises', () => {
    expect(interceptionChances(pass({ airborne: true })).catchShare).toBeLessThan(interceptionChances(pass()).catchShare);
  });

  it('les trois issues sortent, dans des proportions conformes aux chances', () => {
    const rng = new Rng(3);
    const counts = { catch: 0, deflect: 0, miss: 0 };
    const ctx = pass({ contact: 0.6 });
    for (let i = 0; i < 4000; i++) counts[resolveInterception(ctx, rng)]++;
    const { touch, catchShare } = interceptionChances(ctx);
    expect(counts.miss / 4000).toBeCloseTo(1 - touch, 1);
    expect(counts.catch / 4000).toBeCloseTo(touch * catchShare, 1);
  });

  it('déterminisme', () => {
    const run = () => {
      const rng = new Rng(9);
      return Array.from({ length: 50 }, () => [resolveInterception(pass({ contact: 0.5 }), rng), resolveSteal(steal(), rng)]);
    };
    expect(run()).toEqual(run());
  });
});
