import type Phaser from 'phaser';
import maple from '../../../assets/court/maple.png';
import balls from '../../../assets/court/ball-spin.png';

export const MAPLE_ART = maple;
export const BALL_ART = balls;
export const FLOOR_SOURCE = 'court-maple-source';
export const BALL_SOURCE = 'court-ball-source';
export const COURT_STYLE = {
  apron: 0x182537, edge: 0x0d1725, paint: 0x253b51, paintLight: 0x304961,
  gold: 0xdca65f, line: 0xffefd2, wood: 0xd7ab70, woodLight: 0xddb47c, woodDark: 0xc59a62,
} as const;

export function preloadCourtStyle(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FLOOR_SOURCE)) scene.load.image(FLOOR_SOURCE, maple);
  if (!scene.textures.exists(BALL_SOURCE)) scene.load.image(BALL_SOURCE, balls);
}
