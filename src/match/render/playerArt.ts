import type Phaser from 'phaser';
import { hashSeed } from '../../engine/rng';
import { HEIGHT_SCALE, PIXELS_PER_METER } from '../config';
import { shade } from './courtArt';
import { drawMiniNumber, drawText, miniNumberWidth, normalizeText, textWidth } from './pixelFont';

/** Cadre provisoire d'un joueur (px) : pieds au milieu du bord bas. */
export const PLAYER_FRAME = { width: 32, height: 40 } as const;

export type PlayerPose = 'idle' | 'runA' | 'runB' | 'air';
export const POSES: PlayerPose[] = ['idle', 'runA', 'runB', 'air'];

export interface Kit {
  jersey: number;
  shorts: number;
  trim: number;
}

/** Apparence d'un joueur : tirée de son identifiant, pour rester la même d'une partie à l'autre. */
export interface PlayerLook {
  heightCm: number;
  number: number;
  kit: Kit;
  skin: number;
  hair: number;
  hairStyle: 'short' | 'round' | 'bald' | 'band';
}

const OUTLINE = 0x1b1622;
const SKINS = [0xf1c9a5, 0xd9a67a, 0xb97c50, 0x8d5a3b, 0x5e3a26];
const HAIRS = [0x1e1612, 0x3b2516, 0x6b4426, 0xc9a25a, 0x8c3b1f];
const HAIR_STYLES: PlayerLook['hairStyle'][] = ['short', 'round', 'bald', 'band'];
const SHOES = 0x24242c;
const SOCKS = 0xf4efe6;
const EYE = 0x1b1622;

export function lookFor(player: { id: string; heightCm: number; number: number }, kit: Kit): PlayerLook {
  const h = hashSeed(player.id);
  return {
    heightCm: player.heightCm,
    number: player.number,
    kit,
    skin: SKINS[h % SKINS.length],
    hair: HAIRS[(h >>> 5) % HAIRS.length],
    hairStyle: HAIR_STYLES[(h >>> 10) % HAIR_STYLES.length],
  };
}

/** Tampon de pixels : on dessine la silhouette, puis on l'entoure d'un contour sombre. */
class PixelCanvas {
  readonly width: number;
  readonly height: number;
  private readonly px: (number | null)[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.px = Array.from({ length: width * height }, () => null);
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (i >= 0 && j >= 0 && i < this.width && j < this.height) this.px[j * this.width + i] = color;
      }
    }
  }

  /** Interface « PixelTarget » de la police : `fillRect` dans la couleur courante. */
  target(color: number) {
    return { fillRect: (x: number, y: number, w: number, h: number) => this.rect(x, y, w, h, color) };
  }

  outline(color: number): void {
    const filled = (i: number, j: number) => i >= 0 && j >= 0 && i < this.width && j < this.height && this.px[j * this.width + i] !== null;
    const edges: number[] = [];
    for (let j = 0; j < this.height; j++) {
      for (let i = 0; i < this.width; i++) {
        if (!filled(i, j) && (filled(i - 1, j) || filled(i + 1, j) || filled(i, j - 1) || filled(i, j + 1))) edges.push(j * this.width + i);
      }
    }
    for (const k of edges) this.px[k] = color;
  }

  toTexture(scene: Phaser.Scene, key: string): void {
    const g = scene.add.graphics();
    this.px.forEach((color, k) => {
      if (color !== null) g.fillStyle(color).fillRect(k % this.width, Math.floor(k / this.width), 1, 1);
    });
    g.generateTexture(key, this.width, this.height);
    g.destroy();
  }
}

/**
 * Silhouette de profil (tournée vers la droite), style « grosse tête » : la tête fait environ
 * un tiers de la hauteur. Le joueur garde sa taille réelle à l'écran (2 m ≈ 27 px).
 */
