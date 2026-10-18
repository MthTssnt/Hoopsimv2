import { describe, expect, it } from 'vitest';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { CAMERA_TUNING, neededZoom, stepZoom, targetFraming } from './camera';

/** Joueur de 43 px de haut, pieds en (400, 333) ; centre vertical préféré à 284 (640×360). */
const player = { left: 389, right: 411, top: 297, bottom: 355 };
const ANCHOR = 284;

describe('caméra', () => {
  it('reste au zoom 1, centrée sur le joueur en largeur et sur le terrain en hauteur', () => {
    const f = targetFraming(player, { x: 407, y: 320 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(f.zoom).toBe(1);
    expect(f.centerX).toBe(400);
    expect(f.centerY).toBe(ANCHOR);
  });

  it('garde un cadrage vertical stable quand le joueur change de profondeur', () => {
    const farPlayer = { left: 389, right: 411, top: 160, bottom: 217 };
    const nearPlayer = { left: 389, right: 411, top: 387, bottom: 444 };
    for (const p of [farPlayer, nearPlayer]) {
      expect(targetFraming(p, { x: 400, y: p.top + 13 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT).centerY).toBe(ANCHOR);
    }
  });

  it('se décale sans dézoomer quand le ballon est un peu loin', () => {
    const f = targetFraming(player, { x: 693, y: 307 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(f.zoom).toBe(1);
    expect(f.centerX).toBeGreaterThan(400);
    expect(693 + CAMERA_TUNING.margin.x).toBeLessThanOrEqual(f.centerX + VIEW_WIDTH / 2 + 1e-9);
  });

  it('remonte puis dézoome si le ballon monte très haut, sans passer sous le zoom minimal', () => {
    const high = targetFraming(player, { x: 440, y: 27 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(high.zoom).toBeLessThan(1);
    expect(high.zoom).toBeGreaterThanOrEqual(CAMERA_TUNING.minZoom);
    const halfH = VIEW_HEIGHT / (2 * high.zoom);
    expect(27 - CAMERA_TUNING.margin.top).toBeGreaterThanOrEqual(high.centerY - halfH - 1e-9);
    expect(player.bottom + CAMERA_TUNING.margin.bottom).toBeLessThanOrEqual(high.centerY + halfH + 1e-9);
    const huge = targetFraming(player, { x: 440, y: -2700 }, ANCHOR, 'free', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(huge.zoom).toBe(CAMERA_TUNING.minZoom);
  });

  it('en mode paliers, ne prend que 1 ou 0,75 et ne fait pas d’allers-retours', () => {
    expect(stepZoom(1, 1)).toBe(1);
    expect(stepZoom(0.8, 1)).toBe(0.75);
    // Juste sous le palier courant : on y reste (marge), plutôt que de basculer.
    expect(stepZoom(0.96, 1)).toBe(1);
    expect(stepZoom(0.9, 1)).toBe(0.75);
    const f = targetFraming(player, { x: 440, y: 27 }, ANCHOR, 'steps', 1, VIEW_WIDTH, VIEW_HEIGHT);
    expect(CAMERA_TUNING.steps).toContain(f.zoom);
  });

  it('calcule le zoom nécessaire pour faire tenir une boîte', () => {
    expect(neededZoom({ left: 0, right: VIEW_WIDTH / 0.75, top: 0, bottom: 100 }, VIEW_WIDTH, VIEW_HEIGHT)).toBe(0.75);
    expect(neededZoom({ left: 0, right: 100, top: 0, bottom: 100 }, VIEW_WIDTH, VIEW_HEIGHT)).toBe(1);
  });
});
