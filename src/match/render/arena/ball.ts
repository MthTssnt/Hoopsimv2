import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import { BALL } from '../../../assets/sprites/arena';
import { drawGrid } from './draw';

export const BALL_TEXTURE = 'ball';
export const BALL_SHADOW_TEXTURE = 'ball-shadow';

/**
 * Ballon 8×8 cerné (10×10 avec le contour) : deux coutures `ink`, un reflet en haut à gauche,
 * l'ombre en bas à droite ; et son ombre au sol. Partagés par le match et `?style`.
 */
export function createBallTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BALL_TEXTURE)) {
    const g = scene.add.graphics();
    const colors: Record<string, number> = { b: PALETTE.orange, B: PALETTE.orangeDark, n: PALETTE.ink, l: PALETTE.woodLight };
    drawGrid(g, BALL, 1, 1, (c) => colors[c] ?? null);
    g.generateTexture(BALL_TEXTURE, BALL[0].length + 2, BALL.length + 2);
    g.destroy();
  }
  if (!scene.textures.exists(BALL_SHADOW_TEXTURE)) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.32).fillRect(1, 0, 6, 1).fillRect(0, 1, 8, 1).fillRect(1, 2, 6, 1);
    g.generateTexture(BALL_SHADOW_TEXTURE, 8, 3);
    g.destroy();
  }
}
