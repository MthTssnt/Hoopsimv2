import { describe, expect, it } from 'vitest';
import { isThreePoint, makeCourt } from '../physics/court';
import {
  attackHoop,
  attacksRight,
  baselineSpot,
  clockStopsAfterBasket,
  defendHoop,
  formatClock,
  freeThrowPositions,
  freeThrowSpot,
  FULL_COURT,
  inFrontcourt,
  isOut,
  outSpot,
  periodLabel,
  periodLength,
  periodPositions,
  periodStarter,
  tipPositions,
} from './fullCourt';

const court = makeCourt('pro');

describe('sens d’attaque', () => {
  it('l’équipe 0 attaque à droite en première mi-temps, à gauche ensuite (prolongations comprises)', () => {
    expect(attacksRight(0, 1)).toBe(true);
    expect(attacksRight(0, 2)).toBe(true);
    expect(attacksRight(0, 3)).toBe(false);
    expect(attacksRight(0, 5)).toBe(false);
    expect(attacksRight(1, 1)).toBe(false);
    expect(attacksRight(1, 4)).toBe(true);
    expect(attackHoop(court, 0, 1)).toBe(court.hoops.right);
    expect(defendHoop(court, 0, 1)).toBe(court.hoops.left);
    expect(attackHoop(court, 0, 3)).toBe(court.hoops.left);
  });

  it('moitié avant selon l’équipe et la mi-temps', () => {
    expect(inFrontcourt(court, 0, 1, court.length - 3)).toBe(true);
    expect(inFrontcourt(court, 0, 1, 3)).toBe(false);
    expect(inFrontcourt(court, 1, 1, 3)).toBe(true);
    expect(inFrontcourt(court, 0, 3, 3)).toBe(true);
  });
});

describe('sorties et remises', () => {
  it('la ligne est dehors', () => {
    expect(isOut(court, { x: 10, y: 7 })).toBe(false);
    expect(isOut(court, { x: -0.1, y: 7 })).toBe(true);
    expect(isOut(court, { x: 10, y: court.width + 0.01 })).toBe(true);
    // Pied sur la ligne : le centre du joueur à moins de `footMargin` de la ligne.
    expect(isOut(court, { x: 10, y: 0.05 }, FULL_COURT.footMargin)).toBe(true);
    expect(isOut(court, { x: 10, y: 0.3 }, FULL_COURT.footMargin)).toBe(false);
  });

  it('remise sur la ligne la plus proche, dehors ; jamais derrière le panier', () => {
    const side = outSpot(court, { x: 10, y: 0.3 });
    expect(side.y).toBeCloseTo(-FULL_COURT.inboundOut, 9);
    expect(side.x).toBeCloseTo(10, 9);
    expect(isOut(court, side)).toBe(true);
    const near = outSpot(court, { x: 12, y: court.width + 1 });
    expect(near.y).toBeCloseTo(court.width + FULL_COURT.inboundOut, 9);
    const base = outSpot(court, { x: court.length - 0.2, y: court.width / 2 + 0.3 });
    expect(base.x).toBeCloseTo(court.length + FULL_COURT.inboundOut, 9);
    expect(Math.abs(base.y - court.width / 2)).toBeGreaterThanOrEqual(FULL_COURT.baselineClear - 1e-9);
    // Forcée sur la ligne de côté (faute).
    expect(outSpot(court, { x: court.length - 0.2, y: 7 }, true).y).toBeCloseTo(-FULL_COURT.inboundOut, 9);
  });

  it('après un panier : derrière la ligne de fond de ce panier, à côté du poteau', () => {
    const spot = baselineSpot(court, court.hoops.right);
    expect(spot.x).toBeGreaterThan(court.length);
    expect(Math.abs(spot.y - court.width / 2)).toBeGreaterThanOrEqual(FULL_COURT.baselineClear - 1e-9);
    expect(baselineSpot(court, court.hoops.left).x).toBeLessThan(0);
  });
});

