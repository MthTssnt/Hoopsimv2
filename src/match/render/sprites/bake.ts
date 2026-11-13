import type Phaser from 'phaser';
import { PLAYER_SOURCES } from '../../../assets/players/sources';
import { OFFICIAL_LAYOUT, type SheetLayout } from './layout';
import { FRAME, SPRITE_DETAIL as D, SHEET_VIEWS, type AnimationName, type Facing, type Heading } from './views';
import { composePlayer, type ComposedPlayer } from './composePlayer';
import type { Appearance } from './appearance';

export interface PortraitPixel { x: number; y: number; color: number; size?: number }
export interface BakedPlayer {
  key: string; layout: SheetLayout;
  anchors: ({ x: number; y: number; behind?: boolean } | null)[];
  palms: ({ x: number; y: number } | null)[];
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

/** Upload an already composed player; no pose composition occurs when substitutes enter. */
export function installPlayer(scene: Phaser.Scene, key: string, data: ComposedPlayer): BakedPlayer {
  const handKey = `${key}-hand`;
  for (const k of [key, handKey]) if (scene.textures.exists(k)) scene.textures.remove(k);
  const texture = scene.textures.createCanvas(key, data.atlas.width, data.atlas.height)!;
  const hands = scene.textures.createCanvas(handKey, data.hands.width, data.hands.height)!;
  texture.context.drawImage(data.atlas, 0, 0); hands.context.drawImage(data.hands, 0, 0);
  const handSize = 16 * D, columns = 32;
  data.cells.forEach((cell, index) => {
    texture.add(index, 0, cell.x, cell.y, cell.width, cell.height)!.setTrim(FRAME.width * D, FRAME.height * D, cell.left, cell.top, cell.width, cell.height);
    hands.add(index, 0, index % columns * handSize, Math.floor(index / columns) * handSize, handSize, handSize);
  });
  SHEET_VIEWS.forEach(({ facing, heading }, block) => {
    for (const [name, def] of Object.entries(OFFICIAL_LAYOUT.animations) as [AnimationName, SheetLayout['animations'][AnimationName]][]) {
      const animKey = animationKey(key, name, facing, heading); if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
      const base = Math.min(...def.durations);
      scene.anims.create({ key: animKey, frames: def.frames.map((f, i) => ({ key, frame: block * OFFICIAL_LAYOUT.framesPerBlock + f, duration: def.durations[i] - base })), frameRate: 1000 / base, repeat: def.loop ? -1 : 0 });
    }
  });
  texture.refresh(); hands.refresh();
  for (const image of [data.atlas, data.hands]) if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
  return { key, layout: OFFICIAL_LAYOUT, handKey, anchors: data.anchors, palms: data.palms, handCenters: data.handCenters, metrics: data.metrics, portrait: data.portrait };
}

/** Synchronous compatibility path for tools; matches the worker's composer exactly. */
export function bakePlayer(scene: Phaser.Scene, key: string, look: Appearance, team: number): BakedPlayer {
  return installPlayer(scene, key, composePlayer(playerSources(scene), look, team));
}
export function playerSources(scene: Phaser.Scene): HTMLImageElement[] {
  return SOURCE_KEYS.map((source) => {
    if (!scene.textures.exists(source)) throw new Error(`Planche de joueurs indisponible : ${source}`);
    return scene.textures.get(source).getSourceImage() as HTMLImageElement;
  });
}
export function bakeShadow(scene: Phaser.Scene, key: string, width: number, height = 5): void {
  if (scene.textures.exists(key)) return; const g = scene.add.graphics(); g.fillStyle(0x18203a, 0.35);
  for (let y = 0; y < height; y++) { const half = Math.round(width / 2 * Math.sqrt(1 - ((y + 0.5 - height / 2) / (height / 2)) ** 2)); g.fillRect(Math.round(width / 2) - half, y, half * 2, 1); }
  g.generateTexture(key, width, height); g.destroy();
}
