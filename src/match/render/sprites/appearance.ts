import { generateAppearance, type PlayerAppearance } from '../../../assets/characters/appearance';
import { EYE_COLOR_IDS, HAIR_COLOR_IDS, SKIN_IDS, type HairColorId } from '../../../assets/characters/colors';
import { partIds } from '../../../assets/characters/registry';
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
  /**
   * Personnage du rendu 2D (style 5) : pièces et couleurs (`src/assets/characters/`). Absent :
   * déduit des champs ci-dessus (`characterOf`).
   */
  character?: PlayerAppearance;
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
 * Apparence du rendu 2D (`figure2d.ts`) : mêmes teint et couleur de cheveux de base que
 * `appearanceFor` (le portrait du HUD reste cohérent), plus le personnage complet, tiré de
 * l'identifiant du joueur par `generateAppearance`.
 */
export function appearance2DFor(player: AppearanceSource): Appearance {
  const base = appearanceFor(player);
  return { ...base, character: generateAppearance({ id: player.id, age: player.age, skin: base.skin, hairColor: base.hairColor }) };
}

const LEGACY_HAIR_COLORS: readonly HairColorId[] = ['noir', 'brun', 'blond', 'roux', 'gris', 'chatain'];

/**
 * Personnage d'une apparence : le sien, sinon déduit des champs de l'ancien rendu (forme de
 * tête, coiffure, teint, couleur de cheveux), avec le premier visage de chaque catégorie.
 */
export function characterOf(look: Appearance): PlayerAppearance {
  if (look.character) return look.character;
  const shapes = partIds('headShapes');
  const hairs = partIds('hair');
  const hair = LEGACY_HAIR_COLORS[look.hairColor] ?? HAIR_COLOR_IDS[0];
  return {
    version: 1,
    headShape: shapes[look.head % shapes.length],
    skin: SKIN_IDS[look.skin] ?? SKIN_IDS[0],
    ears: partIds('ears')[0],
    eyes: partIds('eyes')[0],
    brows: partIds('brows')[0],
    nose: partIds('noses')[0],
    mouth: partIds('mouths')[0],
    facialHair: null,
    hair: hairs[look.hair % hairs.length],
    colors: { hair, facialHair: hair, eyes: EYE_COLOR_IDS[0], accessory: 'equipe' },
    accessories: [],
  };
}

/** Ce qui distingue deux joueurs à l'œil (hors numéro de maillot). */
export function appearanceSignature(a: Appearance): string {
  const c = a.character;
  const head = c ? [c.headShape, c.skin, c.eyes, c.brows, c.nose, c.mouth, c.ears, c.facialHair ?? '-', c.hair, c.colors.hair, c.colors.facialHair, c.colors.eyes, ...c.accessories] : [a.skin, a.head, a.hair, a.hairColor];
  return [a.heightClass, a.heavy ? 'lourd' : 'léger', ...head].join('/');
}
