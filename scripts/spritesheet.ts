/**
 * Planches de contrôle du rendu 2D, agrandies sans lissage (plus proche voisin), sur fond uni :
 * - `<sortie>.png` : une rangée par animation, images de gauche à droite ;
 * - `<sortie>-tetes.png` : toutes les têtes (5 formes × 10 coiffures, en diagonale bas puis haut ;
 *   dernière rangée : les 3 expressions sur les 4 teints).
 * PNG écrits avec le zlib de Node (sans dépendance) ; affiche le temps de rendu d'une image.
 *   npm run sprites -- [sortie.png] [échelle]
 */
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { HAIR_COLORS, teamRamp } from '../src/assets/palette';
import type { Expression } from '../src/assets/sprites/heads';
import { headGrid2D } from '../src/assets/sprites/heads2d';
import type { Appearance } from '../src/match/render/sprites/appearance';
import { SlotCanvas, slotOf } from '../src/match/render/sprites/canvas';
import { colorsFor, slotColor } from '../src/match/render/sprites/compose';
import { renderFigure2D } from '../src/match/render/sprites/figure2d';
import { poses2D, type Anim2D } from '../src/match/render/sprites/poses2d';
import { FRAME, type Heading } from '../src/match/render/sprites/rig';

const out = process.argv[2] ?? 'planche-sprites-2d.png';
const zoom = Number(process.argv[3] ?? 4);
const BACKGROUND = 0x7d8aa6;

/** Ailier de 2,00 m, coupe courte, numéro 23, aux couleurs d'une équipe du jeu. */
const LOOK: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 0, hair: 1, hairColor: 0, number: 23 };
const COLORS = colorsFor(LOOK, teamRamp('#1d4ed8'), teamRamp('#f59e0b'));
const ROWS: { anim: Anim2D; heading: Heading }[] = [
  { anim: 'idle', heading: 'down' },
  { anim: 'run', heading: 'down' },
];

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

/** PNG RGBA 8 bits. */
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

/** Une grille d'images (une par case) en PNG agrandi, sur fond uni. */
function writeSheet(path: string, rows: { canvas: SlotCanvas; colors: typeof COLORS }[][], cellW: number, cellH: number): string {
  const columns = Math.max(...rows.map((r) => r.length));
  const width = columns * cellW * zoom;
  const height = rows.length * cellH * zoom;
  const rgba = new Uint8Array(width * height * 4);
  const paint = (x: number, y: number, color: number) => {
    for (let j = 0; j < zoom; j++) {
      for (let i = 0; i < zoom; i++) {
        const k = ((y * zoom + j) * width + x * zoom + i) * 4;
        rgba[k] = (color >> 16) & 0xff;
        rgba[k + 1] = (color >> 8) & 0xff;
        rgba[k + 2] = color & 0xff;
        rgba[k + 3] = 255;
      }
    }
  };
  for (let y = 0; y < height / zoom; y++) for (let x = 0; x < width / zoom; x++) paint(x, y, BACKGROUND);
  rows.forEach((row, r) => row.forEach(({ canvas, colors }, c) => canvas.forEach((x, y, slot) => paint(c * cellW + x, r * cellH + y, slotColor(slot, colors)))));
  writeFileSync(path, encodePng(width, height, rgba));
  return `${path} : ${width}×${height} px (×${zoom})`;
}

const bodies = ROWS.map((row) => poses2D(row.anim).map((f) => ({ canvas: renderFigure2D(LOOK, f.pose, row.heading).canvas, colors: COLORS })));
console.log(writeSheet(out, bodies, FRAME.width, FRAME.height));

// Têtes : chaque case porte la tête cernée (contour unique, comme sur le joueur).
const HEAD_CELL = 18;
const headCell = (look: Appearance, heading: Heading, expression: Expression = 'neutre') => {
  const grid = headGrid2D(look, heading, expression);
  const canvas = new SlotCanvas(HEAD_CELL, HEAD_CELL);
  grid.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const slot = slotOf(ch);
    if (slot) canvas.set(x + 1, y, slot);
  }));
  canvas.outline('o');
  return { canvas, colors: colorsFor(look, teamRamp('#1d4ed8'), teamRamp('#f59e0b')) };
};
const heads = (['down', 'up'] as const).flatMap((heading) =>
  [0, 1, 2, 3, 4].map((head) => Array.from({ length: 10 }, (_, hair) => headCell({ ...LOOK, head, hair, skin: (head + hair) % 4, hairColor: hair % HAIR_COLORS.length }, heading))),
);
heads.push((['neutre', 'concentree', 'joyeuse'] as const).flatMap((expression) => [0, 1, 2, 3].map((skin) => headCell({ ...LOOK, skin }, 'down', expression))));
console.log(writeSheet(out.replace(/\.png$/, '') + '-tetes.png', heads, HEAD_CELL, HEAD_CELL));

// Temps de rendu d'une image (moyenne sur toutes les images de la planche).
const all = ROWS.flatMap((row) => poses2D(row.anim).map((f) => () => renderFigure2D(LOOK, f.pose, row.heading)));
const runs = 20;
const t0 = performance.now();
for (let k = 0; k < runs; k++) for (const render of all) render();
const perFrame = (performance.now() - t0) / (runs * all.length);
console.log(`${all.length} images, ${perFrame.toFixed(3)} ms par image`);
