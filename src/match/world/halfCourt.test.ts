import { describe, expect, it } from 'vitest';
import { createNewGame, gaugeTime, type Player } from '../../engine';
import { Rng } from '../../engine/rng';
import { canDunk, DUNK_TUNING, dunkScore } from '../../engine/shot';
import { isThreePoint, makeCourt, RIM_HEIGHT, type Vec3 } from '../physics/court';
import { MatchWorld, WORLD_DT, WORLD_TUNING, type ShotRecord, type WorldInput } from './MatchWorld';
import { HALF_COURT, isCleared, mustClearAfterPickup, startPositions } from './halfCourt';

const players = Object.values(createNewGame('bos', 31).players);
const byOverall = [...players].sort((a, b) => b.overall - a.overall);
const shooter = byOverall[0];
const defender = byOverall[1];
const court = makeCourt('pro');
const hoop = court.hoops.right;
const rim = hoop.rim;
const IDLE: WorldInput = { x: 0, y: 0, jump: false };

function oneOnOne(seed = 1, a: Player = shooter, b: Player = defender): MatchWorld {
  const world = new MatchWorld(court, a, { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  world.startOneOnOne(b);
  return world;
}

function place(world: MatchWorld, index: number, pos: Partial<Vec3>): void {
  world.players[index].pos = { ...world.players[index].pos, ...pos };
  world.players[index].vel = { x: 0, y: 0, z: 0 };
}

/** Saute avec Tir et relâche au sommet ; renvoie le tir enregistré. */
function shootAtApex(world: MatchWorld): ShotRecord {
  world.step(WORLD_DT, [{ ...IDLE, jump: true }]);
  while (world.shot && world.shot.airTime + WORLD_DT < gaugeTime('normal') - 1e-9) world.step(WORLD_DT, [IDLE]);
  world.step(WORLD_DT, [{ ...IDLE, release: true }]);
  return world.lastShot!;
}

/** Ballon qui tombe dans le cercle, attribué à un tir du joueur `shooterIndex`. */
function dropInRim(world: MatchWorld, shooterIndex: number, cleared: boolean, three = false): void {
  world.holder = null;
  world.ball = { pos: { x: rim.x, y: rim.y, z: RIM_HEIGHT + 0.4 }, vel: { x: 0, y: 0, z: -2 } };
  world.lastShot = {
    demo: false,
    shooter: shooterIndex,
    kind: 'jump',
    zone: three ? 'three' : 'mid',
    start: { ...world.ball.pos },
    distance: 5,
    three,
    hoop: 'right',
    contest: null,
    cleared,
    wanted: true,
    probability: 0.5,
    grade: 'green',
    timingError: 0,
    forced: false,
    scored: false,
    invalid: false,
    live: null,
    block: null,
    foul: null,
    goaltend: false,
  };
  world.rules!.lastTeam = shooterIndex;
}

describe('1 contre 1 : départ', () => {
  it('place l’attaquant derrière l’arc et le défenseur entre lui et le cercle', () => {
    const { attackers: [attacker], defenders: [d] } = startPositions(court, hoop, 1);
    expect(isThreePoint(court, hoop, attacker.x, attacker.y)).toBe(true);
    expect(Math.abs(d.x - rim.x)).toBeLessThan(Math.abs(attacker.x - rim.x));
    const world = oneOnOne();
    expect(world.players).toHaveLength(2);
    expect(world.holder).toBe(0);
    expect(world.points).toEqual([0, 0]);
    expect(world.rules!.mustClear).toEqual([false, false]);
    expect(world.hoopFor(3).side).toBe('right');
  });
});

describe('contestation', () => {
  // Tireur moyen à mi-distance : sa proba ne touche pas le plafond de la zone.
  const average = [...players].sort((x, y) => x.attrs.midRange - y.attrs.midRange)[Math.floor(players.length / 2)];
  const probabilityWith = (defenderPos: Partial<Vec3> | null) => {
    const world = oneOnOne(4, average, defender);
    place(world, 0, { x: rim.x - 5, y: rim.y });
    if (defenderPos) place(world, 1, defenderPos);
    else place(world, 1, { x: 2, y: 1 });
    return shootAtApex(world);
  };

  it('un défenseur collé et en face baisse la proba ; de côté, un peu moins', () => {
    const open = probabilityWith(null);
    const front = probabilityWith({ x: rim.x - 4.3, y: rim.y });
    const side = probabilityWith({ x: rim.x - 5, y: rim.y + 0.75 });
    expect(open.contest!.distance).toBeGreaterThan(10);
    expect(front.contest!.facing).toBeCloseTo(1, 5);
    expect(side.contest!.facing).toBeLessThan(0.2);
    expect(front.probability!).toBeLessThan(side.probability!);
    expect(side.probability!).toBeLessThan(open.probability!);
  });

  it('un défenseur collé peut empêcher un dunk : layup ou tir à la place', () => {
    const able = players
      .filter((p) => dunkScore({ dunker: p, inDunkZone: true, moveSpeed: 0, defender: null }) >= DUNK_TUNING.threshold)
      .sort((a, b) => dunkScore({ dunker: a, inDunkZone: true, moveSpeed: 0, defender: null }) - dunkScore({ dunker: b, inDunkZone: true, moveSpeed: 0, defender: null }))[0];
    const wall = [...players].sort((a, b) => b.heightCm + b.attrs.block - (a.heightCm + a.attrs.block))[0];
    const spot = { x: rim.x - 1, y: rim.y };
    const open = oneOnOne(2, able, wall);
    place(open, 0, spot);
    place(open, 1, { x: 2, y: 1 });
    expect(canDunk(open.dunkContext(0))).toBe(true);
    const guarded = oneOnOne(2, able, wall);
    place(guarded, 0, spot);
    place(guarded, 1, { x: rim.x - 0.4, y: rim.y });
    expect(canDunk(guarded.dunkContext(0))).toBe(false);
    guarded.step(WORLD_DT, [{ ...IDLE, jump: true }]);
    expect(guarded.shot?.kind).not.toBe('dunk');
  });
});

describe('possession et ressortie', () => {
  it('rebond défensif : il faut ressortir ; rebond offensif : non', () => {
    expect(mustClearAfterPickup(1, 0, false)).toBe(true);
    expect(mustClearAfterPickup(0, 0, false)).toBe(false);
    expect(mustClearAfterPickup(0, 0, true)).toBe(true);

    const world = oneOnOne();
    world.holder = null;
    world.rules!.lastTeam = 0;
    place(world, 1, { x: rim.x - 3, y: rim.y + 3 });
    world.ball = { pos: { ...world.players[1].pos, z: 0.5 }, vel: { x: 0, y: 0, z: 0 } };
    world.step(WORLD_DT, [IDLE, IDLE]);
    expect(world.holder).toBe(1);
    expect(world.rules!.mustClear[1]).toBe(true);

    const own = oneOnOne();
    own.holder = null;
    own.rules!.lastTeam = 0;
    place(own, 0, { x: rim.x - 3, y: rim.y - 3 });
    own.ball = { pos: { ...own.players[0].pos, z: 0.5 }, vel: { x: 0, y: 0, z: 0 } };
    own.step(WORLD_DT, [IDLE, IDLE]);
    expect(own.holder).toBe(0);
    expect(own.rules!.mustClear[0]).toBe(false);
  });

  it('ressortir derrière l’arc lève l’obligation', () => {
    const world = oneOnOne();
    world.holder = 1;
    world.rules!.mustClear[1] = true;
    place(world, 1, { x: rim.x - 4, y: rim.y });
    world.step(WORLD_DT, [IDLE, IDLE]);
    expect(world.rules!.mustClear[1]).toBe(true);
    place(world, 1, { x: rim.x - 8, y: rim.y });
    expect(isCleared(court, hoop, world.players[1].pos)).toBe(true);
    world.step(WORLD_DT, [IDLE, IDLE]);
    expect(world.rules!.mustClear[1]).toBe(false);
  });

  it('un panier valable compte ; sans ressortie, il ne compte pas et le ballon passe à l’autre', () => {
    const valid = oneOnOne();
    dropInRim(valid, 0, true, true);
    for (let t = 0; t < 1 && !valid.lastShot!.scored; t += WORLD_DT) valid.step(WORLD_DT, [IDLE, IDLE]);
    expect(valid.points).toEqual([3, 0]);

    const invalid = oneOnOne();
    dropInRim(invalid, 0, false);
    for (let t = 0; t < 1 && !invalid.lastShot!.scored; t += WORLD_DT) invalid.step(WORLD_DT, [IDLE, IDLE]);
    expect(invalid.lastShot!.invalid).toBe(true);
    expect(invalid.points).toEqual([0, 0]);
    expect(invalid.holder).toBe(1);
    expect(invalid.rules!.mustClear[1]).toBe(true);
  });

  it('après un panier, celui qui ramasse doit ressortir', () => {
    const world = oneOnOne();
    place(world, 1, { x: rim.x - 0.5, y: rim.y });
    dropInRim(world, 0, true);
    for (let t = 0; t < 3 && world.holder === null; t += WORLD_DT) world.step(WORLD_DT, [IDLE, IDLE]);
    expect(world.holder).toBe(1);
    expect(world.rules!.mustClear[1]).toBe(true);
  });
});

describe('fin de partie', () => {
  it('premier à 11 : vainqueur, pause sans mouvement, puis 0-0 et ballon au joueur', () => {
    const world = oneOnOne();
    world.points = [10, 4];
    dropInRim(world, 0, true);
    for (let t = 0; t < 1 && world.rules!.winner === null; t += WORLD_DT) world.step(WORLD_DT, [IDLE, IDLE]);
    expect(world.points[0]).toBe(12);
    expect(world.rules!.winner).toBe(0);
    const frozen = { ...world.players[0].pos };
    for (let t = 0; t < HALF_COURT.endPause - 0.2; t += WORLD_DT) world.step(WORLD_DT, [{ x: 1, y: 0, jump: false }, IDLE]);
    expect(world.players[0].pos.x).toBeCloseTo(frozen.x, 9);
    for (let t = 0; t < 0.5; t += WORLD_DT) world.step(WORLD_DT, [IDLE, IDLE]);
    expect(world.rules!.winner).toBeNull();
    expect(world.points).toEqual([0, 0]);
    expect(world.holder).toBe(0);
  });
});

describe('corps', () => {
  it('deux joueurs ne se chevauchent jamais, même en se rentrant dedans', () => {
    const world = oneOnOne();
    place(world, 0, { x: 15, y: 7 });
    place(world, 1, { x: 19, y: 7 });
    let closest = Infinity;
    for (let t = 0; t < 2; t += WORLD_DT) {
      world.step(WORLD_DT, [{ x: 1, y: 0, jump: false }, { x: -1, y: 0, jump: false }]);
      const a = world.players[0].pos;
      const b = world.players[1].pos;
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
    }
    expect(closest).toBeGreaterThanOrEqual(2 * WORLD_TUNING.bodyRadius - 1e-9);
  });
});
