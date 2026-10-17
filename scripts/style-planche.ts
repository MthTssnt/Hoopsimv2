/**
 * Planches des 5 styles candidats (étape 1, rien n'est branché dans le jeu). Plus proche voisin, fond uni.
 * Pour chaque style, `<sortie>-<style>.png` :
 * - les 6 mêmes joueurs à ×3 en diagonale bas, puis en diagonale haut ;
 * - une tête à ×8 avec les 4 expressions (neutre, joie, cri, déçu) ;
 * - 2 images de course à ×3 ;
 * - le terrain en match avec les 10 joueurs dans ce style : capture du jeu figé (`terrain.png`,
 *   joueurs cachés) et positions relevées (`terrain.json`), joueurs redessinés dans le style.
 * Plus `<sortie>-apercu.png` : les 5 styles l'un sous l'autre (joueurs ×3 et expressions ×4).
 *   npx tsx scripts/style-planche.ts <sortie> <terrain.png> <terrain.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { PALETTE, teamRamp, type TeamRamp } from '../src/assets/palette';
import { BALL } from '../src/assets/sprites/arena';
import { appearance2DFor, type Appearance } from '../src/match/render/sprites/appearance';
import { drawText } from '../src/match/render/pixelFont';
import { poses2D } from '../src/match/render/sprites/poses2d';
import type { Heading } from '../src/match/render/sprites/rig';
import { sheetFrames2D } from '../src/match/render/sprites/sheet2d';
import { build2D, joints2D, type Pose2D } from '../src/match/render/sprites/skeleton2d';
import { FRAME_S, headImage, renderStyled, type ColorImage, type Look, type StyleDef } from './styles/figureStyled';
import { EXPRESSIONS_4 } from './styles/head25';
import { STYLES } from './styles/styles';

const [out = 'styles', terrainPng, terrainJson] = process.argv.slice(2);
const BACKGROUND = 0x7d8aa6;
const TEXT = 0xf6f2ea;
const HOME: [TeamRamp, TeamRamp] = [teamRamp('#1d4ed8'), teamRamp('#f59e0b')];

/** Les 6 joueurs des planches : teints, coiffures et gabarits variés, dont un barbu et un chauve. */
const base = (o: Partial<Appearance>): Appearance => ({ heightCm: 200, heavy: false, heightClass: 'moyen', skin: 0, head: 0, hair: 0, hairColor: 1, number: 0, ...o });
const SIX: Appearance[] = [
  base({ heightCm: 186, heightClass: 'petit', skin: 0, head: 0, hair: 0, hairColor: 2, number: 3, eyeColor: 2, face: 0 }),
  base({ heightCm: 200, skin: 3, head: 1, hair: 6, hairColor: 0, number: 34, facialHair: 1, eyeColor: 0, face: 1 }),
  base({ heightCm: 212, heavy: true, heightClass: 'grand', skin: 2, head: 4, hair: 11, hairColor: 0, number: 50, eyeColor: 0, face: 2 }),
  base({ heightCm: 198, skin: 1, head: 2, hair: 7, hairColor: 0, number: 11, eyeColor: 1, face: 3 }),
  base({ heightCm: 192, skin: 0, head: 3, hair: 1, hairColor: 3, number: 7, eyeColor: 3, face: 4, headband: true }),
  base({ heightCm: 205, skin: 2, head: 0, hair: 9, hairColor: 5, number: 23, facialHair: 2, eyeColor: 1, face: 5 }),
];

/** Commentaire de chaque style (lisibilité en mouvement, dribbles avancés, modularité). */
const COMMENTS: Record<string, string[]> = {
  retro: [
    'MOUVEMENT : TRES LISIBLE, SILHOUETTE PROPRE, VISAGE DISCRET MAIS PRESENT',
    'DRIBBLES : BON, CONTOUR TEINTE ET 3 TONS SEPARENT BRAS, JAMBES ET BALLON',
    'MODULAIRE : TRES FACILE, PIECES DE 1 A 3 PX, PEU DE CONFLITS ENTRE PIECES',
  ],
  icone: [
    'MOUVEMENT : EXCELLENT, LES SILHOUETTES ET LES COULEURS PRIMENT',
    'DRIBBLES : MOYEN, 2 TONS SEULEMENT, UN BRAS DEVANT LE CORPS SE LIT MAL',
    'MODULAIRE : LE PLUS SIMPLE, MAIS PEU DE PIECES POUR DISTINGUER LES VISAGES',
  ],
  cartoon: [
    'MOUVEMENT : TRES LISIBLE, GROSSE TETE ET CONTOUR NOIR, CHARGE A 10 JOUEURS',
    'DRIBBLES : MOYEN, LE CONTOUR DE 2 PX EPAISSIT BRAS ET JAMBES QUI SE CROISENT',
    'MODULAIRE : FACILE, BEAUCOUP DE PLACE POUR LES PIECES, TETE ACTUELLE A 1/3',
  ],
  bd: [
    "MOUVEMENT : TRES LISIBLE, VOLUMES FRANCS GRACE A L'OMBRE A BORD NET",
    "DRIBBLES : BON, L'OMBRE MET LE BRAS ELOIGNE EN RETRAIT, CONTOUR GENANT ENTRE LES JAMBES",
    "MODULAIRE : FACILE, 2 TONS, L'OMBRE DU VISAGE EST UNE REGLE, PAS UNE PIECE",
  ],
  peint: [
    "MOUVEMENT : CORRECT, MOINS NET SANS CONTOUR, L'OMBRE AU SOL ANCRE LES JOUEURS",
    'DRIBBLES : TRES BON POUR LA PROFONDEUR, MEMBRES ELOIGNES PLUS SOMBRES ET FROIDS',
    'MODULAIRE : PLUS DIFFICILE, 5 TONS ET UN MODELE A RESPECTER PAR PIECE',
  ],
};

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

