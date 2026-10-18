/**
 * Planche de contrôle du système de pièces (style 5, « rétro peint »). Plus proche voisin, fond uni.
 * 1. Une tête de base ×8, puis la même tête en changeant UNE catégorie à la fois (une rangée par
 *    catégorie), chaque variante aussi à l'échelle du match (×3, de face et de dos).
 * 2. Les 4 expressions ×8.
 * 3. 20 joueurs tirés au hasard ×3, de face et de dos.
 * 4. Une capture du terrain en match (PNG passé en argument, pris dans le jeu).
 *   npx tsx scripts/characters-planche.ts <sortie.png> [capture-du-match.png]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import type { PlayerAppearance } from '../src/assets/characters/appearance';
import { partIds, type Category } from '../src/assets/characters/registry';
import { EXPRESSIONS, type Expression } from '../src/assets/characters/types';
import { teamRamp, type TeamRamp } from '../src/assets/palette';
import { drawText } from '../src/match/render/pixelFont';
import { appearance2DFor, type Appearance } from '../src/match/render/sprites/appearance';
import type { SlotCanvas } from '../src/match/render/sprites/canvas';
import { slotColor, type SlotColors } from '../src/match/render/sprites/compose';
import { headSprite, renderFigure2D } from '../src/match/render/sprites/figure2d';
import { colorsPainted } from '../src/match/render/sprites/paintedColors';
import { poses2D } from '../src/match/render/sprites/poses2d';
import { FRAME, type Heading } from '../src/match/render/sprites/rig';

const [out = 'planche-personnages.png', capture] = process.argv.slice(2);
const BACKGROUND = 0x7d8aa6;
const TEXT = 0xf6f2ea;
const WIDTH = 1920;
const TEAMS: [TeamRamp, TeamRamp][] = [
  [teamRamp('#1d4ed8'), teamRamp('#f59e0b')],
  [teamRamp('#b91c1c'), teamRamp('#f6f2ea')],
];

// ------------------------------------------------------------------------------------------------
// Image RGBA et PNG

interface Canvas {
  width: number;
  height: number;
  rgba: Uint8Array;
}

function canvas(width: number, height: number, color = BACKGROUND): Canvas {
  const c = { width, height, rgba: new Uint8Array(width * height * 4) };
  fill(c, 0, 0, width, height, color);
  return c;
}

function fill(c: Canvas, x0: number, y0: number, w: number, h: number, color: number, alpha = 1): void {
  for (let y = Math.max(0, y0); y < Math.min(c.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(c.width, x0 + w); x++) {
      const k = (y * c.width + x) * 4;
      c.rgba[k] = Math.round(c.rgba[k] * (1 - alpha) + ((color >> 16) & 255) * alpha);
      c.rgba[k + 1] = Math.round(c.rgba[k + 1] * (1 - alpha) + ((color >> 8) & 255) * alpha);
      c.rgba[k + 2] = Math.round(c.rgba[k + 2] * (1 - alpha) + (color & 255) * alpha);
      c.rgba[k + 3] = 255;
    }
  }
}

function blit(c: Canvas, img: SlotCanvas, colors: SlotColors, x: number, y: number, zoom: number): void {
  img.forEach((px, py, slot) => fill(c, x + px * zoom, y + py * zoom, zoom, zoom, slotColor(slot, colors)));
}

/** Ombre au sol du style 5 : ovale de 20×5 px du jeu, violet profond. */
function groundShadow(c: Canvas, cx: number, cy: number, zoom: number): void {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -10; dx <= 10; dx++) if ((dx * dx) / 100 + (dy * dy) / 6.25 <= 1) fill(c, cx + dx * zoom, cy + dy * zoom, zoom, zoom, 0x241640, 0.6);
}

function text(c: Canvas, s: string, x: number, y: number, zoom: number): void {
  drawText({ fillRect: (px: number, py: number, w: number, h: number) => fill(c, x + px * zoom, y + py * zoom, w * zoom, h * zoom, TEXT) }, s, 0, 0);
}

