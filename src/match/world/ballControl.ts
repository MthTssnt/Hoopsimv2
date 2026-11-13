import { COURT_DESIGNS, playerScale } from '../../assets/players/courtDesigns';
import { appearanceFor } from '../render/sprites/appearance';
import { POSE_CONTACTS, contactPoint } from '../render/sprites/poseContacts';
import { OFFICIAL_LAYOUT, gestureFrame, sheetIndexIn, type Gesture } from '../render/sprites/layout';
import { dribbleBallAt } from '../render/sprites/motion';
import { FRAME, type Facing, type Heading } from '../render/sprites/views';
import type { SpriteState } from '../render/playerView';
import { ART_DEPTH_SCALE, ART_HEIGHT_SCALE, ART_PPM } from '../render/artConfig';
import { BALL_RADIUS, type Vec3 } from '../physics/court';
import type { PlayerBody } from './player';

/** Pure asset geometry: no Canvas, Phaser, rendered frame or browser clock in game contacts. */
export class BallControlRig {
  private rigs = new Map<string, { anchors: ({ x: number; y: number } | null)[]; key: string }>();
  private anchors(body: PlayerBody, team: number) {
    const p = body.athlete, key = `${team}:${p.heightCm}:${p.weightKg}:${p.number}`;
    const old = this.rigs.get(p.id);
    if (old?.key === key) return old.anchors;
    const look = appearanceFor(p), h = playerScale(look.heightCm, look.heavy, COURT_DESIGNS[team][look.variant]).height;
    const sy = h / 48, sx = sy * (look.heavy ? 1.1 : 1);
    const anchors = (['down', 'down', 'up', 'up'] as const).flatMap((heading, block) => {
      const source = POSE_CONTACTS.find((s) => s.file === `${team}-${look.variant}-${heading}.png`);
      // contacts.json stores paths; retain a stable numeric fallback for the same atlas order.
      const frames = (source ?? POSE_CONTACTS[team * 10 + look.variant * 2 + (heading === 'up' ? 1 : 0)]).frames;
      return frames.map((f) => f.ball ? contactPoint(f.ball, sx, sy, block % 2 === 1) : null);
    });
    this.rigs.set(p.id, { key, anchors });
    return anchors;
  }
  point(body: PlayerBody, team: number, state: SpriteState, dribblePhase: number, clock: number): Vec3 | null {
    const anchors = this.anchors(body, team), layout = OFFICIAL_LAYOUT;
    let anchor: { x: number; y: number } | null;
    if (state.kind === 'frame') {
      anchor = anchors[sheetIndexIn(layout, gestureFrame(layout, state.gesture, state.step), state.facing, state.heading)];
    } else {
      const frames = layout.animations[state.name].frames;
      if (state.name === 'dribble' || state.name === 'dribbleIdle') {
        anchor = dribbleBallAt(dribblePhase, frames.map((f) => anchors[sheetIndexIn(layout, f, state.facing, state.heading)]), FRAME.groundY - 5);
      } else {
        const phase = state.phase ?? (state.name === 'run' ? body.strideDistance / 3.4 % 1 : clock % 1);
        anchor = anchors[sheetIndexIn(layout, frames[Math.floor(phase * frames.length)], state.facing, state.heading)];
      }
    }
    if (!anchor) return null;
    const depthPx = ART_PPM * ART_DEPTH_SCALE, heightPx = ART_PPM * ART_HEIGHT_SCALE;
    const dy = (BALL_RADIUS * heightPx - 5) / depthPx;
    return { x: body.pos.x + (anchor.x - FRAME.centerX) / ART_PPM, y: body.pos.y + dy,
      z: Math.max(BALL_RADIUS, body.pos.z + (FRAME.groundY - anchor.y + dy * depthPx) / heightPx) };
  }
  gesture(body: PlayerBody, team: number, gesture: Gesture, step: number, heading: Heading = 'down', facing: Facing = body.facing < 0 ? 'left' : 'right') {
    return this.point(body, team, { kind: 'frame', gesture, step, heading, facing }, 0, 0);
  }
}

/** A catch needs a reachable volume, a visible approach and a controllable relative speed. */
export function catchable(body: PlayerBody, ball: { pos: Vec3; vel: Vec3 }, reach: number, pass: boolean): boolean {
  const dx = ball.pos.x - body.pos.x, dy = ball.pos.y - body.pos.y;
  if (ball.pos.z < body.pos.z + (body.airborne ? 0.45 : BALL_RADIUS - 0.01) || ball.pos.z > body.pos.z + reach + 0.05) return false;
  const relative = Math.hypot(ball.vel.x - body.vel.x, ball.vel.y - body.vel.y, ball.vel.z - body.vel.z);
  if (relative > 13 + body.athlete.attrs.passing * 0.08) return false;
  const facing = body.look ?? { x: body.facing, y: 0 };
  const d = Math.hypot(dx, dy);
  if (pass && d > 0.25 && (facing.x * dx + facing.y * dy) / (Math.hypot(facing.x, facing.y) * d || 1) < -0.35) return false;
  return true;
}
