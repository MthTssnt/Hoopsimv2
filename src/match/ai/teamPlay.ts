import { hashSeed } from '../../engine/rng';
import type { MatchWorld } from '../world/MatchWorld';

type Point = { x: number; y: number };
export type Endgame = 'normal' | 'hold' | 'quick-two' | 'need-three' | 'foul';
export function endgameStrategy(world: MatchWorld, team: number, defending = false): Endgame {
  const full = world.full;
  if (!full || full.period < 4 || full.clock > 35) return 'normal';
  const margin = world.points[team] - world.points[1 - team];
  if (defending) return margin < 0 && margin >= -9 && full.clock < 22 && full.clock > 2 ? 'foul' : 'normal';
  if (margin > 0 && full.clock > 3 && full.shotClock > Math.min(6, full.clock)) return 'hold';
  if (margin <= -3 && full.clock <= 20) return 'need-three';
  if (margin < 0) return 'quick-two';
  return 'normal';
}

export interface TeamSequence {
  key: string; kind: 'give-go' | 'pick-roll' | 'handoff'; handler: number; partner: number;
  start: number; screen: Point; phase: 'setup' | 'screen' | 'roll' | 'cut' | 'done';
}
const sequences = new WeakMap<MatchWorld, Map<number, TeamSequence>>();
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const open = (world: MatchWorld, i: number) => Math.min(...world.opponentsOf(i).map((j) => distance(world.players[i].pos, world.players[j].pos)));

export function teamSequence(world: MatchWorld, team: number): TeamSequence | null {
  if (!world.full || !world.possession || world.possession.team !== team || !world.full.frontcourt || world.full.phase !== 'jeu' || world.membersOf(team).length < 3) return null;
  let teams = sequences.get(world);
  if (!teams) { teams = new Map(); sequences.set(world, teams); }
  const key = `${world.possession.since}:${world.lineupVersion}:${world.full.period}`;
  let plan = teams.get(team);
  if (!plan || plan.key !== key) {
    if (world.holder === null || world.team[world.holder] !== team) return null;
    const handler = world.holder;
    const candidates = world.teammatesOf(handler);
    const kind = (['give-go', 'pick-roll', 'handoff'] as const)[hashSeed(key + team) % 3];
    const partner = [...candidates].sort((a, b) => kind === 'pick-roll'
      ? world.players[b].athlete.heightCm - world.players[a].athlete.heightCm
      : distance(world.players[a].pos, world.players[handler].pos) - distance(world.players[b].pos, world.players[handler].pos))[0];
    const me = world.players[handler].pos, hoop = world.attackHoop(team);
    const defender = world.opponentsOf(handler).map((i) => world.players[i].pos).sort((a, b) => distance(a, me) - distance(b, me))[0];
    plan = { key, kind, handler, partner, start: world.clock,
      screen: { x: defender.x + hoop.toCourt * 0.2, y: defender.y + (me.y < hoop.rim.y ? -0.4 : 0.4) }, phase: 'setup' };
    teams.set(team, plan);
  }
  const age = world.clock - plan.start;
  if (age > 5 || world.full.shotClock < 7 || world.holder === null && !world.pass) plan.phase = 'done';
  if (plan.kind === 'pick-roll' && plan.phase !== 'done') {
    if (distance(world.players[plan.partner].pos, plan.screen) < 0.55) plan.phase = 'screen';
    if (age > 2 && plan.phase === 'screen' || age > 3.2) plan.phase = 'roll';
  }
  if (world.holder !== plan.handler && world.holder !== null && plan.phase !== 'done') plan.phase = 'cut';
  return plan;
}

/** Roles persist through a pass. A bounded sequence falls back to ordinary spacing on failure. */
export function sequenceIntent(world: MatchWorld, index: number): { target?: Point; passTo?: number; mode?: 'écran' | 'coupe' | 'main-à-main' } {
  const plan = teamSequence(world, world.team[index]);
  if (!plan || plan.phase === 'done' || endgameStrategy(world, world.team[index]) !== 'normal') return {};
  const hoop = world.attackHoop(world.team[index]), me = world.players[index].pos;
  const handler = world.players[plan.handler].pos, partner = world.players[plan.partner].pos;
  const age = world.clock - plan.start, side = plan.screen.y < hoop.rim.y ? -1 : 1;
  if (plan.kind === 'pick-roll') {
    if (index === plan.partner && world.holder !== index) return { mode: plan.phase === 'roll' ? 'coupe' : 'écran',
      target: plan.phase === 'roll' ? { x: hoop.rim.x + hoop.toCourt * 1.2, y: hoop.rim.y + side * 0.8 } : plan.screen };
    if (index === plan.handler && world.holder === index) {
      if (plan.phase === 'roll' && distance(me, partner) < 9 && open(world, plan.partner) > 1.1) return { passTo: plan.partner };
      if (age < 3.2) return { target: { x: plan.screen.x - hoop.toCourt * 1.5, y: plan.screen.y - side * 1.3 } };
    }
  } else if (plan.kind === 'give-go') {
    if (index === plan.handler && world.holder === index && plan.phase === 'setup' && age > 0.65 && age < 2 && open(world, plan.partner) > 1) return { passTo: plan.partner };
    if (index === plan.handler && world.holder !== index) return { mode: 'coupe', target: { x: hoop.rim.x + hoop.toCourt * 1.1, y: hoop.rim.y - side * 0.8 } };
    if (index === plan.partner && world.holder === index && distance(handler, hoop.rim) < 4 && open(world, plan.handler) > 1.1) return { passTo: plan.handler };
  } else {
    if (index === plan.partner && plan.phase !== 'cut' && world.holder !== index) return { mode: 'main-à-main', target: { x: handler.x, y: handler.y - side * 1.1 } };
    if (index === plan.handler && world.holder === index && distance(handler, partner) < 1.6 && age > 0.5) return { passTo: plan.partner };
    if (index === plan.handler && plan.phase === 'cut') return { mode: 'écran', target: plan.screen };
  }
  return {};
}

const defenses = new WeakMap<MatchWorld, { key: string; at: number; switched: number; marks: Map<number, number> }>();
/** A beaten defender trades responsibilities with the helper, with a cooldown against oscillation. */
export function coordinatedMarks(world: MatchWorld, base: Map<number, number>): Map<number, number> {
  if (!world.full) return base;
  const key = `${world.possession?.since}:${world.lineupVersion}:${world.full.period}`;
  let state = defenses.get(world);
  if (!state || state.key !== key) { state = { key, at: -Infinity, switched: -Infinity, marks: base }; defenses.set(world, state); }
  if (world.clock - state.at < 0.2) return state.marks;
  state.at = world.clock;
  const holder = world.holder;
  if (holder === null || world.full.phase !== 'jeu' || world.clock - state.switched < 1.2) return state.marks;
  const primary = state.marks.get(holder);
  if (primary === undefined) return state.marks;
  const hp = world.players[holder].pos, primaryDistance = distance(world.players[primary].pos, hp);
  if (primaryDistance < 2.4) return state.marks;
  const helper = world.opponentsOf(holder).filter((i) => i !== primary).sort((a, b) => distance(world.players[a].pos, hp) - distance(world.players[b].pos, hp))[0];
  if (helper === undefined || distance(world.players[helper].pos, hp) > primaryDistance - 1) return state.marks;
  const covered = state.marks.get(helper);
  if (covered === undefined) return state.marks;
  state.marks.set(holder, helper); state.marks.set(helper, holder);
  state.marks.set(covered, primary); state.marks.set(primary, covered);
  state.switched = world.clock;
  return state.marks;
}