describe('périodes et chrono', () => {
  it('quart-temps et prolongations (5/12, arrondies à 5 s)', () => {
    expect(periodLength(3, 1)).toBe(180);
    expect(periodLength(3, 4)).toBe(180);
    expect(periodLength(3, 5)).toBe(75);
    expect(periodLength(12, 5)).toBe(300);
    expect(periodLength(1, 6)).toBe(FULL_COURT.overtimeMin);
  });

  it('le chrono s’arrête après un panier dans la dernière minute du QT4 et des prolongations seulement', () => {
    expect(clockStopsAfterBasket(4, 59)).toBe(true);
    expect(clockStopsAfterBasket(5, 30)).toBe(true);
    expect(clockStopsAfterBasket(4, 61)).toBe(false);
    expect(clockStopsAfterBasket(3, 10)).toBe(false);
  });

  it('affichage du chrono et de la période', () => {
    expect(formatClock(180)).toBe('3:00');
    expect(formatClock(167.2)).toBe('2:48');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(45.31)).toBe('45.4');
    expect(formatClock(0)).toBe('0.0');
    expect(periodLabel(1)).toBe('QT1');
    expect(periodLabel(5)).toBe('P1');
  });

  it('remise en début de période : le perdant de l’entre-deux aux QT2 et QT3, le gagnant au QT4', () => {
    expect(periodStarter(2, 0)).toBe(1);
    expect(periodStarter(3, 0)).toBe(1);
    expect(periodStarter(4, 0)).toBe(0);
  });
});

describe('placements', () => {
  const order = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
  ];

  it('entre-deux : les sauteurs dans le rond, chacun côté de son panier ; les autres hors du rond', () => {
    const pos = tipPositions(court, 1, [
      [4, 0, 1, 2, 3],
      [9, 5, 6, 7, 8],
    ]);
    const cx = court.length / 2;
    expect(pos.get(4)!.x).toBeLessThan(cx);
    expect(pos.get(9)!.x).toBeGreaterThan(cx);
    for (const i of [0, 1, 2, 3, 5, 6, 7, 8]) {
      const p = pos.get(i)!;
      expect(Math.hypot(p.x - cx, p.y - court.width / 2)).toBeGreaterThan(FULL_COURT.tipRing - 1e-6);
      expect(isOut(court, p)).toBe(false);
    }
    expect(pos.size).toBe(10);
  });

  it('début de période : l’équipe qui remet dans sa moitié arrière, l’autre dans sa moitié défensive', () => {
    const spot = baselineSpot(court, defendHoop(court, 1, 2));
    const pos = periodPositions(court, 2, 1, order, spot, 8);
    expect(pos.get(8)).toEqual(spot);
    for (const i of [5, 6, 7, 9]) expect(inFrontcourt(court, 1, 2, pos.get(i)!.x)).toBe(false);
    for (const i of order[0]) expect(inFrontcourt(court, 1, 2, pos.get(i)!.x)).toBe(true);
  });
});

describe('lancers francs : placements', () => {
  it('tireur derrière la ligne ; le long de la raquette, défense près du cercle et attaque derrière ; les autres en haut', () => {
    const hoop = court.hoops.right;
    const order = [
      [0, 1, 2, 3, 4],
      [5, 6, 7, 8, 9],
    ];
    const pos = freeThrowPositions(court, hoop, 1, 0, order);
    expect(pos.size).toBe(10);
    expect(pos.get(1)).toEqual(freeThrowSpot(court, hoop));
    const fromBase = (i: number) => Math.abs(pos.get(i)!.x - hoop.baselineX);
    const inLane = (i: number) => Math.abs(pos.get(i)!.y - court.width / 2) > court.paintWidth / 2 && fromBase(i) < court.paintLength;
    // Défense : pivot et ailier fort au plus près du cercle, un troisième plus haut.
    expect(inLane(9) && inLane(8) && inLane(7)).toBe(true);
    expect(fromBase(9)).toBeLessThan(fromBase(4));
    // Attaque : pivot et ailier fort derrière eux.
    expect(inLane(4) && inLane(3)).toBe(true);
    // Les autres derrière la ligne à 3 pts.
    for (const i of [0, 2, 5, 6]) expect(isThreePoint(court, hoop, pos.get(i)!.x, pos.get(i)!.y)).toBe(true);
    for (const p of pos.values()) expect(isOut(court, p)).toBe(false);
  });
});
