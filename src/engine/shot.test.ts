import { describe, expect, it } from 'vitest';
import { jumpHeight, reach, runSpeed } from './athletics';
import { Rng } from './rng';
import {
  blockProbability,
  canDunk,
  contestLevel,
  dunkProbability,
  foulProbability,
  FREE_THROW_TUNING,
  freeThrowBase,
  freeThrowProbability,
  greenWindow,
  resolveFreeThrow,
  resolveShot,
  SHOT_MODEL,
  SHOT_TUNING,
  shotProbability,
  timingGrade,
  type Athlete,
  type DunkContext,
  type ShotContext,
} from './shot';
import type { Attributes } from './types';

/** Joueur « moyen » : toutes les notes à 64, 2 m, poids attendu pour la taille. */
function athlete(attrs: Partial<Attributes> = {}, heightCm = 200, weightKg = 102): Athlete {
  const base = Object.fromEntries(
    [
      'inside', 'midRange', 'three', 'freeThrow', 'passing', 'handling', 'offReb', 'defReb', 'interiorDef',
      'perimeterDef', 'steal', 'block', 'speed', 'strength', 'stamina', 'iq', 'vertical', 'standingDunk', 'drivingDunk',
    ].map((k) => [k, 64]),
  ) as unknown as Attributes;
  return { attrs: { ...base, ...attrs }, heightCm, weightKg };
}

function openThree(overrides: Partial<ShotContext> = {}): ShotContext {
  return {
    shooter: athlete(),
    zone: 'three',
    kind: 'jump',
    mode: 'timing',
    speed: 'normal',
    timingError: 0,
    contest: null,
    moveSpeed: 0,
    ...overrides,
  };
}

/** Réussite moyenne avec un lâcher humain : écart ~ N(0, humanTimingSd), intégré numériquement. */
function humanAverage(ctx: ShotContext): number {
  const sd = SHOT_TUNING.humanTimingSd;
  let sum = 0;
  let weight = 0;
  for (let i = -600; i <= 600; i++) {
    const e = (i / 100) * sd;
    const w = Math.exp(-0.5 * (e / sd) ** 2);
    sum += w * shotProbability({ ...ctx, timingError: e });
    weight += w;
  }
  return sum / weight;
}

describe('modèle de tir du match joué', () => {
  it('le vert parfait donne ~45 % à 3 pts à un tireur moyen ouvert', () => {
    expect(shotProbability(openThree())).toBeCloseTo(0.45, 2);
  });

  it('un lâcher humain moyen tourne autour de 35 % à 3 pts, dans les deux modes', () => {
    expect(humanAverage(openThree())).toBeGreaterThan(0.34);
    expect(humanAverage(openThree())).toBeLessThan(0.36);
    expect(humanAverage(openThree({ mode: 'realPct' }))).toBeGreaterThan(0.34);
    expect(humanAverage(openThree({ mode: 'realPct' }))).toBeLessThan(0.36);
  });

  it('pèse le timing plus fort en mode Timing qu’en Real Player %', () => {
    const late = 0.2;
    const timingDrop = shotProbability(openThree()) - shotProbability(openThree({ timingError: late }));
    const realDrop =
      shotProbability(openThree({ mode: 'realPct' })) - shotProbability(openThree({ mode: 'realPct', timingError: late }));
    expect(timingDrop).toBeGreaterThan(realDrop);
  });

  it('baisse quand le lâcher s’éloigne du sommet, des deux côtés', () => {
    for (const mode of ['timing', 'realPct'] as const) {
      let previous = Infinity;
      for (let ms = 0; ms <= 300; ms += 10) {
        const late = shotProbability(openThree({ mode, timingError: ms / 1000 }));
        const early = shotProbability(openThree({ mode, timingError: -ms / 1000 }));
        expect(late).toBeLessThanOrEqual(previous);
        expect(early).toBeCloseTo(late, 10);
        previous = late;
      }
    }
  });

  it('ne dépasse jamais le plafond à 3 pts, même pour un excellent tireur parfait', () => {
    const sniper = athlete({ three: 99 });
    expect(shotProbability(openThree({ shooter: sniper }))).toBeLessThanOrEqual(SHOT_MODEL.bounds.three[1]);
    expect(shotProbability(openThree({ timingError: 1 }))).toBeGreaterThanOrEqual(SHOT_TUNING.minProbability);
  });

  it('en Real Player %, la stat élargit la zone verte ; en Timing, elle ne la change pas', () => {
    expect(greenWindow('realPct', 90, 'normal')).toBeGreaterThan(greenWindow('realPct', 50, 'normal'));
    expect(greenWindow('timing', 90, 'normal')).toBe(greenWindow('timing', 50, 'normal'));
    expect(greenWindow('timing', 64, 'fast')).toBeLessThan(greenWindow('timing', 64, 'normal'));
    expect(greenWindow('timing', 64, 'normal')).toBeLessThan(greenWindow('timing', 64, 'slow'));
  });

  it('classe le lâcher : parfait, vert, trop tôt, trop tard', () => {
    const w = greenWindow('timing', 64, 'normal');
    expect(timingGrade(0, w)).toBe('perfect');
    expect(timingGrade(w * 0.8, w)).toBe('green');
    expect(timingGrade(-w * 1.5, w)).toBe('early');
    expect(timingGrade(w * 1.5, w)).toBe('late');
  });

  it('pénalise la contestation selon la distance et le fait d’être en face', () => {
    const open = shotProbability(openThree());
    const far = shotProbability(openThree({ contest: { distance: 3, facing: 1 } }));
    const close = shotProbability(openThree({ contest: { distance: 0.8, facing: 1 } }));
    const tight = shotProbability(openThree({ contest: { distance: 0.4, facing: 1 } }));
    const side = shotProbability(openThree({ contest: { distance: 0.4, facing: 0 } }));
    expect(far).toBe(open);
    expect(close).toBeLessThan(open);
    expect(tight).toBeLessThan(close);
    expect(side).toBeGreaterThan(tight);
    expect(side).toBeLessThan(open);
    expect(contestLevel({ distance: 0.4, facing: 1 })).toBe(1);
  });

  it('pénalise le tir en mouvement, mais pas le layup', () => {
    expect(shotProbability(openThree({ moveSpeed: 4 }))).toBeLessThan(shotProbability(openThree()));
    const layup = openThree({ zone: 'rim', kind: 'layup' });
    expect(shotProbability({ ...layup, moveSpeed: 4 })).toBe(shotProbability(layup));
  });

  it('tire un résultat déterministe, conforme à la probabilité', () => {
    const ctx = openThree({ timingError: 0.03 });
    const p = shotProbability(ctx);
    const a = new Rng(7);
    const b = new Rng(7);
    let made = 0;
    for (let i = 0; i < 20000; i++) {
      const r = resolveShot(ctx, a);
      expect(resolveShot(ctx, b).made).toBe(r.made);
      if (r.made) made++;
    }
    expect(made / 20000).toBeCloseTo(p, 1);
  });
});

