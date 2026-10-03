import { describe, expect, it } from 'vitest';
import { createNewGame, type Player } from '../../engine';
import { Rng } from '../../engine/rng';
import { makeCourt, type Vec3 } from '../physics/court';
import { startPositions } from './halfCourt';
import { MatchWorld, WORLD_DT, type WorldInput } from './MatchWorld';
import { laneContact, measureSteal, STEAL_FLOW } from './steal';

const league = createNewGame('bos', 31);
const roster = (k: number) => league.teams[k].rotation.map((id) => league.players[id]).slice(0, 3);
const court = makeCourt('pro');
const hoop = court.hoops.right;
const rim = hoop.rim;
const IDLE: WorldInput = { x: 0, y: 0, jump: false };
const idle = (n: number) => Array.from({ length: n }, () => IDLE);

function threeOnThree(seed: number, home: Player[] = roster(0), away: Player[] = roster(1)): MatchWorld {
  const w = new MatchWorld(court, home[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  w.startTeams(home, away);
  return w;
}

function place(w: MatchWorld, i: number, pos: Partial<Vec3>): void {
  w.players[i].pos = { ...w.players[i].pos, ...pos };
  w.players[i].vel = { x: 0, y: 0, z: 0 };
}

function stepWith(w: MatchWorld, i: number, input: WorldInput): void {
  const inputs = idle(w.players.length);
  inputs[i] = input;
  w.step(WORLD_DT, inputs);
}

function run(w: MatchWorld, seconds: number, until?: () => boolean): void {
  for (let t = 0; t < seconds; t += WORLD_DT) {
    if (until?.()) return;
    w.step(WORLD_DT, idle(w.players.length));
  }
}

/** Porteur 0 arrêté, tourné vers la droite (ballon à sa droite) ; défenseur 3 placé à `dx`, `dy` de lui. */
function reachScenario(seed: number, dx: number, dy = 0): MatchWorld {
  const w = threeOnThree(seed);
  place(w, 0, { x: rim.x - 7, y: rim.y });
  w.players[0].facing = 1;
  place(w, 3, { x: rim.x - 7 + dx, y: rim.y + dy });
  place(w, 4, { x: 2, y: 1 });
  place(w, 5, { x: 2, y: 14 });
  run(w, 0.05);
  return w;
}

describe('mesures', () => {
  it('geste de vol : bonne distance, bout des doigts, dans le vide ; exposition ; rapprochement', () => {
    const holder = { x: 0, y: 0, z: 0 };
    const ball = { x: 0.22, y: 0.12, z: 0.5 };
    const good = measureSteal({ x: 0.9, y: 0.1, z: 0 }, holder, ball)!;
    expect(good.reach).toBe(1);
    expect(good.exposed).toBeGreaterThan(0.9);
    expect(good.closeness).toBeCloseTo(0, 9);
    const fingertips = measureSteal({ x: 1.2, y: 0.1, z: 0 }, holder, ball)!;
    expect(fingertips.reach).toBeLessThan(0.5);
    expect(measureSteal({ x: 1.5, y: 0, z: 0 }, holder, ball)).toBeNull();
    const behind = measureSteal({ x: -0.7, y: 0.1, z: 0 }, holder, { ...ball, x: 0.15 })!;
    expect(behind.exposed).toBeLessThan(0.25);
    expect(behind.closeness).toBeGreaterThan(0.1);
    expect(measureSteal({ x: 0.9, y: 0, z: 0 }, holder, { ...ball, z: 2.4 })).toBeNull();
  });

  it('ligne de passe : en plein, au bord, hors de portée ; plus loin bras allongé', () => {
    const d = { x: 0, y: 0, z: 0 };
    expect(laneContact(d, 2.6, { x: 0, y: 0.1, z: 1.2 }, false)!.quality).toBeGreaterThan(0.7);
    expect(laneContact(d, 2.6, { x: 0, y: 0.7, z: 1.2 }, false)).toBeNull();
    expect(laneContact(d, 2.6, { x: 0, y: 0.7, z: 1.2 }, true)).not.toBeNull();
    expect(laneContact(d, 2.6, { x: 0, y: 0.1, z: 3 }, false)).toBeNull();
  });
});

describe('vol sur le porteur', () => {
  const attempts = Array.from({ length: 60 }, (_, i) => {
    const w = reachScenario(i + 1, 0.95, 0.1);
    stepWith(w, 3, { ...IDLE, steal: true });
    return w;
  });

  it('à bonne distance sur un ballon exposé : des vols, quelques fautes, des ratés', () => {
    const results = attempts.map((w) => w.lastSteal!.result);
    expect(results.filter((r) => r === 'vol').length).toBeGreaterThan(3);
    expect(results.filter((r) => r === 'raté').length).toBeGreaterThan(20);
    expect(attempts[0].lastSteal!.reach).toBe(1);
    expect(attempts[0].lastSteal!.exposed).toBeGreaterThan(0.8);
  });

  it('vol réussi : ballon libre vers le défenseur, perte si la défense le ramasse, ressortie due', () => {
    const stolen = attempts.filter((w) => w.lastSteal!.result === 'vol');
    let defenseGot = 0;
    for (const w of stolen) {
      expect(w.holder).toBeNull();
      expect(w.ball.vel.x).toBeGreaterThan(0);
      run(w, 2, () => w.holder !== null);
      if (w.holder !== null && w.team[w.holder] === 1) {
        defenseGot++;
        expect(w.turnovers.at(-1)).toMatchObject({ kind: 'vol', thief: 3, loser: 0 });
        expect(w.rules!.mustClear[1]).toBe(true);
      }
    }
    expect(defenseGot).toBeGreaterThan(stolen.length / 2);
  });

  it('raté : déséquilibre (il avance au ralenti) et délai avant un nouveau geste', () => {
    const missed = attempts.find((w) => w.lastSteal!.result === 'raté')!;
    expect(missed.offBalance[3]).toBeGreaterThan(0);
    const before = missed.lastSteal;
    stepWith(missed, 3, { ...IDLE, steal: true });
    expect(missed.lastSteal).toBe(before);
    for (let t = 0; t < 0.2; t += WORLD_DT) stepWith(missed, 3, { x: -1, y: 0, jump: false });
    expect(Math.hypot(missed.players[3].vel.x, missed.players[3].vel.y)).toBeLessThan(missed.players[3].runSpeed * STEAL_FLOW.offBalanceSpeed + 0.01);
  });

  it('dans le vide : rien ne se passe, mais déséquilibre', () => {
    const w = reachScenario(1, 2.5);
    stepWith(w, 3, { ...IDLE, steal: true });
    expect(w.lastSteal).toBeNull();
    expect(w.holder).toBe(0);
    expect(w.offBalance[3]).toBeGreaterThan(0);
  });

  it('trop près et à travers le corps : souvent faute, et le porteur reprend en haut de la raquette', () => {
    let fouls = 0;
    const { attackers } = startPositions(court, hoop, 3);
    for (let seed = 1; seed <= 30; seed++) {
      // Défenseur collé, du côté opposé au ballon.
      const w = reachScenario(seed, -0.72, 0.05);
      stepWith(w, 3, { ...IDLE, steal: true });
      if (w.lastSteal?.result !== 'faute') continue;
      fouls++;
      expect(w.rules!.restart).not.toBeNull();
      run(w, STEAL_FLOW.cooldown + 1.2, () => w.rules!.restart === null);
      expect(w.holder).toBe(0);
      expect(w.players[0].pos).toEqual(attackers[0]);
    }
    expect(fouls).toBeGreaterThan(10);
  });
});

describe('ligne de passe', () => {
  /** Passe de 0 vers 1 avec le défenseur 4 au milieu de la ligne ; `reach` : A appuyé juste avant. */
  function laneScenario(seed: number, offset = 0, reachPress = false, jump = false): MatchWorld {
    const w = threeOnThree(seed);
    place(w, 0, { x: rim.x - 8, y: rim.y });
    place(w, 1, { x: rim.x - 8, y: rim.y - 6 });
    place(w, 3, { x: 2, y: 1 });
    place(w, 5, { x: 2, y: 14 });
    place(w, 4, { x: rim.x - 8 + offset, y: rim.y - 3 });
    if (jump) stepWith(w, 4, { ...IDLE, jump: true });
    for (let t = 0; t < (jump ? 0.25 : 0); t += WORLD_DT) w.step(WORLD_DT, idle(6));
    const inputs = idle(6);
    inputs[0] = { ...IDLE, pass: true, x: 0, y: -1 };
    if (reachPress) inputs[4] = { ...IDLE, steal: true };
    w.step(WORLD_DT, inputs);
    return w;
  }

  it('un défenseur dans la ligne : des passes attrapées, déviées, et d’autres qui passent', () => {
    const outcomes = { catch: 0, deflect: 0, miss: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const w = laneScenario(seed);
      expect(w.pass?.receiver).toBe(1);
      run(w, 1.5, () => w.lastIntercept !== null);
      outcomes[w.lastIntercept!.outcome]++;
      if (w.lastIntercept!.outcome === 'catch') {
        expect(w.holder).toBe(4);
        expect(w.turnovers.at(-1)).toMatchObject({ kind: 'interception', thief: 4, loser: 0 });
        expect(w.rules!.mustClear[1]).toBe(true);
      }
      if (w.lastIntercept!.outcome === 'deflect') expect(w.pass).toBeNull();
    }
    expect(outcomes.catch).toBeGreaterThan(3);
    expect(outcomes.deflect).toBeGreaterThan(3);
    expect(outcomes.miss).toBeGreaterThan(3);
  });

  it('un défenseur à l’écart ne touche jamais la passe ; bras allongé (A), il l’atteint', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = laneScenario(seed, 0.75);
      run(w, 1.5, () => w.holder !== null);
      expect(w.lastIntercept).toBeNull();
      expect(w.holder).toBe(1);
    }
    const reached = Array.from({ length: 20 }, (_, i) => laneScenario(i + 1, 0.75, true)).filter((w) => {
      run(w, 1.5, () => w.holder !== null || w.lastIntercept !== null);
      return w.lastIntercept !== null;
    });
    expect(reached.length).toBeGreaterThan(10);
  });

  it('en sautant, plutôt des déviations', () => {
    const outcomes = { catch: 0, deflect: 0, miss: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const w = laneScenario(seed, 0, false, true);
      run(w, 1.5, () => w.lastIntercept !== null || w.holder !== null);
      if (w.lastIntercept) outcomes[w.lastIntercept.outcome]++;
    }
    expect(outcomes.deflect).toBeGreaterThan(outcomes.catch);
  });

  it('une passe déviée ramassée par la défense est une perte ; reprise par l’attaque, non', () => {
    let lost = 0;
    let kept = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const w = laneScenario(seed);
      run(w, 1.5, () => w.lastIntercept !== null);
      if (w.lastIntercept?.outcome !== 'deflect') continue;
      const before = w.turnovers.length;
      run(w, 4, () => w.holder !== null);
      if (w.holder === null) continue;
      if (w.team[w.holder] === 1) {
        lost++;
        expect(w.turnovers.length).toBe(before + 1);
        expect(w.turnovers.at(-1)!.kind).toBe('déviation');
      } else {
        kept++;
        expect(w.turnovers.length).toBe(before);
      }
    }
    expect(lost + kept).toBeGreaterThan(5);
  });
});

describe('déterminisme', () => {
  it('vols et interceptions se rejouent à l’identique', () => {
    const replay = () =>
      [2, 5, 9].map((seed) => {
        const w = reachScenario(seed, 0.95, 0.1);
        stepWith(w, 3, { ...IDLE, steal: true });
        run(w, 1);
        return JSON.stringify({ steal: w.lastSteal, ball: w.ball, holder: w.holder, turnovers: w.turnovers });
      });
    expect(replay()).toEqual(replay());
  });
});
