import type Phaser from 'phaser';
import maple from '../../../assets/court/maple.png';
import balls from '../../../assets/court/ball-spin.png';

export const MAPLE_ART = maple;
export const BALL_ART = balls;
export const FLOOR_SOURCE = 'court-maple-source';
export const BALL_SOURCE = 'court-ball-source';
export const COURT_STYLE = {
  apron: 0x17243b, edge: 0x0d1423, paint: 0x293e62, paintLight: 0x344d75,
  gold: 0xe8bc76, line: 0xfff1d6, wood: 0xe7bd77, woodLight: 0xf0ce93, woodDark: 0xc99b59,
} as const;

export function preloadCourtStyle(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FLOOR_SOURCE)) scene.load.image(FLOOR_SOURCE, maple);
  if (!scene.textures.exists(BALL_SOURCE)) scene.load.image(BALL_SOURCE, balls);
}
