import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import type { TeamLook } from '../arena/draw';
import { drawSmallText, drawText, GLYPH_H, SMALL_H, smallTextWidth, textWidth } from '../pixelFont';
import type { Appearance } from '../sprites/appearance';
import { colorsFor, headLayer, slotColor } from '../sprites/compose';

/** Postes en abrégé, en français. */
export const POSITION_SHORT: Record<string, string> = { PG: 'MEN', SG: 'ARR', SF: 'AIL', PF: 'AF', C: 'PIV' };

/** Panneau du HUD : fond `navy`, liseré `ink`, coins coupés. */
function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(PALETTE.ink).fillRect(x + 1, y, w - 2, h).fillRect(x, y + 1, w, h - 2);
  g.fillStyle(PALETTE.navy).fillRect(x + 1, y + 1, w - 2, h - 2);
}

/** Pastille aux couleurs d'une équipe avec son abréviation. */
function chip(g: Phaser.GameObjects.Graphics, team: TeamLook, x: number, y: number): number {
  const w = textWidth(team.abbr) + 4;
  g.fillStyle(team.primary[2]).fillRect(x, y, w, GLYPH_H + 3);
  g.fillStyle(team.primary[1]).fillRect(x, y, w, GLYPH_H + 2);
  g.fillStyle(team.secondary[0]);
  drawText(g, team.abbr, x + 2, y + 1);
  return w;
}

export interface ScoreboardData {
  home: TeamLook;
  away: TeamLook;
  homeScore: number;
  awayScore: number;
  /** Période affichée (QT1… QT4, P1… en prolongation). */
  period: string;
  clock: string;
  /** Shot clock (s, entier) ; null quand il ne compte plus (moins de temps au chrono). */
  shotClock: number | null;
  /** Ligne du bas à la place de la période et des horloges (ex. « PREMIER À 11 » en 1 contre 1). */
  note?: string;
}

/** Tableau de score compact (haut à gauche) : pastilles + scores, puis période, chrono et horloge des tirs. */
export function drawScoreboard(g: Phaser.GameObjects.Graphics, x: number, y: number, d: ScoreboardData): void {
  const w = 116;
  panel(g, x, y, w, 25);
  let cx = x + 3;
  cx += chip(g, d.home, cx, y + 3) + 3;
  g.fillStyle(PALETTE.chalk);
  drawText(g, String(d.homeScore), cx, y + 4);
  cx = x + w / 2 + 2;
  cx += chip(g, d.away, cx, y + 3) + 3;
  drawText(g, String(d.awayScore), cx, y + 4);
  if (d.note) {
    g.fillStyle(PALETTE.yellow);
    drawText(g, d.note, x + 4, y + 15);
    return;
  }
  drawText(g, d.period, x + 4, y + 15);
  g.fillStyle(PALETTE.yellow);
  drawText(g, d.clock, x + 30, y + 15);
  if (d.shotClock === null) return;
  // Les 5 dernières secondes du shot clock en rouge.
  g.fillStyle(d.shotClock <= 5 ? PALETTE.red : PALETTE.silver);
  const shot = `TIR ${d.shotClock}`;
  drawText(g, shot, x + w - 4 - textWidth(shot), y + 15);
}

/** Taille du portrait (px) : la tête 14×14, contour compris, avec une marge. */
export const PORTRAIT_SIZE = 16;

/** Portrait (tête, cheveux, expression neutre) dessiné à partir de l'apparence du joueur. */
export function drawPortrait(g: Phaser.GameObjects.Graphics, look: Appearance, team: TeamLook, x: number, y: number): void {
  const c = headLayer(look, 'neutre', 2, 2, PORTRAIT_SIZE, PORTRAIT_SIZE);
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
  const w = 150;
  panel(g, x, y, w, 28);
  g.fillStyle(d.team.primary[1]).fillRect(x + 3, y + 3, PORTRAIT_SIZE + 2, 22);
  g.fillStyle(d.team.primary[2]).fillRect(x + 3, y + 19, PORTRAIT_SIZE + 2, 6);
  drawPortrait(g, d.look, d.team, x + 4, y + 4);
  const tx = x + PORTRAIT_SIZE + 9;
  g.fillStyle(PALETTE.chalk);
  drawText(g, d.name, tx, y + 4);
  g.fillStyle(PALETTE.yellow);
  drawText(g, d.position, x + w - 4 - textWidth(d.position), y + 4);
  g.fillStyle(PALETTE.outline).fillRect(tx, y + 13, 52, 3);
  g.fillStyle(PALETTE.green).fillRect(tx, y + 13, Math.round(52 * d.energy), 3);
  g.fillStyle(PALETTE.silver);
  drawText(g, d.stats, tx, y + 18);
}

/** Étiquette de nom sous un joueur, en petite police 3×5 ; celle du joueur contrôlé est soulignée en jaune. */
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

/** Petite annonce colorée (ex. note d'un tir) en police 3×5, sur fond sombre. */
export function createTag(scene: Phaser.Scene, key: string, text: string, color: number): void {
  if (scene.textures.exists(key)) return;
  const w = smallTextWidth(text) + 4;
  const h = SMALL_H + 2;
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.navy, 0.85).fillRect(1, 0, w - 2, h).fillRect(0, 1, w, h - 2);
  g.fillStyle(color);
  drawSmallText(g, text, 2, 1);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Bandeau de fin de partie, centré en `cx` : titre en police 5×7 doublée, sous-titre en petite police. */
export function drawBanner(g: Phaser.GameObjects.Graphics, cx: number, y: number, title: string, subtitle: string, color: number): void {
  const w = Math.max(textWidth(title, 2), smallTextWidth(subtitle)) + 16;
  const h = GLYPH_H * 2 + SMALL_H + 13;
  const x = Math.round(cx - w / 2);
  panel(g, x, y, w, h);
  g.fillStyle(color).fillRect(x + 2, y + 2, w - 4, 1).fillRect(x + 2, y + h - 3, w - 4, 1);
  drawText(g, title, Math.round(cx - textWidth(title, 2) / 2), y + 5, 2);
  g.fillStyle(PALETTE.silver);
  drawSmallText(g, subtitle, Math.round(cx - smallTextWidth(subtitle) / 2), y + 5 + GLYPH_H * 2 + 3);
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
