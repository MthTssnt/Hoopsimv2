import { describe, expect, it } from 'vitest';
import { CAMERA_TUNING, neededZoom, stepZoom, targetFraming } from './camera';

const VIEW_W = 320;
const VIEW_H = 180;
/** Joueur de 40 px de haut, pieds en (300, 250). */
const player = { left: 292, right: 308, top: 210, bottom: 250 };

describe('caméra', () => {
  it('reste au zoom 1, centrée sur le joueur, quand il tient le ballon', () => {
    const f = targetFraming(player, { x: 305, y: 235 }, 'free', 1, VIEW_W, VIEW_H);
    expect(f.zoom).toBe(1);
    expect(f.centerX).toBe(300);
    expect(f.centerY).toBe(230);
  });

  it('se décale sans dézoomer quand le ballon est un peu loin', () => {
    const f = targetFraming(player, { x: 450, y: 230 }, 'free', 1, VIEW_W, VIEW_H);
    expect(f.zoom).toBe(1);
    expect(f.centerX).toBeGreaterThan(300);
    expect(450 + CAMERA_TUNING.margin.x).toBeLessThanOrEqual(f.centerX + VIEW_W / 2 + 1e-9);
  });

  it('dézoome quand le ballon monte haut, sans descendre sous le zoom minimal', () => {
    const high = targetFraming(player, { x: 330, y: 60 }, 'free', 1, VIEW_W, VIEW_H);
    expect(high.zoom).toBeLessThan(1);
    expect(high.zoom).toBeGreaterThanOrEqual(CAMERA_TUNING.minZoom);
    // Le ballon et le joueur tiennent dans la vue.
    const halfH = VIEW_H / (2 * high.zoom);
    expect(60 - CAMERA_TUNING.margin.top).toBeGreaterThanOrEqual(high.centerY - halfH - 1e-9);
    expect(250 + CAMERA_TUNING.margin.bottom).toBeLessThanOrEqual(high.centerY + halfH + 1e-9);
    const huge = targetFraming(player, { x: 330, y: -2000 }, 'free', 1, VIEW_W, VIEW_H);
    expect(huge.zoom).toBe(CAMERA_TUNING.minZoom);
  });

  it('en mode paliers, ne prend que 1, 0,75 ou 0,5 et ne fait pas d’allers-retours', () => {
    expect(stepZoom(1, 1)).toBe(1);
    expect(stepZoom(0.8, 1)).toBe(0.75);
    expect(stepZoom(0.6, 0.75)).toBe(0.5);
    // Juste sous le palier courant : on y reste (marge), plutôt que de basculer.
    expect(stepZoom(0.72, 0.75)).toBe(0.75);
    expect(stepZoom(0.72, 1)).toBe(0.5);
    const f = targetFraming(player, { x: 330, y: 60 }, 'steps', 1, VIEW_W, VIEW_H);
    expect(CAMERA_TUNING.steps).toContain(f.zoom);
  });

  it('calcule le zoom nécessaire pour faire tenir une boîte', () => {
    expect(neededZoom({ left: 0, right: 640, top: 0, bottom: 100 }, VIEW_W, VIEW_H)).toBe(0.5);
    expect(neededZoom({ left: 0, right: 100, top: 0, bottom: 100 }, VIEW_W, VIEW_H)).toBe(1);
  });
});
