import type Phaser from 'phaser';
import { HAIR_COLORS, PALETTE, SKIN_TONES } from '../../../assets/palette';
import { PHOTOGRAPHER, SPECTATORS } from '../../../assets/sprites/arena';
import { hashSeed, Rng } from '../../../engine/rng';
import { CIRCLE_RADIUS, threePointLine, type Court, type Hoop } from '../../physics/court';
import { fillEllipse, fillPolygon, pixelLine, pixelPolyline, type Point } from '../pixelDraw';
import { drawText, GLYPH_H, textWidth } from '../pixelFont';
import { artPx } from '../artConfig';
import type { ArtProjection } from './artProjection';
import { colorDistance, drawGrid, type PaintTarget, type TeamLook } from './draw';

/** Bandes visibles autour des lignes (m) : au fond, devant, derrière chaque ligne de fond. */
export interface Apron {
  far: number;
  near: number;
  baseline: number;
}

/** Bandes de la scène `?style` (bout de terrain : seuls le fond et la ligne de fond de droite se voient). */
export const STYLE_APRON: Apron = { far: 1.2, near: 2, baseline: 1.1 };

export interface ArenaOptions {
  /** Taille de la texture (px). */
  size: { width: number; height: number };
  apron: Apron;
  /** Abscisse (px) où commence le nom de l'équipe sur la bande du fond ; par défaut, après la ligne de fond de gauche. */
  bannerFrom?: number;
}

/** Repères de l'arène en pixels (arrondis), dans l'espace de la texture. */
export interface ArenaLayout {
  farApronTop: number;
  farLine: number;
  nearLine: number;
  nearApronBottom: number;
  leftApron: number;
  leftBaseline: number;
  rightBaseline: number;
  rightApron: number;
}

export function arenaLayout(proj: ArtProjection, court: Court, apron: Apron): ArenaLayout {
  const P = (x: number, y: number) => proj.project(x, y, 0);
  const { length: L, width: W } = court;
  return {
    farApronTop: Math.round(P(0, -apron.far).y),
    farLine: Math.round(P(0, 0).y),
    nearLine: Math.round(P(0, W).y),
    nearApronBottom: Math.round(P(0, W + apron.near).y),
    leftApron: Math.round(P(-apron.baseline, 0).x),
    leftBaseline: Math.round(P(0, 0).x),
    rightBaseline: Math.round(P(L, 0).x),
    rightApron: Math.round(P(L + apron.baseline, 0).x),
  };
}

/** Spectateur tiré au sort : peau, cheveux, vêtement (souvent aux couleurs de l'équipe à domicile). */
function spectatorColors(rng: Rng, home: TeamLook): (char: string) => number | null {
  const skin = SKIN_TONES[rng.int(0, SKIN_TONES.length - 1)];
  const hair = HAIR_COLORS[rng.int(0, HAIR_COLORS.length - 1)];
  const shirt = rng.pick([home.primary[1], home.primary[1], home.primary[0], home.secondary[1], PALETTE.chalk, PALETTE.red, PALETTE.blue, PALETTE.green, PALETTE.yellow]);
  const map: Record<string, number> = { '1': skin[0], '2': skin[1], '3': skin[2], h: hair[0], H: hair[1], n: PALETTE.outline, P: shirt, S: home.secondary[1] };
  return (char) => map[char] ?? null;
}

/** Rangées de public lisibles dans un rectangle (vu de face). Rien si le rectangle est vide. */
function drawCrowd(g: PaintTarget, x0: number, y0: number, x1: number, y1: number, home: TeamLook, rng: Rng): void {
  if (x1 <= x0 || y1 <= y0) return;
  const rowH = artPx(15);
  for (let y = y1 - rowH, row = 0; y > y0 - rowH; y -= rowH, row++) {
    g.fillStyle(row % 2 ? PALETTE.seatDark : PALETTE.seat).fillRect(x0, Math.max(y0, y), x1 - x0, rowH);
    g.fillStyle(PALETTE.seatDark).fillRect(x0, y + rowH - 2, x1 - x0, 1);
    for (let x = x0 + 2 + (row % 2) * artPx(6); x < x1 - artPx(10); x += artPx(12)) {
      if (!rng.chance(0.85)) continue;
      const top = y + 2;
      if (top < y0 - 2) continue;
      drawGrid(g, SPECTATORS[rng.int(0, SPECTATORS.length - 1)], x, top, spectatorColors(rng, home));
    }
  }
}

