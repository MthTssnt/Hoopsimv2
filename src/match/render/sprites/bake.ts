import type Phaser from 'phaser';
import { PLAYER_SOURCES } from '../../../assets/players/sources';
import { COURT_DESIGNS } from '../../../assets/players/courtDesigns';
import { OFFICIAL_LAYOUT, MOTION_FRAMES, type SheetLayout } from './layout';
import { FRAME, SPRITE_DETAIL as D, SHEET_VIEWS, type AnimationName, type Facing, type Heading } from './views';
import { paintMotion } from './motionArt';
import type { Appearance } from './appearance';

export interface PortraitPixel { x: number; y: number; color: number; size?: number }
export interface BakedPlayer {
  key: string; layout: SheetLayout;
  anchors: ({ x: number; y: number; behind?: boolean } | null)[];
  metrics: { headTop: number; raisedHandTop: number };
  portrait: PortraitPixel[]; handKey: string; handCenters: { x: number; y: number }[];
}
const SOURCE_KEYS = PLAYER_SOURCES.map((_, i) => `official-players-${i}`);
export function preloadPlayers(scene: Phaser.Scene): void {
  PLAYER_SOURCES.forEach((url, i) => { if (!scene.textures.exists(SOURCE_KEYS[i])) scene.load.image(SOURCE_KEYS[i], url); });
}
export function animationKey(key: string, name: AnimationName, facing: Facing, heading: Heading = 'down'): string {
  return `${key}:${name}${heading === 'up' ? ':up' : ''}${facing === 'left' ? ':left' : ''}`;
}

/** Atlas rogné avec repères fixes : conserve le détail sans réserver une grande case vide par pose. */
export function bakePlayer(scene: Phaser.Scene, key: string, look: Appearance, team: number): BakedPlayer {
  const sources = SOURCE_KEYS.map((source) => {
    if (!scene.textures.exists(source)) throw new Error(`Planche de joueurs indisponible : ${source}`);
    return scene.textures.get(source).getSourceImage() as HTMLImageElement;
  });
  const handKey = `${key}-hand`;
  for (const k of [key, handKey]) if (scene.textures.exists(k)) scene.textures.remove(k);
  const frames = SHEET_VIEWS.flatMap(({ facing, heading }) => MOTION_FRAMES.map((spec) => {
    const art = paintMotion(sources, look, team, spec.motion, spec.frame, heading, facing), b = art.bounds;
    if (b.left <= 0 || b.right >= FRAME.width * D - 1 || b.top <= 0 || b.bottom >= FRAME.height * D - 1) throw new Error(`Image hors cadre : ${spec.motion}/${spec.frame}/${look.variant}`);
    return art;
  }));
  let x = 2, y = 2, rowHeight = 0;
  const cells = frames.map(({ bounds: b }) => {
    const width = b.right - b.left + 1, height = b.bottom - b.top + 1;
    if (x + width + 2 > 2048) { x = 2; y += rowHeight + 4; rowHeight = 0; }
    const cell = { x, y, width, height }; x += width + 4; rowHeight = Math.max(rowHeight, height); return cell;
  });
  const texture = scene.textures.createCanvas(key, 2048, y + rowHeight + 2)!;
  const handSize = 16 * D, columns = 32;
  const hands = scene.textures.createCanvas(handKey, columns * handSize, Math.ceil(frames.length / columns) * handSize)!;
  texture.context.imageSmoothingEnabled = hands.context.imageSmoothingEnabled = false;
  const anchors: BakedPlayer['anchors'] = [], handCenters: BakedPlayer['handCenters'] = [];
  let headTop: number = FRAME.groundY, raisedHandTop: number = FRAME.groundY;
  frames.forEach((art, index) => {
    const cell = cells[index], b = art.bounds;
    texture.context.drawImage(art.canvas, b.left, b.top, cell.width, cell.height, cell.x, cell.y, cell.width, cell.height);
    texture.add(index, 0, cell.x, cell.y, cell.width, cell.height)!.setTrim(FRAME.width * D, FRAME.height * D, b.left, b.top, cell.width, cell.height);
    const hx = index % columns * handSize, hy = Math.floor(index / columns) * handSize;
    const center = { x: Math.round(art.handCenter.x * D) / D, y: Math.round(art.handCenter.y * D) / D };
    hands.context.drawImage(art.hand, center.x * D - handSize / 2, center.y * D - handSize / 2, handSize, handSize, hx, hy, handSize, handSize);
    hands.add(index, 0, hx, hy, handSize, handSize);
    anchors.push(art.pose.ball); handCenters.push(center);
    const spec = MOTION_FRAMES[index % OFFICIAL_LAYOUT.framesPerBlock];
    if (spec.motion === 'idle') headTop = Math.min(headTop, b.top / D);
    if (spec.motion === 'dunk') raisedHandTop = Math.min(raisedHandTop, b.top / D);
  });
  SHEET_VIEWS.forEach(({ facing, heading }, block) => {
    for (const [name, def] of Object.entries(OFFICIAL_LAYOUT.animations) as [AnimationName, SheetLayout['animations'][AnimationName]][]) {
      const animKey = animationKey(key, name, facing, heading); if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
      const base = Math.min(...def.durations);
      scene.anims.create({ key: animKey, frames: def.frames.map((f, i) => ({ key, frame: block * OFFICIAL_LAYOUT.framesPerBlock + f, duration: def.durations[i] - base })), frameRate: 1000 / base, repeat: def.loop ? -1 : 0 });
    }
  });
  texture.refresh(); hands.refresh();
  const design = COURT_DESIGNS[team][look.variant];
  const portraitCanvas = document.createElement('canvas'); portraitCanvas.width = portraitCanvas.height = 18 * D;
  const pc = portraitCanvas.getContext('2d')!; pc.imageSmoothingEnabled = false;
  const rect = design.frames[0], hh = Math.round(rect.height * 0.35), size = 18 * D;
  const ratio = Math.min((size - 2) / rect.width, (size - 2) / hh), pw = rect.width * ratio, ph = hh * ratio;
  pc.drawImage(sources[team], rect.x, rect.y, rect.width, hh, (size - pw) / 2, size - ph - 1, pw, ph);
  const data = pc.getImageData(0, 0, size, size).data; const portrait: PortraitPixel[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; if (data[i + 3] >= 160) portrait.push({ x: x / D, y: y / D, size: 1 / D, color: data[i] << 16 | data[i + 1] << 8 | data[i + 2] }); }
  return { key, layout: OFFICIAL_LAYOUT, anchors, portrait, handKey, handCenters, metrics: { headTop, raisedHandTop } };
}
export function bakeShadow(scene: Phaser.Scene, key: string, width: number, height = 5): void {
  if (scene.textures.exists(key)) return; const g = scene.add.graphics(); g.fillStyle(0x18203a, 0.35);
  for (let y = 0; y < height; y++) { const half = Math.round(width / 2 * Math.sqrt(1 - ((y + 0.5 - height / 2) / (height / 2)) ** 2)); g.fillRect(Math.round(width / 2) - half, y, half * 2, 1); }
  g.generateTexture(key, width, height); g.destroy();
}
