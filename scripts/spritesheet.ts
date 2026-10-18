/**
 * Planche des animations du rendu 2D (style 5), agrandie sans lissage (plus proche voisin), sur fond
 * uni : la feuille du match telle qu'elle est cuite (`LAYOUT_2D`), avec le ballon tenu posé à son
 * point d'accroche, devant ou derrière le joueur (`behind`).
 * - pour un droitier puis pour un gaucher : une rangée par animation (arrêt, course, dribble en
 *   course, dribble à l'arrêt, images fixes), dans les 4 positions ;
 * - affiche le temps de cuisson d'un joueur (toutes les images de la feuille).
 * Les têtes et les pièces ont leur propre planche (`scripts/characters-planche.ts`).
 *   npm run sprites -- [sortie.png] [agrandissement]
 */
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { PALETTE, teamRamp } from '../src/assets/palette';
import { BALL } from '../src/assets/sprites/arena';
import { appearance2DFor, type Appearance } from '../src/match/render/sprites/appearance';
import { SHEET_VIEWS, slotColor, type SlotColors } from '../src/match/render/sprites/compose';
import { drawSmallText } from '../src/match/render/pixelFont';
import { LAYOUT_2D } from '../src/match/render/sprites/layout';
import { colorsPainted } from '../src/match/render/sprites/paintedColors';
import { FRAME } from '../src/match/render/sprites/rig';
import { composeFrame2D, type ComposedFrame2D } from '../src/match/render/sprites/sheet2d';

const out = process.argv[2] ?? 'planche-sprites-2d.png';
const zoom = Number(process.argv[3] ?? 3);
const BACKGROUND = 0x7d8aa6;
const TEXT = 0xf6f2ea;

const base = appearance2DFor({ id: 'planche-animations', heightCm: 200, weightKg: 96, number: 23, age: 26 });
const hand = (dominantHand: 'droite' | 'gauche'): Appearance => ({ ...base, character: { ...base.character!, hair: 'degrade', dominantHand } });
const LOOKS: [string, Appearance][] = [
  ['DROITIER', hand('droite')],
  ['GAUCHER', hand('gauche')],
];
const COLORS = colorsPainted(base, teamRamp('#1d4ed8'), teamRamp('#f59e0b'));

/** Rangées d'une planche : un groupe d'images de la feuille, dans une position. */
const GROUPS: [string, number[]][] = [
  ['ARRET', [0, 1]],
  ['COURSE', LAYOUT_2D.animations.run.frames.slice()],
  ['DRIBBLE COURSE', LAYOUT_2D.animations.dribble.frames.slice()],
  ['DRIBBLE ARRET', LAYOUT_2D.animations.dribbleIdle.frames.slice()],
  ['TIR LAYUP DUNK CONTRE', [22, 23, 24, 25, 26, 27]],
];
const VIEW_LABEL = { 'down-right': 'BAS DROITE', 'down-left': 'BAS GAUCHE', 'up-right': 'HAUT DROITE', 'up-left': 'HAUT GAUCHE' } as const;

// ------------------------------------------------------------------------------------------------

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
}

const LABEL_W = 150;
const CELL_W = FRAME.width * zoom;
const CELL_H = FRAME.height * zoom;
const rows = LOOKS.length * GROUPS.length * SHEET_VIEWS.length;
const width = LABEL_W + 8 * CELL_W;
const height = LOOKS.length * 40 + rows * (CELL_H + 4);
const rgba = new Uint8Array(width * height * 4);
const fill = (x0: number, y0: number, w: number, h: number, color: number, alpha = 1) => {
  for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
      const k = (y * width + x) * 4;
      rgba[k] = Math.round(rgba[k] * (1 - alpha) + ((color >> 16) & 0xff) * alpha);
      rgba[k + 1] = Math.round(rgba[k + 1] * (1 - alpha) + ((color >> 8) & 0xff) * alpha);
      rgba[k + 2] = Math.round(rgba[k + 2] * (1 - alpha) + (color & 0xff) * alpha);
      rgba[k + 3] = 255;
    }
  }
};
const text = (s: string, x: number, y: number, z = 2) => drawSmallText({ fillRect: (px: number, py: number, w: number, h: number) => fill(x + px * z, y + py * z, w * z, h * z, TEXT) }, s, 0, 0);

/** Ballon du jeu (8×8, contour sombre) centré en (cx, cy), coordonnées du cadre. */
function drawBall(ox: number, oy: number, cx: number, cy: number) {
  const colors: Record<string, number> = { b: PALETTE.orange, B: PALETTE.orangeDark, n: PALETTE.ink, l: PALETTE.woodLight };
  const inside = (x: number, y: number) => (BALL[y]?.[x] ?? '.') !== '.';
  for (let y = -1; y <= 8; y++) {
    for (let x = -1; x <= 8; x++) {
      const px = ox + (cx - 4 + x) * zoom;
      const py = oy + (cy - 4 + y) * zoom;
      if (inside(x, y)) fill(px, py, zoom, zoom, colors[BALL[y][x]]);
      else if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) fill(px, py, zoom, zoom, PALETTE.outline);
    }
  }
}

function drawFrame(ox: number, oy: number, frame: ComposedFrame2D, colors: SlotColors) {
  // Ombre au sol violette du style 5.
  for (let dy = -2; dy <= 2; dy++) for (let dx = -10; dx <= 10; dx++) if ((dx * dx) / 100 + (dy * dy) / 6.25 <= 1) fill(ox + (FRAME.centerX + dx) * zoom, oy + (FRAME.groundY - 1 + dy) * zoom, zoom, zoom, 0x241640, 0.6);
  if (frame.ball?.behind) drawBall(ox, oy, frame.ball.x, frame.ball.y);
  frame.canvas.forEach((x, y, slot) => fill(ox + x * zoom, oy + y * zoom, zoom, zoom, slotColor(slot, colors)));
  if (frame.ball && !frame.ball.behind) drawBall(ox, oy, frame.ball.x, frame.ball.y);
}

fill(0, 0, width, height, BACKGROUND);
let top = 0;
for (const [name, look] of LOOKS) {
  text(name, 8, top + 10, 4);
  top += 40;
  const sheet = new Map<string, ComposedFrame2D>();
  const frameOf = (index: number, heading: 'down' | 'up', facing: 'right' | 'left') => {
    const key = `${heading}|${index}`;
    if (!sheet.has(`${key}|right`)) {
      const both = composeFrame2D(look, index, heading);
      sheet.set(`${key}|right`, both.right);
      sheet.set(`${key}|left`, both.left);
    }
    return sheet.get(`${key}|${facing}`)!;
  };
  for (const [label, frames] of GROUPS) {
    for (const view of SHEET_VIEWS) {
      text(label, 8, top + 20);
      text(VIEW_LABEL[`${view.heading}-${view.facing}`], 8, top + 40);
      frames.forEach((index, i) => drawFrame(LABEL_W + i * CELL_W, top, frameOf(index, view.heading, view.facing), COLORS));
      top += CELL_H + 4;
    }
  }
}
writeFileSync(out, encodePng(width, height, rgba));
console.log(`${out} : ${width}×${height} px`);

// Temps de cuisson des images d'un joueur (les deux orientations de chaque image, deux diagonales).
const t0 = performance.now();
for (const heading of ['down', 'up'] as const) for (let i = 0; i < LAYOUT_2D.framesPerBlock; i++) composeFrame2D(LOOKS[0][1], i, heading);
console.log(`feuille de ${LAYOUT_2D.framesPerBlock * 4} images : ${(performance.now() - t0).toFixed(0)} ms`);
