import { describe, expect, it } from 'vitest';
import { createNewGame, type Player } from '../../engine';
import { Rng } from '../../engine/rng';
import { makeCourt, type Vec3 } from '../physics/court';
import { HALF_COURT, startPositions } from './halfCourt';
import { MatchWorld, WORLD_DT, type WorldInput } from './MatchWorld';
import { leadPoint, PASS_FLOW, passSpeed, passTarget, passVelocity } from './passing';

const players = Object.values(createNewGame('bos', 31).players);
const byOverall = [...players].sort((a, b) => b.overall - a.overall);
const court = makeCourt('pro');
const hoop = court.hoops.right;
const rim = hoop.rim;
const IDLE: WorldInput = { x: 0, y: 0, jump: false };
const idle = (n: number) => Array.from({ length: n }, () => IDLE);

function threeOnThree(seed = 1, home: Player[] = byOverall.slice(0, 3), away: Player[] = byOverall.slice(3, 6)): MatchWorld {
  const world = new MatchWorld(court, home[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  world.startTeams(home, away);
  return world;
}

function place(world: MatchWorld, index: number, pos: Partial<Vec3>): void {
  world.players[index].pos = { ...world.players[index].pos, ...pos };
  world.players[index].vel = { x: 0, y: 0, z: 0 };
}

/** Le joueur `index` reçoit `input`, les autres ne font rien. */
function stepWith(world: MatchWorld, index: number, input: WorldInput): void {
  const inputs = idle(world.players.length);
  inputs[index] = input;
  world.step(WORLD_DT, inputs);
}

function run(world: MatchWorld, seconds: number, until?: () => boolean): void {
  for (let t = 0; t < seconds; t += WORLD_DT) {
    if (until?.()) return;
    world.step(WORLD_DT, idle(world.players.length));
  }
}

describe('choix du receveur', () => {
  const mates = [
    { index: 1, pos: { x: 5, y: 0 } },
    { index: 2, pos: { x: 0, y: 5 } },
    { index: 3, pos: { x: 4, y: 3 } },
  ];

  it('vise le coéquipier dans la direction tenue', () => {
    expect(passTarget({ x: 0, y: 0 }, { x: 1, y: 0 }, mates)).toBe(1);
    expect(passTarget({ x: 0, y: 0 }, { x: 0, y: 1 }, mates)).toBe(2);
    expect(passTarget({ x: 0, y: 0 }, { x: 1, y: 0.7 }, mates)).toBe(3);
  });

  it('à angle voisin, le plus proche ; sans personne dans le cône, le plus aligné', () => {
    const close = [
      { index: 1, pos: { x: 10, y: 0.5 } },
      { index: 2, pos: { x: 3, y: 0.4 } },
    ];
    expect(passTarget({ x: 0, y: 0 }, { x: 1, y: 0 }, close)).toBe(2);
    expect(passTarget({ x: 0, y: 0 }, { x: -1, y: 0 }, mates)).toBe(2);
    expect(passTarget({ x: 0, y: 0 }, { x: 0, y: 0 }, mates)).toBeNull();
  });

  it('une meilleure stat de passe va plus vite', () => {
    expect(passSpeed(99)).toBeGreaterThan(passSpeed(40));
    expect(passSpeed(25)).toBeCloseTo(PASS_FLOW.speed[0], 9);
  });

  it('la trajectoire arrive au point visé, en avance sur un receveur en course', () => {
    const from = { x: 0, y: 0, z: 1.2 };
    const lead = leadPoint(from, { pos: { x: 6, y: 0, z: 0 }, vel: { x: 0, y: 4, z: 0 } }, 1.2, 12);
    expect(lead.y).toBeGreaterThan(1);
    expect(lead.y).toBeLessThanOrEqual(PASS_FLOW.maxLead + 1e-9);
    const { vel, time } = passVelocity(from, lead, 12);
    expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(12, 6);
    expect(time).toBeGreaterThan(0.4);
  });
});

describe('passe dans le monde', () => {
  it('le receveur arrêté l’attrape ; le contrôle passe sur lui dès le lâcher', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const world = threeOnThree(seed);
      expect(world.holder).toBe(0);
      expect(world.controlled).toBe(0);
      const to = world.players[1].pos;
      const from = world.players[0].pos;
      stepWith(world, 0, { ...IDLE, pass: true, x: Math.sign(to.x - from.x) * 0.2, y: Math.sign(to.y - from.y) });
      expect(world.pass?.receiver).toBe(1);
      expect(world.controlled).toBe(1);
      run(world, 1.5, () => world.holder !== null);
      expect(world.holder).toBe(1);
      expect(world.lastPass?.passer).toBe(0);
    }
  });

  it('un receveur en course l’attrape en avance', () => {
    let caught = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const world = threeOnThree(seed);
      const run1: WorldInput = { x: 0, y: 1, jump: false };
      // Le receveur court vers le spectateur pendant 0,4 s avant la passe, puis continue.
      for (let t = 0; t < 0.4; t += WORLD_DT) stepWith(world, 1, run1);
      const to = world.players[1].pos;
      const from = world.players[0].pos;
      const inputs = idle(6);
      inputs[0] = { ...IDLE, pass: true, x: Math.sign(to.x - from.x) * 0.2, y: Math.sign(to.y - from.y) };
      inputs[1] = run1;
      world.step(WORLD_DT, inputs);
      for (let t = 0; t < 1.5 && world.holder === null; t += WORLD_DT) stepWith(world, 1, run1);
      if (world.holder === 1) caught++;
    }
    expect(caught).toBeGreaterThanOrEqual(28);
  });

  it('un adversaire sur la trajectoire ne l’attrape pas (interception au 9) ; ratée, elle devient libre', () => {
    const world = threeOnThree(2);
    const a = world.players[0].pos;
    const b = world.players[1].pos;
    // Un défenseur au milieu de la ligne de passe.
    place(world, 3, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    stepWith(world, 0, { ...IDLE, pass: true, x: Math.sign(b.x - a.x) * 0.2, y: Math.sign(b.y - a.y) });
    run(world, 1.5, () => world.holder !== null);
    expect(world.holder).toBe(1);

    const loose = threeOnThree(3);
    const to = loose.players[1].pos;
    const from = loose.players[0].pos;
    stepWith(loose, 0, { ...IDLE, pass: true, x: Math.sign(to.x - from.x) * 0.2, y: Math.sign(to.y - from.y) });
    // Le receveur s'en va : personne ne l'attrape, puis n'importe qui peut le ramasser.
    place(loose, 1, { x: 2, y: 1 });
    run(loose, PASS_FLOW.maxFlight + 0.2, () => loose.pass === null);
    expect(loose.pass).toBeNull();
  });

  it('pas de passe en l’air ni pendant un tir', () => {
    const world = threeOnThree(4);
    stepWith(world, 0, { ...IDLE, jump: true });
    stepWith(world, 0, { ...IDLE, pass: true, x: 0, y: 1 });
    expect(world.pass).toBeNull();
    expect(world.shot?.shooter).toBe(0);
  });
});