function blit(c: Canvas, img: ColorImage, x: number, y: number, zoom: number): void {
  for (let py = 0; py < img.height; py++) for (let px = 0; px < img.width; px++) {
    const col = img.get(px, py);
    if (col >= 0) fill(c, x + px * zoom, y + py * zoom, zoom, zoom, col);
  }
}

/** Ombre au sol : ovale de 20×5 px du jeu, sous les pieds. */
function groundShadow(c: Canvas, cx: number, cy: number, zoom: number, style: StyleDef): void {
  const color = style.coolShadows ? 0x241640 : 0x000000;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -10; dx <= 10; dx++) if ((dx * dx) / 100 + (dy * dy) / 6.25 <= 1) fill(c, cx + dx * zoom, cy + dy * zoom, zoom, zoom, color, style.groundShadow);
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
    for (let x = 0; x < w; x++) {
      c.rgba.set([line[x * bpp], line[x * bpp + 1], line[x * bpp + 2], 255], (y * w + x) * 4);
    }
    prev = line;
  }
  return c;
}

// ------------------------------------------------------------------------------------------------
// Terrain en match

interface Scene {
  cam: { x: number; y: number };
  canvas: { w: number };
  bodies: { feet: { x: number; y: number }; frame: number; depth: number; player: { id: string; heightCm: number; weightKg: number; number: number; age: number }; primary: TeamRamp; secondary: TeamRamp }[];
  ball: { x: number; y: number; depth: number };
}

/** Pose d'une image de la feuille du match (en l'air, bassin remonté à la hauteur de l'arrêt). */
function sheetPose(look: Appearance, frame: number, heading: Heading): Pose2D {
  const spec = sheetFrames2D(heading)[frame];
  if (!spec.air) return spec.pose;
  const b = build2D(look.heightCm, look.heavy);
  const z = (p: Pose2D) => joints2D(b, { ...p, lift: 0 }, heading).pelvis[2];
  return { ...spec.pose, lift: Math.max(0, z(poses2D('idle')[0].pose) - z(spec.pose)), expression: 'neutre' };
}

function matchShot(style: StyleDef, background: Canvas, scene: Scene): Canvas {
  const c: Canvas = { width: background.width, height: background.height, rgba: background.rgba.slice() };
  const zoom = scene.canvas.w / 640;
  const ballImg = ballImage();
  const items = [
    ...scene.bodies.map((b) => ({ depth: b.depth, draw: () => {
      const block = Math.floor(b.frame / 19);
      const heading: Heading = block >= 2 ? 'up' : 'down';
      const facing = block % 2 === 1 ? 'left' : 'right';
      const look2D = appearance2DFor(b.player);
      const look: Look = { ...look2D, facialHair: look2D.facialHair === 4 ? 0 : look2D.facialHair };
      const fig = renderStyled(style, look, sheetPose(look, b.frame % 19, heading), heading, facing, b.primary, b.secondary);
      const sx = Math.round((b.feet.x - FRAME_S.centerX - scene.cam.x) * zoom);
      const sy = Math.round((b.feet.y - FRAME_S.groundY - scene.cam.y) * zoom);
      if (style.groundShadow > 0.4) groundShadow(c, Math.round((b.feet.x - scene.cam.x) * zoom), Math.round((b.feet.y - 1 - scene.cam.y) * zoom), zoom, style);
      blit(c, fig.image, sx, sy, zoom);
    } })),
    { depth: scene.ball.depth, draw: () => blit(c, ballImg, Math.round((scene.ball.x - 5 - scene.cam.x) * zoom), Math.round((scene.ball.y - 5 - scene.cam.y) * zoom), zoom) },
  ].sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
  return c;
}

