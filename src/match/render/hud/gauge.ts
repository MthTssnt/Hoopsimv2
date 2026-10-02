import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import type { TimingGrade } from '../../../engine/shot';

/** Jauge de tir : barre verticale à côté du tireur (valeurs provisoires, réglables à l'œil). */
export const GAUGE = {
  /** Intérieur de la barre (px), sans le contour. */
  width: 4,
  height: 20,
  /** La barre couvre `span` × la durée de la jauge : le sommet du saut tombe à ~70 % de la hauteur. */
  span: 1.4,
  /** La jauge reste affichée après le lâcher (ms). */
  lingerMs: 600,
} as const;

/** Ce que montre la jauge, en fractions de la hauteur de la barre (0 = bas, 1 = haut). */
export interface GaugeView {
  fill: number;
  /** Zone verte autour du sommet du saut. */
  greenFrom: number;
  greenTo: number;
  apex: number;
}

const fraction = (t: number, gaugeTime: number) => Math.min(1, Math.max(0, t / (GAUGE.span * gaugeTime)));

/**
 * Jauge après `elapsed` secondes en l'air : elle se remplit pendant la montée ; la zone verte
 * (demi-largeur `window`, voir `greenWindow`) est centrée sur le sommet du saut (`gaugeTime`).
 */
export function gaugeView(elapsed: number, gaugeTime: number, window: number): GaugeView {
  return {
    fill: fraction(elapsed, gaugeTime),
    greenFrom: fraction(gaugeTime - window, gaugeTime),
    greenTo: fraction(gaugeTime + window, gaugeTime),
    apex: fraction(gaugeTime, gaugeTime),
  };
}

/** Rangée de la barre (0 = rangée du bas) qui correspond à une fraction de sa hauteur. */
export function gaugeRow(value: number): number {
  return Math.min(GAUGE.height - 1, Math.floor(value * GAUGE.height));
}

/**
 * Dessine la jauge, coin haut-gauche du contour en (x, y) : fond sombre, zone verte sur toute
 * la largeur, remplissage clair au centre (la zone verte reste visible sur les bords), trait
 * jaune au lâcher.
 */
export function drawGauge(g: Phaser.GameObjects.Graphics, x: number, y: number, view: GaugeView, release: number | null): void {
  const { width: W, height: H } = GAUGE;
  const bottom = y + H; // dernière rangée de l'intérieur
  g.fillStyle(PALETTE.outline).fillRect(x, y, W + 2, H + 2);
  g.fillStyle(PALETTE.navy).fillRect(x + 1, y + 1, W, H);
  const from = gaugeRow(view.greenFrom);
  const to = gaugeRow(view.greenTo);
  g.fillStyle(PALETTE.green).fillRect(x + 1, bottom - to, W, to - from + 1);
  const filled = Math.round(view.fill * H);
  if (filled > 0) g.fillStyle(PALETTE.chalk).fillRect(x + 2, bottom - filled + 1, W - 2, filled);
  if (release !== null) g.fillStyle(PALETTE.yellow).fillRect(x, bottom - gaugeRow(release), W + 2, 1);
}

/** Annonce au lâcher : texte et couleur selon la note du timing. */
export const GRADE_TAGS: Readonly<Record<TimingGrade, { text: string; color: number }>> = {
  perfect: { text: 'PARFAIT', color: PALETTE.yellow },
  green: { text: 'BON', color: PALETTE.green },
  early: { text: 'TÔT', color: PALETTE.silver },
  late: { text: 'TARD', color: PALETTE.silver },
};
