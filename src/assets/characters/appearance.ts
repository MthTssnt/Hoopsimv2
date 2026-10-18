/**
 * Apparence d'un personnage : une donnée sérialisable (JSON), une pièce par catégorie et ses
 * couleurs. Elle est tirée de façon déterministe de l'identifiant du joueur, et pourra être
 * modifiée à la main (éditeur de personnage) : `normalizeAppearance` remet d'aplomb une donnée
 * lue d'une sauvegarde ou de l'éditeur (pièce inconnue → pièce tirée pour ce joueur).
 */
import { hashSeed, Rng } from '../../engine/rng';
import { ACCESSORY_COLOR_IDS, EYE_COLOR_IDS, HAIR_COLOR_IDS, SKIN_IDS, type AccessoryColorId, type EyeColorId, type HairColorId, type SkinId } from './colors';
import { hasPart, REGISTRY, type Entry } from './registry';

export interface PlayerAppearance {
  version: 1;
  headShape: string;
  skin: SkinId;
  ears: string;
  eyes: string;
  brows: string;
  nose: string;
  mouth: string;
  /** Pilosité faciale, ou null (rasé). */
  facialHair: string | null;
  hair: string;
  colors: {
    hair: HairColorId;
    /** Rampe à part des cheveux (barbe grise sur cheveux bruns). */
    facialHair: HairColorId;
    eyes: EyeColorId;
    accessory: AccessoryColorId;
  };
  accessories: string[];
}

/** Ce que le tirage reçoit du joueur. `skin` et `hairColor` : indices déjà tirés ailleurs (portrait du HUD). */
export interface AppearanceSeed {
  id: string;
  age?: number;
  /** Indice de teint (`SKIN_IDS`), sinon tiré ici. */
  skin?: number;
  /** Indice de couleur de cheveux dans l'ordre noir, brun, blond, roux, gris, sinon tiré ici. */
  hairColor?: number;
}

const LEGACY_HAIR_COLORS: readonly HairColorId[] = ['noir', 'brun', 'blond', 'roux', 'gris'];

/** Fréquence des coiffures selon le teint (une coiffure absente de ces tables pèse 1). */
const HAIR_WEIGHTS: Record<'clair' | 'fonce', Record<string, number>> = {
  fonce: { ebouriffe: 5, pics: 4, chignon: 2, queue: 1, 'mi-longs': 1, longs: 1, afro: 10, dreadlocks: 8, tresses: 8, degrade: 12, rase: 10, chauve: 5, crete: 3 },
  clair: { ebouriffe: 12, pics: 10, chignon: 4, queue: 4, 'mi-longs': 7, longs: 4, afro: 2, dreadlocks: 2, tresses: 1, degrade: 9, rase: 8, chauve: 4, crete: 3 },
};

function pick<T extends { id: string }>(rng: Rng, list: readonly Entry<T>[], weight?: (part: T) => number | undefined): string {
  return list[rng.weightedIndex(list.map((e) => weight?.(e.part) ?? e.weight ?? 1))].part.id;
}

