import { HAIR_COLORS, SKIN_TONES } from '../../../assets/palette';
import { HAIRS, HEADS } from '../../../assets/sprites/heads';
import { hashSeed, Rng } from '../../../engine/rng';

/** Apparence d'un joueur : déterministe, tirée de son identifiant et de son physique. */
export interface Appearance {
  heightCm: number;
  heavy: boolean;
  heightClass: 'petit' | 'moyen' | 'grand';
  skin: number;
  head: number;
  hair: number;
  hairColor: number;
  number: number;
}

export interface AppearanceSource {
  id: string;
  heightCm: number;
  weightKg: number;
  number: number;
  age?: number;
}

/** Corpulence « lourde » : nettement au-dessus du poids attendu pour la taille. */
export function isHeavy(heightCm: number, weightKg: number): boolean {
  return weightKg - ((heightCm - 100) * 1.02 + 8) >= 3;
}

export function heightClass(heightCm: number): Appearance['heightClass'] {
  return heightCm < 193 ? 'petit' : heightCm <= 205 ? 'moyen' : 'grand';
}

/** Cheveux plus souvent foncés sur les peaux foncées ; gris possible chez les vétérans. */
function pickHairColor(rng: Rng, skin: number, age: number | undefined): number {
  if (age !== undefined && age >= 34 && rng.chance(0.4)) return 4;
  const weights = skin >= 2 ? [0.68, 0.27, 0.03, 0.02] : [0.3, 0.35, 0.2, 0.15];
  return rng.weightedIndex(weights);
}

export function appearanceFor(player: AppearanceSource): Appearance {
  const rng = new Rng(hashSeed(`${player.id}|apparence`));
  const skin = rng.int(0, SKIN_TONES.length - 1);
  return {
    heightCm: player.heightCm,
    heavy: isHeavy(player.heightCm, player.weightKg),
    heightClass: heightClass(player.heightCm),
    skin,
    head: rng.int(0, HEADS.length - 1),
    hair: rng.int(0, HAIRS.length - 1),
    hairColor: Math.min(HAIR_COLORS.length - 1, pickHairColor(rng, skin, player.age)),
    number: player.number,
  };
}

/** Ce qui distingue deux joueurs à l'œil (hors numéro de maillot). */
export function appearanceSignature(a: Appearance): string {
  return [a.heightClass, a.heavy ? 'lourd' : 'léger', a.skin, a.head, a.hair, a.hairColor].join('/');
}
