/**
 * Couleurs des personnages, par emplacement : identifiants stables (sauvegardes, éditeur) et
 * rampes de 5 tons du style 5 (« rétro peint »), calculées à la cuisson.
 *
 * Rampe peinte d'une matière, à partir de 3 tons (clair, base, ombre) :
 *   0 reflet chaud · 1 clair · 2 base · 3 ombre teintée violet · 4 ombre profonde (sert de contour)
 */
import { EYE_COLORS, HAIR_RAMPS, mixColor, PALETTE, shadeColor, SKIN_TONES, type Ramp5 } from '../palette';

/** Luminance perçue (0-1) d'une couleur 0xRRGGBB. */
export function luma(c: number): number {
  return (0.299 * ((c >> 16) & 0xff) + 0.587 * ((c >> 8) & 0xff) + 0.114 * (c & 0xff)) / 255;
}

/**
 * Rampe de 5 tons du style 5 : reflet tiré vers le chaud, ombres tirées vers le bleu-violet.
 * Chaque ton reste plus sombre que le précédent : sur une matière très foncée (cheveux noirs), la
 * teinte violette éclaircirait l'ombre, elle est alors assombrie en gardant sa teinte.
 */
export function paintedRamp(light: number, base: number, shadow: number): Ramp5 {
  const ramp = [mixColor(light, 0xffe6b8, 0.5), mixColor(light, base, 0.35), base, mixColor(shadow, 0x5a4aa0, 0.35), mixColor(shadeColor(shadow, 0.66), 0x34246e, 0.45)];
  for (let i = 3; i < ramp.length; i++) {
    const max = luma(ramp[i - 1]) * 0.85;
    if (luma(ramp[i]) > max && luma(ramp[i]) > 0) ramp[i] = shadeColor(ramp[i], max / luma(ramp[i]));
  }
  return ramp as unknown as Ramp5;
}

/** Teints, du plus clair au plus foncé (mêmes teintes que `SKIN_TONES`). */
export const SKINS = {
  clair: SKIN_TONES[0],
  mat: SKIN_TONES[1],
  brun: SKIN_TONES[2],
  fonce: SKIN_TONES[3],
} as const satisfies Record<string, readonly [number, number, number]>;
export type SkinId = keyof typeof SKINS;
export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

/** Couleurs de cheveux et de pilosité (rampes de 5 tons de `HAIR_RAMPS`). */
export const HAIR_COLOR_RAMPS = {
  noir: HAIR_RAMPS[0],
  brun: HAIR_RAMPS[1],
  chatain: HAIR_RAMPS[5],
  roux: HAIR_RAMPS[3],
  blond: HAIR_RAMPS[2],
  gris: HAIR_RAMPS[4],
} as const satisfies Record<string, Ramp5>;
export type HairColorId = keyof typeof HAIR_COLOR_RAMPS;
export const HAIR_COLOR_IDS = Object.keys(HAIR_COLOR_RAMPS) as HairColorId[];

/** Couleurs des yeux. */
export const EYE_COLOR_TONES = {
  'brun-fonce': EYE_COLORS[0],
  noisette: EYE_COLORS[1],
  bleu: EYE_COLORS[2],
  vert: EYE_COLORS[3],
  gris: EYE_COLORS[4],
} as const satisfies Record<string, number>;
export type EyeColorId = keyof typeof EYE_COLOR_TONES;
export const EYE_COLOR_IDS = Object.keys(EYE_COLOR_TONES) as EyeColorId[];

/** Couleurs des accessoires : « equipe » prend la couleur secondaire de l'équipe à la cuisson. */
export const ACCESSORY_COLORS = {
  equipe: null,
  blanc: [PALETTE.chalk, PALETTE.chalk, PALETTE.mist],
  noir: [PALETTE.slate, PALETTE.ink, PALETTE.outline],
  rouge: [mixColor(PALETTE.red, 0xffffff, 0.3), PALETTE.red, shadeColor(PALETTE.red, 0.65)],
} as const satisfies Record<string, readonly [number, number, number] | null>;
export type AccessoryColorId = keyof typeof ACCESSORY_COLORS;
export const ACCESSORY_COLOR_IDS = Object.keys(ACCESSORY_COLORS) as AccessoryColorId[];