function writePng(path: string, c: Canvas): void {
  const chunk = (type: string, data: Uint8Array) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const raw = Buffer.alloc((c.width * 4 + 1) * c.height);
  for (let y = 0; y < c.height; y++) raw.set(c.rgba.subarray(y * c.width * 4, (y + 1) * c.width * 4), y * (c.width * 4 + 1) + 1);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(c.width, 0);
  header.writeUInt32BE(c.height, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]));
  console.log(`${path} : ${c.width}×${c.height} px`);
}

/** PNG RGB(A) 8 bits non entrelacé (captures de Chromium). */
function readPng(path: string): Canvas {
  const buf = readFileSync(path);
  let p = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const kind = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      type = data[9];
    } else if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const c: Canvas = { width: w, height: h, rgba: new Uint8Array(w * h * 4) };
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const cc = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(b - cc);
      const pb = Math.abs(a - cc);
      const pc = Math.abs(a + b - 2 * cc);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : cc;
      line[i] = (line[i] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth : 0)) & 255;
    }
    for (let x = 0; x < w; x++) c.rgba.set([line[x * bpp], line[x * bpp + 1], line[x * bpp + 2], 255], (y * w + x) * 4);
    prev = line;
  }
  return c;
}

function paste(c: Canvas, img: Canvas, x0: number, y0: number): void {
  for (let y = 0; y < img.height && y0 + y < c.height; y++) c.rgba.set(img.rgba.subarray(y * img.width * 4, (y * img.width + Math.min(img.width, c.width - x0)) * 4), ((y0 + y) * c.width + x0) * 4);
}

// ------------------------------------------------------------------------------------------------
// Planche

/** La tête de base : une pièce « moyenne » dans chaque catégorie, sans pilosité ni accessoire. */
const BASE: PlayerAppearance = {
  version: 1,
  headShape: 'normale',
  skin: 'mat',
  ears: 'normales',
  eyes: 'points',
  brows: 'doux',
  nose: 'bouton',
  mouth: 'fine',
  facialHair: null,
  hair: 'ebouriffe',
  colors: { hair: 'brun', facialHair: 'brun', eyes: 'brun-fonce', accessory: 'equipe' },
  accessories: [],
};
const BODY: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 0, hair: 0, hairColor: 1, number: 23 };
const look = (character: PlayerAppearance): Appearance => ({ ...BODY, character });
const colors = (a: Appearance, team = 0) => colorsPainted(a, ...TEAMS[team]);

/** Rangées : une catégorie qui change, ses valeurs (la valeur de la base en premier). */
const ROWS: { label: string; category: Category; apply: (id: string) => PlayerAppearance }[] = [
  { label: 'FORME DE TETE', category: 'headShapes', apply: (id) => ({ ...BASE, headShape: id }) },
  { label: 'YEUX', category: 'eyes', apply: (id) => ({ ...BASE, eyes: id }) },
  { label: 'SOURCILS', category: 'brows', apply: (id) => ({ ...BASE, brows: id }) },
  { label: 'NEZ', category: 'noses', apply: (id) => ({ ...BASE, nose: id }) },
  { label: 'BOUCHE', category: 'mouths', apply: (id) => ({ ...BASE, mouth: id }) },
  { label: 'OREILLES', category: 'ears', apply: (id) => ({ ...BASE, ears: id, hair: 'rase' }) },
  { label: 'PILOSITE', category: 'facialHair', apply: (id) => ({ ...BASE, facialHair: id, colors: { ...BASE.colors, facialHair: 'gris' } }) },
  { label: 'CHEVEUX', category: 'hair', apply: (id) => ({ ...BASE, hair: id }) },
  { label: 'ACCESSOIRES', category: 'accessories', apply: (id) => ({ ...BASE, accessories: [id] }) },
];

const ZOOM = 8;
const HEAD_W = 26;
const HEAD_H = 30;
const CELL = HEAD_W * ZOOM + 24;

