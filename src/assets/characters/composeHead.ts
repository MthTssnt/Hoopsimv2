/**
 * Compositeur de tête : assemble les pièces d'une `PlayerAppearance` dans une grille
 * d'emplacements de couleur, dans un ordre fixe (de l'arrière vers l'avant) :
 *
 *   1. cheveux arrière     6. bouche
 *   2. tête (peau)         7. yeux
 *   3. oreilles            8. sourcils
 *   4. pilosité            9. cheveux avant
 *   5. nez                10. accessoires
 *
 * Chaque pièce est posée à un ancrage de la forme de tête. Règles de recouvrement (masques, pas
 * de cas particuliers par pièce) :
 * - de dos (diagonale haut), les pièces du visage (nez, bouche, yeux, sourcils) sont masquées ;
 * - les pièces du visage et la pilosité ne se posent que sur la tête (sauf un nez `outside`) ;
 * - la bouche passe devant la pilosité ; le nez aussi ;
 * - les mèches avant n'entrent pas dans la zone du visage de la forme (sauf jusqu'à la rangée
 *   `fringeRow` d'une frange) : elles ne couvrent jamais les sourcils ni les yeux ;
 * - les mèches (avant et arrière) ne couvrent l'oreille que si la coiffure `coversEars` ;
 * - un accessoire `wrap` est découpé sur la tête déjà peinte.
 *
 * Modelé du style 5 : peau claire (5), pommette au reflet (1), ombre (3) sur le bas de la mâchoire
 * et sur les deux colonnes du bord droit, ombre portée de la ligne des cheveux ; pilosité à
 * l'ombre (B) sur son bord bas ; accessoire à l'ombre (d) au bout droit de chaque rangée.
 * Pur (sans Phaser), testé.
 */
import type { PlayerAppearance } from './appearance';
import { partOf } from './registry';
import type { Expression, Grid, View } from './types';

export interface HeadImage {
  /** Grille d'emplacements de couleur (« . » : vide), recadrée sur la tête. */
  rows: string[];
  /** Haut du cou dans `rows` : la tête se pose là sur le corps. */
  neck: { x: number; y: number };
}

/** Calque de chaque pixel (pour les règles de recouvrement). */
type Layer = 'hairBack' | 'skin' | 'ear' | 'facial' | 'nose' | 'mouth' | 'eye' | 'brow' | 'hairFront' | 'accessory';

const PAD = 10;
const SIZE = 12 + PAD * 2;
const HAIR_SLOTS = new Set(['r', 'h', 'H', 'D', 'E', '0']);
/** Tons de peau du visage, pour le modelé du bord droit. */
const SKIN_TONES = new Set(['1', '5', '3', '4']);

const cache = new Map<string, HeadImage>();

