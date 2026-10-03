import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../engine';
import { drainEnergy, energyFactor, matchRotation, startingEnergy } from '../../engine/rotation';
import { matchProgress, matchTimeScale, createSquad, substitute, tickSquad, tiredAthlete } from './rotation';

const league = createNewGame('bos', 31);
const rotation = matchRotation(league.teams[0], league.players);

describe('échelle du match', () => {
  it('×4 pour 4 × 3 min, ×1 pour 4 × 12 min', () => {
    expect(matchTimeScale(3)).toBe(4);
    expect(matchTimeScale(12)).toBe(1);
    expect(matchTimeScale(1)).toBe(12);
  });

  it('part du match écoulée, comme la simulation (prolongation = 5/12 de quart-temps)', () => {
    expect(matchProgress(1, 180, 3)).toBe(0);
    expect(matchProgress(2, 90, 3)).toBeCloseTo(0.375, 12);
    expect(matchProgress(4, 0, 3)).toBe(1);
    expect(matchProgress(5, 75, 3)).toBe(1);
    expect(matchProgress(5, 0, 3)).toBeCloseTo(1 + 5 / 48, 12);
  });
});

describe('effectif', () => {
  it('toute la rotation, énergie de départ et minutes visées de la simulation, stats à 0', () => {
    const squad = createSquad(1, rotation);
    expect(squad.members).toHaveLength(rotation.length);
    expect(squad.members.every((m) => m.team === 1 && m.body === null && !m.onCourt && m.line.pts === 0)).toBe(true);
    expect(squad.members[0].energy).toBe(startingEnergy(rotation[0]));
    expect(squad.members[0].targetSecs).toBeGreaterThan(squad.members.at(-1)!.targetSecs);
    expect(squad.fouls).toBe(0);
  });

  it('fatigue à l’échelle : sur le terrain on perd et on joue, sur le banc on récupère', () => {
    const squad = createSquad(0, rotation);
    const [court, bench] = squad.members;
    court.body = 0;
    court.energy = 90;
    bench.energy = 60;
    tickSquad(squad, 10, 4);
    expect(court.line.secs).toBe(10);
    expect(bench.line.secs).toBe(0);
    expect(court.energy).toBeCloseTo(drainEnergy(90, court.player.attrs.stamina, 40, true), 12);
    expect(bench.energy).toBeCloseTo(drainEnergy(60, bench.player.attrs.stamina, 40, false), 12);
    expect(squad.sinceSub).toBe(10);
  });

  it('un joueur fatigué joue avec des notes plus basses, sauf aux lancers francs ; la fiche de la ligue ne change pas', () => {
    const player = rotation[0];
    const before = { ...player.attrs };
    const tired = tiredAthlete(player, 40);
    expect(tired.id).toBe(player.id);
    expect(tired.attrs.three).toBeCloseTo(player.attrs.three * energyFactor(40), 9);
    expect(tired.attrs.speed).toBeLessThan(player.attrs.speed);
    expect(tired.attrs.freeThrow).toBe(player.attrs.freeThrow);
    expect(player.attrs).toEqual(before);
    expect(tiredAthlete(player, 100).attrs).toEqual(player.attrs);
  });
});

describe('changements', () => {
  it('ceux qui restent gardent leur corps ; un remplaçant prend le corps de celui qui sort à son poste', () => {
    const squad = createSquad(0, rotation);
    const five = squad.members.slice(0, 5);
    const slots = [0, 1, 2, 3, 4];
    five.forEach((m, k) => (m.body = slots[k]));
    const sub = squad.members[6];
    const next = [...five];
    next[2] = sub;
    const { lineup, entering } = substitute(squad, next, slots);
    expect(lineup).toEqual(slots);
    expect(entering).toEqual([{ member: sub, body: 2, out: five[2] }]);
    expect(five[2].body).toBeNull();
    expect(five[2].onCourt).toBe(false);
    expect(sub.onCourt).toBe(true);
    expect(sub.line.gp).toBe(1);
    expect(five[0].body).toBe(0);
  });

  it('postes réordonnés sans entrée : personne ne change de corps, les postes suivent', () => {
    const squad = createSquad(0, rotation);
    const five = squad.members.slice(0, 5);
    five.forEach((m, k) => (m.body = 5 + k));
    const swapped = [five[1], five[0], five[2], five[3], five[4]];
    const { lineup, entering } = substitute(squad, swapped, [5, 6, 7, 8, 9]);
    expect(entering).toEqual([]);
    expect(lineup).toEqual([6, 5, 7, 8, 9]);
  });
});
