import { describe, expect, it } from 'vitest';
import { WORLD_TUNING } from '../world/MatchWorld';
import { AIR_FRAMES, blendBall, frameIndex, heldBallPoint, PLAYER_VIEW_TUNING, spriteStateFor } from './playerView';
import { ANIMATIONS, FRAME, FRAMES } from './sprites/rig';

const ground = { airborne: false, speed: 0, holding: false, facing: 1 };

describe('image du joueur selon l’état du monde', () => {
  it('au sol : arrêt, course, dribble à l’arrêt, dribble en course', () => {
    expect(spriteStateFor(ground)).toEqual({ kind: 'anim', name: 'idle', facing: 'right' });
    expect(spriteStateFor({ ...ground, speed: 4 })).toEqual({ kind: 'anim', name: 'run', facing: 'right' });
    expect(spriteStateFor({ ...ground, holding: true })).toEqual({ kind: 'anim', name: 'dribbleIdle', facing: 'right' });
    expect(spriteStateFor({ ...ground, holding: true, speed: 4 })).toEqual({ kind: 'anim', name: 'dribble', facing: 'right' });
    // Juste sous le seuil : encore à l'arrêt (pas de piétinement en fin de freinage).
    expect(spriteStateFor({ ...ground, speed: PLAYER_VIEW_TUNING.runSpeed })).toMatchObject({ kind: 'anim', name: 'idle' });
  });

  it('en l’air : ballon levé avec le ballon, bras du lâcher sans, même en mouvement', () => {
    expect(spriteStateFor({ ...ground, airborne: true, holding: true, speed: 5 })).toEqual({ kind: 'frame', frame: AIR_FRAMES.withBall, facing: 'right' });
    expect(spriteStateFor({ ...ground, airborne: true })).toEqual({ kind: 'frame', frame: AIR_FRAMES.empty, facing: 'right' });
    // L'image en l'air avec ballon a bien un ballon dessiné, celle du lâcher non.
    expect(FRAMES[AIR_FRAMES.withBall].ball).toBe('overhead');
    expect(FRAMES[AIR_FRAMES.empty].ball).toBeUndefined();
  });

  it('tourné vers la gauche : images dédiées, jamais de retournement', () => {
    expect(spriteStateFor({ ...ground, facing: -1, speed: 3 })).toEqual({ kind: 'anim', name: 'run', facing: 'left' });
    expect(spriteStateFor({ ...ground, facing: -1, airborne: true }).facing).toBe('left');
    expect(frameIndex(13, 'right')).toBe(13);
    expect(frameIndex(13, 'left')).toBe(13 + FRAMES.length);
  });

  it('dribble dessiné au rythme du dribble du monde', () => {
    const total = (name: 'dribble' | 'dribbleIdle') => ANIMATIONS[name].durations.reduce((a, b) => a + b, 0);
    expect(total('dribble')).toBe(WORLD_TUNING.dribblePeriod * 1000);
    expect(total('dribbleIdle')).toBe(WORLD_TUNING.dribblePeriod * 1000);
  });
});

describe('ballon tenu et raccord', () => {
  it('ramène le point d’accroche de l’image dans le monde', () => {
    const feet = { x: 300, y: 200 };
    // Le pixel des semelles au centre du cadre tombe sur les pieds.
    expect(heldBallPoint(feet, { x: FRAME.centerX, y: FRAME.groundY })).toEqual(feet);
    expect(heldBallPoint(feet, { x: FRAME.centerX + 6, y: FRAME.groundY - 20 })).toEqual({ x: 306, y: 180 });
  });

  it('va de la main à la position physique en 80 ms, puis colle à la physique', () => {
    const from = { x: 100, y: 50 };
    const to = { x: 140, y: 30 };
    expect(PLAYER_VIEW_TUNING.ballBlendMs).toBe(80);
    expect(blendBall(from, to, 0)).toEqual(from);
    expect(blendBall(from, to, 40)).toEqual({ x: 120, y: 40 });
    expect(blendBall(from, to, 80)).toEqual(to);
    expect(blendBall(from, to, 500)).toEqual(to);
    expect(blendBall(from, to, -5)).toEqual(from);
  });
});
