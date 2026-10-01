import { describe, expect, it } from 'vitest';
import { Rng } from '../../engine/rng';
import { BALL_PHYSICS, isAtRest, stepBall, type BallEvent, type BallState } from './ball';
import {
  BALL_RADIUS,
  COURT_LENGTH,
  RIM_HEIGHT,
  distanceToRim,
  inPaintHalf,
  isThreePoint,
  makeCourt,
  type Vec3,
} from './court';
import { simulateShot, solveShot, SOLVER_TUNING } from './shotSolver';

const court = makeCourt('pro');
const hoop = court.hoops.right;

function run(ball: BallState, seconds: number): BallEvent[] {
  const events: BallEvent[] = [];
  for (let t = 0; t < seconds; t += BALL_PHYSICS.dt) events.push(...stepBall(ball, court));
  return events;
}

/** Position de tir aléatoire devant le panier de droite, à une distance donnée. */
function randomRelease(rng: Rng, minDist: number, maxDist: number): Vec3 {
  const dist = rng.range(minDist, maxDist);
  const angle = rng.range(-1.45, 1.45);
  return {
    x: hoop.rim.x - Math.cos(angle) * dist,
    y: Math.min(court.width - 0.3, Math.max(0.3, hoop.rim.y + Math.sin(angle) * dist)),
    z: rng.range(2.1, 2.8),
  };
}

describe('terrain', () => {
  it('place le cercle à 3,05 m, à 1,60 m de la ligne de fond', () => {
    expect(hoop.rim.z).toBe(RIM_HEIGHT);
    expect(COURT_LENGTH - hoop.rim.x).toBeCloseTo(1.6, 2);
    expect(court.hoops.left.rim.x).toBeCloseTo(1.6, 2);
  });

  it('trace la ligne à 3 pts selon le niveau', () => {
    const college = makeCourt('college');
    const at = (dist: number) => ({ x: hoop.rim.x - dist, y: hoop.rim.y });
    expect(isThreePoint(court, hoop, at(7.0).x, at(7.0).y)).toBe(false);
    expect(isThreePoint(college, college.hoops.right, at(7.0).x, at(7.0).y)).toBe(true);
    expect(isThreePoint(court, hoop, at(7.4).x, at(7.4).y)).toBe(true);
    // Coin : 6,71 m en pro, 6,60 m en college.
    const corner = { x: hoop.rim.x - 0.5, y: hoop.rim.y + 6.65 };
    expect(isThreePoint(court, hoop, corner.x, corner.y)).toBe(false);
    expect(isThreePoint(college, college.hoops.right, corner.x, corner.y)).toBe(true);
  });

  it('repère la moitié de la raquette côté panier', () => {
    expect(inPaintHalf(court, hoop, COURT_LENGTH - 2, hoop.rim.y)).toBe(true);
    expect(inPaintHalf(court, hoop, COURT_LENGTH - 4, hoop.rim.y)).toBe(false);
    expect(inPaintHalf(court, hoop, COURT_LENGTH - 2, hoop.rim.y + 3)).toBe(false);
  });
});

describe('ballon', () => {
  it('rebondit de moins en moins haut puis s’arrête sur le parquet', () => {
    const ball: BallState = { pos: { x: 10, y: 7, z: 2 }, vel: { x: 0, y: 0, z: 0 } };
    const peaks: number[] = [];
    let rising = false;
    let peak = 0;
    for (let t = 0; t < 8; t += BALL_PHYSICS.dt) {
      stepBall(ball, court);
      if (ball.vel.z > 0) {
        rising = true;
        peak = Math.max(peak, ball.pos.z);
      } else if (rising) {
        peaks.push(peak);
        rising = false;
        peak = 0;
      }
    }
    expect(peaks.length).toBeGreaterThan(2);
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeLessThan(peaks[i - 1]);
    expect(ball.pos.z).toBeCloseTo(BALL_RADIUS, 6);
    expect(isAtRest(ball)).toBe(true);
  });

  it('compte un panier quand il tombe dans le cercle', () => {
    const ball: BallState = { pos: { ...hoop.rim, z: 4 }, vel: { x: 0, y: 0, z: 0 } };
    expect(run(ball, 2).some((e) => e.type === 'score' && e.hoop === 'right')).toBe(true);
  });

  it('rebondit sur le fer quand il tombe dessus', () => {
    const ball: BallState = { pos: { x: hoop.rim.x - 0.24, y: hoop.rim.y, z: 4 }, vel: { x: 0, y: 0, z: 0 } };
    const events = run(ball, 1.5);
    expect(events.some((e) => e.type === 'rim')).toBe(true);
  });

  it('rebondit sur la planche', () => {
    const ball: BallState = { pos: { x: hoop.board.min.x - 1, y: hoop.rim.y, z: 3.4 }, vel: { x: 6, y: 0, z: 1 } };
    let hitBoard = false;
    for (let t = 0; t < 0.5 && !hitBoard; t += BALL_PHYSICS.dt) {
      hitBoard = stepBall(ball, court).some((e) => e.type === 'board');
    }
    expect(hitBoard).toBe(true);
    expect(ball.vel.x).toBeLessThan(0);
  });

  it('reste sur le terrain grâce aux murs invisibles', () => {
    const ball: BallState = { pos: { x: 27, y: 7, z: 1 }, vel: { x: 12, y: 9, z: 2 } };
    run(ball, 6);
    expect(ball.pos.x).toBeLessThanOrEqual(court.length + BALL_PHYSICS.wallMargin);
    expect(ball.pos.y).toBeLessThanOrEqual(court.width + BALL_PHYSICS.wallMargin);
  });
});

describe('solveur de tir', () => {
  it('produit toujours le résultat tiré par le moteur (500 tirs, 1 à 8,5 m)', () => {
    const rng = new Rng(2026);
    for (let i = 0; i < 500; i++) {
      const start = randomRelease(rng, 1, 8.5);
      const made = rng.chance(0.5);
      const plan = solveShot(start, made, court, hoop, rng);
      expect(plan.made).toBe(made);
      // La simulation « en direct » repart des mêmes conditions : même résultat.
      expect(simulateShot(start, plan.velocity, court, hoop)?.made).toBe(made);
    }
  });

  it('fait retomber la plupart des ratés près du cercle', () => {
    const rng = new Rng(77);
    let near = 0;
    const total = 200;
    for (let i = 0; i < total; i++) {
      const plan = solveShot(randomRelease(rng, 2, 8.5), false, court, hoop, rng);
      if (plan.landing && distanceToRim(hoop, plan.landing.x, plan.landing.y) <= SOLVER_TUNING.reboundRadius) near++;
    }
    expect(near / total).toBeGreaterThan(0.85);
  });

  it('est déterministe pour une même graine', () => {
    const start = { x: 22, y: 5, z: 2.4 };
    const a = solveShot(start, true, court, hoop, new Rng(5));
    const b = solveShot(start, true, court, hoop, new Rng(5));
    expect(a.velocity).toEqual(b.velocity);
  });
});
