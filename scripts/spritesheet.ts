/**
 * Planches de contrôle du rendu 2D, agrandies sans lissage (plus proche voisin), sur fond uni :
 * - `<sortie>.png` : une rangée par animation, images de gauche à droite ;
 * - `<sortie>-tetes.png` : une tête de face et de dos sur 3 teints et les 4 expressions (×8) ; 6 joueurs
 *   entiers à l'arrêt en ×4, puis en ×3 (match en plein écran 1080p) en diagonale bas et haut ; la
 *   course en ×3 ; toutes les coiffures de face et de dos (×4, couleurs variées, bandeau en option).
 * PNG écrits avec le zlib de Node (sans dépendance) ; affiche le temps de rendu d'une image.
 *   npm run sprites -- [sortie.png] [échelle de la première planche]
 */
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { teamRamp } from '../src/assets/palette';
import { FACE_TRAITS, HAIRS_2D, headGrid2D, type FaceExpression } from '../src/assets/sprites/heads2d';
import type { Appearance } from '../src/match/render/sprites/appearance';
import { SlotCanvas, slotOf } from '../src/match/render/sprites/canvas';
import { colors2D, slotColor, type SlotColors } from '../src/match/render/sprites/compose';
import { colorOutline, renderFigure2D } from '../src/match/render/sprites/figure2d';
import { drawSmallText, SMALL_H } from '../src/match/render/pixelFont';
import { poses2D, type Anim2D } from '../src/match/render/sprites/poses2d';
import { FRAME, type Heading } from '../src/match/render/sprites/rig';

const out = process.argv[2] ?? 'planche-sprites-2d.png';
const zoom = Number(process.argv[3] ?? 4);
const BACKGROUND = 0x7d8aa6;

/** Ailier de 2,00 m, coupe courte, numéro 23, aux couleurs d'une équipe du jeu. */
const LOOK: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 0, hair: 1, hairColor: 0, number: 23 };
const COLORS = colors2D(LOOK, teamRamp('#1d4ed8'), teamRamp('#f59e0b'));
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

const team = (look: Appearance) => colors2D(look, teamRamp('#1d4ed8'), teamRamp('#f59e0b'));
const bodies: SheetRow[] = ROWS.map((row) => ({
  label: row.anim,
  zoom,
  cellW: FRAME.width,
  cellH: FRAME.height,
  cells: poses2D(row.anim).map((f) => ({ canvas: renderFigure2D(LOOK, f.pose, row.heading).canvas, colors: COLORS })),
}));
console.log(writeSheet(out, bodies, false));

// Planche des têtes : une tête de face et de dos sur 3 teints, les 4 expressions (×8) ; puis 6 joueurs
// entiers (×4, puis ×3 : l'échelle du match en plein écran 1080p, en diagonale bas et haut) ; la
// course à ×3 ; toutes les coiffures (×4), de face puis de dos.
const HEAD_CELL = 32;
const headCell = (look: Appearance, heading: Heading, expression: FaceExpression = 'neutre') => {
  const grid = headGrid2D(look, heading, expression);
  const canvas = new SlotCanvas(HEAD_CELL, HEAD_CELL);
  const dx = Math.floor((HEAD_CELL - grid.rows[0].length) / 2);
  const dy = HEAD_CELL - 1 - grid.rows.length;
  grid.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const slot = slotOf(ch);
    if (slot) canvas.set(x + dx, y + dy, slot);
  }));
  colorOutline(canvas, (x, y) => (canvas.get(x, y) && 'rhHDE'.includes(canvas.get(x, y)!) ? 'hair' : 'skin'));
  return { canvas, colors: team(look) };
};
// Joueurs de la planche : apparence complète du rendu 2D.
const look2D = (o: Partial<Appearance>): Appearance => ({ ...LOOK, hair: 0, hairColor: 1, skin: 2, head: 0, face: 0, number: 23, ...o });
const headRow = (label: string, cells: SheetRow['cells'], z = 8): SheetRow => ({ label, zoom: z, cellW: HEAD_CELL, cellH: HEAD_CELL, cells });
const HAIR_COLOR_ORDER = [0, 1, 5, 3, 2, 4]; // noir, brun, châtain, roux, blond, gris
const styleLook = (hair: number, extra: Partial<Appearance> = {}) =>
  look2D({ hair, hairColor: HAIR_COLOR_ORDER[hair % 6], skin: [2, 0, 3, 1][hair % 4], face: hair % FACE_TRAITS.length, head: hair % 5, eyeColor: hair % 4, ...extra });
