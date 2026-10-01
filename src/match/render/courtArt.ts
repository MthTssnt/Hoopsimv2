import type Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import {
  BACKBOARD,
  CIRCLE_RADIUS,
  RIM_RADIUS,
  threePointLine,
  type Court,
  type Hoop,
} from '../physics/court';
import { depthOf, project } from './projection';

/** Palette provisoire, originale (placeholders en attendant la DA). */
export const COLORS = {
  sky: 0x1d1d2b,
  wall: 0x2b2b40,
  apron: 0x8a5a2b,
  floor: 0xc68642,
  paint: 0x9c4a2a,
  line: 0xf4efe6,
  board: 0xe8edf2,
  boardFrame: 0x5b6470,
  pole: 0x3a3f4b,
  rim: 0xff5a1f,
  net: 0xdfe6ee,
  ball: 0xe8772e,
  ballSeam: 0x7a3412,
  shadow: 0x000000,
} as const;

type Point = { x: number; y: number };

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

/** Cercle au sol (en mètres), projeté : une ellipse à l'écran. */
function floorCircle(cx: number, cy: number, r: number, from = 0, to = Math.PI * 2, segments = 48): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = from + ((to - from) * i) / segments;
    points.push(project(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return points;
}

function floorRect(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number): void {
  const a = project(Math.min(x0, x1), Math.min(y0, y1));
  const b = project(Math.max(x0, x1), Math.max(y0, y1));
  g.fillRect(Math.round(a.x), Math.round(a.y), Math.round(b.x) - Math.round(a.x), Math.round(b.y) - Math.round(a.y));
}

/** Dessine le terrain une fois et le convertit en texture (le Graphics coûte cher à chaque image). */
export function createCourtTexture(scene: Phaser.Scene, key: string, court: Court): void {
  const g = scene.add.graphics();
  const { length: L, width: W } = court;

  g.fillStyle(COLORS.sky).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  const farApron = project(0, -WORLD_MARGIN);
  g.fillStyle(COLORS.wall).fillRect(0, Math.round(farApron.y) - 10, WORLD_WIDTH, 10);
  g.fillStyle(COLORS.apron);
  floorRect(g, -WORLD_MARGIN, -WORLD_MARGIN, L + WORLD_MARGIN, W + WORLD_MARGIN);
  g.fillStyle(COLORS.floor);
  floorRect(g, 0, 0, L, W);

  // Raquettes et ronds.
  g.fillStyle(COLORS.paint);
  for (const hoop of [court.hoops.left, court.hoops.right]) {
    const ft = hoop.baselineX + hoop.toCourt * court.paintLength;
    floorRect(g, hoop.baselineX, hoop.rim.y - court.paintWidth / 2, ft, hoop.rim.y + court.paintWidth / 2);
  }

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
 * Panier : poteau, planche et moitié arrière du cercle derrière le ballon ; moitié avant
 * du cercle et filet devant. Les deux moitiés encadrent la profondeur du cercle.
 */
export function drawHoop(scene: Phaser.Scene, hoop: Hoop): void {
  const { rim, board, toCourt, baselineX } = hoop;
  const back = scene.add.graphics().setDepth(depthOf(rim.y) - 0.2);
  const front = scene.add.graphics().setDepth(depthOf(rim.y) + 0.2);

  // Poteau derrière la ligne de fond et bras jusqu'à la planche.
  const poleX = baselineX - toCourt * 1;
  const armZ = BACKBOARD.bottom + 0.4;
  const poleBase = project(poleX, rim.y);
  const poleTop = project(poleX, rim.y, armZ);
  back.fillStyle(COLORS.pole);
  back.fillRect(Math.round(poleBase.x) - 1, Math.round(poleTop.y), 3, Math.round(poleBase.y - poleTop.y));
  back.fillRect(Math.round(poleBase.x) - 3, Math.round(poleBase.y) - 1, 7, 2);
  const boardBack = toCourt > 0 ? board.min.x : board.max.x;
  pixelLine(back, poleTop, project(boardBack, rim.y, armZ));

  // Planche vue de côté : une bande verticale (sa largeur est écrasée par la profondeur).
  const boardFront = toCourt > 0 ? board.max.x : board.min.x;
  const top = project(board.min.x, board.min.y, board.max.z);
  const bottom = project(board.min.x, board.max.y, board.min.z);
  const bx = Math.round(project((board.min.x + board.max.x) / 2, 0).x);
  back.fillStyle(COLORS.boardFrame).fillRect(bx - 1, Math.round(top.y), 3, Math.round(bottom.y - top.y));
  back.fillStyle(COLORS.board).fillRect(bx, Math.round(top.y) + 1, 1, Math.round(bottom.y - top.y) - 2);

  // Cercle : ellipse, moitié du fond derrière, moitié avant devant.
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
  pixelLine(back, project(rim.x - toCourt * RIM_RADIUS, rim.y, rim.z), project(boardFront, rim.y, rim.z));
  front.fillStyle(COLORS.net, 0.7);
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI * i) / 4;
    const upper = project(rim.x + Math.cos(a) * RIM_RADIUS, rim.y + Math.sin(a) * RIM_RADIUS, rim.z);
    const lower = project(rim.x + Math.cos(a) * RIM_RADIUS * 0.55, rim.y + Math.sin(a) * RIM_RADIUS * 0.55, rim.z - 0.42);
    pixelLine(front, upper, lower);
  }
  front.fillStyle(COLORS.rim);
  pixelPolyline(front, ring(0, Math.PI));
}
