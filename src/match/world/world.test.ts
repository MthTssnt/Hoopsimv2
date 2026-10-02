import { describe, expect, it } from 'vitest';
import { createNewGame, gaugeTime, type Player } from '../../engine';
import { reach } from '../../engine/athletics';
import { DUNK_TUNING, dunkScore } from '../../engine/shot';
import { Rng } from '../../engine/rng';
import { BALL_RADIUS, makeCourt, RIM_HEIGHT } from '../physics/court';
import { MatchWorld, WORLD_DT, WORLD_TUNING } from './MatchWorld';
import { PLAYER_TUNING, type MoveInput } from './player';
import { SHOT_FLOW } from './shooting';

const players = Object.values(createNewGame('bos', 31).players);
const guard = players.filter((p) => p.pos === 'PG').sort((a, b) => b.attrs.speed - a.attrs.speed)[0];
const heavyCenter = players.filter((p) => p.pos === 'C').sort((a, b) => b.weightKg - a.weightKg)[0];
const court = makeCourt('pro');
const START = { x: 18, y: 7, z: 0 };

function newWorld(athlete: Player = guard, seed = 1): MatchWorld {
  return new MatchWorld(court, athlete, START, { mode: 'timing', speed: 'normal' }, new Rng(seed));
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
    world.setShotSettings({ mode: 'timing', speed: 'slow' });
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
      world.setShotSettings({ mode: 'timing', speed });
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

describe('tir avec jauge', () => {
  /** Saute avec Tir, puis relâche quand le temps en l'air atteint `at` (s) ; renvoie le monde. */
  const shootAt = (world: MatchWorld, at: number, move: MoveInput = IDLE): MatchWorld => {
    world.step(WORLD_DT, { ...move, jump: true });
    while (world.shot && world.shot.airTime + WORLD_DT < at - 1e-9) world.step(WORLD_DT, move);
    world.step(WORLD_DT, { ...move, release: true });
    return world;
  };
  const rim = court.hoops.right.rim;

  it('Tir avec le ballon : le joueur saute, se tourne vers le panier et la jauge tourne', () => {
    const world = newWorld();
    run(world, 0.2, { x: -1, y: 0, jump: false });
    expect(world.player.facing).toBe(-1);
    run(world, 0.3, IDLE);
    world.step(WORLD_DT, { ...IDLE, jump: true });
    expect(world.player.airborne).toBe(true);
    expect(world.player.facing).toBe(1);
    expect(world.shot?.kind).toBe('jump');
    expect(world.holder).toBe(0);
  });

  it('note le lâcher : parfait au sommet, tôt avant, tard après', () => {
    const apex = gaugeTime('normal');
    const perfect = shootAt(newWorld(), apex).lastShot!;
    expect(perfect.grade).toBe('perfect');
    expect(Math.abs(perfect.timingError!)).toBeLessThanOrEqual(WORLD_DT + 1e-9);
    expect(perfect.demo).toBe(false);
    expect(shootAt(newWorld(), apex - 0.25).lastShot!.grade).toBe('early');
    expect(shootAt(newWorld(), apex + 0.25).lastShot!.grade).toBe('late');
  });

  it('Tir encore enfoncé à l’atterrissage : le tir part tout seul, très en retard', () => {
    const world = newWorld();
    world.step(WORLD_DT, { ...IDLE, jump: true });
    run(world, 2, IDLE);
    const shot = world.lastShot!;
    expect(shot.forced).toBe(true);
    expect(shot.grade).toBe('late');
    expect(shot.timingError!).toBeCloseTo(world.player.timeToApex, 1);
    expect(world.shot).toBeNull();
  });

  it('met en scène exactement le résultat tiré, et compte les points marqués', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 20; seed++) {
      const world = shootAt(newWorld(guard, seed), gaugeTime('normal'));
      run(world, 4, IDLE);
      const shot = world.lastShot!;
      expect(shot.zone).toBe('three');
      expect(shot.live).toBe(shot.wanted);
      expect(world.points).toBe(shot.wanted ? 3 : 0);
      outcomes.add(shot.wanted);
    }
    expect([...outcomes].sort()).toEqual([false, true]);
  });

  it('layup en attaquant le cercle : le joueur file vers un point devant le cercle', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const world = new MatchWorld(court, guard, { x: rim.x - 4.5, y: rim.y, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
      run(world, 0.4, RIGHT);
      expect(Math.hypot(world.player.pos.x - rim.x, world.player.pos.y - rim.y)).toBeLessThan(3);
      world.step(WORLD_DT, { ...RIGHT, jump: true });
      expect(world.shot?.kind).toBe('layup');
      while (world.shot && world.shot.airTime + WORLD_DT < gaugeTime('normal')) world.step(WORLD_DT, RIGHT);
      world.step(WORLD_DT, { ...RIGHT, release: true });
      const shot = world.lastShot!;
      expect(shot.kind).toBe('layup');
      expect(shot.zone).toBe('rim');
      expect(shot.start.x).toBeLessThan(rim.x);
      run(world, 3, IDLE);
      expect(shot.live).toBe(shot.wanted);
      expect(world.points).toBe(shot.wanted ? 2 : 0);
      // Retombé devant le cercle, côté terrain.
      expect(world.player.pos.x).toBeLessThan(rim.x);
      expect(world.player.pos.x).toBeGreaterThan(rim.x - 1.6);
    }
  });

  it('près du cercle à l’arrêt : petit tir en suspension, zone « près du cercle »', () => {
    const world = new MatchWorld(court, guard, { x: rim.x - 2, y: rim.y, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(2));
    shootAt(world, gaugeTime('normal'));
    expect(world.lastShot!.kind).toBe('jump');
    expect(world.lastShot!.zone).toBe('rim');
  });

  it('sans ballon, Tir reste un simple saut', () => {
    const world = newWorld();
    world.holder = null;
    world.ball = { pos: { x: START.x + 5, y: START.y, z: BALL_RADIUS }, vel: { x: 0, y: 0, z: 0 } };
    world.step(WORLD_DT, { ...IDLE, jump: true });
    expect(world.player.airborne).toBe(true);
    expect(world.shot).toBeNull();
  });

  it('transmet le mode de tir : un lâcher raté coûte moins en Real Player % qu’en Timing', () => {
    const late = gaugeTime('normal') + 0.3;
    const timing = shootAt(newWorld(), late).lastShot!.probability!;
    const real = newWorld();
    real.setShotSettings({ mode: 'realPct', speed: 'normal' });
    expect(shootAt(real, late).lastShot!.probability!).toBeGreaterThan(timing);
  });
});

