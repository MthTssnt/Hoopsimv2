import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../engine';
import { Rng } from '../../engine/rng';
import { gmMatchSetup, worldGamePlans, worldRotations } from '../gameResult';
import { assignMarks, PlayerAi } from '../ai/playerAi';
import { makeCourt } from '../physics/court';
import { MatchWorld, WORLD_DT } from '../world/MatchWorld';
import type { PlayId } from '../../engine/coaching/tactics';

function fixture(playId: PlayId = 'horns', defense: 'man' | 'switch' | 'drop' = 'man') {
  const league = createNewGame('bos', 31), game = league.schedule.find(g => g.homeId === 'bos' || g.awayId === 'bos')!;
  const setup = gmMatchSetup(league, game, 'regarder');
  const plans = worldGamePlans(setup);
  plans[0]!.playbook = [{ playId, weight: 1 }]; plans[1]!.defense = defense;
  const [mine, theirs] = worldRotations(setup);
  const w = new MatchWorld(makeCourt('pro'), mine[0], { x: 0, y: 0, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(31));
  w.autoRestart = false; w.startFullCourt(mine, theirs, 1, plans);
  w.clock = 10; w.full!.phase = 'jeu'; w.full!.frontcourt = true; w.full!.clock = 55; w.full!.tip = null;
  w.possession = { team: 0, since: 10 }; w.holder = w.lineup[0][0];
  const initial = w.tactics.inspect(w, 0)!;
  for (const [index, p] of Object.entries(initial.spots)) {
    const i = Number(index); Object.assign(w.players[i].pos, p); Object.assign(w.players[i].vel, { x: 0, y: 0, z: 0 });
    const opposite = w.lineup[1][w.lineup[0].indexOf(i)];
    Object.assign(w.players[opposite].pos, { x: p.x - w.attackHoop(0).toCourt * 1.1, y: p.y, z: 0 });
  }
  return { w, plans, setup };
}
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('interprétation spatiale du playbook', () => {
  it('distingue Five-Out et Horns, respecte le terrain et se reflète à la mi-temps', () => {
    for (const playId of ['fiveOut', 'horns', 'highPickRoll', 'postEntry', 'isolation'] as const) {
      const { w } = fixture(playId);
      const a = structuredClone(w.tactics.inspect(w, 0)!);
      expect(a.play.playId).toBe(playId);
      expect(Object.keys(a.spots)).toHaveLength(5);
      expect(Object.values(a.spots).every(p => p.x > 0 && p.x < w.court.length && p.y > 0 && p.y < w.court.width)).toBe(true);
      const radii = Object.values(a.spots).map(p => distance(p, w.attackHoop(0).rim));
      if (playId === 'fiveOut') expect(Math.min(...radii)).toBeGreaterThan(w.court.threeArc);
      if (playId === 'horns') expect(radii.filter(r => r < 6)).toHaveLength(2);
      w.full!.period = 3; w.clock += 0.1;
      const b = w.tactics.inspect(w, 0)!;
      for (const i of Object.keys(a.spots).map(Number)) {
        expect(a.spots[i].x + b.spots[i].x).toBeCloseTo(w.court.length, 6);
        expect(a.spots[i].y).toBeCloseTo(b.spots[i].y, 6);
      }
    }
  });
  it('partage une seule séquence, conserve les rôles après une passe, coupe après un écran planté', () => {
    const { w } = fixture('highPickRoll');
    const first = w.tactics.inspect(w, 0)!;
    w.clock += 0.1; const screen = w.tactics.inspect(w, 0)!;
    expect(screen.phase).toBe('screen');
    Object.assign(w.players[screen.partner].pos, screen.screen);
    const opponent = assignMarks(w).get(screen.handler)!;
    Object.assign(w.players[opponent].pos, { x: screen.screen!.x, y: screen.screen!.y + 0.6 });
    w.clock += 0.2;
    for (const i of w.lineup[0]) w.tactics.intent(w, i);
    expect(w.tactics.summary(0).screenWindows).toBe(1);
    expect(w.tactics.summary(0).playsStarted.highPickRoll).toBe(1);
    w.clock += 1.1;
    expect(w.tactics.inspect(w, 0)!.phase).toBe('roll');
    expect(w.tactics.intent(w, screen.partner).mode).toBe('coupe');
    w.holder = screen.partner; w.clock += 0.1;
    expect(w.tactics.inspect(w, 0)!.key).toBe(first.key);
  });
  it('abandonne aux faibles chronos, ballon libre et changement de cinq sans écrire une position', () => {
    const { w } = fixture();
    const before = w.players.map(p => ({ ...p.pos }));
    w.full!.shotClock = 5;
    w.clock += 0.1;
    for (const i of w.lineup[0]) expect(w.tactics.intent(w, i)).toEqual({});
    expect(w.tactics.inspect(w, 0)!.phase).toBe('fallback');
    expect(w.players.map(p => p.pos)).toEqual(before);
    w.full!.shotClock = 24; w.lineupVersion++; w.clock += 0.1;
    expect(w.tactics.inspect(w, 0)!.phase).not.toBe('fallback');
    w.holder = null; w.pass = null; w.clock += 0.1;
    expect(w.tactics.inspect(w, 0)!.phase).toBe('fallback');
  });
  it('les dix IA produisent de vraies entrées bornées et aucun déplacement instantané', () => {
    const { w } = fixture('horns');
    const ais = w.players.map((_, i) => new PlayerAi(i, new Rng(100 + i)));
    for (let n = 0; n < 240; n++) {
      const before = w.players.map(p => ({ ...p.pos }));
      const inputs = ais.map(ai => ai.think(w, WORLD_DT));
      expect(inputs.every(i => Number.isFinite(i.x) && Number.isFinite(i.y) && Math.hypot(i.x, i.y) <= 1.001)).toBe(true);
      w.step(WORLD_DT, inputs);
      if (w.full!.phase === 'jeu') for (let i = 0; i < 10; i++) expect(distance(before[i], w.players[i].pos)).toBeLessThan(0.5);
    }
  });
});

describe('politiques défensives physiques', () => {
  it('switch permute les responsabilités seulement près d’un écran stationnaire ; man garde ses duels', () => {
    for (const defense of ['man', 'switch'] as const) {
      const { w } = fixture('highPickRoll', defense); w.clock += 0.1;
      const s = w.tactics.inspect(w, 0)!;
      Object.assign(w.players[s.partner].pos, s.screen);
      const base = assignMarks(w), defender = base.get(s.handler)!;
      Object.assign(w.players[defender].pos, { x: s.screen!.x, y: s.screen!.y + 0.6 });
      const marks = w.tactics.defensiveMarks(w, base);
      expect(new Set(marks.values()).size).toBe(10);
      expect(marks.get(s.handler) === defender).toBe(defense === 'man');
      for (const [a, b] of marks) expect(marks.get(b)).toBe(a);
      expect(w.tactics.summary(1).switches).toBe(defense === 'switch' ? 1 : 0);
    }
  });
  it('drop fait protéger la peinture au défenseur du screener, aide et pression ont des cibles distinctes', () => {
    const { w } = fixture('highPickRoll', 'drop'); w.clock += 0.1;
    const s = w.tactics.inspect(w, 0)!, defender = assignMarks(w).get(s.partner)!;
    const ordinary = { x: 14, y: 7 };
    const drop = w.tactics.defensiveTarget(w, defender, s.partner, ordinary);
    expect(distance(drop, w.attackHoop(0).rim)).toBeLessThan(4);
    const plan = w.getGamePlan(1)!;
    w.tactics.setPlan(1, { ...plan, defensivePressure: 100 });
    expect(w.tactics.guardGap(1)).toBeLessThan(1.1);
    w.tactics.setPlan(1, { ...plan, defense: 'man', defensiveHelp: 100 });
    const help = w.tactics.defensiveTarget(w, defender, s.partner, ordinary);
    expect(distance(help, w.defendHoop(1).rim)).toBeLessThan(distance(ordinary, w.defendHoop(1).rim));
  });
});

describe('commandes coach sûres', () => {
  it('ne conserve pas les tactiques d’un ancien match dans un nouveau demi-terrain', () => {
    const { w } = fixture('horns');
    const home = w.players[0].athlete, away = w.players[5].athlete;
    w.startTeams([home], [away]);
    expect(w.full).toBeNull(); expect(w.tactics.enabled(0)).toBe(false);
    expect(w.tactics.peek(0)).toBeUndefined();
    expect(w.coachingEvents).toEqual([]);
  });

  it('diffère réellement le plan pendant un tir et préserve le ballon à la réception de la commande', () => {
    const { w } = fixture('fiveOut'), plan = w.getGamePlan(0)!;
    const holder = w.holder!, idle = () => w.players.map(() => ({ x: 0, y: 0, jump: false }));
    const inputs = idle(); inputs[holder].jump = true; w.step(WORLD_DT, inputs);
    expect(w.shot).not.toBeNull();
    const shot = w.shot, ball = JSON.stringify(w.ball), points = [...w.points], controlled = w.controlled;
    expect(w.requestCoachingPlan(0, { ...plan, offense: 'isolation' })).toEqual([]);
    expect(JSON.stringify(w.ball)).toBe(ball); expect(w.shot).toBe(shot); expect(w.controlled).toBe(controlled);
    w.step(WORLD_DT, idle());
    expect(w.getGamePlan(0)!.offense).toBe(plan.offense);
    expect(w.points).toEqual(points);
    for (let n = 0; n < 1500 && !w.coachingEvents.some(e => e.status === 'applied'); n++) w.step(WORLD_DT, idle());
    expect(w.getGamePlan(0)!.offense).toBe('isolation');
    expect(w.coachingEvents.filter(e => e.kind === 'plan').map(e => e.status)).toEqual(['queued', 'applied']);
  });
  it('diffère les consignes pendant une passe réelle, sans réassigner son receveur', () => {
    const { w } = fixture('fiveOut'), holder = w.holder!, receiver = w.lineup[0][1];
    const idle = () => w.players.map(() => ({ x: 0, y: 0, jump: false }));
    const input = idle().map(i => ({ ...i, pass: false, receiver: undefined as number | undefined }));
    input[holder] = { x: 0, y: 1, jump: false, pass: true, receiver };
    w.step(WORLD_DT, input); expect(w.pass).not.toBeNull();
    const pass = w.pass, oldPlan = w.getGamePlan(0)!;
    expect(w.requestCoachingPlan(0, { ...oldPlan, pace: 90 })).toEqual([]);
    expect(w.pass).toBe(pass); expect(w.pass!.receiver).toBe(receiver);
    w.step(WORLD_DT, idle()); expect(w.getGamePlan(0)!.pace).toBe(oldPlan.pace);
  });
  it('conserve le cinq pendant les lancers et applique la demande après la série', () => {
    const { w } = fixture(), ids = w.squads![0].members.slice(5, 10).map(m => m.id);
    const before = w.lineup[0].map(i => w.memberOf(i)!.id);
    w.full!.phase = 'mort'; w.full!.pause = 1;
    w.full!.freeThrows = { shooter: w.holder!, team: 0, total: 2, taken: 0, made: 0, aim: null, flying: false, pause: 0 };
    expect(w.requestCoachingFive(0, ids)).toEqual([]);
    const idle = w.players.map(() => ({ x: 0, y: 0, jump: false }));
    w.step(WORLD_DT, idle); expect(w.lineup[0].map(i => w.memberOf(i)!.id)).toEqual(before);
    w.full!.freeThrows = null; w.step(WORLD_DT, idle);
    expect(w.lineup[0].map(i => w.memberOf(i)!.id)).toEqual(ids);
  });
  it('applique le cinq seulement à l’arrêt légal, sans modifier le tir ou l’identité du porteur en jeu', () => {
    const { w } = fixture();
    const ids = w.squads![0].members.slice(5, 10).map(m => m.id);
    const before = w.lineup[0].map(i => w.memberOf(i)!.id);
    expect(w.requestCoachingFive(0, ids)).toEqual([]);
    w.step(WORLD_DT, w.players.map(() => ({ x: 0, y: 0, jump: false })));
    expect(w.lineup[0].map(i => w.memberOf(i)!.id)).toEqual(before);
    w.full!.phase = 'mort'; w.full!.pause = 1;
    w.step(WORLD_DT, w.players.map(() => ({ x: 0, y: 0, jump: false })));
    expect(w.lineup[0].map(i => w.memberOf(i)!.id)).toEqual(ids);
    expect(w.coachingEvents.at(-1)!.status).toBe('applied');
  });
  it('rejette doublons, adversaires, éliminés et plan invalide sans mutation partielle', () => {
    const { w } = fixture();
    const ids = w.squads![0].members.slice(5, 10).map(m => m.id);
    expect(w.requestCoachingFive(0, [ids[0], ids[0], ...ids.slice(2)]).length).toBeGreaterThan(0);
    w.squads![0].members[5].fouledOut = true;
    expect(w.requestCoachingFive(0, ids).length).toBeGreaterThan(0);
    expect(w.requestCoachingFive(0, w.squads![1].members.slice(0, 5).map(m => m.id)).length).toBeGreaterThan(0);
    expect(w.requestCoachingPlan(0, { ...w.getGamePlan(0)!, pace: NaN }).length).toBeGreaterThan(0);
    expect(w.coachingEvents).toEqual([]);
  });
});
