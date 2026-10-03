import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../engine';
import { reach } from '../../engine/athletics';
import { Rng } from '../../engine/rng';
import { BALL_PHYSICS } from '../physics/ball';
import { makeCourt, type Vec3 } from '../physics/court';
import { fullCourtRoster } from '../roster';
import { attackHoop, FULL_COURT, inFrontcourt, isOut } from './fullCourt';
import { MatchWorld, WORLD_DT, type WorldInput } from './MatchWorld';
import { freeTimeToApex } from './player';

const league = createNewGame('bos', 31);
const home = fullCourtRoster(league.players, league.teams[0]);
const away = fullCourtRoster(league.players, league.teams[1]);
const court = makeCourt('pro');
const IDLE: WorldInput = { x: 0, y: 0, jump: false };
const idle = () => Array.from({ length: 10 }, () => IDLE);

function match(seed = 1, quarterMinutes = 3): MatchWorld {
  const w = new MatchWorld(court, home[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  w.startFullCourt(home, away, quarterMinutes);
  return w;
}

function place(w: MatchWorld, i: number, pos: Partial<Vec3>): void {
  w.players[i].pos = { ...w.players[i].pos, ...pos, z: 0 };
  w.players[i].vel = { x: 0, y: 0, z: 0 };
  w.players[i].airborne = false;
}

function stepWith(w: MatchWorld, i: number, input: WorldInput): void {
  const inputs = idle();
  inputs[i] = input;
  w.step(WORLD_DT, inputs);
}

function run(w: MatchWorld, seconds: number, until?: () => boolean): number {
  let t = 0;
  for (; t < seconds; t += WORLD_DT) {
    if (until?.()) return t;
    w.step(WORLD_DT, idle());
  }
  return t;
}

/** Jeu en cours : `holder` a le ballon en `pos`, les autres rangés loin, au fond. */
function live(w: MatchWorld, holder: number, pos: { x: number; y: number }): void {
  const full = w.full!;
  w.players.forEach((_, i) => place(w, i, { x: 2 + i * 2.5, y: 0.8 }));
  place(w, holder, pos);
  full.phase = 'jeu';
  full.tip = null;
  full.inbound = null;
  full.frontcourt = false;
  full.backcourtTime = 0;
  full.shotClock = FULL_COURT.shotClock;
  full.lastTouch = { player: holder, team: w.team[holder] };
  w.holder = holder;
  w.possession = { team: w.team[holder], since: w.clock };
  w.ball = { pos: w.handPosition(w.players[holder]), vel: { x: 0, y: 0, z: 0 } };
}

const events = (w: MatchWorld) => w.events.map((e) => e.kind);
const mid = court.length / 2;

describe('entre-deux', () => {
  it('début de match : les pivots au centre, ballon lancé, personne ne le ramasse, le chrono attend', () => {
    const w = match();
    const full = w.full!;
    expect(full.phase).toBe('entre-deux');
    expect(full.period).toBe(1);
    expect(full.clock).toBe(180);
    expect(w.controlled).toBe(4);
    expect(Math.abs(w.players[4].pos.x - mid)).toBeLessThan(1);
    expect(Math.abs(w.players[9].pos.x - mid)).toBeLessThan(1);
    // Personne ne saute : le ballon retombe et il est relancé ; le chrono ne bouge pas.
    run(w, 3);
    expect(full.phase).toBe('entre-deux');
    expect(w.holder).toBeNull();
    expect(full.clock).toBe(180);
  });

  /** Appui sur Saut pour que la main soit au plus haut quand le ballon y redescend. */
  function jumpDelay(w: MatchWorld, j: number): number {
    const body = w.players[j];
    const vz = w.ball.vel.z;
    const apexTime = vz / BALL_PHYSICS.gravity;
    const apex = w.ball.pos.z + (vz * vz) / (2 * BALL_PHYSICS.gravity);
    const hand = body.jumpHeight + reach(body.athlete);
    const fall = Math.sqrt((2 * Math.max(0, apex - hand)) / BALL_PHYSICS.gravity);
    return apexTime + fall - freeTimeToApex(body);
  }

  it('saut bien calé : ton pivot le tape vers son équipe ; le chrono part au toucher', () => {
    const w = match();
    const full = w.full!;
    const delay = jumpDelay(w, 4);
    run(w, delay);
    stepWith(w, 4, { ...IDLE, jump: true });
    run(w, 1.2, () => full.phase !== 'entre-deux');
    expect(full.phase).toBe('jeu');
    expect(full.tipWinner).toBe(0);
    expect(full.lastTouch?.player).toBe(4);
    const clock = full.clock;
    run(w, 0.5);
    expect(full.clock).toBeLessThan(clock);
    // Un coéquipier le ramasse.
    run(w, 3, () => w.holder !== null);
    expect(w.team[w.holder!]).toBe(0);
  });

  it('les deux sautent bien calés : la plus haute main touche la première', () => {
    const w = match(2);
    const full = w.full!;
    const hand = (j: number) => w.players[j].jumpHeight + reach(w.players[j].athlete);
    const delays = [4, 9].map((j) => ({ j, at: jumpDelay(w, j) }));
    const inputs = idle();
    for (let t = 0; t < 2 && full.phase === 'entre-deux'; t += WORLD_DT) {
      for (const d of delays) inputs[d.j] = { ...IDLE, jump: t >= d.at && t < d.at + WORLD_DT };
      w.step(WORLD_DT, inputs);
    }
    expect(full.phase).toBe('jeu');
    expect(full.lastTouch?.player).toBe(hand(4) >= hand(9) ? 4 : 9);
  });

  it('toucher le ballon avant son sommet : violation, ballon à l’autre équipe', () => {
    const w = match();
    const full = w.full!;
    stepWith(w, 4, { ...IDLE, jump: true });
    run(w, 1, () => full.phase !== 'entre-deux');
    expect(full.phase).toBe('mort');
    expect(events(w)).toContain('entre-deux');
    expect(full.inbound?.team).toBe(1);
    expect(full.tipWinner).toBe(1);
    run(w, FULL_COURT.deadPause + 0.1);
    expect(full.phase).toBe('remise');
    expect(w.team[w.holder!]).toBe(1);
    expect(isOut(court, w.players[w.holder!].pos)).toBe(true);
  });
});

describe('sorties et remises', () => {
  it('porteur qui pose le pied sur la ligne : SORTIE, remise pour l’autre équipe au plus près', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: 20, y: 0.6 });
    for (let t = 0; t < 1 && full.phase === 'jeu'; t += WORLD_DT) stepWith(w, 0, { x: 0, y: -1, jump: false });
    expect(full.phase).toBe('mort');
    expect(events(w)).toContain('sortie');
    expect(w.turnovers.at(-1)).toMatchObject({ kind: 'sortie', loser: 0, thief: null });
    expect(full.inbound?.team).toBe(1);
    expect(full.inbound?.spot.y).toBeLessThan(0);
    expect(Math.abs(full.inbound!.spot.x - 20)).toBeLessThan(1.5);
    const clock = full.clock;
    run(w, FULL_COURT.deadPause + 0.05);
    expect(full.phase).toBe('remise');
    const thrower = w.holder!;
    expect(w.team[thrower]).toBe(1);
    expect(w.players[thrower].pos).toMatchObject({ x: full.inbound!.spot.x, y: full.inbound!.spot.y });
    // Le chrono est arrêté pendant le ballon mort et la remise.
    expect(full.clock).toBe(clock);
  });

  it('ballon libre qui sort : au détriment du dernier qui l’a touché', () => {
    const w = match();
    const full = w.full!;
    live(w, 6, { x: 18, y: 6 });
    w.holder = null;
    full.lastTouch = { player: 6, team: 1 };
    w.ball = { pos: { x: 18, y: 1, z: 0.3 }, vel: { x: 0, y: -4, z: 0 } };
    run(w, 1.5, () => full.phase !== 'jeu');
    expect(full.phase).toBe('mort');
    expect(full.inbound?.team).toBe(0);
  });

  it('remise : le lanceur ne bouge pas ; sa passe touchée sur le terrain lance le chrono', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: 20, y: 0.6 });
    for (let t = 0; t < 1 && full.phase === 'jeu'; t += WORLD_DT) stepWith(w, 0, { x: 0, y: -1, jump: false });
    run(w, FULL_COURT.deadPause + 0.05);
    const thrower = w.holder!;
    const spot = { ...w.players[thrower].pos };
    // Un coéquipier tout près, sur le terrain ; l'ancien porteur s'écarte de la ligne de passe.
    const mate = w.lineup[1].find((i) => i !== thrower)!;
    place(w, mate, { x: spot.x, y: 3 });
    place(w, 0, { x: spot.x + 4, y: 5 });
    for (let t = 0; t < 0.3; t += WORLD_DT) stepWith(w, thrower, { x: 1, y: 1, jump: true });
    expect(w.players[thrower].pos).toMatchObject({ x: spot.x, y: spot.y });
    expect(w.shot).toBeNull();
    const clock = full.clock;
    stepWith(w, thrower, { x: 0, y: 1, jump: false, pass: true });
    expect(w.pass?.receiver).toBe(mate);
    run(w, 1.5, () => w.holder !== null);
    expect(w.holder).toBe(mate);
    expect(full.phase).toBe('jeu');
    run(w, 0.5);
    expect(full.clock).toBeLessThan(clock);
  });

  it('5 secondes sans passer : violation, ballon à l’autre équipe au même endroit', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: 20, y: 0.6 });
    for (let t = 0; t < 1 && full.phase === 'jeu'; t += WORLD_DT) stepWith(w, 0, { x: 0, y: -1, jump: false });
    run(w, FULL_COURT.deadPause + 0.05);
    const spot = { ...full.inbound!.spot };
    run(w, FULL_COURT.inboundLimit + 0.1, () => full.phase !== 'remise');
    expect(events(w)).toContain('5 secondes');
    expect(full.inbound?.team).toBe(0);
    expect(full.inbound?.spot).toEqual(spot);
  });

  it('panier : l’autre équipe remet sous ce panier ; le chrono continue (sauf dernière minute du QT4)', () => {
    for (const lastMinute of [false, true]) {
      const w = match();
      const full = w.full!;
      live(w, 0, { x: 22, y: 7 });
      if (lastMinute) {
        full.period = 4;
        full.clock = 50;
      }
      w.holder = null;
      const rim = attackHoop(court, 0, full.period).rim;
      w.ball = { pos: { x: rim.x, y: rim.y, z: rim.z + 0.6 }, vel: { x: 0, y: 0, z: -1 } };
      // Un tir marqué par l'équipe 0 (enregistrement minimal du monde).
      w.demoShot(true);
      w.lastShot!.demo = false;
      w.lastShot!.shooter = 0;
      run(w, 2, () => w.points[0] > 0);
      expect(w.points[0]).toBeGreaterThan(0);
      const clock = full.clock;
      run(w, 2, () => full.phase === 'remise');
      expect(full.phase).toBe('remise');
      expect(full.inbound?.team).toBe(1);
      expect(full.inbound?.afterBasket).toBe(true);
      const thrower = w.holder!;
      expect(Math.abs(w.players[thrower].pos.x - court.length)).toBeLessThan(1);
      if (lastMinute) expect(full.clock).toBe(clock);
      else expect(full.clock).toBeLessThan(clock);
    }
  });
});

