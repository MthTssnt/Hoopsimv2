import { describe, expect, it } from 'vitest';
import { appearanceFor, isHeavy } from './appearance';

describe('apparences officielles', () => {
  it('garde la taille et le numéro réels, la corpulence et la main forte déterministe', () => {
    const player = { id: 'match-23', heightCm: 211, weightKg: 127, number: 23 };
    const look = appearanceFor(player);
    expect(look).toEqual(appearanceFor({ ...player }));
    expect(look).toMatchObject({ heightCm: 211, number: 23, heavy: true });
    expect(appearanceFor(player, 4)).toMatchObject({ variant: 4, dominantHand: look.dominantHand });
    expect(isHeavy(186, 77)).toBe(false);
  });

  it('tire les cinq familles et une minorité de gauchers sans dépendre de l’équipe', () => {
    const looks = Array.from({ length: 200 }, (_, i) => appearanceFor({ id: `joueur-${i}`, heightCm: 200, weightKg: 95, number: i % 100 }));
    expect(new Set(looks.map((look) => look.variant)).size).toBe(5);
    const left = looks.filter((look) => look.dominantHand === 'gauche').length;
    expect(left).toBeGreaterThan(5);
    expect(left).toBeLessThan(50);
  });
});