export function composeHead(look: PlayerAppearance, view: View, expression: Expression = 'neutre'): HeadImage {
  const key = `${JSON.stringify(look)}|${view}|${expression}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const made = compose(look, view, expression);
  if (cache.size > 2000) cache.clear();
  cache.set(key, made);
  return made;
}

function compose(look: PlayerAppearance, view: View, expression: Expression): HeadImage {
  const shape = partOf('headShapes', look.headShape).views[view];
  const A = shape.anchors;
  const hair = partOf('hair', look.hair);
  const slot: string[][] = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => '.'));
  const layer: (Layer | null)[][] = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
  const get = (x: number, y: number) => slot[y + PAD]?.[x + PAD] ?? '.';
  const layerAt = (x: number, y: number) => layer[y + PAD]?.[x + PAD] ?? null;
  const set = (x: number, y: number, ch: string, l: Layer) => {
    if (x + PAD < 0 || y + PAD < 0 || x + PAD >= SIZE || y + PAD >= SIZE) return;
    slot[y + PAD][x + PAD] = ch;
    layer[y + PAD][x + PAD] = l;
  };
  const skull = (x: number, y: number) => shape.skull[y]?.[x] === 'x';
  /** Pixels d'une grille posée à un ancrage. */
  const pixels = (g: Grid, anchor: readonly [number, number]) => {
    const out: [number, number, string][] = [];
    g.rows.forEach((row, gy) => [...row].forEach((ch, gx) => ch !== '.' && out.push([anchor[0] + g.at[0] + gx, anchor[1] + g.at[1] + gy, ch])));
    return out;
  };
  const onHead = (x: number, y: number) => skull(x, y) && layerAt(x, y) !== null && layerAt(x, y) !== 'hairBack';

  // 1. Cheveux arrière.
  for (const [x, y, ch] of pixels(hair.views[view].back, A.hairline)) set(x, y, ch, 'hairBack');

  // 2. Tête : silhouette de la forme, ombre sous la mâchoire (de face) ou sur la nuque (de dos).
  shape.skull.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== 'x') return;
      const left = row.indexOf('x');
      const right = row.lastIndexOf('x');
      const shade = view === 'down' ? y >= 8 && (x === left || !skull(x, y + 1) || (x === right && y > 8)) : !skull(x, y + 1);
      set(x, y, shade ? '3' : '5', 'skin');
    }),
  );
  if (view === 'down' && skull(...A.cheek)) set(A.cheek[0], A.cheek[1], '1', 'skin');

  // 3. Oreilles.
  const ears = partOf('ears', look.ears).views;
  const earPixels = view === 'down' ? pixels(ears.down.near, A.earNear) : [...pixels(ears.up.near, A.earNear), ...pixels(ears.up.far, A.earFar)];
  // Une coiffure couvrante cache aussi l'oreille derrière ses mèches arrière.
  for (const [x, y, ch] of earPixels) if (!(hair.coversEars && layerAt(x, y) === 'hairBack')) set(x, y, ch, 'ear');

  // 4. Pilosité, découpée sur la peau.
  if (look.facialHair) {
    const facial = partOf('facialHair', look.facialHair).views[view];
    for (const [x, y, ch] of pixels(facial, A.mouth)) if (layerAt(x, y) === 'skin' || layerAt(x, y) === 'ear') set(x, y, ch, 'facial');
    // Modelé : le bord bas de la pilosité passe à l'ombre.
    for (let y = -PAD; y < SIZE - PAD; y++) for (let x = -PAD; x < SIZE - PAD; x++) if (layerAt(x, y) === 'facial' && get(x, y) === 'b' && !onHead(x, y + 1)) set(x, y, 'B', 'facial');
  }

  // 5-8. Visage, de face seulement : nez, bouche, yeux, sourcils.
  if (view === 'down') {
    const nose = partOf('noses', look.nose);
    for (const [x, y, ch] of pixels(nose.grid, A.nose)) if (onHead(x, y) || (nose.outside && !onHead(x, y))) set(x, y, ch, 'nose');
    for (const [x, y, ch] of pixels(partOf('mouths', look.mouth).expressions[expression], A.mouth)) if (onHead(x, y)) set(x, y, ch, 'mouth');
    const eyes = partOf('eyes', look.eyes).expressions[expression];
    for (const [x, y, ch] of [...pixels(eyes.near, A.eyeNear), ...pixels(eyes.far, A.eyeFar)]) if (onHead(x, y)) set(x, y, ch, 'eye');
    const brows = partOf('brows', look.brows).expressions[expression];
    for (const [x, y, ch] of [...pixels(brows.near, A.browNear), ...pixels(brows.far, A.browFar)]) if (onHead(x, y)) set(x, y, ch, 'brow');
  }

  // 9. Cheveux avant : hors de la zone du visage (sauf frange), hors de l'oreille (sauf coiffure couvrante).
  const face = shape.face;
  for (const [x, y, ch] of pixels(hair.views[view].front, A.hairline)) {
    const inFace = view === 'down' && skull(x, y) && x >= face.x0 && x <= face.x1 && y >= face.y0 && (hair.fringeRow === undefined || y > hair.fringeRow);
    if (inFace || (layerAt(x, y) === 'ear' && !hair.coversEars)) continue;
    set(x, y, ch, 'hairFront');
  }
  // Ombre portée de la ligne des cheveux sur la peau juste dessous.
  for (let y = -PAD + 1; y < SIZE - PAD; y++) for (let x = -PAD; x < SIZE - PAD; x++) if (layerAt(x, y) === 'skin' && get(x, y) === '5' && HAIR_SLOTS.has(get(x, y - 1))) set(x, y, '3', 'skin');

  // 10. Accessoires, découpés sur la tête peinte, puis leurs pans libres.
  for (const id of look.accessories) {
    const acc = partOf('accessories', id);
    const placed: [number, number][] = [];
    for (const [x, y, ch] of pixels(acc.views[view], A.hairline)) {
      if (acc.wrap && get(x, y) === '.') continue;
      set(x, y, ch, 'accessory');
      placed.push([x, y]);
    }
    if (!placed.length) continue;
    // Modelé : le bout droit de chaque rangée à l'ombre.
    for (const y of new Set(placed.map((p) => p[1]))) set(Math.max(...placed.filter((p) => p[1] === y).map((p) => p[0])), y, 'd', 'accessory');
    const loose = acc.loose?.[view];
    if (loose) {
      const lastRow = Math.max(...placed.map((p) => p[1]));
      const leftEnd = Math.min(...placed.filter((p) => p[1] === lastRow).map((p) => p[0]));
      for (const [x, y, ch] of pixels(loose, [leftEnd, lastRow])) set(x, y, ch, 'accessory');
    }
  }

  // Modelé de la peau : les deux colonnes du bord droit de la peau visible passent à l'ombre.
  for (let y = 0; y < SIZE; y++) {
    const row = slot[y];
    let right = -1;
    for (let x = SIZE - 1; x >= 0 && right < 0; x--) if (SKIN_TONES.has(row[x])) right = x;
    for (let x = Math.max(0, right - 1); right >= 0 && x <= right; x++) if (row[x] === '5') row[x] = '3';
  }

  const used = slot.map((r) => r.some((c) => c !== '.'));
  const top = used.indexOf(true);
  const bottom = used.lastIndexOf(true);
  let left = SIZE;
  let right = -1;
  for (let y = top; y <= bottom; y++)
    slot[y].forEach((c, x) => {
      if (c === '.') return;
      left = Math.min(left, x);
      right = Math.max(right, x);
    });
  return {
    rows: slot.slice(top, bottom + 1).map((r) => r.slice(left, right + 1).join('')),
    neck: { x: A.neck[0] + PAD - left, y: A.neck[1] + PAD - top },
  };
}
