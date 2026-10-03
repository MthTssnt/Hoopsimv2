import { describe, expect, it } from 'vitest';
import { createNewGame } from '../engine';
import { POSITION_INDEX } from '../engine/ratings';
import { spreadLabels } from './render/hud/labels';
import { fullCourtRoster, halfCourtRoster } from './roster';

const league = createNewGame('bos', 31);
const players = Object.values(league.players);

describe('effectif du demi-terrain', () => {
  it('un arrière, un ailier et un intérieur de l’équipe, les meilleurs à leur poste', () => {
    for (const team of league.teams.slice(0, 6)) {
      const three = halfCourtRoster(players, team.id, 3);
      expect(three).toHaveLength(3);
      expect(new Set(three).size).toBe(3);
      expect(three.every((p) => p.teamId === team.id)).toBe(true);
      expect(['PG', 'SG']).toContain(three[0].pos);
      expect(['C', 'PF']).toContain(three[2].pos);
      const guards = players.filter((p) => p.teamId === team.id && (p.pos === 'PG' || p.pos === 'SG') && p.injuryGames === 0);
      expect(three[0].overall).toBe(Math.max(...guards.map((p) => p.overall)));
    }
    expect(halfCourtRoster(players, league.teams[0].id, 2).map((p) => p.pos).some((pos) => pos === 'C' || pos === 'PF')).toBe(true);
    expect(halfCourtRoster(players, league.teams[0].id, 1)).toHaveLength(1);
  });
});

describe('cinq majeur du terrain entier', () => {
  it('les cinq premiers de la rotation, rangés du meneur au pivot', () => {
    for (const team of league.teams.slice(0, 8)) {
      const five = fullCourtRoster(league.players, team);
      expect(five).toHaveLength(5);
      expect(new Set(five).size).toBe(5);
      const firstFive = team.rotation.map((id) => league.players[id]).filter((p) => p.injuryGames === 0).slice(0, 5);
      expect(new Set(five)).toEqual(new Set(firstFive));
      // Rangés par poste comme la simulation : en moyenne, le premier est plus petit poste que le dernier.
      expect(POSITION_INDEX[five[0].pos]).toBeLessThanOrEqual(POSITION_INDEX[five[4].pos]);
    }
  });
});

describe('étiquettes', () => {
  it('les étiquettes côte à côte s’écartent sans se chevaucher', () => {
    const boxes = [
      { x: 100, y: 50, width: 30, height: 7 },
      { x: 104, y: 51, width: 26, height: 7 },
      { x: 108, y: 50, width: 34, height: 7 },
      { x: 200, y: 50, width: 30, height: 7 },
    ];
    spreadLabels(boxes);
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const a = boxes[i];
        const b = boxes[j];
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((a.width + b.width) / 2);
      }
    }
    expect(boxes[3].x).toBe(200);
  });
});
