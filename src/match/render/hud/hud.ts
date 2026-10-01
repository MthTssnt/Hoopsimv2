import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import { FACES, HAIRS, HEADS } from '../../../assets/sprites/heads';
import type { TeamLook } from '../arena/draw';
import { drawSmallText, drawText, SMALL_H, smallTextWidth, textWidth } from '../pixelFont';
import type { Appearance } from '../sprites/appearance';
import { SlotCanvas } from '../sprites/canvas';
import { colorsFor, slotColor } from '../sprites/compose';

/** Postes en abrégé, en français. */
export const POSITION_SHORT: Record<string, string> = { PG: 'MEN', SG: 'ARR', SF: 'AIL', PF: 'AF', C: 'PIV' };

/** Panneau du HUD : fond `navy`, liseré `ink`, coins coupés. */
function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(PALETTE.ink).fillRect(x + 1, y, w - 2, h).fillRect(x, y + 1, w, h - 2);
  g.fillStyle(PALETTE.navy).fillRect(x + 1, y + 1, w - 2, h - 2);
}

/** Pastille aux couleurs d'une équipe avec son abréviation. */
function chip(g: Phaser.GameObjects.Graphics, team: TeamLook, x: number, y: number): number {
  const w = textWidth(team.abbr) + 5;
  g.fillStyle(team.primary[2]).fillRect(x, y, w, 9);
  g.fillStyle(team.primary[1]).fillRect(x, y, w, 8);
  g.fillStyle(team.secondary[0]);
  drawText(g, team.abbr, x + 3, y + 1);
  return w;
}

export interface ScoreboardData {
  home: TeamLook;
  away: TeamLook;
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string;
  shotClock: number;
}

/** Tableau de score compact (haut à gauche) : pastilles + scores, puis période, chrono et horloge des tirs. */
export function drawScoreboard(g: Phaser.GameObjects.Graphics, x: number, y: number, d: ScoreboardData): void {
  const w = 104;
  panel(g, x, y, w, 23);
  let cx = x + 3;
  cx += chip(g, d.home, cx, y + 3) + 3;
  g.fillStyle(PALETTE.chalk);
  drawText(g, String(d.homeScore), cx, y + 4);
  cx = x + w / 2 + 2;
  cx += chip(g, d.away, cx, y + 3) + 3;
  drawText(g, String(d.awayScore), cx, y + 4);
  drawText(g, `QT${d.period}`, x + 4, y + 14);
  g.fillStyle(PALETTE.yellow);
  drawText(g, d.clock, x + 28, y + 14);
  g.fillStyle(PALETTE.silver);
  const shot = `TIR ${d.shotClock}`;
  drawText(g, shot, x + w - 4 - textWidth(shot), y + 14);
}

/** Portrait (tête, visage, coiffure) dessiné à partir de l'apparence du joueur. */
export function drawPortrait(g: Phaser.GameObjects.Graphics, look: Appearance, team: TeamLook, x: number, y: number): void {
  const c = new SlotCanvas(14, 14);
  c.stamp(HEADS[look.head], 2, 3);
  c.stamp(FACES[look.face], 2, 3);
  const hair = HAIRS[look.hair];
  c.stamp(hair.grid, 1, 1, { clip: hair.clip });
  c.outline('o');
  const colors = colorsFor(look, team.primary, team.secondary);
  c.forEach((px, py, slot) => g.fillStyle(slotColor(slot, colors)).fillRect(x + px, y + py, 1, 1));
}

export interface PlayerCardData {
  look: Appearance;
  team: TeamLook;
  name: string;
  position: string;
  energy: number;
  stats: string;
}

/** Carte du joueur contrôlé (bas à gauche) : portrait, nom, poste, énergie, statistiques. */
export function drawPlayerCard(g: Phaser.GameObjects.Graphics, x: number, y: number, d: PlayerCardData): void {
  const w = 128;
  panel(g, x, y, w, 25);
  g.fillStyle(d.team.primary[1]).fillRect(x + 3, y + 3, 17, 19);
  g.fillStyle(d.team.primary[2]).fillRect(x + 3, y + 18, 17, 4);
  drawPortrait(g, d.look, d.team, x + 4, y + 4);
  g.fillStyle(PALETTE.chalk);
  drawText(g, d.name, x + 24, y + 3);
  g.fillStyle(PALETTE.yellow);
  drawText(g, d.position, x + w - 4 - textWidth(d.position), y + 3);
  g.fillStyle(PALETTE.outline).fillRect(x + 24, y + 12, 42, 3);
  g.fillStyle(PALETTE.green).fillRect(x + 24, y + 12, Math.round(42 * d.energy), 3);
  g.fillStyle(PALETTE.silver);
  drawText(g, d.stats, x + 24, y + 16);
}

/** Étiquette de nom sous un joueur, en petite police ; celle du joueur contrôlé est soulignée en jaune. */
export function createNameLabel(scene: Phaser.Scene, key: string, name: string, controlled: boolean): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = smallTextWidth(name) + 4;
  const h = SMALL_H + 2;
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.navy, 0.8).fillRect(1, 0, w - 2, h).fillRect(0, 1, w, h - 2);
  g.fillStyle(PALETTE.chalk);
  drawSmallText(g, name, 2, 1);
  if (controlled) g.fillStyle(PALETTE.yellow).fillRect(1, h - 1, w - 2, 1);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Anneau jaune au sol sous le joueur contrôlé. */
export function createControlRing(scene: Phaser.Scene, key: string, width: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  const h = 6;
  g.fillStyle(PALETTE.yellow);
  g.fillRect(4, 0, width - 8, 1).fillRect(1, 1, 3, 1).fillRect(width - 4, 1, 3, 1);
  g.fillRect(0, 2, 1, 2).fillRect(width - 1, 2, 1, 2);
  g.fillRect(1, 4, 3, 1).fillRect(width - 4, 4, 3, 1).fillRect(4, h - 1, width - 8, 1);
  g.generateTexture(key, width, h);
  g.destroy();
}
