import type Phaser from 'phaser';
import type { Appearance } from './appearance';
import { colorsFor, composeFrame, slotColor, type Kit, type SlotColors } from './compose';
import { ANIMATIONS, bodyDims, FRAME, FRAMES, type AnimationName, type BodyDims } from './rig';
import type { TeamRamp } from '../../../assets/palette';

export interface BakedPlayer {
  /** Clé de la texture (feuille de sprites) ; les animations sont `${key}:${nom}`. */
  key: string;
  /** Centre du ballon tenu pour chaque image (cadre tourné vers la droite), ou null. */
  anchors: ({ x: number; y: number } | null)[];
  dims: BodyDims;
}

export interface BakeOptions {
  scale: number;
  primary: TeamRamp;
  secondary: TeamRamp;
  kit?: Kit;
  /** Rejouer le tir et le dunk en boucle (scène `?style`). */
  loopAll?: boolean;
}

/**
 * Cuit toutes les images d'un joueur dans une texture canvas (une image par colonne), puis
 * enregistre ses animations. Les couleurs (peau, cheveux, équipe) sont posées ici.
 */
export function bakePlayer(scene: Phaser.Scene, key: string, look: Appearance, options: BakeOptions): BakedPlayer {
  const dims = bodyDims(look.heightCm, look.heavy, options.scale);
  const colors: SlotColors = colorsFor(look, options.primary, options.secondary);
  const width = FRAME.width * FRAMES.length;

  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, FRAME.height)!;
  const image = texture.context.createImageData(width, FRAME.height);
  const anchors: BakedPlayer['anchors'] = [];
  FRAMES.forEach((frame, i) => {
    const { canvas, ball } = composeFrame(look, frame, dims, options.kit);
    canvas.forEach((x, y, slot) => {
      const color = slotColor(slot, colors);
      const k = (y * width + i * FRAME.width + x) * 4;
      image.data[k] = (color >> 16) & 0xff;
      image.data[k + 1] = (color >> 8) & 0xff;
      image.data[k + 2] = color & 0xff;
      image.data[k + 3] = 255;
    });
    anchors.push(ball);
  });
  texture.putData(image, 0, 0);
  texture.refresh();
  FRAMES.forEach((_, i) => texture.add(i, 0, i * FRAME.width, 0, FRAME.width, FRAME.height));

  for (const [name, def] of Object.entries(ANIMATIONS) as [AnimationName, (typeof ANIMATIONS)[AnimationName]][]) {
    const animKey = `${key}:${name}`;
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    // Durée de base = la plus courte ; les images plus longues ajoutent leur différence
    // (dans Phaser, la durée d'une image s'ajoute à la durée de base).
    const base = Math.min(...def.durations);
    scene.anims.create({
      key: animKey,
      frames: def.frames.map((frame, j) => ({ key, frame, duration: def.durations[j] - base })),
      frameRate: 1000 / base,
      repeat: def.loop || options.loopAll ? -1 : 0,
      repeatDelay: def.loop ? 0 : 400,
    });
  }
  return { key, anchors, dims };
}

/** Ombre ovale au sol, à la largeur du joueur. */
export function bakeShadow(scene: Phaser.Scene, key: string, width: number, height = 6): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.32);
  const rx = width / 2;
  const ry = height / 2;
  for (let y = 0; y < height; y++) {
    const dy = (y + 0.5 - ry) / ry;
    const half = Math.round(rx * Math.sqrt(1 - dy * dy));
    g.fillRect(Math.round(rx) - half, y, half * 2, 1);
  }
  g.generateTexture(key, width, height);
  g.destroy();
}