const styles = HAIRS_2D.map((_, hair) => styleLook(hair));
// Le bandeau, option combinable : sur les cheveux longs et sur la coupe en pics.
const banded = [styleLook(5, { headband: true }), styleLook(1, { headband: true })];
const six = [
  look2D({ hair: 0, hairColor: 1, skin: 2, head: 0, face: 0, number: 23, eyeColor: 0 }),
  look2D({ hair: 6, hairColor: 0, skin: 3, head: 1, face: 1, number: 34, facialHair: 1, eyeColor: 0 }),
  look2D({ hair: 3, hairColor: 2, skin: 0, head: 2, face: 3, number: 7, eyeColor: 1 }),
  look2D({ hair: 7, hairColor: 0, skin: 3, head: 3, face: 4, number: 11, heightCm: 212, heavy: true, eyeColor: 3 }),
  look2D({ hair: 9, hairColor: 5, skin: 1, head: 4, face: 2, number: 50, facialHair: 2, heightCm: 186, eyeColor: 2 }),
  look2D({ hair: 12, hairColor: 3, skin: 0, head: 0, face: 5, number: 3, headband: true, eyeColor: 1 }),
];
const full = (label: string, z: number, looks: Appearance[], heading: Heading = 'down'): SheetRow => ({
  label,
  zoom: z,
  cellW: FRAME.width,
  cellH: FRAME.height,
  cells: looks.map((l) => ({ canvas: renderFigure2D(l, poses2D('idle')[0].pose, heading).canvas, colors: team(l) })),
});
const TEST_HEAD = (skin: number) => look2D({ skin, hair: 0, hairColor: 1, face: 1, eyeColor: 1 });
const runner = six[0];
const heads: SheetRow[] = [
  headRow('TETE FACE DOS', [0, 2, 3].flatMap((skin) => (['down', 'up'] as const).map((h) => headCell(TEST_HEAD(skin), h)))),
  headRow('EXPRESSIONS', (['concentree', 'joyeuse', 'effort', 'decu'] as const).map((e) => headCell(TEST_HEAD(2), 'down', e))),
  full('6 JOUEURS X4', 4, six),
  full('MATCH X3 BAS', 3, six, 'down'),
  full('MATCH X3 HAUT', 3, six, 'up'),
  { label: 'COURSE X3', zoom: 3, cellW: FRAME.width, cellH: FRAME.height, cells: poses2D('run').map((f) => ({ canvas: renderFigure2D(runner, f.pose, 'down').canvas, colors: team(runner) })) },
  headRow('COIFFURES FACE', [...styles, ...banded].map((l) => headCell(l, 'down')), 4),
  headRow('COIFFURES DOS', [...styles, ...banded].map((l) => headCell(l, 'up')), 4),
];
console.log(writeSheet(out.replace(/\.png$/, '') + '-tetes.png', heads, true));

// Temps de rendu d'une image (moyenne sur toutes les images de la planche).
const all = ROWS.flatMap((row) => poses2D(row.anim).map((f) => () => renderFigure2D(LOOK, f.pose, row.heading)));
const runs = 20;
const t0 = performance.now();
for (let k = 0; k < runs; k++) for (const render of all) render();
const perFrame = (performance.now() - t0) / (runs * all.length);
console.log(`${all.length} images, ${perFrame.toFixed(3)} ms par image`);