/** Tire l'apparence d'un joueur, de façon déterministe (même identifiant, même apparence). */
export function generateAppearance(seed: AppearanceSeed): PlayerAppearance {
  const rng = new Rng(hashSeed(`${seed.id}|personnage`));
  const skinIndex = seed.skin ?? rng.int(0, SKIN_IDS.length - 1);
  const skin = SKIN_IDS[Math.max(0, Math.min(SKIN_IDS.length - 1, skinIndex))];
  const dark = skinIndex >= 2;
  const age = seed.age ?? 25;
  // Couleur de cheveux : celle déjà tirée (portrait du HUD), sinon plus souvent foncée sur peau foncée, grise chez les vétérans.
  let hairColor: HairColorId =
    seed.hairColor !== undefined
      ? (LEGACY_HAIR_COLORS[seed.hairColor] ?? 'noir')
      : age >= 34 && rng.chance(0.4)
        ? 'gris'
        : LEGACY_HAIR_COLORS[rng.weightedIndex(dark ? [0.68, 0.27, 0.03, 0.02] : [0.3, 0.35, 0.2, 0.15])];
  if (hairColor === 'brun' && rng.chance(0.4)) hairColor = 'chatain';
  const hairWeights = HAIR_WEIGHTS[dark ? 'fonce' : 'clair'];
  const hair = pick(rng, REGISTRY.hair, (p) => hairWeights[p.id]);
  const facialHair = rng.chance(age >= 28 ? 0.45 : 0.3) ? pick(rng, REGISTRY.facialHair, (p) => (p.id === 'barbe' && age >= 28 ? 4 : undefined)) : null;
  // Pilosité : la couleur des cheveux, sinon grisonnante avec l'âge, parfois un ton à côté.
  const facialColor: HairColorId = hairColor === 'gris' || (age >= 31 && rng.chance(0.35)) ? 'gris' : hairColor === 'blond' && rng.chance(0.4) ? 'chatain' : hairColor;
  const eyeWeights = [0.55, 0.25, 0.08, 0.07, 0.05].map((w, i) => (dark && i >= 2 ? w * 0.25 : w));
  const accessories = rng.chance(0.12) ? [pick(rng, REGISTRY.accessories)] : [];
  return {
    version: 1,
    headShape: pick(rng, REGISTRY.headShapes),
    skin,
    ears: pick(rng, REGISTRY.ears),
    eyes: pick(rng, REGISTRY.eyes),
    brows: pick(rng, REGISTRY.brows),
    nose: pick(rng, REGISTRY.noses),
    mouth: pick(rng, REGISTRY.mouths),
    facialHair,
    hair,
    colors: {
      hair: hairColor,
      facialHair: facialColor,
      eyes: EYE_COLOR_IDS[rng.weightedIndex(eyeWeights)],
      accessory: ACCESSORY_COLOR_IDS[rng.weightedIndex([0.6, 0.25, 0.1, 0.05])],
    },
    accessories,
  };
}

const oneOf = <T extends string>(ids: readonly T[], value: unknown, fallback: T): T => (ids.includes(value as T) ? (value as T) : fallback);

/**
 * Apparence valide à partir d'une donnée quelconque (sauvegarde, éditeur) : chaque champ inconnu
 * ou mal formé est remplacé par celui du tirage de `seed`.
 */
export function normalizeAppearance(data: unknown, seed: AppearanceSeed): PlayerAppearance {
  const base = generateAppearance(seed);
  if (!data || typeof data !== 'object') return base;
  const d = data as Record<string, unknown>;
  const c = (d.colors && typeof d.colors === 'object' ? d.colors : {}) as Record<string, unknown>;
  const part = (category: Parameters<typeof hasPart>[0], value: unknown, fallback: string) => (typeof value === 'string' && hasPart(category, value) ? value : fallback);
  return {
    version: 1,
    headShape: part('headShapes', d.headShape, base.headShape),
    skin: oneOf(SKIN_IDS, d.skin, base.skin),
    ears: part('ears', d.ears, base.ears),
    eyes: part('eyes', d.eyes, base.eyes),
    brows: part('brows', d.brows, base.brows),
    nose: part('noses', d.nose, base.nose),
    mouth: part('mouths', d.mouth, base.mouth),
    facialHair: d.facialHair === null ? null : typeof d.facialHair === 'string' && hasPart('facialHair', d.facialHair) ? d.facialHair : base.facialHair,
    hair: part('hair', d.hair, base.hair),
    colors: {
      hair: oneOf(HAIR_COLOR_IDS, c.hair, base.colors.hair),
      facialHair: oneOf(HAIR_COLOR_IDS, c.facialHair, base.colors.facialHair),
      eyes: oneOf(EYE_COLOR_IDS, c.eyes, base.colors.eyes),
      accessory: oneOf(ACCESSORY_COLOR_IDS, c.accessory, base.colors.accessory),
    },
    accessories: Array.isArray(d.accessories) ? d.accessories.filter((a): a is string => typeof a === 'string' && hasPart('accessories', a)) : base.accessories,
  };
}
