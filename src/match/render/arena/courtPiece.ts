import type Phaser from 'phaser';
import { HAIR_COLORS, PALETTE, SKIN_TONES } from '../../../assets/palette';
import { PHOTOGRAPHER, SPECTATORS } from '../../../assets/sprites/arena';
import { hashSeed, Rng } from '../../../engine/rng';
import { CIRCLE_RADIUS, threePointLine, type Court } from '../../physics/court';
import { fillEllipse, fillPolygon, pixelLine, pixelPolyline, type Point } from '../pixelDraw';
import { drawText, GLYPH_H, textWidth } from '../pixelFont';
import type { ArtProjection } from './artProjection';
import { colorDistance, drawGrid, type TeamLook } from './draw';

/** Marges visibles autour des lignes (m) : bande du fond et bande derrière la ligne de fond. */
export const APRON = { far: 1.2, baseline: 1.1 } as const;

/** Spectateur tiré au sort : peau, cheveux, vêtement (souvent aux couleurs de l'équipe à domicile). */
function spectatorColors(rng: Rng, home: TeamLook): (char: string) => number | null {
  const skin = SKIN_TONES[rng.int(0, SKIN_TONES.length - 1)];
  const hair = HAIR_COLORS[rng.int(0, HAIR_COLORS.length - 1)];
  const shirt = rng.pick([home.primary[1], home.primary[1], home.primary[0], home.secondary[1], PALETTE.chalk, PALETTE.red, PALETTE.blue, PALETTE.green, PALETTE.yellow]);
  const map: Record<string, number> = { '1': skin[0], '2': skin[1], '3': skin[2], h: hair[0], H: hair[1], n: PALETTE.outline, P: shirt, S: home.secondary[1] };
  return (char) => map[char] ?? null;
}

/** Rangées de public lisibles dans un rectangle (vu de face). */
function drawCrowd(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, home: TeamLook, rng: Rng): void {
  const rowH = 15;
  for (let y = y1 - rowH, row = 0; y > y0 - rowH; y -= rowH, row++) {
    g.fillStyle(row % 2 ? PALETTE.seatDark : PALETTE.seat).fillRect(x0, Math.max(y0, y), x1 - x0, rowH);
    g.fillStyle(PALETTE.seatDark).fillRect(x0, y + rowH - 2, x1 - x0, 1);
    for (let x = x0 + 2 + (row % 2) * 6; x < x1 - 10; x += 12) {
      if (!rng.chance(0.85)) continue;
      const top = y + 2;
      if (top < y0 - 2) continue;
      drawGrid(g, SPECTATORS[rng.int(0, SPECTATORS.length - 1)], x, top, spectatorColors(rng, home));
    }
  }
}

/**
 * Bout de terrain pour la scène `?style` : tribunes, bande du fond au nom de l'équipe à
 * domicile, parquet, raquette, rond central, lignes, bande derrière la ligne de fond (nom et
 * photographes) et public sur le côté. Dessiné une fois, puis converti en texture.
 */
