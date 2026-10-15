import { describe, expect, it } from 'vitest';
import type { Appearance } from '../appearance';
import { renderFigure2D } from '../figure2d';
import { poses2D } from '../poses2d';
import { FRAME } from '../rig';
import { DENSITY_HD } from './densityHD';
import { headGridHD } from './headHD';

const LOOK: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 2, head: 0, hair: 0, hairColor: 1, number: 23, face: 1, eyeColor: 1 };
const idle = poses2D('idle')[0].pose;

describe('prototype haute résolution (densité ×1,5)', () => {
  it('même joueur 1,5 fois plus fin : hauteur ×1,5 (±2 px), dans son cadre de 84×96, pieds au sol', () => {
    for (const heading of ['down', 'up'] as const) {
      const old = renderFigure2D(LOOK, idle, heading).canvas.bounds()!;
      const hd = renderFigure2D(LOOK, idle, heading, 'right', 'team', DENSITY_HD).canvas.bounds()!;
      const hOld = FRAME.groundY - old.top + 1;
      const hHd = DENSITY_HD.frame.groundY - hd.top + 1;
      expect(Math.abs(hHd - hOld * 1.5), heading).toBeLessThanOrEqual(2);
      expect(hd.bottom).toBe(DENSITY_HD.frame.groundY);
      expect(hd.left).toBeGreaterThan(0);
      expect(hd.right).toBeLessThan(DENSITY_HD.frame.width - 1);
    }
  });

  it('visage de 3/4 : œil proche plus large que l’œil éloigné, blanc, iris et pupille ; peau en 3 tons au moins', () => {
    const rows = headGridHD(LOOK, 'down').rows;
    const eyeRow = rows.find((r) => r.includes('n'))!;
    const groups = eyeRow.replace(/[^win]/g, '.').split('.').filter(Boolean);
    expect(groups).toHaveLength(2);
    expect(groups[0].length).toBeGreaterThan(groups[1].length);
    for (const ch of 'win123E4') expect(rows.join('').includes(ch), ch).toBe(true);
    expect(headGridHD(LOOK, 'up').rows.join('')).not.toMatch(/[win]/);
  });

  it('numéro dessiné à la même densité (9 rangées)', () => {
    expect(DENSITY_HD.digits.height).toBe(9);
    expect(DENSITY_HD.digits.width(23)).toBe(11);
  });
});
