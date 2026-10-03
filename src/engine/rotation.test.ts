import { describe, expect, it } from 'vitest';
import { createNewGame } from '.';
import { minuteTargets, pickLineup } from './coach';
import {
  coachValue,
  drainEnergy,
  energyFactor,
  inBonus,
  matchRotation,
  newCoachContext,
  nextLineup,
  restEnergy,
  rotationTargets,
  startingEnergy,
  startingLineup,
  updateCoachContext,
  type RotationMember,
} from './rotation';
import type { Player } from './types';

const member = (over: Partial<RotationMember> = {}): RotationMember => ({
  id: 'a',
  overall: 70,
  posIndex: 3,
  energy: 80,
  onCourt: false,
  fouledOut: false,
  targetSecs: 1800,
  line: { secs: 600, pf: 0 },
  ...over,
});

describe('énergie (valeurs de la simulation)', () => {
  it('départ : énergie de la ligue + 40, bornée à 70-100', () => {
    expect(startingEnergy({ energy: 20 } as Player)).toBe(70);
    expect(startingEnergy({ energy: 45 } as Player)).toBe(85);
    expect(startingEnergy({ energy: 90 } as Player)).toBe(100);
  });

  it('perte sur le terrain, récupération sur le banc, bornes 5-100', () => {
    // Endurance 60 : 0,115 − 0,03 = 0,085 par seconde ; 0,16 + 0,048 = 0,208 sur le banc.
    expect(drainEnergy(90, 60, 100, true)).toBeCloseTo(90 - 8.5, 9);
    expect(drainEnergy(50, 60, 100, false)).toBeCloseTo(50 + 20.8, 9);
    expect(drainEnergy(6, 20, 1000, true)).toBe(5);
    expect(drainEnergy(99, 99, 1000, false)).toBe(100);
    // Mêmes opérations que l'ancien `advanceTime` de `simGame`.
    const stamina = 73;
    const drain = 0.115 - stamina * 0.0005;
    expect(drainEnergy(88.3, stamina, 17.2, true)).toBe(Math.min(100, Math.max(5, 88.3 - drain * 17.2)));
  });

  it('repos de 15 entre les périodes, 30 à la mi-temps', () => {
    expect(restEnergy(50, 1)).toBe(65);
    expect(restEnergy(50, 2)).toBe(80);
    expect(restEnergy(90, 3)).toBe(100);
  });

  it('effet sur les notes : × 0,8 à vide, × 1 plein', () => {
    expect(energyFactor(100)).toBe(1);
    expect(energyFactor(0)).toBeCloseTo(0.8, 12);
    expect(energyFactor(50)).toBe(0.8 + 0.2 * 0.5);
  });
});

describe('coach (valeurs de la simulation)', () => {
  it('minutes en retard, fatigue, fautes', () => {
    const ctx = newCoachContext();
    ctx.progress = 0.5;
    // Visé 1 800 s, à mi-match 900 s attendues, 600 jouées : 5 min de retard.
    expect(coachValue(member(), ctx)).toBeCloseTo(55 + 5 * 4 + 10 * 0.25 + 15 * 0.12, 9);
    expect(coachValue(member({ onCourt: true }), ctx) - coachValue(member(), ctx)).toBeCloseTo(2, 9);
    ctx.period = 1;
    expect(coachValue(member(), ctx) - coachValue(member({ line: { secs: 600, pf: 3 } }), ctx)).toBeCloseTo(5, 9);
    expect(coachValue(member(), ctx) - coachValue(member({ line: { secs: 600, pf: 5 } }), ctx)).toBeCloseTo(15, 9);
  });

  it('à l’échelle d’un match court, le temps joué compte multiplié par l’échelle', () => {
    const full = newCoachContext(1);
    const short = newCoachContext(4);
    full.progress = short.progress = 0.5;
    expect(coachValue(member({ line: { secs: 150, pf: 0 } }), short)).toBeCloseTo(coachValue(member(), full), 9);
  });

  it('fin de match serrée, match plié ; seuils de temps divisés par l’échelle', () => {
    const ctx = newCoachContext();
    updateCoachContext(ctx, 4, 200, 2700, 2880, 6);
    expect(ctx.closing).toBe(true);
    updateCoachContext(ctx, 4, 400, 2600, 2880, 25);
    expect(ctx.garbage).toBe(true);
    updateCoachContext(ctx, 3, 100, 2000, 2880, 6);
    expect(ctx.closing || ctx.garbage).toBe(false);
    const short = newCoachContext(4);
    updateCoachContext(short, 4, 70, 650, 720, 6);
    expect(short.closing).toBe(true);
    updateCoachContext(short, 4, 80, 640, 720, 6);
    expect(short.closing).toBe(false);
    expect(short.progress).toBeCloseTo(640 / 720, 12);
  });

  it('bonus à partir de la 6e faute d’équipe', () => {
    expect(inBonus(5)).toBe(false);
    expect(inBonus(6)).toBe(true);
  });

  it('cinq de départ et cinq suivant : jamais un éliminé s’il en reste cinq', () => {
    const rotation = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5].map((pos, i) => member({ id: `p${i}`, posIndex: pos, overall: 80 - i }));
    const five = startingLineup(rotation);
    expect(new Set(five)).toEqual(new Set(rotation.slice(0, 5)));
    expect(five).toEqual(pickLineup(rotation.slice(0, 5), (lp) => lp.overall));
    rotation[0].fouledOut = true;
    expect(nextLineup(rotation, newCoachContext())).not.toContain(rotation[0]);
  });
});

describe('effectif d’un match', () => {
  it('les valides de la rotation (au moins 8), minutes visées dans l’ordre', () => {
    const league = createNewGame('bos', 7);
    for (const team of league.teams.slice(0, 5)) {
      const available = matchRotation(team, league.players);
      expect(available.length).toBeGreaterThanOrEqual(8);
      expect(available.every((p) => p.injuryGames === 0 && p.teamId === team.id)).toBe(true);
      const targets = rotationTargets(available);
      expect([...targets.values()]).toEqual(minuteTargets(available.length));
    }
  });
});