describe('violations', () => {
  it('8 secondes dans sa moitié arrière', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: 8, y: 7 });
    run(w, FULL_COURT.backcourtLimit + 0.2, () => full.phase !== 'jeu');
    expect(events(w)).toContain('8 secondes');
    expect(full.inbound?.team).toBe(1);
  });

  it('passer la ligne médiane arrête le compte des 8 s', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: mid + 2, y: 7 });
    run(w, FULL_COURT.backcourtLimit + 1);
    expect(full.frontcourt).toBe(true);
    expect(events(w)).not.toContain('8 secondes');
  });

  it('retour en zone : le porteur qui revient dans sa moitié arrière, ou une passe reçue derrière', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: mid + 0.6, y: 7 });
    run(w, 0.1);
    expect(full.frontcourt).toBe(true);
    for (let t = 0; t < 1 && full.phase === 'jeu'; t += WORLD_DT) stepWith(w, 0, { x: -1, y: 0, jump: false });
    expect(events(w)).toContain('retour en zone');
    expect(inFrontcourt(court, 0, 1, full.inbound!.spot.x)).toBe(false);

    const p = match(3);
    live(p, 0, { x: mid + 2, y: 7 });
    place(p, 1, { x: mid - 4, y: 7 });
    run(p, 0.1);
    stepWith(p, 0, { x: -1, y: 0, jump: false, pass: true });
    expect(p.pass?.receiver).toBe(1);
    run(p, 1.5, () => p.full!.phase !== 'jeu');
    expect(events(p)).toContain('retour en zone');
  });

  it('24 secondes ; un tir lâché avant 0 qui touche le cercle n’est pas une violation', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: 22, y: 7 });
    run(w, FULL_COURT.shotClock + 0.2, () => full.phase !== 'jeu');
    expect(events(w)).toContain('24 secondes');
    expect(full.inbound?.team).toBe(1);

    // Tir raté juste avant la fin du shot clock : le ballon touche le cercle, pas de violation.
    let ok = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = match(seed);
      const sf = s.full!;
      const rim = attackHoop(court, 0, 1).rim;
      live(s, 0, { x: rim.x - 4.5, y: rim.y });
      sf.frontcourt = true;
      sf.shotClock = 0.9;
      stepWith(s, 0, { ...IDLE, jump: true });
      for (let t = 0; t < 2 && s.shot; t += WORLD_DT) stepWith(s, 0, { ...IDLE, release: s.shot.airTime >= s.players[0].timeToApex });
      run(s, 2.5, () => sf.phase !== 'jeu' || s.holder !== null);
      if (!events(s).includes('24 secondes')) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(5);
  });

  it('rebond offensif après le cercle : 14 s au shot clock', () => {
    let checked = 0;
    for (let seed = 1; seed <= 12 && checked < 2; seed++) {
      const s = match(seed);
      const sf = s.full!;
      const rim = attackHoop(court, 0, 1).rim;
      live(s, 0, { x: rim.x - 4.5, y: rim.y });
      sf.frontcourt = true;
      stepWith(s, 0, { ...IDLE, jump: true });
      // Lâcher très tard : tir raté.
      for (let t = 0; t < 2 && s.shot; t += WORLD_DT) stepWith(s, 0, IDLE);
      if (s.lastShot?.wanted !== false) continue;
      // Un coéquipier suit le ballon jusqu'à le ramasser après le cercle.
      for (let t = 0; t < 3 && s.holder === null && sf.phase === 'jeu'; t += WORLD_DT) {
        if (s.lastShot.live !== null || s.ball.vel.z < 0) place(s, 1, { x: s.ball.pos.x, y: s.ball.pos.y });
        s.step(WORLD_DT, idle());
      }
      if (s.holder !== 1) continue;
      expect(sf.shotClock).toBeLessThanOrEqual(FULL_COURT.shotClockReset);
      expect(sf.shotClock).toBeGreaterThan(FULL_COURT.shotClockReset - 1);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('périodes', () => {
  it('fin de période, puis remise de la ligne de fond ; changement de panier à la mi-temps', () => {
    const w = match();
    const full = w.full!;
    full.tipWinner = 0;
    live(w, 0, { x: 22, y: 7 });
    full.clock = 0.2;
    run(w, 0.3);
    expect(full.phase).toBe('fin-periode');
    run(w, FULL_COURT.periodPause + 0.1);
    expect(full.period).toBe(2);
    expect(full.phase).toBe('remise');
    expect(full.clock).toBe(180);
    // QT2 : remise pour le perdant de l'entre-deux, dans sa moitié arrière.
    expect(w.team[w.holder!]).toBe(1);
    expect(inFrontcourt(court, 1, 2, w.players[w.holder!].pos.x)).toBe(false);
    live(w, 5, { x: 8, y: 7 });
    full.clock = 0.1;
    run(w, 0.2);
    expect(full.phase).toBe('fin-periode');
    expect(full.pause).toBeGreaterThan(FULL_COURT.periodPause);
    run(w, FULL_COURT.halftimePause + 0.1);
    expect(full.period).toBe(3);
    expect(w.attackHoop(0)).toBe(court.hoops.left);
  });

  it('égalité à la fin du QT4 : prolongation par entre-deux ; sinon fin du match, puis un nouveau', () => {
    const w = match();
    const full = w.full!;
    live(w, 0, { x: 22, y: 7 });
    full.period = 4;
    full.clock = 0.1;
    w.points = [40, 40];
    run(w, 0.2);
    expect(full.phase).toBe('fin-periode');
    run(w, FULL_COURT.periodPause + 0.1);
    expect(full.period).toBe(5);
    expect(full.phase).toBe('entre-deux');
    expect(full.clock).toBe(75);

    live(w, 0, { x: 22, y: 7 });
    full.clock = 0.1;
    w.points = [44, 41];
    run(w, 0.2);
    expect(full.phase).toBe('fin-match');
    expect(full.winner).toBe(0);
    run(w, FULL_COURT.finalPause + 0.1);
    expect(full.period).toBe(1);
    expect(full.phase).toBe('entre-deux');
    expect(w.points).toEqual([0, 0]);
  });
});

describe('fautes (provisoires, jusqu’aux lancers du 11)', () => {
  it('faute de main : ballon mort, remise de côté pour l’équipe qui l’a subie', () => {
    let found = false;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const w = match(seed);
      const full = w.full!;
      live(w, 0, { x: 20, y: 7 });
      w.players[0].facing = 1;
      place(w, 5, { x: 20.72, y: 7 });
      stepWith(w, 5, { ...IDLE, steal: true });
      if (w.lastSteal?.result !== 'faute') continue;
      found = true;
      expect(full.phase).toBe('mort');
      expect(full.inbound?.team).toBe(0);
      expect(full.inbound!.spot.y < 0 || full.inbound!.spot.y > court.width).toBe(true);
    }
    expect(found).toBe(true);
  });
});

describe('déterminisme', () => {
  it('un 5 contre 5 où tes entrées sont scriptées se rejoue à l’identique', () => {
    const replay = () => {
      const w = match(9);
      for (let step = 0; step < 20 / WORLD_DT; step++) {
        const phase = step % 240;
        const inputs = idle();
        inputs[w.controlled] = { x: phase < 120 ? 1 : -0.5, y: phase < 60 ? 0.4 : -0.3, jump: phase === 150 || step === 50, release: phase === 198, pass: phase === 30 };
        w.step(WORLD_DT, inputs);
      }
      return JSON.stringify({ players: w.players.map((p) => p.pos), ball: w.ball, points: w.points, full: w.full });
    };
    expect(replay()).toBe(replay());
  });
});

describe('lancers francs (faute sur un tir)', () => {
  /** Tir de l'équipe 0 depuis `dx` m du cercle, défenseur collé côté cercle ; renvoie le monde après le lâcher au sommet. */
  function shotWithContact(seed: number, dx: number): MatchWorld {
    const w = match(seed);
    const rim = attackHoop(court, 0, 1).rim;
    live(w, 0, { x: rim.x - dx, y: rim.y });
    w.full!.frontcourt = true;
    place(w, 5, { x: rim.x - dx + 0.72, y: rim.y });
    stepWith(w, 0, { ...IDLE, jump: true });
    for (let t = 0; t < 2 && w.shot; t += WORLD_DT) stepWith(w, 0, { ...IDLE, release: w.shot.airTime + WORLD_DT >= w.players[0].timeToApex });
    return w;
  }

  /** Graines où la faute est sifflée, avec un tir voulu raté (`missed`) ou réussi. */
  function fouled(dx: number, missed: boolean, count = 2): MatchWorld[] {
    const found: MatchWorld[] = [];
    for (let seed = 1; seed <= 80 && found.length < count; seed++) {
      const w = shotWithContact(seed, dx);
      if (w.lastShot?.foul?.called && w.lastShot.wanted !== missed) found.push(w);
    }
    return found;
  }

  it('tir à 2 pts raté : 2 lancers ; tir à 3 pts raté : 3 lancers ; panier marqué : 1 lancer en plus des points', () => {
    for (const [dx, missed, total, points] of [
      [5, true, 2, 0],
      [7.8, true, 3, 0],
      [5, false, 1, 2],
    ] as const) {
      const cases = fouled(dx, missed);
      expect(cases.length).toBeGreaterThan(0);
      for (const w of cases) {
        run(w, 4, () => w.full!.phase === 'lancers');
        expect(w.full!.phase).toBe('lancers');
        expect(w.full!.freeThrows).toMatchObject({ shooter: 0, total, taken: 0 });
        expect(w.points[0]).toBe(points);
        expect(w.holder).toBe(0);
      }
    }
  });

  it('série de lancers : placements, personne ne bouge, jauge sans saut ; chrono arrêté ; le dernier décide de la suite', () => {
    let lastMade = 0;
    let lastMissed = 0;
    for (const w of fouled(5, true, 6)) {
      const full = w.full!;
      run(w, 4, () => full.phase === 'lancers');
      const clock = full.clock;
      const shooter = w.players[0];
      const spot = { ...shooter.pos };
      expect(Math.abs(spot.x - (attackHoop(court, 0, 1).baselineX - court.paintLength))).toBeLessThan(0.6);
      // Les autres tentent de bouger : rien ne bouge.
      const frozen = w.players.map((p) => ({ ...p.pos }));
      w.step(WORLD_DT, Array.from({ length: 10 }, () => ({ x: 1, y: 1, jump: false })));
      w.players.forEach((p, i) => expect(p.pos).toEqual(frozen[i]));
      for (let n = 0; n < 2; n++) {
        run(w, 2, () => w.holder === 0 && full.freeThrows?.aim === null && full.freeThrows?.pause === 0 && !full.freeThrows.flying);
        stepWith(w, 0, { ...IDLE, jump: true });
        expect(shooter.airborne).toBe(false);
        for (let t = 0; t < 2 && full.freeThrows?.aim !== null && w.holder === 0; t += WORLD_DT) {
          stepWith(w, 0, { ...IDLE, release: (full.freeThrows?.aim ?? 0) + WORLD_DT >= shooter.timeToApex });
        }
        expect(w.lastShot?.kind).toBe('lancer');
        expect(w.lastShot?.grade).toBe('perfect');
      }
      expect(full.clock).toBe(clock);
      run(w, 3, () => full.phase === 'remise' || w.holder !== null);
      if (w.lastShot!.wanted) {
        lastMade++;
        expect(full.phase).toBe('remise');
        expect(full.inbound?.team).toBe(1);
        expect(full.clock).toBe(clock);
      } else {
        lastMissed++;
        expect(full.phase).toBe('jeu');
      }
    }
    expect(lastMade).toBeGreaterThan(0);
    expect(lastMade + lastMissed).toBeGreaterThan(2);
  });

  it('Tir tenu trop longtemps : le lancer part tout seul, très en retard', () => {
    const [w] = fouled(5, true, 1);
    run(w, 4, () => w.full!.phase === 'lancers');
    stepWith(w, 0, { ...IDLE, jump: true });
    run(w, 3, () => w.lastShot?.kind === 'lancer');
    expect(w.lastShot).toMatchObject({ kind: 'lancer', forced: true, grade: 'late' });
  });

  it('dernier lancer raté : le chrono attend que quelqu’un touche le ballon', () => {
    for (const w of fouled(5, true, 10)) {
      const full = w.full!;
      run(w, 4, () => full.phase === 'lancers');
      // Deux lancers lâchés très tard : souvent ratés.
      for (let n = 0; n < 2; n++) {
        run(w, 2, () => w.holder === 0 && full.freeThrows?.aim === null && !full.freeThrows?.flying && full.freeThrows?.pause === 0);
        stepWith(w, 0, { ...IDLE, jump: true });
        run(w, 0.8, () => w.lastShot?.kind === 'lancer' && w.holder !== 0);
        stepWith(w, 0, { ...IDLE, release: true });
      }
      if (full.phase !== 'jeu' || w.lastShot!.wanted) continue;
      expect(full.waitTouch).toBe(true);
      const clock = full.clock;
      run(w, 3, () => w.holder !== null || full.phase !== 'jeu');
      if (w.holder === null) continue;
      expect(full.waitTouch).toBe(false);
      run(w, 0.5);
      expect(full.clock).toBeLessThan(clock);
      return;
    }
    throw new Error('aucun dernier lancer raté repris');
  });
});