function drawPlayer(look: PlayerLook, pose: PlayerPose): PixelCanvas {
  const c = new PixelCanvas(PLAYER_FRAME.width, PLAYER_FRAME.height);
  const H = Math.round((look.heightCm / 100) * PIXELS_PER_METER * HEIGHT_SCALE);
  const cx = PLAYER_FRAME.width / 2;
  const shoes = 2;
  const legs = Math.round(H * 0.2) - (pose === 'air' ? 2 : 0);
  const shorts = Math.max(3, Math.round(H * 0.13));
  const torso = Math.round(H * 0.22);
  const head = H - (shoes + Math.round(H * 0.2) + shorts + torso);
  const bottom = PLAYER_FRAME.height - 1 - (pose === 'air' ? 2 : 0);
  const skinDark = shade(look.skin, 0.8);

  // Jambes et chaussures : écartées ou croisées selon l'image de course.
  const stride = pose === 'runA' ? 2 : pose === 'runB' ? -1 : pose === 'air' ? 1 : 0;
  const legTop = bottom - shoes - legs + 1;
  const backLeg = cx - 3 - stride;
  const frontLeg = cx + 1 + stride;
  c.rect(backLeg, legTop, 2, legs, skinDark);
  c.rect(frontLeg, legTop, 2, legs, look.skin);
  c.rect(backLeg, bottom - shoes, 2, 1, SOCKS);
  c.rect(frontLeg, bottom - shoes, 2, 1, SOCKS);
  c.rect(backLeg - 1, bottom - shoes + 1, 4, shoes, SHOES);
  c.rect(frontLeg, bottom - shoes + 1, 4, shoes, SHOES);

  // Short et maillot.
  const shortsTop = legTop - shorts;
  c.rect(cx - 4, shortsTop, 8, shorts, look.kit.shorts);
  c.rect(cx - 4, shortsTop + shorts - 1, 8, 1, look.kit.trim);
  const torsoTop = shortsTop - torso;
  c.rect(cx - 4, torsoTop, 8, torso, look.kit.jersey);
  c.rect(cx - 2, torsoTop, 4, 1, look.kit.trim);
  if (torso >= 6) drawMiniNumber(c.target(look.kit.trim), look.number, cx - Math.ceil(miniNumberWidth(look.number) / 2), torsoTop + 1);

  // Tête : grosse, arrondie, tournée vers la droite.
  const headW = head + 1;
  const headTop = torsoTop - head;
  const hx = cx - Math.floor(headW / 2);
  c.rect(hx + 1, headTop, headW - 2, head, look.skin);
  c.rect(hx, headTop + 1, headW, head - 2, look.skin);
  c.rect(hx + headW - 3, headTop + Math.floor(head * 0.45), 1, 2, EYE);
  c.rect(hx + 1, headTop + Math.floor(head * 0.55), 1, 2, skinDark); // oreille
  switch (look.hairStyle) {
    case 'short':
      c.rect(hx + 1, headTop, headW - 2, 2, look.hair);
      c.rect(hx, headTop + 1, 3, Math.floor(head / 2), look.hair);
      break;
    case 'round':
      c.rect(hx, headTop - 2, headW, 3, look.hair);
      c.rect(hx - 1, headTop - 1, 4, Math.floor(head * 0.6), look.hair);
      break;
    case 'band':
      c.rect(hx + 1, headTop, headW - 2, 1, look.hair);
      c.rect(hx, headTop + 1, headW, 1, look.kit.trim);
      break;
    case 'bald':
      break;
  }

  // Bras : le long du corps (main de dribble vers l'avant), ou levé au-dessus de la tête en l'air.
  if (pose === 'air') {
    c.rect(cx + 3, headTop - 3, 2, torsoTop - headTop + 5, look.skin);
  } else {
    const swing = pose === 'runA' ? -1 : pose === 'runB' ? 1 : 0;
    c.rect(cx - 5 + swing, torsoTop + 1, 1, torso - 1, skinDark);
    c.rect(cx + 4, torsoTop + 1, 2, torso - 2, look.skin);
    c.rect(cx + 5, torsoTop + torso - 1, 2, 2, look.skin);
  }

  c.outline(OUTLINE);
  return c;
}

/** Crée une texture par pose : `${prefix}-idle`, `${prefix}-runA`, … */
export function createPlayerTextures(scene: Phaser.Scene, prefix: string, look: PlayerLook): void {
  for (const pose of POSES) {
    const key = `${prefix}-${pose}`;
    if (!scene.textures.exists(key)) drawPlayer(look, pose).toTexture(scene, key);
  }
}

export function createPlayerShadowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('player-shadow')) return;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3).fillRect(3, 0, 8, 1).fillRect(0, 1, 14, 2).fillRect(3, 3, 8, 1);
  g.generateTexture('player-shadow', 14, 4);
  g.destroy();
}

/** Anneau au sol sous le joueur contrôlé. */
export function createControlRingTexture(scene: Phaser.Scene, color: number): void {
  if (scene.textures.exists('control-ring')) return;
  const g = scene.add.graphics();
  g.fillStyle(color);
  g.fillRect(5, 0, 8, 1).fillRect(2, 1, 3, 1).fillRect(13, 1, 3, 1);
  g.fillRect(0, 2, 2, 2).fillRect(16, 2, 2, 2);
  g.fillRect(2, 4, 3, 1).fillRect(13, 4, 3, 1).fillRect(5, 5, 8, 1);
  g.generateTexture('control-ring', 18, 6);
  g.destroy();
}

/** « E. OKONKWO » en police pixel sur un petit fond sombre. */
export function labelText(player: { firstName: string; lastName: string }): string {
  return normalizeText(`${player.firstName.charAt(0)}. ${player.lastName}`);
}

export function createNameLabel(scene: Phaser.Scene, key: string, text: string): void {
  if (scene.textures.exists(key)) return;
  const w = textWidth(text) + 4;
  const g = scene.add.graphics();
  g.fillStyle(0x101018, 0.75).fillRect(1, 0, w - 2, 11).fillRect(0, 1, w, 9);
  g.fillStyle(0xf6efe2);
  drawText(g, text, 2, 2);
  g.generateTexture(key, w, 11);
  g.destroy();
}
