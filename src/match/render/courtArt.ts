import type Phaser from 'phaser';
import { hashSeed, Rng } from '../../engine/rng';
import { DEPTH_SCALE, PIXELS_PER_METER, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import { BACKBOARD, CIRCLE_RADIUS, RIM_RADIUS, threePointLine, type Court, type Hoop } from '../physics/court';
import { drawText, GLYPH_H, textWidth } from './pixelFont';
import { depthOf, project } from './projection';

/** Palette originale (placeholders en attendant la DA définitive). */
export const COLORS = {
  arena: 0x15141f,
  seatA: 0x23223a,
  seatB: 0x2b2a46,
  wood: 0xd8a467,
  woodAlt: 0xcd985b,
  woodSeam: 0xb5824a,
  line: 0xf6efe2,
  board: 0xeef2f6,
  boardFrame: 0x4a525e,
  pole: 0x3a3f4b,
  rim: 0xff5a1f,
  net: 0xe6ecf2,
  ball: 0xe8772e,
  ballSeam: 0x7a3412,
  shadow: 0x000000,
} as const;

/** Habillage aux couleurs d'une équipe (de `teamsData.ts`). */
export interface CourtTheme {
  primary: number;
  secondary: number;
  abbr: string;
  name: string;
}

export function themeFromTeam(team: { colors: { primary: string; secondary: string }; abbr: string; name: string }): CourtTheme {
  return {
    primary: parseInt(team.colors.primary.slice(1), 16),
    secondary: parseInt(team.colors.secondary.slice(1), 16),
    abbr: team.abbr,
    name: team.name,
  };
}

/** Assombrit (k < 1) ou éclaircit (k > 1) une couleur. */
export function shade(color: number, k: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (c((color >> 16) & 0xff) << 16) | (c((color >> 8) & 0xff) << 8) | c(color & 0xff);
}

type Point = { x: number; y: number };

/** Socle du panier derrière la ligne de fond (m vers l'extérieur) ; le nom de l'équipe passe devant. */
const STANCHION = { padFrom: 1.2, padTo: 2, pole: 1.6, textCenter: 0.58 } as const;

/** Trace une ligne pixel par pixel (Bresenham) : traits nets d'un pixel, sans anticrénelage. */
function pixelLine(g: Phaser.GameObjects.Graphics, a: Point, b: Point): void {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function pixelPolyline(g: Phaser.GameObjects.Graphics, points: Point[]): void {
  for (let i = 1; i < points.length; i++) pixelLine(g, points[i - 1], points[i]);
}

/** Remplit un polygone convexe ou non, ligne de pixels par ligne de pixels (bords nets). */
function fillPolygon(g: Phaser.GameObjects.Graphics, points: Point[]): void {
  const ys = points.map((p) => p.y);
  for (let y = Math.round(Math.min(...ys)); y <= Math.round(Math.max(...ys)); y++) {
    const xs: number[] = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    });
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) g.fillRect(Math.round(xs[k]), y, Math.max(1, Math.round(xs[k + 1]) - Math.round(xs[k])), 1);
  }
}

/** Cercle au sol (en mètres), projeté : une ellipse à l'écran. */
function floorCircle(cx: number, cy: number, r: number, segments = 64): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (Math.PI * 2 * i) / segments;
    points.push(project(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return points;
}

/** Disque au sol rempli, ligne de pixels par ligne de pixels. */
function fillFloorDisc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  const c = project(cx, cy);
  const a = r * PIXELS_PER_METER;
  const b = r * DEPTH_SCALE * PIXELS_PER_METER;
  for (let dy = -Math.floor(b); dy <= Math.floor(b); dy++) {
    const half = Math.round(a * Math.sqrt(Math.max(0, 1 - (dy / b) ** 2)));
    g.fillRect(Math.round(c.x) - half, Math.round(c.y) + dy, 2 * half, 1);
  }
}

function floorRect(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number): void {
  const a = project(Math.min(x0, x1), Math.min(y0, y1));
  const b = project(Math.max(x0, x1), Math.max(y0, y1));
  g.fillRect(Math.round(a.x), Math.round(a.y), Math.round(b.x) - Math.round(a.x), Math.round(b.y) - Math.round(a.y));
}

