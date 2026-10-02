/**
 * Palette maîtresse de HoopSim : 32 couleurs fixes, propres au jeu (voir docs/ART_DIRECTION.md).
 * Tout sprite dessiné en code n'utilise que ces couleurs, plus les deux rampes d'équipe
 * (primaire et secondaire, 3 tons chacune) calculées à partir de `teamsData.ts`.
 * Les ombres au sol sont du noir en transparence, pas une couleur de la palette.
 */
export const PALETTE = {
  // Contour et neutres
  outline: 0x1a1424,
  ink: 0x2e2a3a,
  slate: 0x5a5868,
  silver: 0x9a98a6,
  mist: 0xd4d2dc,
  chalk: 0xf6f2ea,
  // Rampe de peau : chaque teinte prend 3 tons consécutifs (clair, base, ombre) → 4 teintes
  skin0: 0xffe0c2,
  skin1: 0xf0bf94,
  skin2: 0xd1945f,
  skin3: 0xa8693d,
  skin4: 0x7a4627,
  skin5: 0x4e2b19,
  // Cheveux
  hairBlack: 0x241a1a,
  hairBrown: 0x5c3a22,
  hairBlond: 0xd9b25e,
  // Parquet
  woodLight: 0xe8b97a,
  wood: 0xd39a5a,
  woodDark: 0xa86d3a,
  // Ballon et cercle
  orange: 0xf07a2a,
  orangeDark: 0xb4471c,
  // Arène
  seatDark: 0x1f2340,
  seat: 0x2c3260,
  // Vitre de la planche
  glass: 0xbfe3ec,
  // Accents (public, HUD)
  red: 0xd8423a,
  yellow: 0xf4c542,
  green: 0x3fa36b,
  blue: 0x3f6fd8,
  // Réserve
  auburn: 0x9a3e22,
  teal: 0x2aa6a0,
  purple: 0x7a4fb8,
  pink: 0xe88aa8,
  navy: 0x18203a,
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Teintes de peau : indices de départ dans la rampe (clair, base, ombre). */
export const SKIN_TONES: [number, number, number][] = [
  [PALETTE.skin0, PALETTE.skin1, PALETTE.skin2],
  [PALETTE.skin1, PALETTE.skin2, PALETTE.skin3],
  [PALETTE.skin2, PALETTE.skin3, PALETTE.skin4],
  [PALETTE.skin3, PALETTE.skin4, PALETTE.skin5],
];

/** Couleurs de cheveux : base et ombre. */
export const HAIR_COLORS: [number, number][] = [
  [PALETTE.hairBlack, PALETTE.outline],
  [PALETTE.hairBrown, PALETTE.hairBlack],
  [PALETTE.hairBlond, PALETTE.hairBrown],
  [PALETTE.auburn, PALETTE.hairBrown],
  [PALETTE.silver, PALETTE.slate],
];

/** Rampe d'équipe : clair, base, sombre. */
export type TeamRamp = [number, number, number];

/** Assombrit (k < 1) ou éclaircit (k > 1) une couleur 0xRRGGBB. */
export function shadeColor(color: number, k: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (c((color >> 16) & 0xff) << 16) | (c((color >> 8) & 0xff) << 8) | c(color & 0xff);
}

/** Mélange deux couleurs (t = 0 → a, t = 1 → b). */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Rampe de 3 tons à partir d'une couleur d'équipe (`#rrggbb` ou nombre). */
export function teamRamp(color: string | number): TeamRamp {
  const base = typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
  // Ton clair : mélange vers le blanc (lisible même pour une couleur presque noire).
  return [mixColor(base, 0xffffff, 0.3), base, shadeColor(base, 0.65)];
}