/** Ballon du jeu (8×8 et son contour). */
function ballImage(): ColorImage {
  const colors: Record<string, number> = { b: PALETTE.orange, B: PALETTE.orangeDark, n: PALETTE.ink, l: PALETTE.woodLight };
  const W = 10;
  const px = new Int32Array(W * W).fill(-1);
  const inside = (x: number, y: number) => (BALL[y - 1]?.[x - 1] ?? '.') !== '.';
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (inside(x, y)) px[y * W + x] = colors[BALL[y - 1][x - 1]];
    else if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) px[y * W + x] = PALETTE.outline;
  }
  return { width: W, height: W, px, get: (x, y) => (x < 0 || y < 0 || x >= W || y >= W ? -1 : px[y * W + x]) };
}

// ------------------------------------------------------------------------------------------------
// Planches

const idle = poses2D('idle')[0].pose;
const run = poses2D('run');
const CELL_W = FRAME_S.width * 3;
const CELL_H = FRAME_S.height * 3;

function player(c: Canvas, style: StyleDef, look: Look, pose: Pose2D, heading: Heading, x: number, y: number, zoom: number): void {
  groundShadow(c, x + FRAME_S.centerX * zoom, y + (FRAME_S.groundY - 1) * zoom, zoom, style);
  blit(c, renderStyled(style, look, pose, heading, 'right', ...HOME).image, x, y, zoom);
}

/** Hauteur de la tête rapportée à celle du joueur (coupe chauve, diagonale bas, à l'arrêt). */
function headRatio(style: StyleDef): number {
  const look = { ...SIX[2], heavy: false, heightCm: 200, hair: 11, facialHair: 0 };
  const img = renderStyled(style, look, idle, 'down', 'right', ...HOME).image;
  const head = headImage(style, look, 'down', ...HOME);
  let top = img.height;
  for (let y = 0; y < img.height && top === img.height; y++) for (let x = 0; x < img.width; x++) if (img.get(x, y) >= 0) top = y;
  return (head.height - 2 * (style.outlineWidth + 1)) / (FRAME_S.groundY - top - style.outlineWidth + 1);
}

function section(style: StyleDef, shot: Canvas | null): Canvas {
  const width = 1920;
  const top = 150;
  const heads = EXPRESSIONS_4.map((expression) => headImage(style, { ...SIX[0], expression }, 'down', ...HOME));
  const headH = Math.max(...heads.map((h) => h.height)) * 8;
  const row3 = top + 2 * (CELL_H + 20);
  const height = row3 + Math.max(headH, CELL_H) + 30 + (shot ? shot.height : 0);
  const c = canvas(width, height);
  text(c, `${style.name}  TETE ${Math.round(headRatio(style) * 100)} POUR CENT`, 20, 16, 4);
  (COMMENTS[style.id] ?? []).forEach((line, k) => text(c, line, 20, 60 + k * 26, 3));
  SIX.forEach((look, k) => player(c, style, look, idle, 'down', 20 + k * CELL_W, top, 3));
  SIX.forEach((look, k) => player(c, style, look, idle, 'up', 20 + k * CELL_W, top + CELL_H + 20, 3));
  // Expressions ×8 (neutre, joie, cri, déçu) : la tête du premier joueur ; puis 2 images de course ×3.
  let x = 20;
  for (const h of heads) {
    blit(c, h, x, row3, 8);
    x += h.width * 8 + 16;
  }
  [1, 5].forEach((f, k) => player(c, style, SIX[1], run[f].pose, 'down', x + 20 + k * CELL_W, row3, 3));
  if (shot) {
    const y0 = row3 + Math.max(headH, CELL_H) + 30;
    for (let y = 0; y < shot.height; y++) c.rgba.set(shot.rgba.subarray(y * shot.width * 4, (y + 1) * shot.width * 4), ((y0 + y) * width) * 4);
  }
  return c;
}

const background = terrainPng ? readPng(terrainPng) : null;
const scene: Scene | null = terrainJson ? JSON.parse(readFileSync(terrainJson, 'utf8')) : null;
for (const style of STYLES) writePng(`${out}-${style.id}.png`, section(style, background && scene ? matchShot(style, background, scene) : null));

// Aperçu : les 5 styles l'un sous l'autre.
const ROW = CELL_H + 40;
const apercu = canvas(1920, STYLES.length * ROW + 20);
STYLES.forEach((style, s) => {
  const y = 20 + s * ROW;
  text(apercu, style.name, 20, y, 3);
  SIX.forEach((look, k) => player(apercu, style, look, idle, 'down', 20 + k * CELL_W, y + 26, 3));
  EXPRESSIONS_4.forEach((expression, k) => blit(apercu, headImage(style, { ...SIX[3], expression }, 'down', ...HOME), 1200 + k * 175, y + 40, 6));
});
writePng(`${out}-apercu.png`, apercu);