/** Tribunes : rangées de sièges et de spectateurs, tirées au sort (graine fixe par équipe). */
function drawCrowd(g: Phaser.GameObjects.Graphics, x0: number, x1: number, bottom: number, theme: CourtTheme, salt: string): void {
  const rng = new Rng(hashSeed(`tribunes-${theme.abbr}-${salt}`));
  const skins = [0xf1c9a5, 0xd9a67a, 0xb97c50, 0x8d5a3b, 0x5e3a26];
  const shirts = [theme.primary, theme.primary, theme.secondary, 0xe6e6e6, 0x3d5a80, 0x9c2c2c, 0x2d6a4f, 0xd4a017];
  const rowHeight = 6;
  for (let row = 0, y = bottom - rowHeight; y > -rowHeight; row++, y -= rowHeight) {
    g.fillStyle(row % 2 ? COLORS.seatA : COLORS.seatB).fillRect(x0, y, x1 - x0, rowHeight);
    for (let x = x0 + rng.int(0, 4); x < x1 - 2; x += rng.int(4, 7)) {
      if (!rng.chance(0.7)) continue;
      g.fillStyle(rng.pick(shirts)).fillRect(x, y + 3, 3, 3);
      g.fillStyle(rng.pick(skins)).fillRect(x, y + 1, 3, 2);
    }
  }
}

function drawStands(g: Phaser.GameObjects.Graphics, court: Court, theme: CourtTheme): void {
  g.fillStyle(COLORS.arena).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const farApron = Math.round(project(0, -WORLD_MARGIN).y);
  const leftApron = Math.round(project(-WORLD_MARGIN, 0).x);
  const rightApron = Math.round(project(court.length + WORLD_MARGIN, 0).x);
  drawCrowd(g, 0, WORLD_WIDTH, farApron - 4, theme, 'fond');
  drawCrowd(g, 0, leftApron - 4, WORLD_HEIGHT, theme, 'gauche');
  drawCrowd(g, rightApron + 4, WORLD_WIDTH, WORLD_HEIGHT, theme, 'droite');
  // Rambardes aux couleurs de l'équipe au pied des tribunes.
  g.fillStyle(shade(theme.primary, 0.75));
  g.fillRect(0, farApron - 3, WORLD_WIDTH, 3).fillRect(leftApron - 3, farApron, 3, WORLD_HEIGHT).fillRect(rightApron, farApron, 3, WORLD_HEIGHT);
  g.fillStyle(theme.secondary);
  g.fillRect(0, farApron - 4, WORLD_WIDTH, 1).fillRect(leftApron - 4, farApron - 4, 1, WORLD_HEIGHT).fillRect(rightApron + 3, farApron - 4, 1, WORLD_HEIGHT);
}

/** Parquet en lattes dans le sens de la longueur, joints décalés tirés au sort. */
function drawPlanks(g: Phaser.GameObjects.Graphics, court: Court): void {
  const rng = new Rng(hashSeed('parquet'));
  const top = project(0, 0);
  const bottom = project(court.length, court.width);
  const left = Math.round(top.x);
  const right = Math.round(bottom.x);
  for (let y = Math.round(top.y), row = 0; y < Math.round(bottom.y); y += 3, row++) {
    const h = Math.min(3, Math.round(bottom.y) - y);
    g.fillStyle(row % 2 ? COLORS.woodAlt : COLORS.wood).fillRect(left, y, right - left, h);
    g.fillStyle(COLORS.woodSeam);
    for (let x = left + rng.int(0, 30); x < right; x += rng.int(18, 42)) g.fillRect(x, y, 1, h);
  }
}

