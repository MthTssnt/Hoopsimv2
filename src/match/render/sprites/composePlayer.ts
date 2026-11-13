import { COURT_DESIGNS } from '../../../assets/players/courtDesigns';
import { MOTION_FRAMES, OFFICIAL_LAYOUT } from './layout';
import { FRAME, SPRITE_DETAIL as D, SHEET_VIEWS } from './views';
import { paintMotion } from './motionArt';
import { artCanvas, type ArtCanvas, type ArtSource } from './artCanvas';
import type { Appearance } from './appearance';
import type { BakedPlayer, PortraitPixel } from './bake';

export interface ComposedPlayer {
  atlas: ArtCanvas | ImageBitmap; hands: ArtCanvas | ImageBitmap;
  cells: { x: number; y: number; width: number; height: number; left: number; top: number }[];
  palms: BakedPlayer['palms'];
  anchors: BakedPlayer['anchors']; handCenters: BakedPlayer['handCenters'];
  portrait: BakedPlayer['portrait']; metrics: BakedPlayer['metrics'];
}
/** Whole-character raster composition, independent of Phaser and safe in an OffscreenCanvas worker. */
export function composePlayer(sources: readonly ArtSource[], look: Appearance, team: number): ComposedPlayer {
  const frames = SHEET_VIEWS.flatMap(({ facing, heading }) => MOTION_FRAMES.map((spec) => {
    const art = paintMotion(sources, look, team, spec.motion, spec.frame, heading, facing), b = art.bounds;
    if (b.left <= 0 || b.right >= FRAME.width * D - 1 || b.top <= 0 || b.bottom >= FRAME.height * D - 1) throw new Error(`Image hors cadre : ${spec.motion}/${spec.frame}/${look.variant}`);
    return art;
  }));
  let x = 2, y = 2, rowHeight = 0;
  const cells = frames.map(({ bounds: b }) => {
    const width = b.right - b.left + 1, height = b.bottom - b.top + 1;
    if (x + width + 2 > 2048) { x = 2; y += rowHeight + 4; rowHeight = 0; }
    const cell = { x, y, width, height }; x += width + 4; rowHeight = Math.max(rowHeight, height); return { ...cell, left: b.left, top: b.top };
  });
  const atlas = artCanvas(2048, y + rowHeight + 2), ac = atlas.getContext('2d')!;
  const handSize = 16 * D, columns = 32;
  const hands = artCanvas(columns * handSize, Math.ceil(frames.length / columns) * handSize), hc = hands.getContext('2d')!;
  ac.imageSmoothingEnabled = hc.imageSmoothingEnabled = false;
  const anchors: BakedPlayer['anchors'] = [], handCenters: BakedPlayer['handCenters'] = [];
  const palms: BakedPlayer['palms'] = [];
  let headTop: number = FRAME.groundY, raisedHandTop: number = FRAME.groundY;
  frames.forEach((art, index) => {
    const cell = cells[index], b = art.bounds;
    ac.drawImage(art.canvas, b.left, b.top, cell.width, cell.height, cell.x, cell.y, cell.width, cell.height);

    const hx = index % columns * handSize, hy = Math.floor(index / columns) * handSize;
    const center = { x: Math.round(art.handCenter.x * D) / D, y: Math.round(art.handCenter.y * D) / D };
    hc.drawImage(art.hand, center.x * D - handSize / 2, center.y * D - handSize / 2, handSize, handSize, hx, hy, handSize, handSize);

    anchors.push(art.pose.ball); palms.push(art.pose.palm); handCenters.push(center);
    const spec = MOTION_FRAMES[index % OFFICIAL_LAYOUT.framesPerBlock];
    if (spec.motion === 'idle') headTop = Math.min(headTop, b.top / D);
    if (spec.motion === 'dunk') raisedHandTop = Math.min(raisedHandTop, b.top / D);
  });
  const design = COURT_DESIGNS[team][look.variant];
  const portraitCanvas = artCanvas(18 * D, 18 * D);
  const pc = portraitCanvas.getContext('2d')!; pc.imageSmoothingEnabled = false;
  const rect = design.frames[0], hh = Math.round(rect.height * 0.35), size = 18 * D;
  const ratio = Math.min((size - 2) / rect.width, (size - 2) / hh), pw = rect.width * ratio, ph = hh * ratio;
  pc.drawImage(sources[team], rect.x, rect.y, rect.width, hh, (size - pw) / 2, size - ph - 1, pw, ph);
  const data = pc.getImageData(0, 0, size, size).data; const portrait: PortraitPixel[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; if (data[i + 3] >= 160) portrait.push({ x: x / D, y: y / D, size: 1 / D, color: data[i] << 16 | data[i + 1] << 8 | data[i + 2] }); }
  return { atlas, hands, cells, anchors, palms, handCenters, portrait, metrics: { headTop, raisedHandTop } };
}
