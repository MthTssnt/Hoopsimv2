/**
 * Planches de contrôle du rendu 2D, agrandies sans lissage (plus proche voisin), sur fond uni :
 * - `<sortie>.png` : une rangée par animation, images de gauche à droite ;
 * - `<sortie>-tetes.png` : une rangée par forme de tête avec toutes les coiffures (teints et
 *   couleurs de cheveux variés), en diagonale bas puis en diagonale haut ; la pilosité faciale ;
 *   les expressions ; des joueurs complets à l'arrêt, pour juger le raccord au corps.
 * PNG écrits avec le zlib de Node (sans dépendance) ; affiche le temps de rendu d'une image.
 *   npm run sprites -- [sortie.png] [échelle]
 */
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { HAIR_COLORS, teamRamp } from '../src/assets/palette';
import type { Expression } from '../src/assets/sprites/heads';
import { HAIRS_2D, headGrid2D } from '../src/assets/sprites/heads2d';
import type { Appearance } from '../src/match/render/sprites/appearance';
import { SlotCanvas, slotOf } from '../src/match/render/sprites/canvas';
import { colorsFor, slotColor } from '../src/match/render/sprites/compose';
import { renderFigure2D } from '../src/match/render/sprites/figure2d';
import { drawSmallText, SMALL_H } from '../src/match/render/pixelFont';
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

interface SheetRow {
  label: string;
  cellW: number;
  cellH: number;
  cells: { canvas: SlotCanvas; colors: typeof COLORS }[];
}

const LABEL_W = 44;
const LABEL_COLOR = 0xf6f2ea;

/** Rangées d'images (une par case) en PNG agrandi, sur fond uni, avec leur étiquette à gauche. */
function writeSheet(path: string, rows: SheetRow[], labels: boolean): string {
  const left = labels ? LABEL_W : 0;
  const width = (left + Math.max(...rows.map((r) => r.cells.length * r.cellW))) * zoom;
  const height = rows.reduce((h, r) => h + r.cellH, 0) * zoom;
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
  let top = 0;
  for (const row of rows) {
    if (labels) {
      const target = { fillRect: (x: number, y: number, w: number, h: number) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) paint(x + i, y + j, LABEL_COLOR); } };
      drawSmallText(target, row.label, 2, top + Math.floor((row.cellH - SMALL_H) / 2));
    }
    row.cells.forEach(({ canvas, colors }, c) => canvas.forEach((x, y, slot) => paint(left + c * row.cellW + x, top + y, slotColor(slot, colors))));
    top += row.cellH;
  }
  writeFileSync(path, encodePng(width, height, rgba));
  return `${path} : ${width}×${height} px (×${zoom})`;
}

const bodies: SheetRow[] = ROWS.map((row) => ({
  label: row.anim,
  cellW: FRAME.width,
  cellH: FRAME.height,
  cells: poses2D(row.anim).map((f) => ({ canvas: renderFigure2D(LOOK, f.pose, row.heading).canvas, colors: COLORS })),
}));
console.log(writeSheet(out, bodies, false));

// Têtes : chaque case porte la tête cernée (contour unique, comme sur le joueur).
const HEAD_CELL = 20;
const colorsOf = (look: Appearance) => colorsFor(look, teamRamp('#1d4ed8'), teamRamp('#f59e0b'));
const headCell = (look: Appearance, heading: Heading, expression: Expression = 'neutre') => {
  const grid = headGrid2D(look, heading, expression);
  const canvas = new SlotCanvas(HEAD_CELL, HEAD_CELL);
  grid.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const slot = slotOf(ch);
    if (slot) canvas.set(x + 1, y + 1, slot);
  }));
  canvas.outline('o');
  return { canvas, colors: colorsOf(look) };
};
const headRow = (label: string, cells: SheetRow['cells']): SheetRow => ({ label, cellW: HEAD_CELL, cellH: HEAD_CELL, cells });
const look = (head: number, hair: number, skin: number, hairColor: number, facialHair = 0): Appearance => ({ ...LOOK, head, hair, skin, hairColor, facialHair });
const SHAPE_NAMES = ['RONDE', 'CARREE', 'LONGUE', 'LARGE', 'POINTUE'];
// Toutes les coiffures sur chaque forme ; teints et couleurs de cheveux tournent.
const variants = (head: number) => Array.from({ length: HAIRS_2D.length }, (_, hair) => look(head, hair, (head + hair) % 4, (head * 3 + hair) % HAIR_COLORS.length));
const heads: SheetRow[] = [
  ...SHAPE_NAMES.map((name, head) => headRow(name, variants(head).map((l) => headCell(l, 'down')))),
  ...SHAPE_NAMES.map((name, head) => headRow(`${name} DOS`, variants(head).map((l) => headCell(l, 'up')))),
  headRow('PILOSITE', [
    ...[1, 2, 3, 4].flatMap((facial) => [headCell(look(1, 1, 1, 1, facial), 'down'), headCell(look(3, 0, 3, 0, facial), 'down')]),
    headCell(look(1, 1, 1, 1, 1), 'up'),
    headCell(look(3, 0, 3, 0, 4), 'up'),
  ]),
  headRow('EXPRESSIONS', (['neutre', 'concentree', 'joyeuse'] as const).flatMap((e) => [0, 2, 3].map((skin) => headCell(look(skin, [1, 7, 2][skin % 3], skin, skin === 0 ? 2 : 0), 'down', e)))),
  {
    label: 'JOUEURS',
    cellW: FRAME.width,
    cellH: FRAME.height,
    cells: [look(1, 1, 3, 0, 1), look(2, 7, 0, 2), look(0, 2, 2, 0), look(4, 8, 1, 1, 2), look(3, 5, 3, 0, 4), look(1, 3, 2, 3)].map((l, k) => ({
      canvas: renderFigure2D({ ...l, heightCm: [200, 186, 212, 196, 206, 200][k], heavy: k === 2, number: [23, 7, 34, 11, 50, 3][k] }, poses2D('idle')[0].pose, k === 5 ? 'up' : 'down').canvas,
      colors: colorsOf(l),
    })),
  },
];
console.log(writeSheet(out.replace(/\.png$/, '') + '-tetes.png', heads, true));

// Temps de rendu d'une image (moyenne sur toutes les images de la planche).
const all = ROWS.flatMap((row) => poses2D(row.anim).map((f) => () => renderFigure2D(LOOK, f.pose, row.heading)));
const runs = 20;
const t0 = performance.now();
for (let k = 0; k < runs; k++) for (const render of all) render();
const perFrame = (performance.now() - t0) / (runs * all.length);
console.log(`${all.length} images, ${perFrame.toFixed(3)} ms par image`);