describe('lancer franc', () => {
  const ft = (o: Partial<Parameters<typeof freeThrowProbability>[0]> = {}) => ({
    shooter: athlete({ freeThrow: 75 }),
    mode: 'timing' as const,
    speed: 'normal' as const,
    timingError: 0,
    ...o,
  });
  /** Réussite moyenne avec un lâcher humain moyen, intégrée numériquement. */
  const human = (o: Partial<Parameters<typeof freeThrowProbability>[0]> = {}) => {
    const sd = SHOT_TUNING.humanTimingSd;
    let sum = 0;
    let weight = 0;
    for (let i = -600; i <= 600; i++) {
      const e = (i / 100) * sd;
      const w = Math.exp(-0.5 * (e / sd) ** 2);
      sum += w * freeThrowProbability(ft({ ...o, timingError: e }));
      weight += w;
    }
    return sum / weight;
  };

  it('base de la simulation : 0,40 + 0,0055 × stat, bornée', () => {
    expect(freeThrowBase(75)).toBeCloseTo(0.8125, 9);
    expect(freeThrowBase(0)).toBe(0.45);
    expect(freeThrowBase(120)).toBe(0.95);
  });

  it('lâcher parfait au-dessus de la base ; un timing humain moyen retombe autour d’elle', () => {
    expect(freeThrowProbability(ft())).toBeGreaterThan(freeThrowBase(75));
    expect(freeThrowProbability(ft())).toBeLessThanOrEqual(FREE_THROW_TUNING.max);
    expect(Math.abs(human() - freeThrowBase(75))).toBeLessThan(0.06);
    expect(freeThrowProbability(ft({ timingError: 0.25 }))).toBeLessThan(0.4);
  });

  it('un meilleur tireur réussit plus ; en Real Player %, sa stat élargit le vert', () => {
    expect(human({ shooter: athlete({ freeThrow: 90 }) })).toBeGreaterThan(human({ shooter: athlete({ freeThrow: 50 }) }));
    const late = 0.09;
    const good = freeThrowProbability(ft({ mode: 'realPct', timingError: late, shooter: athlete({ freeThrow: 95 }) })) / freeThrowBase(95);
    const bad = freeThrowProbability(ft({ mode: 'realPct', timingError: late, shooter: athlete({ freeThrow: 40 }) })) / freeThrowBase(40);
    expect(good).toBeGreaterThan(bad);
  });

  it('les issues suivent la proba, avec la note du lâcher ; déterminisme', () => {
    const rng = new Rng(4);
    let made = 0;
    for (let i = 0; i < 4000; i++) if (resolveFreeThrow(ft(), rng).made) made++;
    expect(made / 4000).toBeCloseTo(freeThrowProbability(ft()), 1);
    expect(resolveFreeThrow(ft({ timingError: -0.3 }), new Rng(1)).grade).toBe('early');
    const run = () => {
      const r = new Rng(8);
      return Array.from({ length: 30 }, (_, i) => resolveFreeThrow(ft({ timingError: (i - 15) / 100 }), r).made);
    };
    expect(run()).toEqual(run());
  });
});