/** Une variante : la tête ×8 de face, puis ×3 de face et de dos (échelle du match). */
function cell(c: Canvas, a: Appearance, x: number, y: number, label: string): void {
  const down = headSprite(a, 'down');
  const k = colors(a);
  blit(c, down, k, x + Math.round((HEAD_W - down.width) / 2) * ZOOM, y + (HEAD_H - down.height) * ZOOM, ZOOM);
  const small = y + HEAD_H * ZOOM + 8;
  for (const [i, view] of (['down', 'up'] as Heading[]).entries()) {
    const h = headSprite(a, view);
    blit(c, h, k, x + 20 + i * 90, small + (HEAD_H - h.height) * 3, 3);
  }
  text(c, label.toUpperCase(), x, small + HEAD_H * 3 + 8, 2);
}

const ROW_H = HEAD_H * ZOOM + 8 + HEAD_H * 3 + 30;
const PER_LINE = Math.floor((WIDTH - 260) / CELL);
const lines = ROWS.map((r) => Math.ceil(partIds(r.category).length / PER_LINE));
const idle = poses2D('idle')[0].pose;
const PLAYER_W = FRAME.width * 3;
const PLAYER_H = FRAME.height * 3;
const shot = capture ? readPng(capture) : null;

const headerH = HEAD_H * ZOOM + 80;
const rowsH = lines.reduce((t, n) => t + n * ROW_H + 20, 0);
const exprH = HEAD_H * ZOOM + 80;
const playersH = 2 * (PLAYER_H + 40) * 2 + 60;
const height = headerH + rowsH + exprH + playersH + (shot ? shot.height + 60 : 0) + 40;
const c = canvas(WIDTH, height);

// 1. Tête de base, puis une rangée par catégorie.
let y = 20;
text(c, 'STYLE 5 RETRO PEINT  SYSTEME DE PIECES', 20, y, 4);
text(c, 'TETE DE BASE X8', 20, y + 40, 3);
cell(c, look(BASE), 300, y, 'base');
y += headerH;
for (const [r, row] of ROWS.entries()) {
  text(c, row.label, 20, y + 20, 3);
  partIds(row.category).forEach((id, i) => {
    const line = Math.floor(i / PER_LINE);
    cell(c, look(row.apply(id)), 260 + (i % PER_LINE) * CELL, y + line * ROW_H, id);
  });
  y += lines[r] * ROW_H + 20;
}

// 2. Les 4 expressions ×8.
text(c, 'EXPRESSIONS X8', 20, y + 20, 3);
const expr: PlayerAppearance = { ...BASE, eyes: 'ronds', brows: 'epais', mouth: 'large' };
EXPRESSIONS.forEach((e: Expression, i) => {
  const h = headSprite(look(expr), 'down', e);
  blit(c, h, colors(look(expr)), 320 + i * CELL, y + (HEAD_H - h.height) * ZOOM, ZOOM);
  text(c, e.toUpperCase(), 320 + i * CELL, y + HEAD_H * ZOOM + 8, 2);
});
y += exprH;

// 3. 20 joueurs tirés au hasard ×3, de face puis de dos.
text(c, '20 JOUEURS AU HASARD X3  DE FACE PUIS DE DOS', 20, y, 3);
y += 40;
const players = Array.from({ length: 20 }, (_, i) =>
  appearance2DFor({ id: `planche-${i * 7919 + 13}`, heightCm: 182 + ((i * 37) % 34), weightKg: 84 + ((i * 53) % 34), number: (i * 17) % 100, age: 20 + ((i * 11) % 16) }),
);
for (const [half, group] of [players.slice(0, 10), players.slice(10)].entries()) {
  for (const heading of ['down', 'up'] as Heading[]) {
    group.forEach((p, i) => {
      const x = 20 + i * (PLAYER_W - 4);
      groundShadow(c, x + FRAME.centerX * 3, y + (FRAME.groundY - 1) * 3, 3);
      blit(c, renderFigure2D(p, idle, heading).canvas, colors(p, (i + half) % 2), x, y, 3);
    });
    y += PLAYER_H + 20;
  }
  y += 20;
}

// 4. Capture du terrain en match.
if (shot) {
  text(c, 'MATCH  CAPTURE DU JEU  X3', 20, y, 3);
  paste(c, shot, 0, y + 40);
}
writePng(out, c);

