import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../engine';
import { Rng } from '../../engine/rng';
import { makeCourt, type Vec3 } from '../physics/court';
import { MatchWorld, WORLD_DT, type ShotRecord, type WorldInput } from '../world/MatchWorld';
import { AI_TUNING, choosePlan, delayedPosition, guardSpot, OpponentAi, reactionTime, timingSd } from './opponent';

const players = Object.values(createNewGame('bos', 31).players);
const byOverall = [...players].sort((a, b) => b.overall - a.overall);
const court = makeCourt('pro');
const hoop = court.hoops.right;
const rim = hoop.rim;
const IDLE: WorldInput = { x: 0, y: 0, jump: false };

function oneOnOne(seed = 1): MatchWorld {
  const world = new MatchWorld(court, byOverall[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  world.startOneOnOne(byOverall[1]);
  return world;
}

function place(world: MatchWorld, index: number, pos: Partial<Vec3>): void {
  world.players[index].pos = { ...world.players[index].pos, ...pos };
  world.players[index].vel = { x: 0, y: 0, z: 0 };
}

/** Joue `seconds` : le joueur 0 suit `user` (ou une IA), le joueur 1 est l'IA. */
function play(world: MatchWorld, ai: OpponentAi, seconds: number, user: WorldInput | OpponentAi = IDLE, until?: () => boolean): number {
  let t = 0;
  for (; t < seconds; t += WORLD_DT) {
    if (until?.()) break;
    const first = user instanceof OpponentAi ? user.think(world, WORLD_DT) : user;
    world.step(WORLD_DT, [first, ai.think(world, WORLD_DT)]);
  }
  return t;
}

const angleBetween = (ax: number, ay: number, bx: number, by: number) =>
  (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))))) * 180) / Math.PI;

describe('IA : réglages', () => {
  it('réagit plus vite et lâche plus juste avec de meilleures notes', () => {
    expect(reactionTime(90)).toBeLessThan(reactionTime(40));
    expect(reactionTime(25)).toBeCloseTo(AI_TUNING.reaction.slow, 9);
    expect(timingSd(90)).toBeLessThan(timingSd(40));
  });

  it('voit l’attaquant avec du retard', () => {
    const history = [
      { t: 0, p: { x: 0, y: 0 } },
      { t: 0.1, p: { x: 1, y: 0 } },
      { t: 0.2, p: { x: 2, y: 0 } },
    ];
    expect(delayedPosition(history, 0.2, 0.1)).toEqual({ x: 1, y: 0 });
    expect(delayedPosition(history, 0.2, 0.5)).toEqual({ x: 0, y: 0 });
  });

  it('choisit ses plans selon ses tendances', () => {
    const p = byOverall[3];
    const counts = { rim: 0, mid: 0, three: 0 };
    const rng = new Rng(7);
    for (let i = 0; i < 2000; i++) counts[choosePlan(p.tendencies, rng)]++;
    const total = p.tendencies.rim + p.tendencies.mid + p.tendencies.three;
    for (const k of ['rim', 'mid', 'three'] as const) expect(counts[k] / 2000).toBeCloseTo(p.tendencies[k] / total, 1);
  });

  it('se place sur la ligne attaquant → cercle', () => {
    const spot = guardSpot({ x: rim.x - 6, y: rim.y }, hoop);
    expect(spot.x).toBeCloseTo(rim.x - 6 + AI_TUNING.guardGap, 9);
    expect(spot.y).toBeCloseTo(rim.y, 9);
  });
});

describe('IA en défense', () => {
  it('se place entre l’attaquant et le cercle', () => {
    const world = oneOnOne();
    const ai = new OpponentAi(1, new Rng(1));
    place(world, 0, { x: rim.x - 7, y: rim.y + 2 });
    place(world, 1, { x: rim.x - 3, y: rim.y - 4 });
    play(world, ai, 2);
    const user = world.players[0].pos;
    const me = world.players[1].pos;
    expect(ai.mode).toBe('défense');
    expect(Math.hypot(me.x - user.x, me.y - user.y)).toBeCloseTo(AI_TUNING.guardGap, 0);
    expect(Math.hypot(me.x - rim.x, me.y - rim.y)).toBeLessThan(Math.hypot(user.x - rim.x, user.y - rim.y));
    expect(angleBetween(me.x - user.x, me.y - user.y, rim.x - user.x, rim.y - user.y)).toBeLessThan(15);
  });

  it('saute pour contester un tireur proche, pas un tireur loin', () => {
    const near = oneOnOne();
    const ai = new OpponentAi(1, new Rng(1));
    place(near, 0, { x: rim.x - 6, y: rim.y });
    place(near, 1, { x: rim.x - 6 + AI_TUNING.guardGap, y: rim.y });
    play(near, ai, 0.3);
    let jumped = false;
    near.step(WORLD_DT, [{ ...IDLE, jump: true }, ai.think(near, WORLD_DT)]);
    play(near, ai, 0.6, IDLE, () => (jumped ||= near.players[1].airborne, false));
    expect(jumped).toBe(true);

    const far = oneOnOne();
    const ai2 = new OpponentAi(1, new Rng(1));
    place(far, 0, { x: rim.x - 8, y: rim.y });
    place(far, 1, { x: rim.x - 1, y: rim.y + 5 });
    let farJump = false;
    far.step(WORLD_DT, [{ ...IDLE, jump: true }, ai2.think(far, WORLD_DT)]);
    play(far, ai2, 0.6, IDLE, () => (farJump ||= far.players[1].airborne, false));
    expect(farJump).toBe(false);
  });
});