export function createCourtPiece(scene: Phaser.Scene, key: string, proj: ArtProjection, court: Court, home: TeamLook, view: { width: number; height: number }): void {
  const g = scene.add.graphics();
  const rng = new Rng(hashSeed(`public-${home.abbr}`));
  const { length: L, width: W } = court;
  const P = (x: number, y: number, z = 0) => proj.project(x, y, z);
  const farApronTop = Math.round(P(0, -APRON.far).y);
  const farLine = Math.round(P(0, 0).y);
  const baseline = Math.round(P(L, 0).x);
  const apronRight = Math.round(P(L + APRON.baseline, 0).x);

  // Fond, tribunes du fond et public sur le côté.
  g.fillStyle(PALETTE.navy).fillRect(0, 0, view.width, view.height);
  drawCrowd(g, 0, 0, view.width, farApronTop - 2, home, rng);
  drawCrowd(g, apronRight + 2, farApronTop, view.width, view.height, home, rng);
  g.fillStyle(home.secondary[1]).fillRect(0, farApronTop - 2, view.width, 1).fillRect(apronRight + 1, farApronTop - 2, 1, view.height);
  g.fillStyle(home.primary[2]).fillRect(0, farApronTop - 1, apronRight + 1, 1);

  // Bandes aux couleurs de l'équipe à domicile.
  g.fillStyle(home.primary[1]).fillRect(0, farApronTop, apronRight, farLine - farApronTop);
  g.fillRect(baseline, farApronTop, apronRight - baseline, view.height - farApronTop);
  const banner = `${home.city} ${home.name}`;
  g.fillStyle(home.secondary[0]);
  const bannerY = Math.round((farApronTop + farLine - GLYPH_H * 2) / 2);
  // Le nom part après le tableau de score, et se répète tant qu'il y a de la place.
  for (let x = 196; x + textWidth(banner, 2) < baseline - 12; x += textWidth(banner, 2) + 60) drawText(g, banner, x, bannerY, 2);

  // Parquet en lattes.
  const floorBottom = Math.min(view.height, Math.round(P(0, W).y));
  const plank = 5;
  for (let y = farLine, row = 0; y < floorBottom; y += plank, row++) {
    g.fillStyle(row % 2 ? PALETTE.wood : PALETTE.woodLight).fillRect(0, y, baseline, Math.min(plank, floorBottom - y));
    g.fillStyle(PALETTE.woodDark);
    for (let x = rng.int(0, 40); x < baseline; x += rng.int(26, 60)) g.fillRect(x, y, 1, Math.min(plank, floorBottom - y));
  }

  // Raquette et rond central aux couleurs de l'équipe (ton sombre si trop proche du bois).
  const paint = colorDistance(home.primary[1], PALETTE.wood) < 90 ? home.primary[2] : home.primary[1];
  const hoop = court.hoops.right;
  const ft = hoop.baselineX - court.paintLength;
  const box = (x0: number, y0: number, x1: number, y1: number): Point[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
  g.fillStyle(paint);
  fillPolygon(g, box(ft, hoop.rim.y - court.paintWidth / 2, L, hoop.rim.y + court.paintWidth / 2));
  const center = P(L / 2, W / 2);
  const disc = (r: number, color: number) => {
    g.fillStyle(color);
    fillEllipse(g, center.x, center.y, r * proj.ppm, r * proj.depthPx);
  };
  disc(CIRCLE_RADIUS, paint);
  disc(CIRCLE_RADIUS * 0.8, home.secondary[1]);
  disc(CIRCLE_RADIUS * 0.7, paint);
  g.fillStyle(home.secondary[0]);
  drawText(g, home.abbr, Math.round(center.x - textWidth(home.abbr, 2) / 2), Math.round(center.y - GLYPH_H), 2);

  // Lignes.
  g.fillStyle(PALETTE.chalk);
  pixelLine(g, P(0, 0), P(L, 0));
  pixelLine(g, P(L, 0), P(L, W));
  pixelLine(g, P(L / 2, 0), P(L / 2, W));
  pixelPolyline(g, [...box(ft, hoop.rim.y - court.paintWidth / 2, L, hoop.rim.y + court.paintWidth / 2), P(ft, hoop.rim.y - court.paintWidth / 2)]);
  const circle = (cx: number, cy: number, r: number) => {
    const pts: Point[] = [];
    for (let i = 0; i <= 64; i++) pts.push(P(cx + Math.cos((i / 64) * Math.PI * 2) * r, cy + Math.sin((i / 64) * Math.PI * 2) * r));
    pixelPolyline(g, pts);
  };
  circle(L / 2, W / 2, CIRCLE_RADIUS);
  circle(ft, hoop.rim.y, CIRCLE_RADIUS);
  pixelPolyline(g, threePointLine(court, hoop).map((p) => P(p.x, p.y)));

  // Photographes accroupis derrière la ligne de fond, tournés vers le terrain.
  const pressColors = (char: string): number | null =>
    ({ '1': SKIN_TONES[1][0], '2': SKIN_TONES[1][1], '3': SKIN_TONES[1][2], h: HAIR_COLORS[1][0], H: HAIR_COLORS[1][1], k: PALETTE.ink, w: PALETTE.chalk, g: PALETTE.silver, G: PALETTE.slate })[char] ?? null;
  for (const depth of [2.8, 11.6]) {
    const p = P(L + APRON.baseline / 2, depth);
    drawGrid(g, PHOTOGRAPHER, Math.round(p.x) - 9, Math.round(p.y) - 17, pressColors, { flip: true });
  }

  g.generateTexture(key, view.width, view.height);
  g.destroy();
}
