import { describe, expect, it } from 'vitest';
import { createNewGame, gaugeTime, type Player } from '../../engine';
import { reach } from '../../engine/athletics';
import { Rng } from '../../engine/rng';
import { makeCourt, RIM_HEIGHT, type Vec3 } from '../physics/court';
import { armContact, bodyContact, DEFENSE_FLOW, inGoaltendZone, swatVelocity } from './defense';
import { MatchWorld, WORLD_DT, type ShotRecord, type WorldInput } from './MatchWorld';
import { startPositions } from './oneOnOne';

const players = Object.values(createNewGame('bos', 31).players);
const byOverall = [...players].sort((a, b) => b.overall - a.overall);
const tallest = [...players].sort((a, b) => b.heightCm - a.heightCm)[0];
const court = makeCourt('pro');
const hoop = court.hoops.right;
const rim = hoop.rim;
const IDLE: WorldInput = { x: 0, y: 0, jump: false };

function oneOnOne(seed: number, a: Player = byOverall[0], b: Player = tallest): MatchWorld {
  const world = new MatchWorld(court, a, { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  world.startOneOnOne(b);
  return world;
}

function place(world: MatchWorld, index: number, pos: Partial<Vec3>, airborne = false): void {
  const body = world.players[index];
  body.pos = { ...body.pos, ...pos };
  body.vel = { x: 0, y: 0, z: 0 };
  body.airborne = airborne;
}

/** Le joueur 0 tire depuis `spot` et relâche au sommet ; renvoie le tir enregistré. */
function shootFrom(world: MatchWorld, spot: { x: number; y: number }, inputs: (t: number) => WorldInput = () => IDLE): ShotRecord {
  place(world, 0, spot);
  world.step(WORLD_DT, [{ ...IDLE, jump: true }, inputs(0)]);
  let t = WORLD_DT;
  while (world.shot && world.shot.airTime + WORLD_DT < gaugeTime('normal') - 1e-9) {
    world.step(WORLD_DT, [IDLE, inputs(t)]);
    t += WORLD_DT;
  }
  world.step(WORLD_DT, [{ ...IDLE, release: true }, inputs(t)]);
  return world.lastShot!;
}

function run(world: MatchWorld, seconds: number, until?: () => boolean): void {
  for (let t = 0; t < seconds; t += WORLD_DT) {
    if (until?.()) return;
    world.step(WORLD_DT, [IDLE, IDLE]);
  }
}

/**
 * Tir à mi-distance du joueur 0, défenseur loin ; dès que le ballon est à ~1,3 m du tireur en
 * montée, le défenseur (en l'air) est placé sous lui, bras levé dans la trajectoire.
 */
function blockScenario(seed: number): { world: MatchWorld; shot: ShotRecord; before: Vec3 } {
  const world = oneOnOne(seed);
  place(world, 1, { x: 2, y: 1 });
  const shot = shootFrom(world, { x: rim.x - 6, y: rim.y });
  const from = world.players[0].pos;
  run(world, 1, () => Math.hypot(world.ball.pos.x - from.x, world.ball.pos.y - from.y) > 1.3);
  const ball = world.ball.pos;
  const shoulder = (tallest.heightCm / 100) * DEFENSE_FLOW.shoulderRatio;
  place(world, 1, { x: ball.x + 0.25, y: ball.y, z: Math.max(0.05, ball.z - shoulder - 0.4) }, true);
  const before = { ...world.ball.vel };
  world.step(WORLD_DT, [IDLE, IDLE]);
  return { world, shot, before };
}

describe('mesures de la défense', () => {
  const h = 200;
  const r = 2.66;
  const feet = { x: 0, y: 0, z: 0 };

  it('le bras levé touche le ballon dans sa portée, en plein près de l’épaule, effleuré au bout des doigts', () => {
    const full = armContact(feet, h, r, { x: 0.3, y: 0, z: 2.3 })!;
    const graze = armContact(feet, h, r, { x: 0, y: 0, z: 2.75 })!;
    expect(full.quality).toBe(1);
    expect(graze.quality).toBeGreaterThan(0);
    expect(graze.quality).toBeLessThan(0.3);
    expect(armContact(feet, h, r, { x: 0, y: 0, z: 2.9 })).toBeNull();
    // Bras tendu à l'horizontale : ce n'est pas un contre.
    expect(armContact(feet, h, r, { x: 0.9, y: 0, z: 1.7 })).toBeNull();
  });

  it('plus haut en l’air ou avec de plus grands bras', () => {
    const ball = { x: 0, y: 0, z: 2.95 };
    expect(armContact(feet, h, r, ball)).toBeNull();
    expect(armContact({ x: 0, y: 0, z: 0.6 }, h, r, ball)).not.toBeNull();
    const big = 220;
    expect(armContact(feet, big, (big / 100) * 1.33, ball)).not.toBeNull();
  });

  it('contact des corps : recouvrement et vitesse du défenseur vers le tireur', () => {
    const shooter = { pos: { x: 0, y: 0, z: 0 } };
    const c = bodyContact({ pos: { x: 0.75, y: 0, z: 0 }, vel: { x: -2, y: 0, z: 0 } }, shooter)!;
    expect(c.overlap).toBeCloseTo(DEFENSE_FLOW.contactRange - 0.75, 9);
    expect(c.approachSpeed).toBeCloseTo(2, 9);
    expect(bodyContact({ pos: { x: 0.75, y: 0, z: 0 }, vel: { x: 3, y: 0, z: 0 } }, shooter)!.approachSpeed).toBe(0);
    expect(bodyContact({ pos: { x: 1, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } }, shooter)).toBeNull();
  });

  it('zone de goaltending : ballon qui redescend au-dessus du cercle, près de lui', () => {
    const at = (dx: number, z: number, vz: number) => ({ pos: { x: rim.x + dx, y: rim.y, z }, vel: { x: 0, y: 0, z: vz } });
    expect(inGoaltendZone(hoop, at(-0.5, RIM_HEIGHT + 0.5, -2))).toBe(true);
    expect(inGoaltendZone(hoop, at(-0.5, RIM_HEIGHT + 0.5, 2))).toBe(false);
    expect(inGoaltendZone(hoop, at(-1.5, RIM_HEIGHT + 0.5, -2))).toBe(false);
    expect(inGoaltendZone(hoop, at(-0.5, RIM_HEIGHT - 0.2, -2))).toBe(false);
  });

  it('ballon frappé : loin de la main, vitesse bornée, seedé', () => {
    const v = swatVelocity({ x: 0, y: 0 }, { x: 1, y: 0, z: 3 }, { x: -1, y: 0 }, new Rng(4));
    const again = swatVelocity({ x: 0, y: 0 }, { x: 1, y: 0, z: 3 }, { x: -1, y: 0 }, new Rng(4));
    expect(v).toEqual(again);
    expect(v.x).toBeGreaterThan(0);
    const speed = Math.hypot(v.x, v.y);
    expect(speed).toBeGreaterThanOrEqual(DEFENSE_FLOW.swatSpeed[0] - 1e-9);
    expect(speed).toBeLessThanOrEqual(DEFENSE_FLOW.swatSpeed[1] + 1e-9);
  });
});

describe('contre', () => {
  const outcomes = Array.from({ length: 40 }, (_, i) => blockScenario(i + 1)).filter(({ shot }) => shot.block);

  it('une main en l’air sur le ballon en montée : contre tenté, une seule fois', () => {
    expect(outcomes.length).toBeGreaterThan(30);
    for (const { world, shot } of outcomes.slice(0, 5)) {
      const first = shot.block;
      expect(first!.blocker).toBe(1);
      expect(first!.contact).toBeGreaterThan(0);
      run(world, 0.1);
      expect(shot.block).toBe(first);
    }
  });

  it('contre réussi : ballon frappé, aucun point même si le tir était voulu réussi', () => {
    const made = outcomes.filter(({ shot }) => shot.block!.success && shot.wanted);
    expect(made.length).toBeGreaterThan(0);
    for (const { world, shot, before } of made) {
      expect(world.ball.vel).not.toEqual(before);
      expect(shot.live).toBe(false);
      run(world, 3, () => world.holder !== null);
      expect(world.points).toEqual([0, 0]);
      expect(shot.scored).toBe(false);
      // Ramassé par le défenseur : il doit ressortir ; repris par le tireur : non.
      if (world.holder !== null) expect(world.rules!.mustClear[world.holder]).toBe(world.holder === 1);
    }
  });

  it('contre raté : le résultat tiré au lâcher tient', () => {
    const missed = outcomes.filter(({ shot }) => !shot.block!.success);
    expect(missed.length).toBeGreaterThan(0);
    for (const { world, shot } of missed) {
      run(world, 4, () => shot.live !== null);
      expect(shot.live).toBe(shot.wanted);
    }
  });

  it('pas de contre au sol, ni sur un ballon qui redescend loin du cercle', () => {
    const ground = oneOnOne(3);
    place(ground, 1, { x: 2, y: 1 });
    const shot = shootFrom(ground, { x: rim.x - 6, y: rim.y });
    const from = ground.players[0].pos;
    run(ground, 1, () => Math.hypot(ground.ball.pos.x - from.x, ground.ball.pos.y - from.y) > 1.3);
    // Ballon ramené à portée d'un bras levé depuis le sol.
    ground.ball.pos.z = 2.4;
    const ball = ground.ball.pos;
    place(ground, 1, { x: ball.x + 0.25, y: ball.y, z: 0 });
    expect(armContact(ground.players[1].pos, tallest.heightCm, reach(tallest), ground.ball.pos)).not.toBeNull();
    ground.step(WORLD_DT, [IDLE, IDLE]);
    expect(shot.block).toBeNull();

    const late = oneOnOne(3);
    place(late, 1, { x: 2, y: 1 });
    const lob = shootFrom(late, { x: rim.x - 7.5, y: rim.y });
    run(late, 2, () => late.ball.vel.z < 0 && Math.hypot(late.ball.pos.x - rim.x, late.ball.pos.y - rim.y) > 2);
    const b = late.ball.pos;
    const shoulder = (tallest.heightCm / 100) * DEFENSE_FLOW.shoulderRatio;
    place(late, 1, { x: b.x + 0.25, y: b.y, z: Math.max(0.05, b.z - shoulder - 0.4) }, true);
    late.step(WORLD_DT, [IDLE, IDLE]);
    expect(lob.block).toBeNull();
    expect(lob.goaltend).toBe(false);
  });

  it('pas de contre sur un dunk', () => {
    const dunker = [...players].sort((a, b) => b.attrs.standingDunk + b.heightCm / 10 - (a.attrs.standingDunk + a.heightCm / 10))[0];
    const world = oneOnOne(2, dunker, byOverall[5]);
    place(world, 1, { x: 2, y: 1 });
    place(world, 0, { x: rim.x - 1, y: rim.y });
    world.step(WORLD_DT, [{ ...IDLE, jump: true }, IDLE]);
    expect(world.shot?.kind).toBe('dunk');
    run(world, 1, () => world.lastShot !== null);
    const ball = world.ball.pos;
    place(world, 1, { x: ball.x - 0.3, y: ball.y + 0.3, z: Math.max(0.05, ball.z - 2) }, true);
    world.step(WORLD_DT, [IDLE, IDLE]);
    expect(world.lastShot!.block).toBeNull();
  });
});

describe('faute', () => {
  /** Tir à mi-distance avec un défenseur collé au sol (contact dès le décollage). */
  const fouled = Array.from({ length: 40 }, (_, i) => {
    const world = oneOnOne(i + 1);
    place(world, 1, { x: rim.x - 5.25, y: rim.y });
    const shot = shootFrom(world, { x: rim.x - 6, y: rim.y });
    return { world, shot };
  });

  it('un défenseur collé, même au sol, est évalué une seule fois ; sans contact, rien', () => {
    for (const { world, shot } of fouled.slice(0, 5)) {
      const call = shot.foul;
      expect(call).not.toBeNull();
      expect(call!.defender).toBe(1);
      run(world, 0.2);
      expect(shot.foul).toBe(call);
    }
    const far = oneOnOne(1);
    place(far, 1, { x: rim.x - 4.5, y: rim.y });
    expect(shootFrom(far, { x: rim.x - 6, y: rim.y }).foul).toBeNull();
  });

  it('faute puis tir raté : ballon mort, puis le tireur en haut de la raquette avec le ballon', () => {
    const cases = fouled.filter(({ shot }) => shot.foul!.called && !shot.wanted);
    expect(cases.length).toBeGreaterThan(0);
    const { attacker, defender } = startPositions(court, hoop);
    for (const { world } of cases) {
      run(world, 3, () => world.rules!.restart !== null);
      expect(world.rules!.restart).not.toBeNull();
      // Pendant la pause, personne ne joue.
      const frozen = { ...world.players[1].pos };
      world.step(WORLD_DT, [IDLE, { x: 1, y: 0, jump: false }]);
      expect(world.players[1].pos.x).toBeCloseTo(frozen.x, 6);
      run(world, DEFENSE_FLOW.foulPause + 0.1, () => world.rules!.restart === null);
      expect(world.rules!.restart).toBeNull();
      expect(world.holder).toBe(0);
      expect(world.players[0].pos).toEqual(attacker);
      expect(world.players[1].pos).toEqual(defender);
      expect(world.rules!.mustClear).toEqual([false, false]);
      expect(world.points).toEqual([0, 0]);
    }
  });

  it('faute puis tir marqué : le panier compte, puis la suite normale', () => {
    const cases = fouled.filter(({ shot }) => shot.foul!.called && shot.wanted);
    expect(cases.length).toBeGreaterThan(0);
    for (const { world, shot } of cases) {
      run(world, 4, () => shot.live !== null && world.holder !== null);
      expect(world.points[0]).toBe(2);
      expect(world.rules!.restart).toBeNull();
      if (world.holder !== null) expect(world.rules!.mustClear[world.holder]).toBe(true);
    }
  });

  it('la fenêtre se ferme à l’atterrissage du tireur', () => {
    const world = oneOnOne(5);
    place(world, 1, { x: 2, y: 1 });
    const shot = shootFrom(world, { x: rim.x - 6, y: rim.y });
    run(world, 2, () => !world.players[0].airborne);
    place(world, 1, { x: world.players[0].pos.x + 0.72, y: world.players[0].pos.y });
    run(world, 0.2);
    expect(shot.foul).toBeNull();
  });

  it('une faute après un contre réussi : le contre ne compte pas, ballon au tireur', () => {
    const found = Array.from({ length: 60 }, (_, i) => blockScenario(i + 1))
      .filter(({ shot }) => shot.block?.success)
      .map(({ world, shot }) => {
        // Le défenseur retombe sur le tireur encore en l'air.
        const s = world.players[0].pos;
        place(world, 1, { x: s.x + 0.72, y: s.y, z: 0.3 }, true);
        world.step(WORLD_DT, [IDLE, IDLE]);
        return { world, shot };
      })
      .filter(({ shot }) => shot.foul?.called);
    expect(found.length).toBeGreaterThan(0);
    for (const { world } of found) {
      run(world, DEFENSE_FLOW.foulPause + 0.3, () => world.rules!.restart === null && world.holder === 0);
      expect(world.holder).toBe(0);
      expect(world.points).toEqual([0, 0]);
    }
  });
});

describe('goaltending', () => {
  it('toucher le ballon qui redescend au-dessus du cercle : le panier compte, même voulu raté', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30 && checked < 3; seed++) {
      const world = oneOnOne(seed);
      place(world, 1, { x: 2, y: 1 });
      const shot = shootFrom(world, { x: rim.x - 6.5, y: rim.y + 1 });
      if (shot.wanted) continue;
      run(world, 2, () => inGoaltendZone(hoop, world.ball));
      if (!inGoaltendZone(hoop, world.ball)) continue;
      const ball = world.ball.pos;
      const shoulder = (tallest.heightCm / 100) * DEFENSE_FLOW.shoulderRatio;
      place(world, 1, { x: ball.x - 0.25, y: ball.y, z: Math.max(0.05, ball.z - shoulder - 0.4) }, true);
      world.step(WORLD_DT, [IDLE, IDLE]);
      expect(shot.goaltend).toBe(true);
      expect(shot.scored).toBe(true);
      expect(world.points).toEqual([2, 0]);
      run(world, 3, () => world.holder !== null);
      expect(world.points).toEqual([2, 0]);
      if (world.holder !== null) expect(world.rules!.mustClear[world.holder]).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('déterminisme', () => {
  it('contres et fautes se rejouent à l’identique', () => {
    const replay = () =>
      [3, 7, 11].map((seed) => {
        const { world, shot } = blockScenario(seed);
        run(world, 2);
        return JSON.stringify({ block: shot.block, foul: shot.foul, ball: world.ball, holder: world.holder });
      });
    expect(replay()).toEqual(replay());
  });
});
