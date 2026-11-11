import { hashSeed, Rng } from '../../../engine/rng';

/** Identité visuelle officielle, indépendante des notes et des résultats de simulation. */
export interface Appearance {
  heightCm: number;
  heavy: boolean;
  number: number;
  variant: number;
  dominantHand: 'droite' | 'gauche';
}
export interface AppearanceSource { id: string; heightCm: number; weightKg: number; number: number }
export const isHeavy = (heightCm: number, weightKg: number): boolean => weightKg - ((heightCm - 100) * 1.02 + 8) >= 3;

export function appearanceFor(player: AppearanceSource, variant?: number): Appearance {
  const rng = new Rng(hashSeed(`${player.id}|design-officiel`));
  const drawn = rng.int(0, 4);
  return { heightCm: player.heightCm, heavy: isHeavy(player.heightCm, player.weightKg), number: player.number,
    variant: variant ?? drawn, dominantHand: rng.chance(0.12) ? 'gauche' : 'droite' };
}
