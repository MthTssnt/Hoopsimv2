import type Phaser from 'phaser';
import { PLAYER_SOURCES } from '../../../assets/players/sources';
import { COURT_DESIGNS, playerScale } from '../../../assets/players/courtDesigns';
import { ACTION_RECTS } from '../../../assets/players/actions';
import { drawJerseyNumber, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import { OFFICIAL_LAYOUT, type SheetLayout } from './layout';
import { FRAME, SHEET_VIEWS, type AnimationName, type Facing, type Heading } from './views';
import type { Appearance } from './appearance';

export interface PortraitPixel { x: number; y: number; color: number }
export interface BakedPlayer {
  key: string;
  layout: SheetLayout;
  anchors: ({ x: number; y: number; behind?: boolean } | null)[];
  metrics: { headTop: number; raisedHandTop: number };
  portrait: PortraitPixel[];
}
const SOURCE_KEYS = PLAYER_SOURCES.map((_, i) => `official-players-${i}`);
export function preloadPlayers(scene: Phaser.Scene): void {
  PLAYER_SOURCES.forEach((url, i) => {
    if (!scene.textures.exists(SOURCE_KEYS[i])) scene.load.image(SOURCE_KEYS[i], url);
  });
}
export function animationKey(key: string, name: AnimationName, facing: Facing, heading: Heading = 'down'): string {
  return `${key}:${name}${heading === 'up' ? ':up' : ''}${facing === 'left' ? ':left' : ''}`;
}

/** Feuille officielle, identique dans le GM et le match de test. Aucun ancien rendu de secours. */
export function bakePlayer(scene: Phaser.Scene, key: string, look: Appearance, team: number): BakedPlayer {
  const variant = look.variant;
  const design = COURT_DESIGNS[team][variant];
  const scale = playerScale(look.heightCm, look.heavy, design);
  const sources = [team, team + 2].map((i) => {
    if (!scene.textures.exists(SOURCE_KEYS[i])) throw new Error(`Planche de joueurs indisponible : ${SOURCE_KEYS[i]}`);
    return scene.textures.get(SOURCE_KEYS[i]).getSourceImage() as HTMLImageElement;
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, FRAME.width * 8, FRAME.height * 4)!;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  const anchors: BakedPlayer['anchors'] = [];
  let raisedHandTop: number = FRAME.groundY;
  SHEET_VIEWS.forEach(({ facing, heading }, block) => {
    for (let frame = 0; frame < 8; frame++) {
      const pose = frame < 4 && heading === 'up' ? 1 : frame < 2 ? 0 : frame;
      const rect = pose < 4 ? design.frames[pose] : ACTION_RECTS[team][variant][pose - 4];
      const w = Math.round(rect.width * scale.x);
      const h = Math.round(rect.height * scale.y);
      const dx = Math.round(FRAME.centerX - w / 2);
      const dy = FRAME.groundY - h;
      const left = facing === 'left';
      ctx.save();
      ctx.translate(frame * FRAME.width, block * FRAME.height);
      if (left) { ctx.translate(FRAME.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(sources[pose < 4 ? 0 : 1], rect.x, rect.y, rect.width, rect.height, dx, dy, w, h);
      ctx.restore();
      if (frame === 7) raisedHandTop = Math.min(raisedHandTop, dy + 2);
      // Le numéro se pose après le miroir, uniquement sur la surface du maillot.
      const x = frame * FRAME.width + Math.round(FRAME.centerX - jerseyNumberWidth(look.number) / 2);
      const y = block * FRAME.height + dy + Math.round(h * (pose >= 4 ? 0.52 : 0.48));
      const pixels = ctx.getImageData(frame * FRAME.width, block * FRAME.height, FRAME.width, FRAME.height);
      ctx.fillStyle = team === 0 ? '#fff5e5' : '#702437';
      drawJerseyNumber(look.number, x, y, (px, py) => {
        const localX = px - frame * FRAME.width;
        const localY = py - block * FRAME.height;
        const i = (localY * FRAME.width + localX) * 4;
        const [r, g, b, alpha] = pixels.data.subarray(i, i + 4);
        const jersey = team === 0 ? b > r * 1.15 && b > g * 1.05 : r > 180 && g > r * 0.85 && b > r * 0.75;
        if (alpha > 220 && jersey) ctx.fillRect(px, py, 1, 1);
      });
      // Tir armé et dunk : ballon au niveau de la main. Au dribble, conserver le rebond du monde.
      const anchor = frame === 4 || frame === 7 ? { x: dx + Math.round(w * (frame === 7 ? 0.84 : 0.68)), y: dy + Math.round(h * 0.12) } : null;
      anchors.push(anchor && left ? { ...anchor, x: FRAME.width - anchor.x } : anchor);
      texture.add(block * 8 + frame, 0, frame * FRAME.width, block * FRAME.height, FRAME.width, FRAME.height);
    }
    for (const [name, def] of Object.entries(OFFICIAL_LAYOUT.animations) as [AnimationName, SheetLayout['animations'][AnimationName]][]) {
      const animKey = animationKey(key, name, facing, heading);
      if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
      const base = Math.min(...def.durations);
      scene.anims.create({ key: animKey, frames: def.frames.map((f, i) => ({ key, frame: block * 8 + f, duration: def.durations[i] - base })), frameRate: 1000 / base, repeat: def.loop ? -1 : 0 });
    }
  });
  texture.refresh();
  // Même tête que le joueur sur le terrain : plus de portrait d'un ancien design.
  const portraitCanvas = document.createElement('canvas');
  portraitCanvas.width = portraitCanvas.height = 18;
  const portraitContext = portraitCanvas.getContext('2d')!;
  portraitContext.imageSmoothingEnabled = false;
  const base = design.frames[0];
  const headHeight = Math.round(base.height * 0.4);
  const headWidth = Math.min(base.width, headHeight);
  portraitContext.drawImage(sources[0], base.x + (base.width - headWidth) / 2, base.y, headWidth, headHeight, 0, 0, 18, 18);
  const data = portraitContext.getImageData(0, 0, 18, 18).data;
  const portrait: PortraitPixel[] = [];
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    const k = (y * 18 + x) * 4;
    if (data[k + 3] >= 160) portrait.push({ x, y, color: (data[k] << 16) | (data[k + 1] << 8) | data[k + 2] });
  }
  return { key, layout: OFFICIAL_LAYOUT, anchors, portrait, metrics: { headTop: FRAME.groundY - scale.height, raisedHandTop } };
}

/** Ombre commune des nouveaux joueurs. */
export function bakeShadow(scene: Phaser.Scene, key: string, width: number, height = 5): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x18203a, 0.35);
  for (let y = 0; y < height; y++) {
    const half = Math.round(width / 2 * Math.sqrt(1 - ((y + 0.5 - height / 2) / (height / 2)) ** 2));
    g.fillRect(Math.round(width / 2) - half, y, half * 2, 1);
  }
  g.generateTexture(key, width, height);
  g.destroy();
}
