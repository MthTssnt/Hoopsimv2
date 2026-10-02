import { describe, expect, it } from 'vitest';
import { createNewGame, gaugeTime, type Player } from '../../engine';
import { Rng } from '../../engine/rng';
import { BALL_RADIUS, makeCourt } from '../physics/court';
import { MatchWorld, WORLD_DT, WORLD_TUNING } from './MatchWorld';
import { PLAYER_TUNING, type MoveInput } from './player';

const players = Object.values(createNewGame('bos', 31).players);
const guard = players.filter((p) => p.pos === 'PG').sort((a, b) => b.attrs.speed - a.attrs.speed)[0];
const heavyCenter = players.filter((p) => p.pos === 'C').sort((a, b) => b.weightKg - a.weightKg)[0];
const court = makeCourt('pro');
const START = { x: 18, y: 7, z: 0 };

function newWorld(athlete: Player = guard, seed = 1): MatchWorld {
  return new MatchWorld(court, athlete, START, gaugeTime('normal'), new Rng(seed));
}

function run(world: MatchWorld, seconds: number, input: MoveInput): void {
  for (let t = 0; t < seconds; t += WORLD_DT) world.step(WORLD_DT, input);
}

const RIGHT: MoveInput = { x: 1, y: 0, jump: false };
const IDLE: MoveInput = { x: 0, y: 0, jump: false };

describe('joueur contrôlé', () => {
  it('atteint sa vitesse de course, et un meneur va plus vite qu’un pivot lourd', () => {
    const fast = newWorld(guard);
    const slow = newWorld(heavyCenter);
    run(fast, 1, RIGHT);
    run(slow, 1, RIGHT);
    expect(fast.player.vel.x).toBeCloseTo(fast.player.runSpeed, 5);
    expect(fast.player.runSpeed).toBeGreaterThan(slow.player.runSpeed);
    expect(fast.player.pos.x).toBeGreaterThan(slow.player.pos.x);
  });

  it('saute à sa hauteur de saut, avec le sommet à la fin de la jauge', () => {
    const world = newWorld();
    world.step(WORLD_DT, { x: 0, y: 0, jump: true });
    let apex = 0;
    let apexTime = 0;
    for (let t = WORLD_DT; t < 2; t += WORLD_DT) {
      world.step(WORLD_DT, IDLE);
      if (world.player.pos.z > apex) {
        apex = world.player.pos.z;
        apexTime = t;
      }
    }
    expect(apex).toBeCloseTo(world.player.jumpHeight, 1);
    expect(apexTime).toBeCloseTo(gaugeTime('normal'), 1);
    expect(world.player.airborne).toBe(false);
  });

  it('suit la vitesse de tir : un saut plus lent quand la jauge est lente', () => {
    const world = newWorld();
    world.setJumpTiming(gaugeTime('slow'));
    expect(world.player.timeToApex).toBe(gaugeTime('slow'));
  });

  /** Temps (s) jusqu'à ce que `done` soit vrai, en appliquant `input`. */
  const timeUntil = (world: MatchWorld, input: MoveInput, done: () => boolean): number => {
    let t = 0;
    while (!done() && t < 3) {
      world.step(WORLD_DT, input);
      t += WORLD_DT;
    }
    return t;
  };

  it('freine net : s’arrête en moins de 0,5 m après une pleine course', () => {
    const world = newWorld();
    run(world, 1, RIGHT);
    const from = world.player.pos.x;
    const time = timeUntil(world, IDLE, () => world.player.vel.x === 0);
    expect(time).toBeLessThanOrEqual(0.15);
    expect(world.player.pos.x - from).toBeLessThan(0.5);
  });

  it('fait demi-tour sans reculer longtemps, et tourne à 90° sans dériver', () => {
    const back = newWorld();
    run(back, 1, RIGHT);
    expect(timeUntil(back, { x: -1, y: 0, jump: false }, () => back.player.vel.x < 0)).toBeLessThanOrEqual(0.15);
    expect(back.player.facing).toBe(-1);
    const turn = newWorld();
    run(turn, 1, RIGHT);
    expect(timeUntil(turn, { x: 0, y: -1, jump: false }, () => Math.abs(turn.player.vel.x) < 1e-9)).toBeLessThanOrEqual(0.15);
    run(turn, 1, { x: 0, y: -1, jump: false });
    expect(turn.player.vel.y).toBeCloseTo(-turn.player.runSpeed, 5);
  });

  it('un saut en pleine course avance de 1 à 2 m, quelle que soit la vitesse de tir', () => {
    for (const speed of ['slow', 'normal', 'fast'] as const) {
      const world = newWorld();
      world.setJumpTiming(gaugeTime(speed));
      run(world, 1, RIGHT);
      const from = world.player.pos.x;
      world.step(WORLD_DT, { ...RIGHT, jump: true });
      timeUntil(world, RIGHT, () => !world.player.airborne);
      const drift = world.player.pos.x - from;
      expect(drift).toBeGreaterThan(1);
      expect(drift).toBeLessThanOrEqual(PLAYER_TUNING.jumpMaxDrift + 0.05);
    }
  });

  it('un saut sur place reste sur place', () => {
    const world = newWorld();
    world.step(WORLD_DT, { x: 0, y: 0, jump: true });
    run(world, 1.5, IDLE);
    expect(world.player.pos.x).toBe(START.x);
    expect(world.player.pos.y).toBe(START.y);
  });

  it('dribble avec le ballon, puis le lève au-dessus de la tête en l’air', () => {
    const world = newWorld();
    expect(world.holder).toBe(0);
    let lowest = Infinity;
    for (let t = 0; t < 1; t += WORLD_DT) {
      world.step(WORLD_DT, RIGHT);
      lowest = Math.min(lowest, world.ball.pos.z);
    }
    expect(lowest).toBeCloseTo(BALL_RADIUS, 1);
    world.step(WORLD_DT, { x: 0, y: 0, jump: true });
    run(world, 0.3, IDLE);
    // Au-dessus de la tête.
    expect(world.ball.pos.z).toBeGreaterThan(world.player.pos.z + world.player.athlete.heightCm / 100);
  });
});

