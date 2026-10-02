import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import { BALL } from '../../../assets/sprites/arena';
import { drawGrid } from './draw';

export const BALL_TEXTURE = 'ball';
export const BALL_SHADOW_TEXTURE = 'ball-shadow';

/** Ballon 6×6 cerné (8×8 avec le contour) et son ombre au sol, partagés par le match et `?style`. */
export function createBallTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BALL_TEXTURE)) {
    const g = scene.add.graphics();
    drawGrid(g, BALL, 1, 1, (c) => (c === 'b' ? PALETTE.orange : c === 'B' ? PALETTE.orangeDark : null));
    g.generateTexture(BALL_TEXTURE, BALL[0].length + 2, BALL.length + 2);
    g.destroy();
  }
  if (!scene.textures.exists(BALL_SHADOW_TEXTURE)) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.32).fillRect(1, 0, 4, 1).fillRect(0, 1, 6, 1).fillRect(1, 2, 4, 1);
    g.generateTexture(BALL_SHADOW_TEXTURE, 6, 3);
    g.destroy();
  }
}
