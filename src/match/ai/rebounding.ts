import { reach } from '../../engine/athletics';
import { BALL_PHYSICS, stepBall } from '../physics/ball';
import type { MatchWorld } from '../world/MatchWorld';
import { freeTimeToApex } from '../world/player';

interface Sample { x: number; y: number; z: number; time: number; falling: boolean; scoring?: boolean }
const forecasts = new WeakMap<MatchWorld, { at: number; shot: object | null; samples: Sample[] }>();
const assignments = new WeakMap<MatchWorld, { shot: object | null; possession: object | null; roles: Map<number, number[]> }>();

/** Simulate the same rim, board and floor, once per 0.1 s for the entire team. */
export function reboundForecast(world: MatchWorld): Sample[] {
  const old = forecasts.get(world);
  if (old && old.shot === world.lastShot && world.clock - old.at < 0.1) return old.samples.map((s) => ({ ...s, time: s.time - (world.clock - old.at) })).filter((s) => s.time >= 0);
  const ball = { pos: { ...world.ball.pos }, vel: { ...world.ball.vel } }, samples: Sample[] = [];
  for (let i = 0; i < 240; i++) {
    const events = stepBall(ball, world.court, BALL_PHYSICS.dt);
    if (i % 4 === 0) samples.push({ ...ball.pos, time: (i + 1) * BALL_PHYSICS.dt, falling: ball.vel.z < 0 });
    if (events.some((e) => e.type === 'score')) { samples.forEach((s) => s.scoring = true); break; }
    if (events.some((e) => e.type === 'floor')) break;
  }
  forecasts.set(world, { at: world.clock, shot: world.lastShot, samples });
  return samples;
}

export function reboundRoles(world: MatchWorld, team: number): number[] {
  let saved = assignments.get(world);
  if (!saved || saved.shot !== world.lastShot || saved.possession !== world.possession) {
    saved = { shot: world.lastShot, possession: world.possession, roles: new Map() };
    assignments.set(world, saved);
  }
  const old = saved.roles.get(team);
  if (old) return old;
  const samples = reboundForecast(world), ball = samples.find((s) => s.falling && s.z < 3.1) ?? samples.at(-1) ?? world.ball.pos;
  const offense = world.possession?.team === team;
  const ranked = world.membersOf(team).map((i) => {
    const b = world.players[i], a = b.athlete.attrs;
    const distance = Math.hypot(b.pos.x - ball.x, b.pos.y - ball.y);
    const ability = offense ? a.offReb : a.defReb;
    return { i, score: distance / b.runSpeed - ability * 0.004 - b.jumpHeight * 0.1 };
  }).sort((a, b) => a.score - b.score || a.i - b.i).slice(0, world.full && !offense ? 3 : 2).map((s) => s.i);
  saved.roles.set(team, ranked);
  return ranked;
}

export function reboundAction(world: MatchWorld, index: number) {
  const body = world.players[index], r = reach(body.athlete), apexTime = freeTimeToApex(body);
  const samples = reboundForecast(world);
  if (samples.some((s) => s.scoring)) {
    const hoop = world.lastShot?.hoop === 'left' ? world.court.hoops.left : world.court.hoops.right;
    const side = body.pos.y < hoop.rim.y ? -1 : 1;
    return { target: { x: hoop.rim.x + hoop.toCourt * 2, y: hoop.rim.y + side * 1.5 }, jump: false, boxOut: true };
  }
  let best: Sample | undefined;
  for (const sample of samples) {
    if (!sample.falling || sample.z > r + body.jumpHeight - 0.05) continue;
    const distance = Math.hypot(sample.x - body.pos.x, sample.y - body.pos.y);
    if (distance > body.runSpeed * Math.max(0, sample.time - 0.08) + 0.5) continue;
    if (!body.airborne && sample.z > r - 0.15) {
      const t = sample.time, foot = Math.sqrt(2 * 9.81 * body.jumpHeight) * t - 0.5 * 9.81 * t * t;
      if (t < 0.06 || foot < 0 || sample.z > r + foot - 0.03) continue;
    }
    best = sample; break;
  }
  best ??= samples.at(-1);
  const target = best ? { x: best.x, y: best.y } : { x: world.ball.pos.x, y: world.ball.pos.y };
  const horizontal = Math.hypot(target.x - body.pos.x, target.y - body.pos.y);
  const jump = !body.airborne && !!best && best.z > r - 0.35 && horizontal < 0.65 + body.runSpeed * 0.12
    && best.time <= apexTime + 0.1 && best.time >= 0.06;
  // Establish position between an opponent and the recovery point while the ball is still high.
  let boxOut: { x: number; y: number } | null = null;
  if (!jump && best && best.time > apexTime + 0.15 && horizontal < 1.1) {
    const opponent = world.opponentsOf(index).map((i) => world.players[i]).find((b) => Math.hypot(b.pos.x - target.x, b.pos.y - target.y) < 2);
    if (opponent) {
      const dx = opponent.pos.x - target.x, dy = opponent.pos.y - target.y, d = Math.hypot(dx, dy) || 1;
      boxOut = { x: target.x + dx / d * 0.6, y: target.y + dy / d * 0.6 };
    }
  }
  return { target: boxOut ?? target, jump, boxOut: boxOut !== null };
}