/** Dessine le terrain une fois et le convertit en texture (le Graphics coûte cher à chaque image). */
export function createCourtTexture(scene: Phaser.Scene, key: string, court: Court, theme: CourtTheme): void {
  const g = scene.add.graphics();
  const { length: L, width: W } = court;

  drawStands(g, court, theme);
  g.fillStyle(theme.primary);
  floorRect(g, -WORLD_MARGIN, -WORLD_MARGIN, L + WORLD_MARGIN, W + WORLD_MARGIN);
  drawPlanks(g, court);

  // Raquettes et rond central aux couleurs de l'équipe.
  g.fillStyle(theme.primary);
  for (const hoop of [court.hoops.left, court.hoops.right]) {
    const ft = hoop.baselineX + hoop.toCourt * court.paintLength;
    floorRect(g, hoop.baselineX, hoop.rim.y - court.paintWidth / 2, ft, hoop.rim.y + court.paintWidth / 2);
  }
  fillFloorDisc(g, L / 2, W / 2, CIRCLE_RADIUS);
  g.fillStyle(theme.secondary);
  fillFloorDisc(g, L / 2, W / 2, CIRCLE_RADIUS * 0.82);
  g.fillStyle(theme.primary);
  fillFloorDisc(g, L / 2, W / 2, CIRCLE_RADIUS * 0.74);
  const center = project(L / 2, W / 2);
  g.fillStyle(theme.secondary);
  drawText(g, theme.abbr, Math.round(center.x - textWidth(theme.abbr, 2) / 2), Math.round(center.y - GLYPH_H), 2);

  // Lignes.
  g.fillStyle(COLORS.line);
  pixelPolyline(g, [project(0, 0), project(L, 0), project(L, W), project(0, W), project(0, 0)]);
  pixelLine(g, project(L / 2, 0), project(L / 2, W));
  pixelPolyline(g, floorCircle(L / 2, W / 2, CIRCLE_RADIUS));
  for (const hoop of [court.hoops.left, court.hoops.right]) {
    const ft = hoop.baselineX + hoop.toCourt * court.paintLength;
    const top = hoop.rim.y - court.paintWidth / 2;
    const bottom = hoop.rim.y + court.paintWidth / 2;
    pixelPolyline(g, [project(hoop.baselineX, top), project(ft, top), project(ft, bottom), project(hoop.baselineX, bottom)]);
    pixelPolyline(g, floorCircle(ft, hoop.rim.y, CIRCLE_RADIUS));
    pixelPolyline(g, threePointLine(court, hoop).map((p) => project(p.x, p.y)));
  }

  // Nom de l'équipe le long des deux lignes de fond, dans la marge.
  const depthPx = project(0, W).y - project(0, 0).y;
  const name = theme.name;
  const scale = Math.max(1, Math.min(3, Math.floor(depthPx / textWidth(name, 1))));
  const length = textWidth(name, scale);
  const startY = Math.round(project(0, W / 2).y - length / 2);
  // Colonne entre la ligne de fond et le socle du panier (voir STANCHION).
  const apronX = (x: number) => Math.round(project(x, 0).x - (GLYPH_H * scale) / 2);
  g.fillStyle(theme.secondary);
  drawText(g, name, apronX(L + STANCHION.textCenter), startY, scale, 90);
  drawText(g, name, apronX(-STANCHION.textCenter), startY, scale, -90);

  g.generateTexture(key, WORLD_WIDTH, WORLD_HEIGHT);
  g.destroy();
}

/** Ballon (5 px) et son ombre, placeholders aux tailles définitives. */
export function createBallTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ball);
  g.fillRect(1, 0, 3, 5).fillRect(0, 1, 5, 3);
  g.fillStyle(COLORS.ballSeam).fillRect(2, 1, 1, 3).fillRect(1, 2, 3, 1);
  g.generateTexture('ball', 5, 5);
  g.clear();
  g.fillStyle(COLORS.shadow, 0.35).fillRect(1, 0, 3, 2).fillRect(0, 0, 5, 1);
  g.generateTexture('ball-shadow', 5, 2);
  g.clear();
  g.fillStyle(COLORS.line, 0.8).fillRect(0, 0, 1, 1).fillRect(2, 0, 1, 1).fillRect(1, 1, 1, 1).fillRect(0, 2, 1, 1).fillRect(2, 2, 1, 1);
  g.generateTexture('marker', 3, 3);
  g.destroy();
}

/**
 * Panier vu de 3/4 : poteau rembourré aux couleurs de l'équipe, planche dessinée en biais
 * (effet de profondeur), moitié arrière du cercle derrière le ballon, moitié avant et filet
 * devant. Le biais de la planche est purement visuel : la physique garde la planche droite.
 */
