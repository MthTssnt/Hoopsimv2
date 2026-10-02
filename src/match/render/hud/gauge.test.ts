import { describe, expect, it } from 'vitest';
import { gaugeTime, greenWindow } from '../../../engine/shot';
import { GAUGE, gaugeRow, gaugeView, GRADE_TAGS } from './gauge';

describe('jauge de tir', () => {
  const T = gaugeTime('normal');

  it('se remplit pendant la montée, du bas vers le haut, dans ses bornes', () => {
    expect(gaugeView(0, T, 0.06).fill).toBe(0);
    expect(gaugeView(T / 2, T, 0.06).fill).toBeCloseTo(0.5 / GAUGE.span, 9);
    expect(gaugeView(10, T, 0.06).fill).toBe(1);
    expect(gaugeView(-1, T, 0.06).fill).toBe(0);
  });

  it('centre la zone verte sur le sommet du saut, vers 70 % de la hauteur', () => {
    const view = gaugeView(0, T, greenWindow('timing', 64, 'normal'));
    expect(view.apex).toBeCloseTo(1 / GAUGE.span, 9);
    expect(view.apex).toBeGreaterThan(0.65);
    expect(view.apex).toBeLessThan(0.75);
    expect((view.greenFrom + view.greenTo) / 2).toBeCloseTo(view.apex, 9);
    // Au moins 2 rangées de vert, sous le haut de la barre.
    expect(gaugeRow(view.greenTo) - gaugeRow(view.greenFrom)).toBeGreaterThanOrEqual(1);
    expect(gaugeRow(view.greenTo)).toBeLessThan(GAUGE.height - 1);
  });

  it('élargit la zone verte d’un bon tireur en Real Player %', () => {
    const width = (skill: number) => {
      const v = gaugeView(0, T, greenWindow('realPct', skill, 'normal'));
      return v.greenTo - v.greenFrom;
    };
    expect(width(90)).toBeGreaterThan(width(40));
  });

  it('annonce chaque note du lâcher', () => {
    expect(Object.keys(GRADE_TAGS).sort()).toEqual(['early', 'green', 'late', 'perfect']);
    expect(GRADE_TAGS.perfect.text).toBe('PARFAIT');
  });
});
