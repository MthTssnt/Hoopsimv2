import { describe, expect, it } from 'vitest';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { CAMERA_TUNING, neededZoom, stepZoom, targetFraming } from './camera';

/** Joueur de 27 px de haut, pieds en (300, 250) ; centre vertical préféré à 213. */
const player = { left: 292, right: 308, top: 223, bottom: 266 };
const ANCHOR = 213;

describe('caméra', () => {
  it('reste au zoom 1, centrée sur le joueur en largeur et sur le terrain en hauteur', () => {
    const f = targetFraming(player, { x: 305, y: 240 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(f.zoom).toBe(1);
    expect(f.centerX).toBe(300);
    expect(f.centerY).toBe(ANCHOR);
  });

  it('garde un cadrage vertical stable quand le joueur change de profondeur', () => {
    const farPlayer = { left: 292, right: 308, top: 120, bottom: 163 };
    const nearPlayer = { left: 292, right: 308, top: 290, bottom: 333 };
    for (const p of [farPlayer, nearPlayer]) {
      expect(targetFraming(p, { x: 300, y: p.top + 10 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT).centerY).toBe(ANCHOR);
    }
  });

  it('se décale sans dézoomer quand le ballon est un peu loin', () => {
    const f = targetFraming(player, { x: 520, y: 230 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(f.zoom).toBe(1);
    expect(f.centerX).toBeGreaterThan(300);
    expect(520 + CAMERA_TUNING.margin.x).toBeLessThanOrEqual(f.centerX + VIEW_WIDTH / 2 + 1e-9);
  });

  it('remonte puis dézoome si le ballon monte très haut, sans passer sous le zoom minimal', () => {
    const high = targetFraming(player, { x: 330, y: 20 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(high.zoom).toBeLessThan(1);
    expect(high.zoom).toBeGreaterThanOrEqual(CAMERA_TUNING.minZoom);
    const halfH = VIEW_HEIGHT / (2 * high.zoom);
    expect(20 - CAMERA_TUNING.margin.top).toBeGreaterThanOrEqual(high.centerY - halfH - 1e-9);
    expect(player.bottom + CAMERA_TUNING.margin.bottom).toBeLessThanOrEqual(high.centerY + halfH + 1e-9);
    const huge = targetFraming(player, { x: 330, y: -2000 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(huge.zoom).toBe(CAMERA_TUNING.minZoom);
  });

  it('en mode paliers, ne prend que 1 ou 0,75 et ne fait pas d’allers-retours', () => {
    expect(stepZoom(1, 1)).toBe(1);
    expect(stepZoom(0.8, 1)).toBe(0.75);
    // Juste sous le palier courant : on y reste (marge), plutôt que de basculer.
    expect(stepZoom(0.96, 1)).toBe(1);
    expect(stepZoom(0.9, 1)).toBe(0.75);
    const f = targetFraming(player, { x: 330, y: 20 }, ANCHOR, 'steps', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(CAMERA_TUNING.steps).toContain(f.zoom);
  });

  it('calcule le zoom nécessaire pour faire tenir une boîte', () => {
    expect(neededZoom({ left: 0, right: 640, top: 0, bottom: 100 }, VIEW_WIDTH, VIEW_HEIGHT)).toBe(0.75);
    expect(neededZoom({ left: 0, right: 100, top: 0, bottom: 100 }, VIEW_WIDTH, VIEW_HEIGHT)).toBe(1);
  });
});
