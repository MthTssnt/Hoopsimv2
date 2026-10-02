import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import { FACES, HAIR_OFFSET, HAIRS, HEADS } from '../../../assets/sprites/heads';
import type { TeamLook } from '../arena/draw';
import { drawText, GLYPH_H, textWidth } from '../pixelFont';
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
  const w = textWidth(team.abbr) + 6;
  g.fillStyle(team.primary[2]).fillRect(x, y, w, 11);
  g.fillStyle(team.primary[1]).fillRect(x, y, w, 10);
  g.fillStyle(team.secondary[0]);
  drawText(g, team.abbr, x + 3, y + 2);
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

/** Tableau de score compact (haut à gauche) : pastilles + scores en grand, puis période, chrono et horloge des tirs. */
export function drawScoreboard(g: Phaser.GameObjects.Graphics, x: number, y: number, d: ScoreboardData): void {
  const w = 156;
  panel(g, x, y, w, 34);
  let cx = x + 4;
  cx += chip(g, d.home, cx, y + 5) + 4;
  g.fillStyle(PALETTE.chalk);
  drawText(g, String(d.homeScore), cx, y + 3, 2);
  cx = x + w / 2 + 2;
  cx += chip(g, d.away, cx, y + 5) + 4;
  drawText(g, String(d.awayScore), cx, y + 3, 2);
  drawText(g, `QT${d.period}`, x + 5, y + 23);
  g.fillStyle(PALETTE.yellow);
  drawText(g, d.clock, x + 40, y + 23);
  g.fillStyle(PALETTE.silver);
  const shot = `TIR ${d.shotClock}`;
  drawText(g, shot, x + w - 5 - textWidth(shot), y + 23);
}

/** Taille du portrait (px) : tête, visage et coiffure dans un carré. */
export const PORTRAIT_SIZE = 22;

/** Portrait (tête, visage, coiffure) dessiné à partir de l'apparence du joueur. */
export function drawPortrait(g: Phaser.GameObjects.Graphics, look: Appearance, team: TeamLook, x: number, y: number): void {
  const c = new SlotCanvas(PORTRAIT_SIZE, PORTRAIT_SIZE);
  const head = { x: 4, y: 6 };
  c.stamp(HEADS[look.head], head.x, head.y);
  c.stamp(FACES[look.face], head.x, head.y);
  const hair = HAIRS[look.hair];
  c.stamp(hair.grid, head.x + HAIR_OFFSET.x, head.y + HAIR_OFFSET.y, { clip: hair.clip });
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
  const w = 176;
  panel(g, x, y, w, 36);
  g.fillStyle(d.team.primary[1]).fillRect(x + 4, y + 4, 26, 28);
  g.fillStyle(d.team.primary[2]).fillRect(x + 4, y + 26, 26, 6);
  drawPortrait(g, d.look, d.team, x + 6, y + 6);
  const tx = x + 36;
  g.fillStyle(PALETTE.chalk);
  drawText(g, d.name, tx, y + 5);
  g.fillStyle(PALETTE.yellow);
  drawText(g, d.position, x + w - 5 - textWidth(d.position), y + 5);
  g.fillStyle(PALETTE.outline).fillRect(tx, y + 15, 64, 4);
  g.fillStyle(PALETTE.green).fillRect(tx, y + 15, Math.round(64 * d.energy), 4);
  g.fillStyle(PALETTE.silver);
  drawText(g, d.stats, tx, y + 24);
}

/** Étiquette de nom sous un joueur ; celle du joueur contrôlé est soulignée en jaune. */
export function createNameLabel(scene: Phaser.Scene, key: string, name: string, controlled: boolean): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = textWidth(name) + 6;
  const h = GLYPH_H + 4;
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.navy, 0.8).fillRect(1, 0, w - 2, h).fillRect(0, 1, w, h - 2);
  g.fillStyle(PALETTE.chalk);
  drawText(g, name, 3, 2);
  if (controlled) g.fillStyle(PALETTE.yellow).fillRect(1, h - 1, w - 2, 1);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Anneau jaune au sol sous le joueur contrôlé (ellipse d'un pixel d'épaisseur). */
export function createControlRing(scene: Phaser.Scene, key: string, width: number, height: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.yellow);
  const rx = (width - 1) / 2;
  const ry = (height - 1) / 2;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    g.fillRect(Math.round(rx + Math.cos(a) * rx), Math.round(ry + Math.sin(a) * ry), 1, 1);
  }
  g.generateTexture(key, width, height);
  g.destroy();
}
