/**
 * Couleurs du rendu 2D en style 5 (« rétro peint ») : chaque matière a sa rampe de 5 tons
 * (`paintedRamp` : reflet chaud, clair, base, ombre violette, ombre profonde), posée sur ses
 * emplacements de couleur. La peau, les cheveux, la pilosité, les yeux et l'accessoire viennent du
 * personnage (`PlayerAppearance`) ; le maillot et la couleur secondaire, de l'équipe.
 *
 *   peau 1 5 2 3 4 (+ 0 brillance) · cheveux r h H D E · pilosité f b B F · yeux i
 *   maillot a p P q Q · secondaire v s S t T · chaussette et semelle x w w y Y
 *   chaussure z Z G j J · accessoire c C d K
 */
import { ACCESSORY_COLORS, EYE_COLOR_TONES, HAIR_COLOR_RAMPS, luma, paintedRamp, SKINS } from '../../../assets/characters/colors';
import { mixColor, PALETTE, type Ramp5, type TeamRamp } from '../../../assets/palette';
import { characterOf, type Appearance } from './appearance';
import type { Slot } from './canvas';
import type { SlotColors } from './compose';

/**
 * Pilosité : 4 tons consécutifs de sa rampe, choisis pour trancher sur la peau (une barbe noire
 * sur une peau foncée reste sombre, mais d'un ton qui se lit).
 */
function facialTones(ramp: Ramp5, skin: number): readonly [number, number, number, number] {
  const s = luma(skin);
  const contrast = (k: number) => Math.abs(luma(ramp[k]) - s);
  const tones = (k: number) => [ramp[Math.max(0, k - 1)], ramp[k], ramp[Math.min(4, k + 1)], ramp[Math.min(4, k + 2)]] as const;
  for (const k of [1, 2, 0, 3]) if (contrast(k) >= 0.2 && contrast(Math.min(4, k + 1)) >= 0.12) return tones(k);
  // Aucun ton ne tranche assez : celui qui tranche le plus.
  return tones([0, 1, 2, 3].reduce((best, k) => (contrast(k) > contrast(best) ? k : best), 1));
}

const paint = (slots: readonly Slot[], ramp: readonly number[], out: Partial<Record<Slot, number>>) => slots.forEach((slot, i) => (out[slot] = ramp[i]));

export function colorsPainted(look: Appearance, primary: TeamRamp, secondary: TeamRamp): SlotColors {
  const ch = characterOf(look);
  const skin = SKINS[ch.skin];
  const sr = paintedRamp(skin[0], skin[1], skin[2]);
  const h = HAIR_COLOR_RAMPS[ch.colors.hair];
  const f = HAIR_COLOR_RAMPS[ch.colors.facialHair];
  const acc = ACCESSORY_COLORS[ch.colors.accessory] ?? secondary;
  const painted: Partial<Record<Slot, number>> = { '0': mixColor(sr[0], 0xffffff, 0.35), i: EYE_COLOR_TONES[ch.colors.eyes], n: PALETTE.outline };
  paint(['1', '5', '2', '3', '4'], sr, painted);
  paint(['r', 'h', 'H', 'D', 'E'], paintedRamp(h[1], h[2], h[3]), painted);
  paint(['f', 'b', 'B', 'F'], facialTones(paintedRamp(f[1], f[2], f[3]), sr[1]), painted);
  paint(['a', 'p', 'P', 'q', 'Q'], paintedRamp(primary[0], primary[1], primary[2]), painted);
  paint(['v', 's', 'S', 't', 'T'], paintedRamp(secondary[0], secondary[1], secondary[2]), painted);
  const sock = paintedRamp(PALETTE.chalk, PALETTE.chalk, PALETTE.mist);
  paint(['x', 'w', 'w', 'y', 'Y'], sock, painted);
  painted.w = PALETTE.chalk;
  paint(['z', 'Z', 'G', 'j', 'J'], paintedRamp(PALETTE.mist, PALETTE.slate, PALETTE.ink), painted);
  // Accessoire : reflet et clair sur le dessus (comme le bandeau de la planche), ombre et contour.
  const ar = paintedRamp(acc[0], acc[1], acc[2]);
  paint(['c', 'C', 'd', 'K'], [ar[0], ar[1], ar[3], ar[4]], painted);
  return { skin, hair: [h[1], h[2], h[3]], primary, secondary, painted };
}
