import type Phaser from 'phaser';
import { PIXELS_PER_METER } from '../config';

/** Cadre définitif d'un joueur (px) : pieds au milieu du bord bas. */
export const PLAYER_FRAME = { width: 32, height: 64 } as const;

export interface Kit {
  jersey: number;
  shorts: number;
  trim: number;
}

/** Tenues provisoires, originales. */
export const KITS = {
  home: { jersey: 0x2f6fd6, shorts: 0x24529e, trim: 0xf4efe6 },
  away: { jersey: 0xd64a3a, shorts: 0x9e2e24, trim: 0xf4efe6 },
} satisfies Record<string, Kit>;

const SKIN = 0xc68e5a;
const HAIR = 0x2a1d14;
const SHOES = 0x1e1e24;
const SOCKS = 0xf4efe6;

/**
 * Silhouette de profil (tournée vers la droite), dessinée à la taille réelle du joueur
 * (2 m = 40 px à 20 px/m) dans un cadre de 32×64. Placeholder en attendant les sprites.
 */
export function createPlayerTexture(scene: Phaser.Scene, key: string, heightCm: number, kit: Kit): void {
  if (scene.textures.exists(key)) return;
  const H = Math.round((heightCm / 100) * PIXELS_PER_METER);
  const g = scene.add.graphics();
  const cx = PLAYER_FRAME.width / 2;
  let y = PLAYER_FRAME.height; // on dessine des pieds vers la tête

  const shoe = 2;
  const sock = 2;
  const legs = Math.round(H * 0.38) - sock;
  const shorts = Math.round(H * 0.13);
  const torso = Math.round(H * 0.27);
  const neck = 1;
  const head = H - (shoe + sock + legs + shorts + torso + neck);

  y -= shoe;
  g.fillStyle(SHOES).fillRect(cx - 4, y, 4, shoe).fillRect(cx + 1, y, 4, shoe);
  y -= sock;
  g.fillStyle(SOCKS).fillRect(cx - 4, y, 3, sock).fillRect(cx + 1, y, 3, sock);
  y -= legs;
  g.fillStyle(SKIN).fillRect(cx - 4, y, 3, legs).fillRect(cx + 1, y, 3, legs);
  y -= shorts;
  g.fillStyle(kit.shorts).fillRect(cx - 5, y, 10, shorts);
  y -= torso;
  g.fillStyle(kit.jersey).fillRect(cx - 4, y, 8, torso);
  g.fillStyle(kit.trim).fillRect(cx - 4, y, 8, 1);
  // Bras avant le long du corps, main vers l'avant (côté dribble).
  g.fillStyle(SKIN).fillRect(cx + 3, y + 1, 2, torso - 2).fillRect(cx + 4, y + torso - 2, 3, 2);
  y -= neck;
  g.fillStyle(SKIN).fillRect(cx - 1, y, 3, neck);
  y -= head;
  g.fillStyle(SKIN).fillRect(cx - 3, y, 6, head);
  g.fillStyle(HAIR).fillRect(cx - 3, y, 6, 2).fillRect(cx - 3, y, 2, Math.min(4, head));
  g.fillStyle(HAIR).fillRect(cx + 1, y + Math.floor(head / 2), 1, 1);

  g.generateTexture(key, PLAYER_FRAME.width, PLAYER_FRAME.height);
  g.destroy();
}

export function createPlayerShadowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('player-shadow')) return;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3).fillRect(3, 0, 8, 1).fillRect(0, 1, 14, 2).fillRect(3, 3, 8, 1);
  g.generateTexture('player-shadow', 14, 4);
  g.destroy();
}
