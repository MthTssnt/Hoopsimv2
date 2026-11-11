import type Phaser from 'phaser';
import { BALL_SOURCE } from './style';
import { RENDER_SCALE as D } from '../../config';

export const BALL_TEXTURE = 'ball';
export const BALL_SHADOW_TEXTURE = 'ball-shadow';

/** Six rotations peintes à double résolution, dans un diamètre logique de 10 px. */
export function createBallTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BALL_TEXTURE)) {
    const texture = scene.textures.createCanvas(BALL_TEXTURE, 60 * D, 10 * D)!;
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    const source = scene.textures.get(BALL_SOURCE).getSourceImage() as HTMLImageElement;
    for (let frame = 0; frame < 6; frame++) {
      const cx = source.width * [0.1875, 0.5, 0.8125][frame % 3];
      const cy = source.height * (frame < 3 ? 0.275 : 0.75);
      const r = source.width * 0.1;
      ctx.save();
      ctx.beginPath(); ctx.arc((frame * 10 + 5) * D, 5 * D, 5 * D, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(source, cx - r, cy - r, r * 2, r * 2, frame * 10 * D, 0, 10 * D, 10 * D);
      ctx.restore();
      texture.add(frame, 0, frame * 10 * D, 0, 10 * D, 10 * D);
    }
    texture.refresh();
  }
  if (!scene.textures.exists(BALL_SHADOW_TEXTURE)) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.32).fillRect(1, 0, 6, 1).fillRect(0, 1, 8, 1).fillRect(1, 2, 6, 1);
    g.generateTexture(BALL_SHADOW_TEXTURE, 8, 3);
    g.destroy();
  }
}
