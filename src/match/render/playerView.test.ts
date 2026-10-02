import { describe, expect, it } from 'vitest';
import { WORLD_TUNING } from '../world/MatchWorld';
import { AIR_FRAMES, animTimeScale, dunkLift, blendBall, frameIndex, heldBallPoint, nextHeading, PLAYER_VIEW_TUNING, spriteStateFor } from './playerView';
import { ANIMATIONS, FRAME, FRAMES } from './sprites/rig';

const ground = { airborne: false, speed: 0, holding: false, facing: 1, heading: 'side' as const };

describe('image du joueur selon l’état du monde', () => {
  it('au sol : arrêt, course, dribble à l’arrêt, dribble en course', () => {
    expect(spriteStateFor(ground)).toEqual({ kind: 'anim', name: 'idle', facing: 'right', heading: 'side' });
    expect(spriteStateFor({ ...ground, speed: 4 })).toMatchObject({ kind: 'anim', name: 'run' });
    expect(spriteStateFor({ ...ground, holding: true })).toMatchObject({ kind: 'anim', name: 'dribbleIdle' });
    expect(spriteStateFor({ ...ground, holding: true, speed: 4 })).toMatchObject({ kind: 'anim', name: 'dribble' });
    // Juste sous le seuil : encore à l'arrêt (pas de piétinement en fin de freinage).
    expect(spriteStateFor({ ...ground, speed: PLAYER_VIEW_TUNING.runSpeed })).toMatchObject({ kind: 'anim', name: 'idle' });
  });

  it('en l’air : ballon levé avec le ballon, bras du lâcher sans, même en mouvement', () => {
    expect(spriteStateFor({ ...ground, airborne: true, holding: true, speed: 5 })).toEqual({ kind: 'frame', frame: AIR_FRAMES.withBall, facing: 'right', heading: 'side' });
    expect(spriteStateFor({ ...ground, airborne: true })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.empty });
    // L'image en l'air avec ballon a bien un ballon dessiné, celle du lâcher non.
    expect(FRAMES[AIR_FRAMES.withBall].ball).toBe('overhead');
    expect(FRAMES[AIR_FRAMES.empty].ball).toBeUndefined();
  });

  it('tourné vers la gauche ou de dos : blocs dédiés de la feuille, jamais de retournement', () => {
    expect(spriteStateFor({ ...ground, facing: -1, speed: 3 })).toEqual({ kind: 'anim', name: 'run', facing: 'left', heading: 'side' });
    expect(spriteStateFor({ ...ground, heading: 'back', speed: 3 })).toMatchObject({ name: 'run', heading: 'back' });
    const air = (facing: number, heading: 'side' | 'back') => frameIndex(spriteStateFor({ ...ground, airborne: true, facing, heading }) as never);
    const n = FRAMES.length;
    expect(air(1, 'side')).toBe(14);
    expect(air(-1, 'side')).toBe(n + 14);
    expect(air(1, 'back')).toBe(2 * n + 14);
    expect(air(-1, 'back')).toBe(3 * n + 14);
  });

  it('dribble dessiné au rythme du dribble du monde (cadence de base)', () => {
    const total = (name: 'dribble' | 'dribbleIdle') => ANIMATIONS[name].durations.reduce((a, b) => a + b, 0);
    expect(total('dribble')).toBe(WORLD_TUNING.dribblePeriod * 1000);
    expect(total('dribbleIdle')).toBe(WORLD_TUNING.dribblePeriod * 1000);
  });
});

describe('vue de dos', () => {
  it('passe de dos en montant, diagonales comprises, et de profil sinon', () => {
    expect(nextHeading('side', { x: 0, y: -6 }, false)).toBe('back');
    expect(nextHeading('side', { x: 4.2, y: -4.2 }, false)).toBe('back');
    expect(nextHeading('side', { x: -4.2, y: -4.2 }, false)).toBe('back');
    expect(nextHeading('back', { x: 6, y: 0 }, false)).toBe('side');
    expect(nextHeading('back', { x: 6, y: -1 }, false)).toBe('side');
    expect(nextHeading('back', { x: 0, y: 6 }, false)).toBe('side');
    expect(nextHeading('back', { x: 4, y: 4 }, false)).toBe('side');
  });

  it('garde la vue précédente à l’arrêt et en l’air', () => {
    expect(nextHeading('back', { x: 0, y: 0 }, false)).toBe('back');
    expect(nextHeading('back', { x: 0.3, y: 0.2 }, false)).toBe('back');
    expect(nextHeading('back', { x: 6, y: 0 }, true)).toBe('back');
    expect(nextHeading('side', { x: 0, y: -6 }, true)).toBe('side');
  });
});

describe('pendant un tir', () => {
  it('reste de profil, même en montant ou de dos', () => {
    expect(nextHeading('back', { x: 0, y: -6 }, false, true)).toBe('side');
    expect(nextHeading('back', { x: 0, y: 0 }, true, true)).toBe('side');
  });

  it('montre le ballon levé, le bras tendu du layup, puis les bras après le lâcher', () => {
    const air = { ...ground, airborne: true, holding: true };
    expect(spriteStateFor({ ...air, shot: 'jump' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.withBall });
    expect(spriteStateFor({ ...air, shot: 'layup' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.layup });
    expect(spriteStateFor({ ...air, holding: false, shot: null })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.empty });
    expect(FRAMES[AIR_FRAMES.layup].ball).toBe('overhead');
  });

  it('dunk : bras tendu en montant avec le ballon, deux bras au cercle après le smash', () => {
    const air = { ...ground, airborne: true };
    expect(spriteStateFor({ ...air, holding: true, shot: 'dunk' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.layup });
    expect(spriteStateFor({ ...air, holding: false, shot: 'dunk' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.dunkHang });
    expect(FRAMES[AIR_FRAMES.dunkHang].ball).toBeUndefined();
    expect(nextHeading('back', { x: 0, y: -3 }, true, true)).toBe('side');
  });
});

describe('mains au cercle pendant un dunk', () => {
  it('monte le sprite de l’écart mains-cercle, selon la montée', () => {
    expect(dunkLift(100, 90, 0)).toBe(0);
    expect(dunkLift(100, 90, 0.5)).toBe(5);
    expect(dunkLift(100, 90, 1)).toBe(10);
    expect(dunkLift(100, 90, 3)).toBe(10);
    // Mains déjà au-dessus du cercle : rien.
    expect(dunkLift(80, 90, 1)).toBe(0);
  });
});

describe('cadence des pas', () => {
  const run = spriteStateFor({ ...ground, speed: 7 });
  it('accélère la course et le dribble avec la vitesse, dans des bornes', () => {
    expect(animTimeScale(run, PLAYER_VIEW_TUNING.strideSpeed)).toBe(1);
    expect(animTimeScale(run, 7.2)).toBeCloseTo(1.44, 5);
    expect(animTimeScale(run, 20)).toBe(PLAYER_VIEW_TUNING.cadence[1]);
    expect(animTimeScale(run, 1)).toBe(PLAYER_VIEW_TUNING.cadence[0]);
    expect(animTimeScale(spriteStateFor({ ...ground, speed: 7, holding: true }), 7.2)).toBeCloseTo(1.44, 5);
  });

  it('laisse les autres animations à leur cadence', () => {
    expect(animTimeScale(spriteStateFor(ground), 0)).toBe(1);
    expect(animTimeScale(spriteStateFor({ ...ground, holding: true }), 0)).toBe(1);
    expect(animTimeScale(spriteStateFor({ ...ground, airborne: true, speed: 2 }), 2)).toBe(1);
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
