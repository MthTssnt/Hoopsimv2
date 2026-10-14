import { EYE_COLOR_WEIGHTS, HAIR_COLORS, SKIN_TONES } from '../../../assets/palette';
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
  /** Pilosité faciale du rendu 2D (`FACIAL_HAIR_2D`, 0 : aucune). */
  facialHair?: number;
  /** Visage type du rendu 2D (`FACE_TRAITS`), par défaut celui de la forme de tête. */
  face?: number;
  /** Couleur des yeux du rendu 2D (`EYE_COLORS`, 0 : brun). */
  eyeColor?: number;
  /** Bandeau aux couleurs de l'équipe (rendu 2D). */
  headband?: boolean;
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

/**
 * Apparence du rendu 2D (`figure2d.ts`) : mêmes teint, forme de tête et couleur de cheveux de base que
 * `appearanceFor`, plus ce que le rendu 2D ajoute, tiré d'un flux à part (l'apparence de l'ancien
 * rendu ne change pas) :
 * - coiffure parmi les 13 du rendu 2D (`HAIRS_2D`), selon le teint ;
 * - châtain à la place d'une partie des bruns ;
 * - visage type, couleur des yeux (surtout brun foncé et noisette, plus rarement bleu, vert, gris),
 *   pilosité faciale (plus fréquente avec l'âge), bandeau.
 */
export function appearance2DFor(player: AppearanceSource): Appearance {
  const base = appearanceFor(player);
  const rng = new Rng(hashSeed(`${player.id}|apparence2d`));
  // Coiffures 2D : ebouriffe, pics, chignon, queue, mi-longs, longs, afro, dreadlocks, tresses,
  // degrade, rase, chauve, crete.
  const hairWeights = base.skin >= 2 ? [5, 4, 2, 1, 1, 1, 10, 8, 8, 12, 10, 5, 3] : [12, 10, 4, 4, 7, 4, 2, 2, 1, 9, 8, 4, 3];
  const darkSkin = base.skin >= 2;
  const eyeWeights = darkSkin ? EYE_COLOR_WEIGHTS.map((w, i) => (i <= 1 ? w : w * 0.25)) : EYE_COLOR_WEIGHTS;
  const age = player.age ?? 25;
  const facialWeights = [10, age >= 28 ? 3 : 1.5, 2, 1, age >= 24 ? 3 : 1.5];
  return {
    ...base,
    hair: rng.weightedIndex(hairWeights),
    hairColor: base.hairColor === 1 && rng.chance(0.4) ? 5 : base.hairColor,
    face: rng.int(0, 5),
    eyeColor: rng.weightedIndex([...eyeWeights]),
    facialHair: rng.weightedIndex(facialWeights),
    headband: rng.chance(0.12),
  };
}

/** Ce qui distingue deux joueurs à l'œil (hors numéro de maillot). */
export function appearanceSignature(a: Appearance): string {
  return [a.heightClass, a.heavy ? 'lourd' : 'léger', a.skin, a.head, a.hair, a.hairColor].join('/');
}
