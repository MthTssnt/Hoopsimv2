import { prepareTactics, resolvePossessionTactics, type PossessionTactics, type PreparedTactics } from '../../engine/coaching/tactics';
import type { GamePlan } from '../../engine/gamePlan';
import { hashSeed, Rng } from '../../engine/rng';
import type { MatchWorld } from '../world/MatchWorld';

type Point = { x: number; y: number };
export type PlayPhase = 'transition' | 'setup' | 'screen' | 'roll' | 'read' | 'fallback';
export interface LivePlay {
  key: string; play: PossessionTactics; phase: PlayPhase; handler: number; partner: number;
  started: number; phaseAt: number; wait?: Point; spots: Record<number, Point>; screen?: Point;
  countedScreen: boolean; cutter?: number;
}
export interface LiveObservation {
  playsStarted: Record<string, number>; screenWindows: number; cutsStarted: number; fallbacks: number; switches: number;
}
export interface TacticalIntent { target?: Point; passTo?: number; mode?: 'écran' | 'coupe' | 'écartement'; zone?: 'rim' | 'mid' | 'three' }
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const observation = (): LiveObservation => ({ playsStarted: {}, screenWindows: 0, cutsStarted: 0, fallbacks: 0, switches: 0 });

/** One shared play per team/possession. Only produces intentions; never moves a body or assigns the ball. */
export class TacticalDirector {
  private plans: (PreparedTactics | undefined)[] = [];
  private states: (LivePlay | undefined)[] = [];
  private at = -Infinity;
  private seed = 0;
  private revision = [0, 0];
  private observations = [observation(), observation()];
  private marks?: { key: string; at: number; switched: number; switchedPlay?: string; map: Map<number, number> };

