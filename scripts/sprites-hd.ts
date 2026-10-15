/**
 * Planche de comparaison du prototype haute résolution (densité ×1,5), plus proche voisin, fond uni :
 * ANCIEN à gauche, NOUVEAU à droite, toujours à la même taille à l'écran.
 * - La tête : ancien ×12, nouveau ×8 (diagonale bas et diagonale haut).
 * - Le joueur entier et le ballon à l'échelle du match en plein écran 1080p : ancien ×3 (640×360),
 *   nouveau ×2 (960×540).
 *   npx tsx scripts/sprites-hd.ts [sortie.png]
 */
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { PALETTE, teamRamp } from '../src/assets/palette';
import { BALL } from '../src/assets/sprites/arena';
import { headGrid2D } from '../src/assets/sprites/heads2d';
import type { Appearance } from '../src/match/render/sprites/appearance';
import { SlotCanvas, slotOf } from '../src/match/render/sprites/canvas';
import { colors2D, slotColor } from '../src/match/render/sprites/compose';
import { colorOutline, renderFigure2D } from '../src/match/render/sprites/figure2d';
import { BALL_HD, DENSITY_HD } from '../src/match/render/sprites/hd/densityHD';
import { headGridHD } from '../src/match/render/sprites/hd/headHD';
import { drawSmallText } from '../src/match/render/pixelFont';
import { poses2D } from '../src/match/render/sprites/poses2d';
import type { Heading } from '../src/match/render/sprites/rig';

const out = process.argv[2] ?? 'comparaison-hd.png';
const BACKGROUND = 0x7d8aa6;
/** Le joueur du test : ébouriffé brun, teint moyen, yeux noisette, n° 23. */
export const TEST_LOOK: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 2, head: 0, hair: 0, hairColor: 1, number: 23, face: 1, eyeColor: 1 };
const colors = colors2D(TEST_LOOK, teamRamp('#1d4ed8'), teamRamp('#f59e0b'));
const BALL_COLORS: Record<string, number> = { b: PALETTE.orange, B: PALETTE.orangeDark, n: PALETTE.ink, l: PALETTE.woodLight };

/** Une grille (tête ou ballon) dans un tampon, avec son contour. */
function headCanvas(grid: { rows: string[] }): SlotCanvas {
  const c = new SlotCanvas(grid.rows[0].length + 2, grid.rows.length + 2);
  grid.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const s = slotOf(ch);
    if (s) c.set(x + 1, y + 1, s);
  }));
  colorOutline(c, (x, y) => ('rhHDE'.includes(c.get(x, y) ?? '.') ? 'hair' : 'skin'));
  return c;
}

type Pixels = { width: number; height: number; at: (x: number, y: number) => number | null };
const fromCanvas = (c: SlotCanvas): Pixels => ({ width: c.width, height: c.height, at: (x, y) => (c.get(x, y) ? slotColor(c.get(x, y)!, colors) : null) });
function fromBall(grid: readonly string[]): Pixels {
  const inside = (x: number, y: number) => (grid[y - 1]?.[x - 1] ?? '.') !== '.';
  return {
    width: grid[0].length + 2,
    height: grid.length + 2,
    at: (x, y) => {
      if (inside(x, y)) return BALL_COLORS[grid[y - 1][x - 1]];
      return inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1) ? PALETTE.outline : null;
    },
  };
}

interface Item {
  pixels: Pixels;
  zoom: number;
  x: number;
  y: number;
}

const items: Item[] = [];
const texts: { text: string; x: number; y: number }[] = [];
const TEXT_ZOOM = 4;
const COL = 700;

// Têtes, même taille à l'écran : ancien ×12, nouveau ×8.
texts.push({ text: 'ANCIEN  TETE X12  JOUEUR X3', x: 40, y: 20 }, { text: 'NOUVEAU  TETE X8  JOUEUR X2', x: COL + 40, y: 20 });
const headings: Heading[] = ['down', 'up'];
headings.forEach((h, k) => {
  items.push({ pixels: fromCanvas(headCanvas(headGrid2D(TEST_LOOK, h))), zoom: 12, x: 40 + k * 300, y: 80 });
  items.push({ pixels: fromCanvas(headCanvas(headGridHD(TEST_LOOK, h))), zoom: 8, x: COL + 40 + k * 300, y: 80 });
});
// Joueurs entiers à l'échelle du match, ballon à côté.
const idle = poses2D('idle')[0].pose;
const ROW2 = 440;
headings.forEach((h, k) => {
  items.push({ pixels: fromCanvas(renderFigure2D(TEST_LOOK, idle, h).canvas), zoom: 3, x: 40 + k * 190, y: ROW2 });
  items.push({ pixels: fromCanvas(renderFigure2D(TEST_LOOK, idle, h, 'right', 'team', DENSITY_HD).canvas), zoom: 2, x: COL + 40 + k * 190, y: ROW2 });
});
items.push({ pixels: fromBall(BALL), zoom: 3, x: 40 + 2 * 190, y: ROW2 + 192 - 30 });
items.push({ pixels: fromBall(BALL_HD), zoom: 2, x: COL + 40 + 2 * 190, y: ROW2 + 192 - 28 });

// Rendu.
const width = 2 * COL;
const height = ROW2 + 192 + 40;
const rgba = new Uint8Array(width * height * 4);
const fill = (x0: number, y0: number, w: number, h: number, color: number) => {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const k = (y * width + x) * 4;
      rgba[k] = (color >> 16) & 0xff;
      rgba[k + 1] = (color >> 8) & 0xff;
      rgba[k + 2] = color & 0xff;
      rgba[k + 3] = 255;
    }
  }
};
fill(0, 0, width, height, BACKGROUND);
fill(COL - 2, 0, 4, height, 0x5a6684);
for (const { text, x, y } of texts) drawSmallText({ fillRect: (px: number, py: number, w: number, h: number) => fill(x + px * TEXT_ZOOM, y + py * TEXT_ZOOM, w * TEXT_ZOOM, h * TEXT_ZOOM, 0xf6f2ea) }, text, 0, 0);
for (const { pixels, zoom, x, y } of items) {
  for (let py = 0; py < pixels.height; py++) {
    for (let px = 0; px < pixels.width; px++) {
      const c = pixels.at(px, py);
      if (c !== null) fill(x + px * zoom, y + py * zoom, zoom, zoom, c);
    }
  }
}


function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
const raw = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]));
console.log(`${out} : ${width}×${height} px`);
