import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../engine';
import { drainEnergy, FOUL_OUT, matchRotation, startingLineup, SUB_INTERVAL } from '../../engine/rotation';
import { Rng } from '../../engine/rng';
import { PlayerAi } from '../ai/playerAi';
import { makeCourt, type Vec3 } from '../physics/court';
import { attackHoop, FULL_COURT } from './fullCourt';
import { MatchWorld, WORLD_DT, type ShotRecord, type WorldInput } from './MatchWorld';
import { createSquad, matchTimeScale } from './rotation';

const league = createNewGame('bos', 31);
const homeRotation = matchRotation(league.teams[0], league.players);
const awayRotation = matchRotation(league.teams[1], league.players);
const court = makeCourt('pro');
const IDLE: WorldInput = { x: 0, y: 0, jump: false };
const idle = () => Array.from({ length: 10 }, () => IDLE);

function match(seed = 1, quarterMinutes = 3): MatchWorld {
  const w = new MatchWorld(court, homeRotation[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  w.startFullCourt(homeRotation, awayRotation, quarterMinutes);
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

function run(w: MatchWorld, seconds: number, until?: () => boolean): void {
  for (let t = 0; t < seconds; t += WORLD_DT) {
    if (until?.()) return;
    w.step(WORLD_DT, idle());
  }
}

/** Jeu en cours dans la moitié avant de l'équipe 0 : `holder` a le ballon en `pos`, les autres rangés au fond. */
function live(w: MatchWorld, holder: number, pos: { x: number; y: number }): void {
  const full = w.full!;
  w.players.forEach((_, i) => place(w, i, { x: 16 + i * 1.2, y: 0.8 }));
  place(w, holder, pos);
  full.phase = 'jeu';
  full.tip = null;
  full.inbound = null;
  full.frontcourt = true;
  full.backcourtTime = 0;
  full.shotClock = FULL_COURT.shotClock;
  full.lastTouch = { player: holder, team: w.team[holder] };
  w.holder = holder;
  if (w.team[holder] === w.userTeam) w.controlled = holder;
  w.possession = { team: w.team[holder], since: w.clock };
  w.ball = { pos: w.handPosition(w.players[holder]), vel: { x: 0, y: 0, z: 0 } };
}

const rim = attackHoop(court, 0, 1).rim;

describe('effectifs du match', () => {
  it('toute la rotation : le cinq de départ sur le terrain (rangé par poste), les autres sur le banc', () => {
    const w = match();
    const squads = w.squads!;
    expect(squads.map((s) => s.members.length)).toEqual([homeRotation.length, awayRotation.length]);
    squads.forEach((squad, team) => {
      const five = startingLineup(createSquad(team, team === 0 ? homeRotation : awayRotation).members).map((m) => m.id);
      const onCourt = w.lineup[team].map((body) => w.memberOf(body)!.id);
      expect(onCourt).toEqual(five);
      expect(squad.members.filter((m) => m.body === null).length).toBe(squad.members.length - 5);
      expect(squad.members.filter((m) => m.starter).every((m) => m.line.gs === 1)).toBe(true);
    });
    expect(w.players.map((b) => b.athlete.id)).toEqual(w.players.map((_, i) => w.memberOf(i)!.id));
    expect(w.box!.periods).toEqual([[0], [0]]);
  });

  it('fatigue à l’échelle du match : on perd sur le terrain, on récupère sur le banc ; minutes au chrono', () => {
    const w = match();
    live(w, 0, { x: rim.x - 6, y: rim.y });
    const squad = w.squads![0];
    const starter = w.memberOf(0)!;
    const bench = squad.members.find((m) => m.body === null)!;
    starter.energy = 90;
    bench.energy = 60;
    const clock = w.full!.clock;
    run(w, 3);
    const played = clock - w.full!.clock;
    expect(played).toBeCloseTo(3, 1);
    const scale = matchTimeScale(3);
    expect(starter.energy).toBeCloseTo(drainEnergy(90, starter.player.attrs.stamina, played * scale, true), 6);
    expect(bench.energy).toBeCloseTo(drainEnergy(60, bench.player.attrs.stamina, played * scale, false), 6);
    expect(starter.line.secs).toBeCloseTo(played, 6);
    expect(bench.line.secs).toBe(0);
  });

  it('les notes baissent avec l’énergie (tir, vitesse, saut) ; les lancers francs non', () => {
    const w = match();
    live(w, 0, { x: rim.x - 6, y: rim.y });
    const member = w.memberOf(1)!;
    member.energy = 20;
    const fresh = { speed: w.players[1].runSpeed, jump: w.players[1].jumpHeight };
    run(w, 1.2);
    const body = w.players[1];
    expect(body.athlete.attrs.three).toBeLessThan(member.player.attrs.three * 0.9);
    expect(body.athlete.attrs.freeThrow).toBe(member.player.attrs.freeThrow);
    expect(body.runSpeed).toBeLessThan(fresh.speed);
    expect(body.jumpHeight).toBeLessThan(fresh.jump);
  });
});

describe('changements au ballon mort', () => {
  /** Ton joueur contrôlé, épuisé et au-delà de ses minutes : le coach le sort à la prochaine sortie. */
  function tiredStarter(seed = 1) {
    const w = match(seed);
    live(w, 0, { x: rim.x - 6, y: 2 });
    const squad = w.squads![0];
    const tired = w.memberOf(0)!;
    tired.energy = 5;
    tired.line.secs = 400;
    squad.sinceSub = SUB_INTERVAL;
    return { w, squad, tired };
  }

  it('pas de changement tant que le ballon est vivant', () => {
    const { w, tired } = tiredStarter();
    const version = w.lineupVersion;
    run(w, 1);
    expect(tired.body).toBe(0);
    expect(w.lineupVersion).toBe(version);
  });

  it('sortie : le remplaçant prend le corps (même place), le poste et le contrôle de celui qui sort', () => {
    const { w, squad, tired } = tiredStarter();
    expect(w.controlled).toBe(0);
    // Le porteur sort du terrain : ballon mort.
    for (let t = 0; t < 2 && w.full!.phase === 'jeu'; t += WORLD_DT) stepWith(w, 0, { ...IDLE, y: -1 });
    expect(w.full!.phase).toBe('mort');
    w.players[0].vel = { x: 0, y: 0, z: 0 };
    const at = { ...w.players[0].pos };
    w.step(WORLD_DT, idle());
    expect(tired.body).toBeNull();
    const incoming = w.memberOf(0)!;
    expect(incoming).not.toBe(tired);
    expect(squad.members).toContain(incoming);
    expect(w.players[0].athlete.id).toBe(incoming.id);
    expect(w.players[0].pos).toEqual(at);
    expect(w.controlled).toBe(0);
    expect(w.lineup[0]).toContain(0);
    expect(w.events.some((e) => e.kind === 'changement' && e.by === 0)).toBe(true);
    expect(squad.sinceSub).toBe(0);
    expect(incoming.line.gp).toBe(1);
  });

  it('intervalle pas encore passé : pas de changement, sauf un joueur éliminé', () => {
    const { w, squad, tired } = tiredStarter();
    squad.sinceSub = 0;
    for (let t = 0; t < 2 && w.full!.phase === 'jeu'; t += WORLD_DT) stepWith(w, 0, { ...IDLE, y: -1 });
    run(w, 0.1);
    expect(tired.body).toBe(0);
  });
});

describe('fautes d’équipe, bonus, 6 fautes', () => {
  /** Porteur 0 arrêté dans la moitié avant ; défenseur 5 collé du côté opposé au ballon (faute de main probable). */
  function reach(seed: number): MatchWorld {
    const w = match(seed);
    live(w, 0, { x: rim.x - 7, y: rim.y });
    w.players[0].facing = 1;
    place(w, 5, { x: rim.x - 7 - 0.72, y: rim.y + 0.05 });
    run(w, 0.05);
    stepWith(w, 5, { ...IDLE, steal: true });
    return w;
  }

  function reachFoul(prepare: (w: MatchWorld) => void): MatchWorld {
    for (let seed = 1; seed <= 60; seed++) {
      const w = match(seed);
      live(w, 0, { x: rim.x - 7, y: rim.y });
      w.players[0].facing = 1;
      place(w, 5, { x: rim.x - 7 - 0.72, y: rim.y + 0.05 });
      run(w, 0.05);
      prepare(w);
      stepWith(w, 5, { ...IDLE, steal: true });
      if (w.lastSteal?.result === 'faute') return w;
    }
    throw new Error('aucune faute de main');
  }

  it('toute faute compte en faute d’équipe et en faute personnelle', () => {
    let found = false;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const w = reach(seed);
      if (w.lastSteal?.result !== 'faute') continue;
      found = true;
      expect(w.squads![1].fouls).toBe(1);
      expect(w.memberOf(5)!.line.pf).toBe(1);
      // Hors bonus : remise de côté, pas de lancers.
      expect(w.full!.phase).toBe('mort');
      expect(w.full!.freeThrows).toBeNull();
      expect(w.full!.inbound?.team).toBe(0);
    }
    expect(found).toBe(true);
  });

  it('bonus (6e faute d’équipe de la période) : 2 lancers au porteur au lieu de la remise, message BONUS', () => {
    const w = reachFoul((w) => (w.squads![1].fouls = 5));
    expect(w.squads![1].fouls).toBe(6);
    expect(w.events.some((e) => e.kind === 'bonus' && e.by === 5)).toBe(true);
    expect(w.full!.freeThrows).toMatchObject({ shooter: 0, total: 2, team: 0 });
    run(w, 3, () => w.full!.phase === 'lancers');
    expect(w.full!.phase).toBe('lancers');
    expect(w.holder).toBe(0);
  });

  it('5 fautes d’équipe seulement : pas encore de bonus', () => {
    const w = reachFoul((w) => (w.squads![1].fouls = 4));
    expect(w.full!.freeThrows).toBeNull();
  });

  it('fautes d’équipe remises à 0 à chaque période', () => {
    const w = match();
    live(w, 0, { x: rim.x - 6, y: rim.y });
    w.squads![0].fouls = 4;
    w.squads![1].fouls = 7;
    w.full!.clock = 0.05;
    run(w, 6, () => w.full!.period === 2 && w.full!.phase === 'remise');
    expect(w.full!.period).toBe(2);
    expect(w.squads!.map((s) => s.fouls)).toEqual([0, 0]);
    expect(w.box!.periods.map((p) => p.length)).toEqual([2, 2]);
  });

  it('6e faute : éliminé (message), il sort au ballon mort et ne revient plus', () => {
    const w = reachFoul((w) => (w.memberOf(5)!.line.pf = FOUL_OUT - 1));
    const out = w.squads![1].members.find((m) => m.line.pf === FOUL_OUT)!;
    expect(out.fouledOut).toBe(true);
    expect(w.events.some((e) => e.kind === '6 fautes' && e.by === 5)).toBe(true);
    expect(out.body).toBeNull();
    expect(w.memberOf(5)).not.toBe(out);
    // Le reste du match entre IA : il ne revient jamais.
    const ais = w.players.map((_, i) => new PlayerAi(i, new Rng(70 + i)));
    for (let t = 0; t < 120; t += WORLD_DT) {
      w.step(WORLD_DT, ais.map((ai) => ai.think(w, WORLD_DT)));
      expect(out.body).toBeNull();
    }
  });
});

describe('lancers et changements', () => {
  /** Tir de l'équipe 0 à 5 m, défenseur 5 collé : graines où la faute est sifflée et le tir voulu raté. */
  function fouledMiss(prepare: (w: MatchWorld) => void): MatchWorld[] {
    const found: MatchWorld[] = [];
    for (let seed = 1; seed <= 80 && found.length < 3; seed++) {
      const w = match(seed);
      live(w, 0, { x: rim.x - 5, y: rim.y });
      place(w, 5, { x: rim.x - 5 + 0.72, y: rim.y });
      prepare(w);
      stepWith(w, 0, { ...IDLE, jump: true });
      for (let t = 0; t < 2 && w.shot; t += WORLD_DT) stepWith(w, 0, { ...IDLE, release: w.shot.airTime + WORLD_DT >= w.players[0].timeToApex });
      if (w.lastShot?.foul?.called && !w.lastShot.wanted) found.push(w);
    }
    return found;
  }

  it('le tireur des lancers reste jusqu’au bout ; personne ne change pendant la série ; le tir raté avec faute n’est pas tenté', () => {
    const cases = fouledMiss((w) => {
      const tired = w.memberOf(0)!;
      tired.energy = 5;
      tired.line.secs = 400;
      w.squads![0].sinceSub = SUB_INTERVAL;
    });
    expect(cases.length).toBeGreaterThan(0);
    for (const w of cases) {
      const shooter = w.memberOf(0)!;
      run(w, 4, () => w.full!.phase === 'lancers');
      expect(w.full!.phase).toBe('lancers');
      expect(w.memberOf(0)).toBe(shooter);
      expect(shooter.line.fga).toBe(0);
      expect(w.memberOf(5)!.line.pf).toBe(1);
      const version = w.lineupVersion;
      w.squads!.forEach((s) => (s.sinceSub = SUB_INTERVAL));
      run(w, 2, () => w.full!.phase !== 'lancers');
      expect(w.lineupVersion).toBe(version);
    }
  });
});

describe('box score : tirs, rebonds, passes décisives', () => {
  /** Tir de `shooter` depuis `pos`, lâché au sommet ; renvoie le tir. */
  function shoot(w: MatchWorld, shooter: number): ShotRecord {
    stepWith(w, shooter, { ...IDLE, jump: true });
    for (let t = 0; t < 2 && w.shot; t += WORLD_DT) stepWith(w, shooter, { ...IDLE, release: w.shot.airTime + WORLD_DT >= w.players[shooter].timeToApex });
    return w.lastShot!;
  }

  it('tir à 3 pts marqué : 3 points, tentative et réussite ; raté : tenté, puis rebond au premier qui le prend', () => {
    let made = false;
    let missed = false;
    for (let seed = 1; seed <= 40 && !(made && missed); seed++) {
      const w = match(seed);
      live(w, 0, { x: rim.x - 7.6, y: rim.y });
      const member = w.memberOf(0)!;
      const shot = shoot(w, 0);
      run(w, 4, () => shot.live !== null || w.full!.phase !== 'jeu');
      if (shot.scored) {
        made = true;
        expect(member.line).toMatchObject({ pts: 3, fga: 1, fgm: 1, tpa: 1, tpm: 1 });
        expect(w.box!.teamPoints(0)).toBe(w.points[0]);
        expect(w.box!.periods[0][0]).toBe(3);
        expect(w.memberOf(5)!.line.plusMinus).toBe(-3);
      } else if (!missed) {
        missed = true;
        expect(member.line).toMatchObject({ pts: 0, fga: 1, fgm: 0, tpa: 1 });
        run(w, 6, () => w.holder !== null || w.full!.phase !== 'jeu');
        const rebounds = w.squads!.flatMap((s) => s.members).reduce((n, m) => n + m.line.oreb + m.line.dreb, 0);
        if (w.holder !== null && w.full!.phase === 'jeu') {
          expect(rebounds).toBe(1);
          const picker = w.memberOf(w.holder)!;
          expect(w.team[w.holder] === 0 ? picker.line.oreb : picker.line.dreb).toBe(1);
        } else {
          // Sorti sans être pris : pas de rebond.
          expect(rebounds).toBe(0);
        }
      }
    }
    expect(made && missed).toBe(true);
  });

  it('passe décisive : reçue puis tir marqué aussitôt ; pas après plus de 4 s', () => {
    for (const wait of [0, 4.5]) {
      let checked = false;
      for (let seed = 1; seed <= 60 && !checked; seed++) {
        const w = match(seed);
        live(w, 0, { x: rim.x - 6, y: rim.y - 3 });
        place(w, 1, { x: rim.x - 2.5, y: rim.y + 1.5 });
        stepWith(w, 0, { x: 1, y: 1, jump: false, pass: true });
        run(w, 2, () => w.holder === 1);
        if (w.holder !== 1) continue;
        run(w, wait);
        const shot = shoot(w, 1);
        run(w, 4, () => shot.live !== null || w.full!.phase !== 'jeu');
        if (!shot.scored) continue;
        checked = true;
        expect(w.memberOf(0)!.line.ast).toBe(wait === 0 ? 1 : 0);
        expect(w.memberOf(1)!.line.pts).toBe(2);
      }
      expect(checked).toBe(true);
    }
  });
});

describe('partie de contrôle IA contre IA (4 × 3 min, rotations complètes)', () => {
  it('rotation, minutes, bonus, box score égal au score et aux tirs du monde, match qui se termine', { timeout: 120_000 }, () => {
    const seed = 5;
    const home = matchRotation(league.teams[2], league.players);
    const away = matchRotation(league.teams[7], league.players);
    const w = new MatchWorld(court, home[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
    w.startFullCourt(home, away, 3);
    const ais = w.players.map((_, i) => new PlayerAi(i, new Rng(seed * 100 + i)));
    const shots = new Set<ShotRecord>();
    for (let t = 0; t < 1800 && w.full!.phase !== 'fin-match'; t += WORLD_DT) {
      w.step(WORLD_DT, ais.map((ai) => ai.think(w, WORLD_DT)));
      if (w.lastShot && !w.lastShot.demo) shots.add(w.lastShot);
    }
    expect(w.full!.phase).toBe('fin-match');
    const box = w.box!;
    const regulation = 4 * 3 * 60 + (w.full!.period - 4) * 75;
    for (const team of [0, 1]) {
      const members = w.squads![team].members;
      expect(box.teamPoints(team)).toBe(w.points[team]);
      expect(box.periods[team].reduce((a, b) => a + b, 0)).toBe(w.points[team]);
      // Cinq sur le terrain en permanence.
      expect(members.reduce((s, m) => s + m.line.secs, 0)).toBeCloseTo(5 * regulation, 0);
      const used = members.filter((m) => m.line.secs > 0).length;
      expect(used).toBeGreaterThanOrEqual(Math.min(8, members.length));
      const starters = members.filter((m) => m.starter);
      const share = starters.reduce((s, m) => s + m.line.secs, 0) / (5 * regulation);
      expect(share).toBeGreaterThan(0.55);
      expect(share).toBeLessThan(0.85);
      for (const m of members) expect(m.energy).toBeGreaterThan(30);
      // Pertes : une par perte du monde, de cette équipe.
      const tov = members.reduce((s, m) => s + m.line.tov, 0);
      expect(tov).toBe(w.turnovers.filter((x) => w.team[x.loser] === team).length);
    }
    // Tirs : chaque tir du monde est tenté au box score, sauf les ratés avec faute (lancers à la place).
    const lines = w.squads!.flatMap((s) => s.members.map((m) => m.line));
    const field = [...shots].filter((s) => s.kind !== 'lancer');
    const fouledMisses = field.filter((s) => s.foul?.called && !(s.scored && !s.invalid)).length;
    expect(lines.reduce((s, l) => s + l.fga, 0)).toBe(field.length - fouledMisses);
    expect(lines.reduce((s, l) => s + l.fta, 0)).toBe([...shots].filter((s) => s.kind === 'lancer').length);
    expect(lines.reduce((s, l) => s + l.ast, 0)).toBeLessThanOrEqual(lines.reduce((s, l) => s + l.fgm, 0));
    expect(lines.reduce((s, l) => s + l.oreb + l.dreb, 0)).toBeGreaterThan(20);
  });

  it('déterminisme avec la rotation', () => {
    const replay = () => {
      const w = match(9, 1);
      const ais = w.players.map((_, i) => new PlayerAi(i, new Rng(900 + i)));
      for (let t = 0; t < 60; t += WORLD_DT) w.step(WORLD_DT, ais.map((ai) => ai.think(w, WORLD_DT)));
      return JSON.stringify({ players: w.players.map((p) => [p.pos, p.athlete.id]), points: w.points, lines: w.squads!.map((s) => s.members.map((m) => m.line)) });
    };
    expect(replay()).toBe(replay());
  });
});