describe('dunk', () => {
  const center = athlete({ standingDunk: 80, drivingDunk: 70, vertical: 60, block: 74 }, 212, 122);
  const smallGuard = athlete({ standingDunk: 40, drivingDunk: 58, vertical: 74 }, 186, 88);
  const ctx = (dunker: Athlete, overrides: Partial<DunkContext> = {}): DunkContext => ({
    dunker,
    inDunkZone: true,
    moveSpeed: 0,
    defender: null,
    ...overrides,
  });

  it('n’est possible que dans la moitié de la raquette côté panier', () => {
    expect(canDunk(ctx(center))).toBe(true);
    expect(canDunk(ctx(center, { inDunkZone: false }))).toBe(false);
  });

  it('dépend de la stat de dunk arrêté ou en mouvement', () => {
    expect(canDunk(ctx(smallGuard))).toBe(false);
    expect(canDunk(ctx(smallGuard, { moveSpeed: 5 }))).toBe(true);
  });

  it('devient plus dur face à un grand défenseur bien placé', () => {
    const contested = ctx(smallGuard, { moveSpeed: 5, defender: { distance: 0.5, facing: 1, player: center } });
    expect(canDunk(contested)).toBe(false);
    const open = dunkProbability(ctx(center));
    const guarded = dunkProbability(ctx(center, { defender: { distance: 0.5, facing: 1, player: center } }));
    expect(guarded).toBeLessThan(open);
    expect(open).toBeLessThan(1);
  });
});

describe('contre et faute', () => {
  it('un grand bon contreur contre plus souvent, surtout quand il touche le ballon en plein', () => {
    const shooter = athlete({}, 190, 92);
    const big = athlete({ block: 85, vertical: 70 }, 213, 115);
    const small = athlete({ block: 45 }, 188, 90);
    expect(blockProbability({ blocker: big, shooter, contact: 1 })).toBeGreaterThan(
      blockProbability({ blocker: small, shooter, contact: 1 }),
    );
    expect(blockProbability({ blocker: big, shooter, contact: 0 })).toBeLessThan(
      blockProbability({ blocker: big, shooter, contact: 1 }),
    );
  });

  it('un contact plus franc ou plus rapide est plus souvent sifflé', () => {
    const p = athlete();
    const soft = foulProbability({ defender: p, shooter: p, overlap: 0, approachSpeed: 0 });
    const hard = foulProbability({ defender: p, shooter: p, overlap: 0.2, approachSpeed: 4 });
    expect(hard).toBeGreaterThan(soft);
  });
});

describe('physique des joueurs', () => {
  const guard = athlete({ speed: 82, vertical: 74, strength: 55 }, 186, 88);
  const heavyCenter = athlete({ speed: 55, vertical: 60, strength: 84 }, 212, 125);

  it('un pivot lourd court moins vite et saute moins haut qu’un meneur', () => {
    expect(runSpeed(heavyCenter)).toBeLessThan(runSpeed(guard));
    expect(jumpHeight(heavyCenter)).toBeLessThan(jumpHeight(guard));
  });

  it('la détente fait monter le saut, la taille la main', () => {
    expect(jumpHeight(athlete({ vertical: 90 }))).toBeGreaterThan(jumpHeight(athlete({ vertical: 50 })));
    expect(reach(heavyCenter)).toBeGreaterThan(reach(guard));
  });

  it('reste dans des ordres de grandeur crédibles', () => {
    for (const p of [guard, heavyCenter, athlete()]) {
      expect(runSpeed(p)).toBeGreaterThanOrEqual(4.5);
      expect(runSpeed(p)).toBeLessThanOrEqual(8);
      expect(jumpHeight(p)).toBeGreaterThanOrEqual(0.3);
      expect(jumpHeight(p)).toBeLessThanOrEqual(1);
    }
  });
});