/** Raquette d'un panier : rectangle de la ligne de fond à la ligne des lancers francs. */
function paintBox(court: Court, hoop: Hoop): { x0: number; x1: number; y0: number; y1: number; ft: number } {
  const ft = hoop.baselineX + hoop.toCourt * court.paintLength;
  return {
    x0: Math.min(hoop.baselineX, ft),
    x1: Math.max(hoop.baselineX, ft),
    y0: hoop.rim.y - court.paintWidth / 2,
    y1: hoop.rim.y + court.paintWidth / 2,
    ft,
  };
}

/**
 * Arène du terrain entier, aux couleurs de l'équipe à domicile : tribunes au fond et derrière
 * les deux lignes de fond, bandes (nom de l'équipe au fond), parquet en lattes, deux raquettes,
 * rond central au sigle de l'équipe, lignes du niveau (pro ou college), photographes aux deux
 * lignes de fond. Tout ce qui sort de la texture est ignoré : la scène `?style` n'en montre
 * qu'un bout.
 */
export function drawArena(g: PaintTarget, proj: ArtProjection, court: Court, home: TeamLook, options: ArenaOptions): void {
  const rng = new Rng(hashSeed(`public-${home.abbr}`));
  const { length: L, width: W } = court;
  const { width: SW, height: SH } = options.size;
  const P = (x: number, y: number, z = 0) => proj.project(x, y, z);
  const a = arenaLayout(proj, court, options.apron);
  const apronBottom = Math.min(SH, a.nearApronBottom);

  // Fond, tribunes du fond puis derrière les lignes de fond (droite, puis gauche).
  g.fillStyle(PALETTE.navy).fillRect(0, 0, SW, SH);
  drawCrowd(g, 0, 0, SW, a.farApronTop - 2, home, rng);
  drawCrowd(g, a.rightApron + 2, a.farApronTop, SW, apronBottom, home, rng);
  drawCrowd(g, 0, a.farApronTop, a.leftApron - 2, apronBottom, home, rng);
  g.fillStyle(home.secondary[1]).fillRect(0, a.farApronTop - 2, SW, 1);
  g.fillRect(a.rightApron + 1, a.farApronTop - 2, 1, apronBottom - a.farApronTop + 2);
  g.fillRect(a.leftApron - 2, a.farApronTop - 2, 1, apronBottom - a.farApronTop + 2);
  g.fillStyle(home.primary[2]).fillRect(a.leftApron - 1, a.farApronTop - 1, a.rightApron - a.leftApron + 2, 1);

  // Bandes aux couleurs de l'équipe à domicile : au fond, derrière les lignes de fond, devant.
  g.fillStyle(home.primary[1]).fillRect(a.leftApron, a.farApronTop, a.rightApron - a.leftApron, a.farLine - a.farApronTop);
  g.fillRect(a.rightBaseline, a.farApronTop, a.rightApron - a.rightBaseline, apronBottom - a.farApronTop);
  g.fillRect(a.leftApron, a.farApronTop, a.leftBaseline - a.leftApron, apronBottom - a.farApronTop);
  g.fillRect(a.leftApron, a.nearLine, a.rightApron - a.leftApron, apronBottom - a.nearLine);
  const banner = `${home.city} ${home.name}`;
  g.fillStyle(home.secondary[0]);
  const bannerY = Math.round((a.farApronTop + a.farLine - GLYPH_H * 2) / 2);
  // Le nom se répète tant qu'il y a de la place sur la bande du fond.
  const bannerFrom = options.bannerFrom ?? a.leftBaseline + artPx(12);
  for (let x = bannerFrom; x + textWidth(banner, 2) < a.rightBaseline - artPx(12); x += textWidth(banner, 2) + artPx(60)) drawText(g, banner, x, bannerY, 2);

  // Parquet en lattes, borné à la texture.
  const floorLeft = Math.max(0, a.leftBaseline);
  const floorRight = Math.min(SW, a.rightBaseline);
  const floorBottom = Math.min(SH, a.nearLine);
  const plank = artPx(5);
  for (let y = a.farLine, row = 0; y < floorBottom; y += plank, row++) {
    const h = Math.min(plank, floorBottom - y);
    g.fillStyle(row % 2 ? PALETTE.wood : PALETTE.woodLight).fillRect(floorLeft, y, floorRight - floorLeft, h);
    g.fillStyle(PALETTE.woodDark);
    for (let x = floorLeft + rng.int(0, artPx(40)); x < floorRight; x += rng.int(artPx(26), artPx(60))) g.fillRect(x, y, 1, h);
  }

  // Raquettes et rond central aux couleurs de l'équipe (ton sombre si trop proche du bois).
  const paint = colorDistance(home.primary[1], PALETTE.wood) < 90 ? home.primary[2] : home.primary[1];
  const box = (x0: number, y0: number, x1: number, y1: number): Point[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
  const hoops = [court.hoops.right, court.hoops.left];
  g.fillStyle(paint);
  for (const hoop of hoops) {
    const b = paintBox(court, hoop);
    fillPolygon(g, box(b.x0, b.y0, b.x1, b.y1));
  }
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
  pixelLine(g, P(0, W), P(L, W));
  pixelLine(g, P(L, 0), P(L, W));
  pixelLine(g, P(0, 0), P(0, W));
  pixelLine(g, P(L / 2, 0), P(L / 2, W));
  const circle = (cx: number, cy: number, r: number) => {
    const pts: Point[] = [];
    for (let i = 0; i <= 64; i++) pts.push(P(cx + Math.cos((i / 64) * Math.PI * 2) * r, cy + Math.sin((i / 64) * Math.PI * 2) * r));
    pixelPolyline(g, pts);
  };
  circle(L / 2, W / 2, CIRCLE_RADIUS);
  for (const hoop of hoops) {
    const b = paintBox(court, hoop);
    const corners = box(b.x0, b.y0, b.x1, b.y1);
    pixelPolyline(g, [...corners, corners[0]]);
    circle(b.ft, hoop.rim.y, CIRCLE_RADIUS);
    pixelPolyline(g, threePointLine(court, hoop).map((p) => P(p.x, p.y)));
  }

  // Photographes accroupis derrière chaque ligne de fond, tournés vers le terrain.
  const pressColors = (char: string): number | null =>
    ({ '1': SKIN_TONES[1][0], '2': SKIN_TONES[1][1], '3': SKIN_TONES[1][2], h: HAIR_COLORS[1][0], H: HAIR_COLORS[1][1], k: PALETTE.ink, w: PALETTE.chalk, g: PALETTE.silver, G: PALETTE.slate })[char] ?? null;
  const behind = options.apron.baseline - 0.55;
  for (const hoop of hoops) {
    for (const depth of [2.8, 11.6]) {
      const p = P(hoop.baselineX - hoop.toCourt * behind, depth);
      drawGrid(g, PHOTOGRAPHER, Math.round(p.x) - Math.floor(PHOTOGRAPHER[0].length / 2), Math.round(p.y) - PHOTOGRAPHER.length + 1, pressColors, {
        flip: hoop.toCourt < 0,
      });
    }
  }
}

/** Dessine l'arène une fois, puis la convertit en texture. */
export function createArena(scene: Phaser.Scene, key: string, proj: ArtProjection, court: Court, home: TeamLook, options: ArenaOptions): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.add.graphics();
  drawArena(g, proj, court, home, options);
  g.generateTexture(key, options.size.width, options.size.height);
  g.destroy();
}