describe('dunk', () => {
  const rim = court.hoops.right.rim;
  const standing = (p: Player) => dunkScore({ dunker: p, inDunkZone: true, moveSpeed: 0, defender: null });
  /** Le meilleur dunkeur à l'arrêt, et un dunkeur tout juste au-dessus du seuil (rate plus souvent). */
  const byScore = players.filter((p) => standing(p) >= DUNK_TUNING.threshold).sort((a, b) => standing(b) - standing(a));
  const dunker = byScore[0];
  const justAbove = byScore[byScore.length - 1];
  /** Un petit joueur sans détente ni stat de dunk : il ne peut pas dunker. */
  const weak: Player = { ...guard, heightCm: 178, attrs: { ...guard.attrs, standingDunk: 25, drivingDunk: 25, vertical: 30 } };
  const at = (athlete: Player, x: number, seed = 1) =>
    new MatchWorld(court, athlete, { x, y: rim.y, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  /** Joue jusqu'à l'atterrissage du dunk ; renvoie la durée d'accroche (s) et la marge de la main au sommet (m). */
  const playDunk = (world: MatchWorld) => {
    let hang = 0;
    let margin = -Infinity;
    for (let t = 0; t < 3 && world.shot; t += WORLD_DT) {
      const before = world.player.pos.z;
      world.step(WORLD_DT, { ...IDLE, release: true });
      margin = Math.max(margin, world.player.pos.z + reach(world.player.athlete) - RIM_HEIGHT);
      if (world.player.airborne && world.player.pos.z === before && world.shot?.dunk?.slammed) hang += WORLD_DT;
    }
    return { hang, margin };
  };

  it('à l’arrêt dans la raquette : dunk sur un simple appui, résultat tiré tout de suite', () => {
    expect(dunker).toBeDefined();
    const world = at(dunker, rim.x - 0.9);
    world.step(WORLD_DT, { ...IDLE, jump: true });
    expect(world.shot?.kind).toBe('dunk');
    expect(world.shot?.zone).toBe('rim');
    expect(typeof world.shot?.dunk?.made).toBe('boolean');
    // Relâcher Tir ne lâche rien : le ballon reste en main jusqu'au smash.
    world.step(WORLD_DT, { ...IDLE, release: true });
    expect(world.shot?.kind).toBe('dunk');
    expect(world.holder).toBe(0);
  });

  it('smashe au sommet, la main au-dessus du cercle, et met en scène le résultat tiré', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 200 && outcomes.size < 2; seed++) {
      const world = at(justAbove, rim.x - 0.9, seed);
      world.step(WORLD_DT, { ...IDLE, jump: true });
      const { hang, margin } = playDunk(world);
      expect(margin).toBeGreaterThanOrEqual(SHOT_FLOW.dunkClearance - 0.02);
      const shot = world.lastShot!;
      expect(shot.kind).toBe('dunk');
      // Accroché ~0,3 s au cercle après un dunk réussi, pas après un raté.
      if (shot.wanted) expect(hang).toBeCloseTo(SHOT_FLOW.dunkHang, 1);
      else expect(hang).toBeLessThanOrEqual(WORLD_DT); // le sommet lui-même peut durer un pas
      run(world, 3, IDLE);
      expect(shot.live).toBe(shot.wanted);
      expect(world.points).toBe(shot.wanted ? 2 : 0);
      outcomes.add(shot.wanted);
    }
    expect([...outcomes].sort()).toEqual([false, true]);
  });

  it('passe avant le layup : en attaquant le cercle dans la raquette, un bon dunkeur dunke', () => {
    const world = at(dunker, rim.x - 4.5);
    while (world.player.pos.x < rim.x - 1.2) world.step(WORLD_DT, RIGHT);
    world.step(WORLD_DT, { ...RIGHT, jump: true });
    expect(world.shot?.kind).toBe('dunk');
    playDunk(world);
    // Il finit devant le cercle, jamais sous la planche.
    expect(world.player.pos.x).toBeLessThan(rim.x);
  });

  it('sous le seuil : layup en attaquant le cercle, tir en suspension à l’arrêt', () => {
    const running = at(weak, rim.x - 4.5);
    while (running.player.pos.x < rim.x - 1.2) running.step(WORLD_DT, RIGHT);
    running.step(WORLD_DT, { ...RIGHT, jump: true });
    expect(running.shot?.kind).toBe('layup');
    const still = at(weak, rim.x - 0.9);
    still.step(WORLD_DT, { ...IDLE, jump: true });
    expect(still.shot?.kind).toBe('jump');
  });

  it('hors de la moitié de la raquette : jamais de dunk', () => {
    const world = at(dunker, rim.x - 4);
    world.step(WORLD_DT, { ...IDLE, jump: true });
    expect(world.shot?.kind).toBe('jump');
  });

  it('retrouve son saut normal après un dunk', () => {
    const world = at(dunker, rim.x - 0.9);
    const gravity = world.player.jumpGravity;
    world.step(WORLD_DT, { ...IDLE, jump: true });
    playDunk(world);
    expect(world.shot).toBeNull();
    expect(world.player.jumpGravity).toBeCloseTo(gravity, 9);
  });
});
