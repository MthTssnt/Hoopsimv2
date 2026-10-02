import { describe, expect, it } from 'vitest';
import { makeCourt } from '../physics/court';
import { attacksRim, layupFinish, releasePoint, SHOT_FLOW, shotZone, targetHoop } from './shooting';

const pro = makeCourt('pro');
const college = makeCourt('college');
const right = pro.hoops.right;
const rim = right.rim;
const still = { x: 0, y: 0, z: 0 };

describe('mesures du tir', () => {
  it('vise le panier le plus proche', () => {
    expect(targetHoop(pro, 5).side).toBe('left');
    expect(targetHoop(pro, 20).side).toBe('right');
  });

  it('classe le tir : près du cercle, mi-distance, 3 pts selon la ligne du niveau', () => {
    expect(shotZone(pro, right, rim.x - 2, rim.y)).toBe('rim');
    expect(shotZone(pro, right, rim.x - SHOT_FLOW.rimRange - 0.1, rim.y)).toBe('mid');
    expect(shotZone(pro, right, rim.x - 5, rim.y)).toBe('mid');
    // Même position, deux niveaux : 6,9 m dans l'axe (arc pro 7,24 m, college 6,75 m).
    expect(shotZone(pro, pro.hoops.right, rim.x - 6.9, rim.y)).toBe('mid');
    expect(shotZone(college, college.hoops.right, rim.x - 6.9, rim.y)).toBe('three');
    expect(shotZone(pro, right, rim.x - 8, rim.y)).toBe('three');
    // Dans le coin, derrière la ligne du cercle (coin pro 6,71 m, college 6,60 m).
    expect(shotZone(pro, right, rim.x + 0.8, rim.y + 6.65)).toBe('mid');
    expect(shotZone(college, college.hoops.right, rim.x + 0.8, rim.y + 6.65)).toBe('three');
  });

  it('reconnaît un joueur qui attaque le cercle : près, en course, dans sa direction', () => {
    const near = { x: rim.x - 2.5, y: rim.y, z: 0 };
    expect(attacksRim(near, { x: 6, y: 0, z: 0 }, right)).toBe(true);
    expect(attacksRim(near, { x: 4.2, y: 4.2, z: 0 }, right)).toBe(true);
    expect(attacksRim(near, { x: -6, y: 0, z: 0 }, right)).toBe(false);
    expect(attacksRim(near, { x: 0, y: 6, z: 0 }, right)).toBe(false);
    expect(attacksRim(near, { x: 1.5, y: 0, z: 0 }, right)).toBe(false);
    expect(attacksRim(near, still, right)).toBe(false);
    expect(attacksRim({ x: rim.x - 4, y: rim.y, z: 0 }, { x: 6, y: 0, z: 0 }, right)).toBe(false);
  });

  it('finit un layup devant le cercle, jamais sous la planche', () => {
    const front = layupFinish({ x: rim.x - 2.5, y: rim.y + 1, z: 0 }, right);
    expect(Math.hypot(front.x - rim.x, front.y - rim.y)).toBeCloseTo(SHOT_FLOW.layupFinish, 5);
    expect(front.x).toBeLessThan(rim.x);
    // Venu de la ligne de fond : ramené devant le cercle.
    const baseline = layupFinish({ x: rim.x + 1, y: rim.y + 2, z: 0 }, right);
    expect(rim.x - baseline.x).toBeCloseTo(SHOT_FLOW.minFront, 5);
  });

  it('lâche le ballon au-dessus de la tête, devant le cercle si le joueur est dessous', () => {
    const open = releasePoint({ x: rim.x - 6, y: rim.y, z: 0.5 }, 200, right, 0.12);
    expect(open).toEqual({ x: rim.x - 6, y: rim.y + 0.12, z: 0.5 + 2 * SHOT_FLOW.releaseHeight });
    const under = releasePoint({ x: rim.x + 0.2, y: rim.y, z: 0 }, 200, right, 0);
    expect(under.x).toBeCloseTo(rim.x - SHOT_FLOW.minFront, 5);
    // Dans le coin, derrière la ligne du cercle mais loin de la planche : pas déplacé.
    const corner = releasePoint({ x: rim.x + 0.8, y: rim.y + 6.5, z: 0 }, 200, right, 0);
    expect(corner.x).toBe(rim.x + 0.8);
  });
});