describe('IA en attaque', () => {
  it('ressort d’abord le ballon quand elle le doit', () => {
    const world = oneOnOne();
    const ai = new OpponentAi(1, new Rng(2));
    world.holder = 1;
    world.rules!.mustClear[1] = true;
    place(world, 1, { x: rim.x - 2, y: rim.y + 1 });
    place(world, 0, { x: 2, y: 1 });
    const t = play(world, ai, 4, IDLE, () => !world.rules!.mustClear[1]);
    expect(world.rules!.mustClear[1]).toBe(false);
    expect(t).toBeLessThan(3);
  });

  it('finit par tirer, en moins de ~4,5 s', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const world = oneOnOne(seed);
      const ai = new OpponentAi(1, new Rng(seed));
      world.holder = 1;
      place(world, 1, { x: rim.x - 8, y: rim.y });
      place(world, 0, { x: 2, y: 1 });
      play(world, ai, 4.5, IDLE, () => world.shot?.shooter === 1 || world.lastShot?.shooter === 1);
      expect(world.shot?.shooter === 1 || world.lastShot?.shooter === 1).toBe(true);
    }
  });

  it('va chercher un ballon libre', () => {
    const world = oneOnOne();
    const ai = new OpponentAi(1, new Rng(3));
    world.holder = null;
    world.ball = { pos: { x: rim.x - 4, y: rim.y + 3, z: 0.12 }, vel: { x: 0, y: 0, z: 0 } };
    place(world, 1, { x: rim.x - 8, y: rim.y - 3 });
    place(world, 0, { x: 2, y: 1 });
    play(world, ai, 3, IDLE, () => world.holder === 1);
    expect(world.holder).toBe(1);
  });
});

describe('déterminisme', () => {
  it('un 1 contre 1 où tes entrées sont scriptées et l’IA joue se rejoue à l’identique', () => {
    const run = () => {
      const world = oneOnOne(9);
      const ai = new OpponentAi(1, new Rng(21));
      let step = 0;
      // Toi : tu fonces vers le cercle, tu tires toutes les ~2 s en relâchant au bout de 0,4 s.
      for (let t = 0; t < 20; t += WORLD_DT, step++) {
        const phase = step % 240;
        const mine: WorldInput = { x: phase < 120 ? 1 : -0.5, y: phase < 60 ? 0.4 : -0.3, jump: phase === 150, release: phase === 198 };
        world.step(WORLD_DT, [mine, ai.think(world, WORLD_DT)]);
      }
      return JSON.stringify({ players: world.players.map((p) => p.pos), ball: world.ball, points: world.points, holder: world.holder, mode: ai.mode });
    };
    expect(run()).toBe(run());
  });
});

describe('partie de contrôle : IA contre IA', () => {
  it('3 minutes : les deux marquent, la possession change, réussite plausible', () => {
    const world = oneOnOne(5);
    const a = new OpponentAi(0, new Rng(11));
    const b = new OpponentAi(1, new Rng(12));
    const shots = new Set<ShotRecord>();
    let changes = 0;
    let lastHolder: number | null = world.holder;
    for (let t = 0; t < 180; t += WORLD_DT) {
      world.step(WORLD_DT, [a.think(world, WORLD_DT), b.think(world, WORLD_DT)]);
      if (world.lastShot && !world.lastShot.demo) shots.add(world.lastShot);
      if (world.holder !== null && lastHolder !== null && world.holder !== lastHolder) changes++;
      if (world.holder !== null) lastHolder = world.holder;
    }
    const all = [...shots];
    const made = all.filter((s) => s.scored && !s.invalid);
    const byShooter = [0, 1].map((i) => made.filter((s) => s.shooter === i).length);
    expect(all.length).toBeGreaterThan(20);
    expect(byShooter[0]).toBeGreaterThan(0);
    expect(byShooter[1]).toBeGreaterThan(0);
    expect(changes).toBeGreaterThanOrEqual(4);
    const pct = made.length / all.length;
    expect(pct).toBeGreaterThan(0.2);
    expect(pct).toBeLessThan(0.75);
  });
});