describe('ballon libre', () => {
  it('se ramasse à portée, pas au-delà', () => {
    const world = newWorld();
    world.holder = null;
    world.ball = { pos: { x: START.x + 2, y: START.y, z: BALL_RADIUS }, vel: { x: 0, y: 0, z: 0 } };
    run(world, 0.1, IDLE);
    expect(world.holder).toBeNull();
    run(world, 1, RIGHT);
    expect(world.holder).toBe(0);
  });

  it('ne revient pas tout de suite dans les mains du tireur', () => {
    const world = newWorld();
    expect(world.demoShot(true)).not.toBeNull();
    expect(world.holder).toBeNull();
    world.step(WORLD_DT, IDLE);
    expect(world.holder).toBeNull();
    expect(WORLD_TUNING.pickupCooldown).toBeGreaterThan(0);
  });

  it('va au bout du tir démo avec le résultat voulu', () => {
    for (const made of [true, false]) {
      const world = newWorld(guard, made ? 3 : 4);
      world.demoShot(made);
      run(world, 4, IDLE);
      expect(world.lastShot?.live).toBe(made);
    }
  });
});

describe('déterminisme', () => {
  it('rejoue exactement la même partie avec la même graine et les mêmes entrées', () => {
    const script = (world: MatchWorld) => {
      run(world, 0.5, RIGHT);
      world.step(WORLD_DT, { x: 1, y: -1, jump: true });
      run(world, 0.6, { x: 0, y: 1, jump: false });
      world.demoShot(false);
      run(world, 2, { x: 1, y: 0, jump: false });
      return JSON.stringify({ p: world.player.pos, b: world.ball, h: world.holder, s: world.lastShot });
    };
    expect(script(newWorld(guard, 9))).toBe(script(newWorld(guard, 9)));
  });
});