export function drawHoop(scene: Phaser.Scene, hoop: Hoop, theme: CourtTheme): void {
  const { rim, board, toCourt, baselineX } = hoop;
  const back = scene.add.graphics().setDepth(depthOf(rim.y) - 0.2);
  const front = scene.add.graphics().setDepth(depthOf(rim.y) + 0.2);
  const outward = -toCourt;

  // Socle rembourré derrière la ligne de fond.
  const baseNear = baselineX + outward * STANCHION.padFrom;
  const baseFar = baselineX + outward * STANCHION.padTo;
  const x0 = Math.min(baseNear, baseFar);
  const x1 = Math.max(baseNear, baseFar);
  const topFace = [project(x0, rim.y - 0.5, 1), project(x1, rim.y - 0.5, 1), project(x1, rim.y + 0.5, 1), project(x0, rim.y + 0.5, 1)];
  const frontFace = [project(x0, rim.y + 0.5, 1), project(x1, rim.y + 0.5, 1), project(x1, rim.y + 0.5, 0), project(x0, rim.y + 0.5, 0)];
  back.fillStyle(shade(theme.primary, 1.15));
  fillPolygon(back, topFace);
  back.fillStyle(shade(theme.primary, 0.8));
  fillPolygon(back, frontFace);

  // Poteau, manchon rembourré et bras jusqu'à la planche.
  const poleX = baselineX + outward * STANCHION.pole;
  const armZ = BACKBOARD.bottom + 0.35;
  const poleBase = project(poleX, rim.y, 1);
  const poleTop = project(poleX, rim.y, armZ + 0.3);
  back.fillStyle(COLORS.pole).fillRect(Math.round(poleBase.x) - 1, Math.round(poleTop.y), 3, Math.round(poleBase.y - poleTop.y));
  const sleeve = project(poleX, rim.y, 2);
  back.fillStyle(theme.primary).fillRect(Math.round(sleeve.x) - 2, Math.round(sleeve.y), 5, Math.round(poleBase.y - sleeve.y));
  const boardBack = toCourt > 0 ? board.min.x : board.max.x;
  back.fillStyle(COLORS.pole);
  pixelLine(back, poleTop, project(boardBack, rim.y, armZ));
  pixelLine(back, { x: poleTop.x, y: poleTop.y + 1 }, { ...project(boardBack, rim.y, armZ - 0.15) });

  // Planche en biais : le bord proche du spectateur part vers l'extérieur.
  const boardFront = toCourt > 0 ? board.max.x : board.min.x;
  const skew = (y: number) => outward * (y - rim.y) * 0.25 * PIXELS_PER_METER;
  const corner = (y: number, z: number) => {
    const p = project(boardFront, y, z);
    return { x: p.x + skew(y), y: p.y };
  };
  const quad = [corner(board.min.y, board.max.z), corner(board.max.y, board.max.z), corner(board.max.y, board.min.z), corner(board.min.y, board.min.z)];
  back.fillStyle(COLORS.boardFrame);
  fillPolygon(back, quad.map((p) => ({ x: p.x + outward * 2, y: p.y })));
  back.fillStyle(COLORS.board);
  fillPolygon(back, quad);
  back.fillStyle(COLORS.boardFrame);
  pixelPolyline(back, [...quad, quad[0]]);
  const box = [corner(rim.y - 0.3, rim.z + 0.45), corner(rim.y + 0.3, rim.z + 0.45), corner(rim.y + 0.3, rim.z + 0.05), corner(rim.y - 0.3, rim.z + 0.05)];
  back.fillStyle(COLORS.rim);
  pixelPolyline(back, [...box, box[0]]);

  // Cercle : ellipse, moitié du fond derrière, moitié avant devant ; filet devant.
  const ring = (from: number, to: number) => {
    const points: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = from + ((to - from) * i) / 16;
      points.push(project(rim.x + Math.cos(a) * RIM_RADIUS, rim.y + Math.sin(a) * RIM_RADIUS, rim.z));
    }
    return points;
  };
  back.fillStyle(COLORS.rim);
  pixelPolyline(back, ring(Math.PI, Math.PI * 2));
  pixelLine(back, project(rim.x + outward * RIM_RADIUS, rim.y, rim.z), project(boardFront, rim.y, rim.z));
  const netDrop = 0.42;
  front.fillStyle(COLORS.net, 0.75);
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI * i) / 6;
    const upper = project(rim.x + Math.cos(a) * RIM_RADIUS, rim.y + Math.sin(a) * RIM_RADIUS, rim.z);
    const lower = project(rim.x + Math.cos(a) * RIM_RADIUS * 0.6, rim.y + Math.sin(a) * RIM_RADIUS * 0.6, rim.z - netDrop);
    pixelLine(front, upper, lower);
  }
  front.fillStyle(COLORS.rim);
  pixelPolyline(front, ring(0, Math.PI));
  pixelPolyline(front, ring(0, Math.PI).map((p) => ({ x: p.x, y: p.y + 1 })));
}
