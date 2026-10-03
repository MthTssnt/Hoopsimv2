import { describe, expect, it } from 'vitest';
import { emptyStatLine } from '../../engine/types';
import { LiveBox, type BoxMember } from './boxScore';

function teams(): BoxMember[][] {
  return [0, 1].map((t) => Array.from({ length: 7 }, (_, k) => ({ line: emptyStatLine(), body: k < 5 ? t * 5 + k : null })));
}

describe('box score en direct', () => {
  it('tirs à 2 et 3 pts : tentatives, réussites, points, période', () => {
    const squads = teams();
    const box = new LiveBox(squads);
    box.startPeriod();
    const [a] = squads[0];
    box.attempt(a, 3);
    box.scored(0, a, 3);
    box.attempt(a, 2);
    box.missed(0);
    box.attempt(a, 2);
    box.scored(0, a, 2);
    expect(a.line).toMatchObject({ pts: 5, fga: 3, fgm: 2, tpa: 1, tpm: 1 });
    expect(box.periods).toEqual([[5], [0]]);
    box.startPeriod();
    box.attempt(a, 2);
    box.scored(0, a, 2);
    expect(box.periods).toEqual([[5, 2], [0, 0]]);
    expect(box.teamPoints(0)).toBe(7);
  });

  it('lancers francs : tentés, réussis, 1 point ; jamais de passe décisive', () => {
    const squads = teams();
    const box = new LiveBox(squads);
    const [a, b] = squads[0];
    box.attempt(a, 1);
    box.scored(0, a, 1, b);
    box.attempt(a, 1);
    expect(a.line).toMatchObject({ pts: 1, fta: 2, ftm: 1, fga: 0 });
    expect(b.line.ast).toBe(0);
  });

  it('tir raté avec faute : il ne compte pas comme tenté', () => {
    const squads = teams();
    const box = new LiveBox(squads);
    const [a] = squads[0];
    box.attempt(a, 3);
    box.cancelAttempt(a, 3);
    expect(a.line).toMatchObject({ fga: 0, tpa: 0 });
  });

  it('rebond : offensif pour l’équipe du tireur, défensif sinon ; un seul par tir raté ; pas après un ballon mort', () => {
    const squads = teams();
    const box = new LiveBox(squads);
    const [a, b] = squads[0];
    const [d] = squads[1];
    box.missed(0);
    box.gained(0, b);
    box.gained(0, a);
    expect(b.line.oreb).toBe(1);
    expect(a.line.oreb + a.line.dreb).toBe(0);
    box.missed(0);
    box.gained(1, d);
    expect(d.line.dreb).toBe(1);
    // Sortie (ballon mort) : personne n'a le rebond.
    box.missed(1);
    box.dead();
    box.gained(0, a);
    expect(a.line.dreb).toBe(0);
    // Ballon pris sans tir raté (passe, interception) : pas de rebond.
    box.gained(1, d);
    expect(d.line.dreb).toBe(1);
  });

  it('passe décisive au passeur, jamais à soi-même', () => {
    const squads = teams();
    const box = new LiveBox(squads);
    const [a, b] = squads[0];
    box.scored(0, a, 2, b);
    box.scored(0, a, 3, a);
    expect(b.line.ast).toBe(1);
    expect(a.line.ast).toBe(0);
  });

  it('+/- des dix joueurs sur le terrain, pas du banc', () => {
    const squads = teams();
    const box = new LiveBox(squads);
    box.scored(1, squads[1][0], 3);
    expect(squads[1].slice(0, 5).every((m) => m.line.plusMinus === 3)).toBe(true);
    expect(squads[0].slice(0, 5).every((m) => m.line.plusMinus === -3)).toBe(true);
    expect(squads[0][5].line.plusMinus).toBe(0);
    expect(squads[1][6].line.plusMinus).toBe(0);
  });

  it('perte et interception ; perte sans voleur (violation) ; contre ; faute', () => {
    const squads = teams();
    const box = new LiveBox(squads);
    const [a] = squads[0];
    const [d, e] = squads[1];
    box.turnover(a, d);
    box.turnover(a, null);
    box.block(e);
    box.foul(e);
    expect(a.line.tov).toBe(2);
    expect(d.line.stl).toBe(1);
    expect(e.line).toMatchObject({ blk: 1, pf: 1 });
  });
});