  reset(plans: readonly (GamePlan | undefined)[], seed: number) {
    this.plans = plans.map(p => p ? prepareTactics(structuredClone(p)) : undefined);
    this.seed = seed; this.states = []; this.at = -Infinity; this.revision = [0, 0];
    this.observations = [observation(), observation()]; this.marks = undefined;
  }
  enabled(team: number) { return !!this.plans[team]; }
  plan(team: number) { return this.plans[team]?.plan; }
  prepared(team: number) { return this.plans[team]; }
  setPlan(team: number, plan: GamePlan) {
    this.plans[team] = prepareTactics(structuredClone(plan)); this.revision[team]++;
    this.states[team] = undefined; this.at = -Infinity; this.marks = undefined;
  }
  summary(team: number): LiveObservation { return structuredClone(this.observations[team]); }
  peek(team: number): LivePlay | undefined { return structuredClone(this.states[team]); }
  inspect(world: MatchWorld, team: number): LivePlay | undefined { this.update(world); return this.states[team]; }
  private point(world: MatchWorld, team: number, out: number, side: number): Point {
    const hoop = world.attackHoop(team);
    return { x: clamp(hoop.rim.x + hoop.toCourt * out, 0.6, world.court.length - 0.6), y: clamp(hoop.rim.y + side, 0.6, world.court.width - 0.6) };
  }
  private openness(world: MatchWorld, index: number) {
    return Math.min(...world.opponentsOf(index).map(i => dist(world.players[index].pos, world.players[i].pos)));
  }
  private movePhase(world: MatchWorld, team: number, phase: PlayPhase) {
    const state = this.states[team]!;
    if (state.phase === phase) return;
    state.phase = phase; state.phaseAt = world.clock;
    if (phase === 'fallback') this.observations[team].fallbacks++;
    if (phase === 'roll') this.observations[team].cutsStarted++;
  }
  private makePlay(world: MatchWorld, team: number, key: string): LivePlay | undefined {
    const members = world.lineup[team];
    const holder = world.holder ?? world.pass?.passer;
    if (holder === undefined || !members.includes(holder) || members.length !== 5) return;
    const players = members.map(i => world.players[i].athlete);
    const other = world.lineup[1 - team].map(i => world.players[i].athlete);
    const play = resolvePossessionTactics(this.plans[team]!, this.plans[1 - team] ?? prepareTactics(), players, other, new Rng(hashSeed(`${this.seed}:${team}:${key}`)));
    const handler = holder;
    const bySize = members.filter(i => i !== handler).sort((a, b) => world.players[b].athlete.heightCm - world.players[a].athlete.heightCm || a - b);
    const partner = bySize.find(i => ['rollMan', 'postScorer'].includes(this.plan(team)?.rolesByPlayerId[world.players[i].athlete.id] ?? '')) ?? bySize[0];
    const slots = [handler, ...members.filter(i => i !== handler)];
    const spots: Record<number, Point> = {};
    // Rim-relative metres, mirrored automatically at halftime, never screen pixels.
    const arc = world.court.threeArc + 0.55;
    [0, -0.67, 0.67, -1.32, 1.32].forEach((angle, k) => {
      spots[slots[k]] = this.point(world, team, Math.cos(angle) * arc, Math.sin(angle) * arc);
    });
    if (play.playId === 'horns') {
      spots[partner] = this.point(world, team, 4.8, -2.25);
      spots[bySize[1]] = this.point(world, team, 4.8, 2.25);
      const wings = members.filter(i => ![handler, partner, bySize[1]].includes(i));
      wings.forEach((i, k) => { spots[i] = this.point(world, team, 1.8, (k ? 1 : -1) * (world.court.threeCorner + 0.3)); });
    }
    if (play.playId === 'default') { spots[partner] = this.point(world, team, 1.8, 1.7); spots[bySize[1]] = this.point(world, team, 4.8, -2.3); }
    if (play.playId === 'postEntry') spots[partner] = this.point(world, team, 2, -1.8);
    if (play.playId === 'highPickRoll') spots[partner] = this.point(world, team, 5.7, -1.6);
    const state: LivePlay = { key, play, handler, partner, spots, phase: world.full!.frontcourt ? 'setup' : 'transition', started: world.clock, phaseAt: world.clock, countedScreen: false };
    this.observations[team].playsStarted[play.playId] = (this.observations[team].playsStarted[play.playId] ?? 0) + 1;
    return state;
  }
  private update(world: MatchWorld) {
    if (this.at === world.clock) return;
    this.at = world.clock;
    const full = world.full;
    if (!full || full.phase !== 'jeu' || !world.possession) return;
    const team = world.possession.team;
    if (!this.enabled(team)) return;
    const key = `${full.period}:${world.possession.since}:${world.lineupVersion}:${this.revision[team]}`;
    let s = this.states[team];
    if (!s || s.key !== key) { s = this.makePlay(world, team, key); this.states[team] = s; }
    if (!s) return;
    if (Math.min(full.shotClock, full.clock) <= 6 || (world.holder === null && !world.pass) || world.shot) {
      this.movePhase(world, team, 'fallback'); return;
    }
    if (s.phase === 'transition') {
      if (!full.frontcourt) return;
      s.started = world.clock; this.movePhase(world, team, 'setup');
    }
    if (world.clock - s.started > 9) { this.movePhase(world, team, 'fallback'); return; }
    const age = world.clock - s.phaseAt;
    if (s.phase === 'setup' && (age > 2.2 || Object.entries(s.spots).filter(([i, p]) => dist(world.players[Number(i)].pos, p) < 1.5).length >= 3)) {
      if (s.play.playId === 'horns' || s.play.playId === 'highPickRoll') {
        const hp = world.players[s.handler].pos;
        const defender = [...world.opponentsOf(s.handler)].sort((a, b) => dist(world.players[a].pos, hp) - dist(world.players[b].pos, hp))[0];
        const dp = world.players[defender].pos;
        const side = hp.y < world.court.width / 2 ? -1 : 1;
        s.screen = { x: clamp(dp.x, 0.8, world.court.length - 0.8), y: clamp(dp.y + side * 1.0, 0.8, world.court.width - 0.8) };
        s.wait = { x: hp.x, y: hp.y };
        this.movePhase(world, team, 'screen');
      } else {
        this.movePhase(world, team, 'read');
        if (this.plans[team]?.offense === 'motion' || s.play.playId === 'fiveOut') {
          s.cutter = world.teammatesOf(s.handler).find(i => this.openness(world, i) > 2.5 && !world.players[i].airborne);
          if (s.cutter !== undefined) this.observations[team].cutsStarted++;
        }
      }
    }
    if (s.phase === 'screen') {
      const screenAge = world.clock - s.phaseAt;
      const partner = world.players[s.partner];
      const planted = !partner.airborne && Math.hypot(partner.vel.x, partner.vel.y) < 0.5 && dist(partner.pos, s.screen!) < 0.65;
      const contact = world.opponentsOf(s.partner).some(i => dist(world.players[i].pos, partner.pos) < 1.1);
      if (planted && contact && !s.countedScreen) { s.countedScreen = true; this.observations[team].screenWindows++; }
      if ((s.countedScreen && screenAge > 1) || (planted && screenAge > 1.5) || screenAge > 3.5 || world.holder !== s.handler && world.holder !== null) this.movePhase(world, team, 'roll');
    }
    if (s.phase === 'roll' && world.clock - s.phaseAt > 2.2) this.movePhase(world, team, 'read');
  }
  shotWeights(world: MatchWorld, index: number) {
    this.update(world);
    const team = world.team[index], s = this.states[team];
    return s?.play.zoneWeights ?? { rim: 1, mid: 1, three: 1 };
  }
  passFactor(world: MatchWorld, index: number) { this.update(world); return this.states[world.team[index]]?.play.passFactor ?? 1; }
  intent(world: MatchWorld, index: number): TacticalIntent {
    this.update(world);
    const team = world.team[index], s = this.states[team];
    if (!world.full || world.full.phase !== 'jeu' || world.possession?.team !== team || !s || s.phase === 'fallback' || world.shot || world.pass) return {};
    const holding = world.holder === index;
    const hoop = world.attackHoop(team);
    if (holding) {
      // An obvious shot/finish, user improvisation and the clock always take priority over the script.
      if (s.play.playId === 'postEntry' && index === s.partner) {
        const kick = world.teammatesOf(index).find(i => this.openness(world, i) > 2.5 && dist(world.players[index].pos, world.players[i].pos) < 10);
        return this.openness(world, index) < 1.2 && kick !== undefined ? { passTo: kick } : { zone: 'rim' };
      }
      if (this.openness(world, index) > 2.5 || dist(world.players[index].pos, hoop.rim) < 3 || s.phase === 'transition') return {};
      if (s.play.playId === 'postEntry') {
        if (index !== s.partner && this.openness(world, s.partner) > 1.15 && dist(world.players[index].pos, world.players[s.partner].pos) < 10) return { passTo: s.partner };
        if (index === s.partner) return { zone: 'rim' };
      }
      if (s.play.playId === 'isolation') {
        const leader = world.lineup[team].find(i => this.plan(team)?.rolesByPlayerId[world.players[i].athlete.id] === 'primaryCreator') ?? [...world.lineup[team]].sort((a, b) => s.play.usageByPlayerId[world.players[b].athlete.id] - s.play.usageByPlayerId[world.players[a].athlete.id])[0];
        if (leader !== undefined && leader !== index && this.openness(world, leader) > 1.5) return { passTo: leader };
        return {};
      }
      if (index === s.handler && s.screen && (s.phase === 'screen' || s.phase === 'roll')) {
        if (s.phase === 'roll' && this.openness(world, s.partner) > 1.2 && dist(world.players[index].pos, world.players[s.partner].pos) < 10) return { passTo: s.partner };
        if (s.phase === 'screen' && dist(world.players[s.partner].pos, s.screen) > 0.7 && world.clock - s.phaseAt < 2.5) return { target: s.wait };
        const side = s.screen.y < hoop.rim.y ? -1 : 1;
        return { target: { x: s.screen.x - hoop.toCourt * 1.3, y: clamp(s.screen.y + side * 1.5, 0.8, world.court.width - 0.8) } };
      }
      return {};
    }
    if (index === s.partner && s.screen && (s.phase === 'screen' || s.phase === 'roll')) return {
      mode: s.phase === 'screen' ? 'écran' : 'coupe', target: s.phase === 'screen' ? s.screen : this.point(world, team, 1.3, -0.8),
    };
    if (s.cutter === index && s.phase === 'read' && world.clock - s.phaseAt < 1.5) return { mode: 'coupe', target: this.point(world, team, 1.5, 0.7) };
    return { mode: 'écartement', target: s.spots[index] };
  }
  /** Real responsibility exchange only near a planted screen, never a universal automatic switch. */
  defensiveMarks(world: MatchWorld, base: Map<number, number>): Map<number, number> {
    this.update(world);
    const attacking = world.possession?.team;
    if (attacking === undefined) return base;
    const defending = 1 - attacking;
    if (!this.enabled(defending)) return base;
    const key = `${world.full?.period}:${world.possession?.since}:${world.lineupVersion}:${this.revision.join('-')}`;
    if (!this.marks || this.marks.key !== key) this.marks = { key, at: -Infinity, switched: -Infinity, map: new Map(base) };
    const state = this.marks;
    if (world.clock - state.at < 0.15) return state.map;
    state.at = world.clock;
    const play = this.states[attacking];
    if (this.plans[defending]?.defense !== 'switch' || !play?.screen || play.phase !== 'screen' || state.switchedPlay === play.key || world.clock - state.switched < 1.2) return state.map;
    const primary = state.map.get(play.handler), helper = state.map.get(play.partner), screener = world.players[play.partner];
    if (primary === undefined || helper === undefined || screener.airborne || Math.hypot(screener.vel.x, screener.vel.y) > 0.5 || dist(screener.pos, play.screen) > 0.7 || dist(screener.pos, world.players[primary].pos) > 1.3) return state.map;
    state.map.set(play.handler, helper); state.map.set(helper, play.handler);
    state.map.set(play.partner, primary); state.map.set(primary, play.partner);
    state.switched = world.clock; state.switchedPlay = play.key; this.observations[defending].switches++;
    return state.map;
  }
  guardGap(team: number) { return clamp(1.1 - ((this.plan(team)?.defensivePressure ?? 50) - 50) / 100, 0.65, 1.6); }
  defensiveTarget(world: MatchWorld, index: number, mark: number, ordinary: Point): Point {
    const team = world.team[index], p = this.plan(team);
    if (!p || !world.full?.frontcourt || world.full.phase !== 'jeu' || world.shot) return ordinary;
    const attacking = 1 - team, state = this.states[attacking];
    if (p.defense === 'drop' && state?.partner === mark && ['screen', 'roll'].includes(state.phase)) return this.point(world, attacking, 2.7, clamp(world.players[mark].pos.y - world.court.width / 2, -1.8, 1.8));
    if (world.holder === mark) return ordinary;
    const hoop = world.defendHoop(team), help = (p.defensiveHelp - 50) / 250;
    return { x: ordinary.x + (hoop.rim.x - ordinary.x) * help, y: ordinary.y + (hoop.rim.y - ordinary.y) * help };
  }
}
