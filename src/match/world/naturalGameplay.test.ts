import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../engine';
import { Rng } from '../../engine/rng';
import { shotProbability } from '../../engine/shot';
import { reach } from '../../engine/athletics';
import { endgameStrategy, coordinatedMarks, teamSequence, sequenceIntent } from '../ai/teamPlay';
import { spriteStateFor } from '../render/playerView';
import { assignMarks, spacingSpots } from '../ai/playerAi';
import { reboundAction } from '../ai/rebounding';
import { navigate } from '../ai/navigation';
import { makeCourt } from '../physics/court';
import { BallControlRig, catchable } from './ballControl';
import { bodyRadius, resolveBodies } from './bodyContacts';
import { armContact, bodyContact, inGoaltendZone } from './defense';
import { MatchWorld, WORLD_DT, type ShotSettings } from './MatchWorld';
import { stepPlayer } from './player';

const players = Object.values(createNewGame('bos', 8126).players), court = makeCourt('pro');
const idle = { x: 0, y: 0, jump: false };
function fixture(full = false, seed = 81) {
  const w = new MatchWorld(court, players[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(seed));
  if (full) { w.startFullCourt(players.slice(0, 5), players.slice(14, 19), 3); w.full!.phase = 'jeu'; w.full!.frontcourt = true; }
  else { w.startTeams(players.slice(0, 2), players.slice(14, 16)); w.rules = null; }
  w.autoRestart = false;
  w.players.forEach((b, i) => { b.pos = { x: 2 + i * 2.4, y: 13, z: 0 }; b.vel = { x: 0, y: 0, z: 0 }; });
  w.holder = 0;
  return w;
}

describe('natural gameplay: ball and movement regressions', () => {
  it('G06: penalizes 24 m shots without changing the 8 m baseline', () => {
    const ctx = { shooter: players[0], zone: 'three' as const, kind: 'jump' as const, mode: 'timing' as const, speed: 'normal' as const, timingError: 0, contest: null, moveSpeed: 0 };
    expect(shotProbability({ ...ctx, distance: 8 })).toBe(shotProbability(ctx));
    expect(shotProbability({ ...ctx, distance: 24 })).toBeLessThan(shotProbability({ ...ctx, distance: 8 }) / 50);
  });
  it('G16: a closer defender behind cannot hide a stronger front contest', () => {
    const w = fixture(); w.players[0].pos = { x: 19, y: 7.62, z: 0 };
    w.players[2].pos = { x: 18.3, y: 7.62, z: 0 }; w.players[3].pos = { x: 20, y: 7.62, z: 0 };
    expect(w.contestFor(0, court.hoops.right)).toMatchObject({ distance: 1, facing: 1 });
  });
  it('G02: rejects excessive receiving speed and catches below airborne feet', () => {
    const b = fixture().players[0], r = reach(b.athlete);
    expect(catchable(b, { pos: { ...b.pos, z: 1.3 }, vel: { x: -30, y: 0, z: 0 } }, r, true)).toBe(false);
    b.airborne = true; b.pos.z = 1;
    expect(catchable(b, { pos: { ...b.pos, z: 0.2 }, vel: { x: 0, y: 0, z: -1 } }, r, false)).toBe(false);
  });
  it('G02/G26: acquiring a high ball does not teleport it to dribble height', () => {
    const w = fixture(); w.holder = null; const b = w.players[0]; b.pos = { x: 10, y: 7, z: 0 };
    w.ball = { pos: { x: 10.4, y: 7, z: 2.4 }, vel: { x: 0, y: 0, z: -1 } };
    w.step(WORLD_DT, []); expect(w.holder).toBe(0); const z = w.ball.pos.z;
    w.step(WORLD_DT, []); expect(Math.abs(w.ball.pos.z - z)).toBeLessThan(0.05);
    expect(w.gestures.clocks[0].catching).toBe(true);
  });
  it('G11: shooter cooldown does not prevent an opponent from taking a reachable ball', () => {
    const w = fixture(); const b = w.players[2]; b.pos = { x: 12, y: 7, z: 0 }; w.holder = null;
    w.ball = { pos: { x: 12, y: 7, z: 1.3 }, vel: { x: 0, y: 0, z: -1 } };
    const access = w as unknown as { cooldown: number; pickupLocked: number };
    access.cooldown = 0.4; access.pickupLocked = 0;
    w.step(WORLD_DT, []); expect(w.holder).toBe(2);
  });
  it('G10: a full-speed reversal brakes before changing facing', () => {
    const b = fixture().players[0]; b.vel.x = 6; b.facing = 1;
    stepPlayer(b, { x: -1, y: 0, jump: false }, WORLD_DT, court);
    expect(b.vel.x).toBeGreaterThan(0); expect(b.facing).toBe(1); expect(b.locomotion).toBe('brake');
  });
  it('G03: a heavier planted body moves less and closing velocity is resolved', () => {
    const w = fixture(), a = w.players[0], b = w.players[1];
    a.athlete = { ...a.athlete, weightKg: 65, attrs: { ...a.athlete.attrs, strength: 60 } };
    b.athlete = { ...b.athlete, weightKg: 135, attrs: { ...b.athlete.attrs, strength: 60 } };
    a.pos = { x: 10, y: 7, z: 0 }; b.pos = { x: 10.5, y: 7, z: 0 };
    resolveBodies([a, b], court, null);
    expect(Math.abs(a.pos.x - 10)).toBeGreaterThan(Math.abs(b.pos.x - 10.5));
    a.vel.x = 4; b.vel.x = -2; b.pos.x = a.pos.x + bodyRadius(a) + bodyRadius(b) - 0.01;
    resolveBodies([a, b], court, null); expect(b.vel.x - a.vel.x).toBeGreaterThanOrEqual(-1e-8);
  });
  it('G03: vertically separated bodies do not push each other', () => {
    const w = fixture(), a = w.players[0], b = w.players[1]; a.pos = { x: 10, y: 7, z: 3 }; b.pos = { x: 10.2, y: 7, z: 0 };
    resolveBodies([a, b], court, null); expect(a.pos.x).toBe(10); expect(b.pos.x).toBe(10.2);
  });
  it('G05: spacing roles survive small movement and ball-side noise', () => {
    const w = fixture(true); const before = [...spacingSpots(w, 0)].map(([i, p]) => [i, { ...p }]);
    for (let k = 0; k < 100; k++) { w.players[1].pos.x += 0.005; w.ball.pos.y += k % 2 ? 0.01 : -0.01; expect([...spacingSpots(w, 0)]).toEqual(before); }
  });
  it('G09: an obstacle changes the approach while preserving forward progress', () => {
    const w = fixture(); w.players[0].pos = { x: 10, y: 7, z: 0 }; w.players[1].pos = { x: 10.8, y: 7, z: 0 };
    const input = navigate(w, 0, { x: 14, y: 7 }, true); expect(Math.abs(input.y)).toBeGreaterThan(0.1); expect(input.x).toBeGreaterThan(0);
  });
  it('G01: asset contact rig is deterministic and has a floor-reaching dribble', () => {
    const w = fixture(), rig = new BallControlRig(), b = w.players[0], state = { kind: 'anim' as const, name: 'dribbleIdle' as const, facing: 'right' as const, heading: 'down' as const };
    const low = rig.point(b, 0, state, 0.5, 0)!; expect(low.z).toBeCloseTo(0.12, 8);
    expect(rig.point(b, 0, state, 0.5, 900)).toEqual(low);
    expect(rig.point(b, 0, state, 0, 0)!.z).toBeGreaterThan(low.z);
  });
  it('G04: a reachable descending high ball triggers an anticipated jump', () => {
    const w = fixture(); w.holder = null; const b = w.players[0]; b.pos = { x: 10, y: 7, z: 0 };
    w.ball = { pos: { x: 10.1, y: 7, z: reach(b.athlete) + 0.65 }, vel: { x: 0, y: 0, z: -1 } };
    const action = reboundAction(w, 0); expect(action.jump).toBe(true);
  });
});

describe('natural gameplay: rules, actions and team decisions', () => {
  it('G18: a wide ball moving away is not protected; a descending ball headed in is', () => {
    const hoop = court.hoops.right;
    expect(inGoaltendZone(hoop, { pos: { x: hoop.rim.x - 0.95, y: hoop.rim.y, z: 3.4 }, vel: { x: -5, y: 0, z: -1 } })).toBe(false);
    expect(inGoaltendZone(hoop, { pos: { ...hoop.rim, z: 3.5 }, vel: { x: 0, y: 0, z: -1 } })).toBe(true);
  });
  it('G17/G19: arms respect facing; body contact uses relative velocity and vertical overlap', () => {
    expect(armContact({ x: 0, y: 0, z: 0 }, 200, 2.66, { x: -0.3, y: 0, z: 2.3 }, { x: 1, y: 0 })).toBeNull();
    const a = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 2, y: 0, z: 0 } };
    expect(bodyContact(a, { pos: { x: 0.7, y: 0, z: 0 }, vel: { x: 2, y: 0, z: 0 } })!.approachSpeed).toBe(0);
    expect(bodyContact(a, { pos: { x: 0.7, y: 0, z: 3 } })).toBeNull();
  });
  it('G30: changing shot speed mid-air keeps the active jump context', () => {
    const w = fixture(); w.players[0].pos = { x: 15, y: 7, z: 0 }; w.step(WORLD_DT, [{ ...idle, jump: true }]);
    const apex = w.players[0].timeToApex, gravity = w.players[0].jumpGravity;
    const next: ShotSettings = { mode: 'timing', speed: 'fast' }; w.setShotSettings(next);
    expect(w.players[0].timeToApex).toBe(apex); expect(w.players[0].jumpGravity).toBe(gravity);
    for (let i = 0; i < 240; i++) w.step(WORLD_DT, [{ ...idle, release: true }]);
    expect(w.shotSettings).toEqual(next);
  });
  it('G30: changing quarter length does not rescale the active period', () => {
    const w = fixture(true), clock = w.full!.clock; w.setQuarterMinutes(5);
    expect(w.full!.quarterMinutes).toBe(3); expect(w.full!.clock).toBe(clock);
    (w as unknown as { startPeriod(n: number): void }).startPeriod(2);
    expect(w.full!.quarterMinutes).toBe(5); expect(w.full!.clock).toBe(300);
  });
  it('G23: final possessions differ with the score and possession', () => {
    const w = fixture(true); w.full!.period = 4; w.full!.clock = 15; w.full!.shotClock = 20;
    w.points = [80, 77]; expect(endgameStrategy(w, 0)).toBe('hold'); expect(endgameStrategy(w, 1)).toBe('need-three');
    expect(endgameStrategy(w, 1, true)).toBe('foul');
    w.points = [80, 79]; expect(endgameStrategy(w, 1)).toBe('quick-two');
  });
  it('G21: a helper takes over a beaten guard and keeps a complete assignment', () => {
    const w = fixture(true); w.holder = 0; w.players[0].pos = { x: 20, y: 7, z: 0 };
    w.players[5].pos = { x: 13, y: 7, z: 0 }; w.players[6].pos = { x: 21, y: 7, z: 0 };
    const marks = coordinatedMarks(w, assignMarks(w)); expect(marks.get(0)).toBe(6); expect(marks.get(6)).toBe(0);
    expect(new Set(w.membersOf(1).map((i) => marks.get(i))).size).toBe(5);
  });
  it('G12: a close layup preserves the sign of approach momentum', () => {
    const w = fixture(), b = w.players[0]; b.athlete = { ...b.athlete, attrs: { ...b.athlete.attrs, standingDunk: 25, drivingDunk: 25, vertical: 25 } };
    b.pos = { x: court.hoops.right.rim.x - 0.3, y: court.hoops.right.rim.y, z: 0 }; b.vel.x = 3;
    w.step(WORLD_DT, [{ ...idle, jump: true }]); expect(w.shot?.kind).toBe('layup'); expect(b.vel.x).toBeGreaterThan(0);
  });
  it('G14: release below a board starts where the hand is, without shifting in front', async () => {
    const { releasePoint } = await import('./shooting'); const p = { x: court.hoops.right.rim.x + 0.3, y: court.hoops.right.rim.y, z: 0.5 };
    expect(releasePoint(p, 200, court.hoops.right, 0.12).x).toBe(p.x);
  });
  it('G15: an impossible requested trajectory has an explicit nonzero physical fallback', () => {
    const w = fixture(); const ok = (w as unknown as { launch(p: { x: number; y: number; z: number }, made: boolean, hoop: typeof court.hoops.right): boolean }).launch({ x: 1, y: 7.62, z: 2.8 }, true, court.hoops.right);
    if (!ok) expect(w.trajectoryFallbacks).toHaveLength(1);
    expect(Math.hypot(w.ball.vel.x, w.ball.vel.y, w.ball.vel.z)).toBeGreaterThan(1);
  });
  it('G08/G13: a dunk releases the active shot while retaining its own recovery', () => {
    const w = fixture(), b = w.players[0]; b.athlete = { ...b.athlete, attrs: { ...b.athlete.attrs, standingDunk: 99, drivingDunk: 99, vertical: 99 } };
    b.pos = { x: court.hoops.right.rim.x - 0.8, y: court.hoops.right.rim.y, z: 0 };
    w.step(WORLD_DT, [{ ...idle, jump: true }]); expect(w.shot?.kind).toBe('dunk');
    for (let i = 0; i < 120 && w.lastShot?.kind !== 'dunk'; i++) w.step(WORLD_DT, []);
    expect(w.shot).toBeNull(); expect(w.dunkRecoveries.has(0)).toBe(true);
    w.holder = 1; w.players[1].pos = { x: 20, y: 5, z: 0 };
    w.step(WORLD_DT, [idle, { ...idle, jump: true }]); expect(w.shot?.shooter).toBe(1);
  });
  it('G33: period end emits a single siren event', () => {
    const w = fixture(true); w.full!.clock = WORLD_DT / 2; w.holder = 0; w.players[0].pos = { x: 20, y: 7, z: 0 };
    w.step(WORLD_DT, []); w.step(WORLD_DT, []);
    expect(w.events.filter((e) => e.kind === 'sirène')).toHaveLength(1);
    expect(w.full!.phase).toBe('fin-periode');
  });
  it('G22: all three collective sequences assign a partner and execute their key action', () => {
    const checked = new Set<string>();
    for (let n = 0; n < 80 && checked.size < 3; n++) {
      const w = fixture(true);
      w.clock = n / 7; w.possession = { team: 0, since: w.clock };
      w.players[0].pos = { x: 20, y: 7, z: 0 };
      const plan = teamSequence(w, 0)!;
      if (checked.has(plan.kind)) continue;
      w.opponentsOf(0).forEach((i) => { w.players[i].pos = { x: 2 + i, y: 1, z: 0 }; });
      if (plan.kind === 'pick-roll') {
        w.players[plan.partner].pos = { ...plan.screen, z: 0 }; w.clock += 2.2;
        expect(sequenceIntent(w, plan.partner)).toMatchObject({ mode: 'coupe' });
        expect(plan.phase).toBe('roll');
      } else {
        w.players[plan.partner].pos = { x: 20, y: plan.kind === 'handoff' ? 8 : 10, z: 0 }; w.clock += 0.9;
        expect(sequenceIntent(w, 0).passTo).toBe(plan.partner);
        w.holder = plan.partner;
        expect(sequenceIntent(w, 0).mode).toBe(plan.kind === 'give-go' ? 'coupe' : 'écran');
      }
      w.clock = plan.start + 6;
      expect(sequenceIntent(w, 0)).toEqual({}); checked.add(plan.kind);
    }
    expect(checked.size).toBe(3);
  });
  it('G19: a non-called initial contact does not suppress a later contact from another defender', () => {
    let checked = false;
    for (let seed = 1; seed <= 30 && !checked; seed++) {
      const w = fixture(true, seed), shooter = w.players[0]; shooter.pos = { x: 20, y: 7, z: 0 };
      w.players[5].pos = { x: 20.5, y: 7, z: 0 };
      w.step(WORLD_DT, [{ ...idle, jump: true }]);
      if (!w.currentFoul || w.currentFoul.called) continue;
      w.players[5].pos = { x: 2, y: 1, z: 0 };
      w.players[6].pos = { x: shooter.pos.x + 0.45, y: shooter.pos.y, z: 0 }; w.players[6].vel.x = -3;
      w.step(WORLD_DT, []); expect(w.currentFoul?.defender).toBe(6); checked = true;
    }
    expect(checked).toBe(true);
  });
  it('G20: an airborne defender can contest a descending ball away from the cylinder', () => {
    const w = fixture(), shooter = w.players[0]; shooter.pos = { x: 20, y: 7, z: 0 };
    w.step(WORLD_DT, [{ ...idle, jump: true }]);
    for (let k = 0; k < 80 && w.shot; k++) w.step(WORLD_DT, [{ ...idle, release: w.shot.airTime >= shooter.timeToApex }]);
    w.ball = { pos: { x: 15, y: 7, z: 3.4 }, vel: { x: 0, y: 0, z: -1 } };
    const defender = w.players[2]; defender.pos = { x: 15.2, y: 7, z: 1.2 }; defender.airborne = true;
    defender.vel.z = 0.3; defender.look = { x: -1, y: 0 }; w.gestures.advance(0); w.gestures.clocks[2].air = 0.1;
    w.step(WORLD_DT, []); expect(w.lastShot?.block?.blocker).toBe(2); expect(w.lastShot?.goaltend).toBe(false);
  });
  it('G28/G34: defensive facing produces backpedal footwork and independent idle phases', () => {
    const w = fixture(), body = w.players[0]; body.vel.x = -3;
    stepPlayer(body, { x: -1, y: 0, jump: false, face: { x: 1, y: 0 } }, WORLD_DT, court);
    expect(body.locomotion).toBe('backpedal');
    expect(spriteStateFor({ airborne: false, speed: 3, holding: false, facing: 1, heading: 'down', locomotion: body.locomotion })).toMatchObject({ name: 'backpedal' });
    w.gestures.advance(0);
    expect(w.gestures.views[0].idlePhase).not.toBe(w.gestures.views[1].idlePhase);
  });
});