describe('équipes au demi-terrain', () => {
  it('départ : 3 attaquants derrière l’arc, chacun avec un défenseur devant lui', () => {
    const world = threeOnThree();
    const { attackers, defenders } = startPositions(court, hoop, 3);
    expect(world.team).toEqual([0, 0, 0, 1, 1, 1]);
    expect(world.points).toEqual([0, 0]);
    expect(world.rules!.target).toBe(HALF_COURT.target[3]);
    for (let i = 0; i < 3; i++) {
      expect(world.players[i].pos).toEqual(attackers[i]);
      expect(world.players[3 + i].pos).toEqual(defenders[i]);
    }
  });

  it('ressortie par équipe : une passe reçue derrière l’arc la lève', () => {
    const world = threeOnThree(5);
    world.rules!.mustClear[0] = true;
    // Le porteur dans la raquette, un coéquipier derrière l'arc.
    place(world, 0, { x: rim.x - 3, y: rim.y });
    world.step(WORLD_DT, idle(6));
    expect(world.rules!.mustClear[0]).toBe(true);
    const to = world.players[1].pos;
    const from = world.players[0].pos;
    stepWith(world, 0, { ...IDLE, pass: true, x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) });
    run(world, 1.5, () => world.holder === 1);
    world.step(WORLD_DT, idle(6));
    expect(world.rules!.mustClear[0]).toBe(false);
  });

  it('une obligation due le reste sur un rebond de son équipe', () => {
    const world = threeOnThree(6);
    world.rules!.mustClear[0] = true;
    world.holder = null;
    world.rules!.lastTeam = 0;
    place(world, 2, { x: rim.x - 3, y: rim.y + 2 });
    world.ball = { pos: { ...world.players[2].pos, z: 0.5 }, vel: { x: 0, y: 0, z: 0 } };
    world.step(WORLD_DT, idle(6));
    expect(world.holder).toBe(2);
    expect(world.rules!.mustClear[0]).toBe(true);
  });

  it('ballon pris par l’adversaire : son équipe ressort, tu prends ton défenseur le plus proche du ballon', () => {
    const world = threeOnThree(7);
    world.holder = null;
    world.rules!.lastTeam = 0;
    place(world, 4, { x: rim.x - 3, y: rim.y + 3 });
    place(world, 2, { x: rim.x - 4, y: rim.y + 3.5 });
    world.ball = { pos: { ...world.players[4].pos, z: 0.5 }, vel: { x: 0, y: 0, z: 0 } };
    world.step(WORLD_DT, idle(6));
    expect(world.holder).toBe(4);
    expect(world.rules!.mustClear[1]).toBe(true);
    expect(world.controlled).toBe(2);
  });

  it('en défense, Passe te fait changer pour le défenseur le plus proche du ballon (le suivant si c’est déjà toi)', () => {
    const world = threeOnThree(8);
    world.holder = 3;
    world.controlled = 0;
    place(world, 3, { x: rim.x - 6, y: rim.y });
    place(world, 1, { x: rim.x - 5, y: rim.y });
    place(world, 2, { x: rim.x - 2, y: rim.y + 4 });
    place(world, 0, { x: rim.x - 9, y: rim.y - 5 });
    stepWith(world, 0, { ...IDLE, pass: true });
    expect(world.controlled).toBe(1);
    stepWith(world, 1, { ...IDLE, pass: true });
    expect(world.controlled).toBe(2);
  });

  it('panier non valable : ballon à l’adversaire le plus proche, qui doit ressortir', () => {
    const world = threeOnThree(9);
    world.rules!.mustClear[0] = true;
    place(world, 5, { x: rim.x - 0.8, y: rim.y });
    world.holder = null;
    world.ball = { pos: { x: rim.x, y: rim.y, z: 3.45 }, vel: { x: 0, y: 0, z: -2 } };
    world.lastShot = {
      demo: false,
      shooter: 1,
      kind: 'jump',
      zone: 'mid',
      start: { ...world.ball.pos },
      distance: 5,
      three: false,
      hoop: 'right',
      contest: null,
      cleared: false,
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
    run(world, 1, () => world.lastShot!.scored);
    expect(world.lastShot!.invalid).toBe(true);
    expect(world.holder).toBe(5);
    expect(world.points).toEqual([0, 0]);
    expect(world.rules!.mustClear[1]).toBe(true);
  });
});
