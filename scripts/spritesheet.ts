/**
 * Planche des animations du rendu 2D (style 5), agrandie sans lissage (plus proche voisin), sur fond
 * uni : une rangée par animation, images de gauche à droite. Les têtes et les pièces ont leur propre
 * planche (`scripts/characters-planche.ts`).
 * PNG écrit avec le zlib de Node (sans dépendance) ; affiche le temps de rendu d'une image.
 *   npm run sprites -- [sortie.png] [échelle de la première planche]
 */
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { teamRamp } from '../src/assets/palette';
import type { Appearance } from '../src/match/render/sprites/appearance';
import type { SlotCanvas } from '../src/match/render/sprites/canvas';
import { slotColor, type SlotColors } from '../src/match/render/sprites/compose';
import { renderFigure2D } from '../src/match/render/sprites/figure2d';
import { colorsPainted } from '../src/match/render/sprites/paintedColors';
import { drawSmallText, SMALL_H } from '../src/match/render/pixelFont';
import { poses2D, type Anim2D } from '../src/match/render/sprites/poses2d';
import { FRAME, type Heading } from '../src/match/render/sprites/rig';

const out = process.argv[2] ?? 'planche-sprites-2d.png';
const zoom = Number(process.argv[3] ?? 4);
const BACKGROUND = 0x7d8aa6;

/** Ailier de 2,00 m, coupe courte, numéro 23, aux couleurs d'une équipe du jeu. */
const LOOK: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 0, hair: 1, hairColor: 0, number: 23 };
const COLORS = colorsPainted(LOOK, teamRamp('#1d4ed8'), teamRamp('#f59e0b'));
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

/** Une rangée de la planche : des images de même taille, au même agrandissement, avec une étiquette. */
interface SheetRow {
  label: string;
  zoom: number;
  cellW: number;
  cellH: number;
  cells: { canvas: SlotCanvas; colors: SlotColors }[];
}

const LABEL_W = 56;
const LABEL_ZOOM = 3;
const LABEL_COLOR = 0xf6f2ea;
const GAP = 6;

/** Rangées d'images en PNG (chaque rangée à son agrandissement), sur fond uni, étiquette à gauche (×3). */
function writeSheet(path: string, rows: SheetRow[], labels: boolean): string {
  const left = labels ? LABEL_W * LABEL_ZOOM : 0;
  const width = left + Math.max(...rows.map((r) => r.cells.length * r.cellW * r.zoom));
  const height = rows.reduce((h, r) => h + r.cellH * r.zoom + GAP, 0);
  const rgba = new Uint8Array(width * height * 4);
  const fill = (x0: number, y0: number, w: number, h: number, color: number) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const k = (y * width + x) * 4;
        rgba[k] = (color >> 16) & 0xff;
        rgba[k + 1] = (color >> 8) & 0xff;
        rgba[k + 2] = color & 0xff;
        rgba[k + 3] = 255;
      }
    }
  };
  fill(0, 0, width, height, BACKGROUND);
  let top = 0;
  for (const row of rows) {
    const h = row.cellH * row.zoom;
    if (labels) {
      const z = LABEL_ZOOM;
      const target = { fillRect: (x: number, y: number, w: number, hh: number) => fill(x * z, y * z, w * z, hh * z, LABEL_COLOR) };
      drawSmallText(target, row.label, 2, Math.floor((top + (h - SMALL_H * z) / 2) / z));
    }
    row.cells.forEach(({ canvas, colors }, c) =>
      canvas.forEach((x, y, slot) => fill(left + (c * row.cellW + x) * row.zoom, top + y * row.zoom, row.zoom, row.zoom, slotColor(slot, colors))),
    );
    top += h + GAP;
  }
  writeFileSync(path, encodePng(width, height, rgba));
  return `${path} : ${width}×${height} px`;
}

const bodies: SheetRow[] = ROWS.map((row) => ({
  label: row.anim,
  zoom,
  cellW: FRAME.width,
  cellH: FRAME.height,
  cells: poses2D(row.anim).map((f) => ({ canvas: renderFigure2D(LOOK, f.pose, row.heading).canvas, colors: COLORS })),
}));
console.log(writeSheet(out, bodies, false));

// Temps de rendu d'une image (moyenne sur toutes les images de la planche).
const all = ROWS.flatMap((row) => poses2D(row.anim).map((f) => () => renderFigure2D(LOOK, f.pose, row.heading)));
const runs = 20;
const t0 = performance.now();
for (let k = 0; k < runs; k++) for (const render of all) render();
const perFrame = (performance.now() - t0) / (runs * all.length);
console.log(`${all.length} images, ${perFrame.toFixed(3)} ms par image`);
