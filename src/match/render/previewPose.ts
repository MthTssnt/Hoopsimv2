import { spriteStateFor, type BodyView } from './playerView';
import { MOTIONS, type MotionId } from './sprites/motion';

/** Synthetic situations for inspecting the actual match selector, not a replacement for trajectories. */
export function previewPose(id: MotionId, phase: number, heading: BodyView['heading'], facing: number) {
  const body: BodyView = { airborne: false, speed: 0, holding: false, facing, heading };
  if (id === 'run' || id === 'dribble') body.speed = 4;
  if (id === 'dribble' || id === 'dribbleIdle') body.holding = true;
  if (['jumpShot', 'layup', 'dunk', 'block', 'blockOff', 'rebound', 'tipoff'].includes(id)) {
    body.airborne = true;
    body.air = { time: phase * (['jumpShot', 'layup', 'dunk'].includes(id) ? 1.2 : 0.76), rising: phase < 0.5, progress: 4 * phase * (1 - phase) };
    if (id === 'jumpShot' || id === 'layup' || id === 'dunk') {
      body.shot = id === 'jumpShot' ? 'jump' : id;
      body.holding = phase < 0.5; body.followThrough = !body.holding;
      body.sinceRelease = body.holding ? null : (phase - 0.5) * 1.2;
    } else body.jumpKind = id as BodyView['jumpKind'];
  }
  if (id === 'pass' || id === 'lobPass') { body.sincePass = phase * 0.25; body.lob = id === 'lobPass'; }
  if (id === 'catch') { body.catching = true; body.holding = phase >= 0.25; body.sinceCatch = phase < 0.25 ? null : (phase - 0.25) * 0.2; }
  if (id === 'landing') body.sinceLanding = phase * 0.12;
  if (id === 'steal') body.sinceReach = phase * 0.25;
  if (id === 'offBalance') { body.offBalance = true; body.motionPhase = phase; }
  if (id === 'freeThrow') {
    body.holding = phase < 0.5;
    body.freeThrow = phase < 0.2 ? { stage: 'setup' } : phase < 0.5 ? { stage: 'aim' } : { stage: 'after', since: (phase - 0.5) * 0.8 };
  }
  const state = spriteStateFor(body);
  const motion: MotionId = state.kind === 'frame' ? state.gesture : state.name === 'shoot' ? 'jumpShot' : state.name;
  const def = MOTIONS.find((m) => m.id === motion)!;
  return { motion, frame: state.kind === 'frame' ? state.step : Math.min(def.count - 1, Math.floor(phase * def.count)), body };
}
