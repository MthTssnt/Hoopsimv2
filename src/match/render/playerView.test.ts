import { describe, expect, it } from 'vitest';
import { WORLD_TUNING } from '../world/MatchWorld';
import { AIR_FRAMES, animTimeScale, dunkLift, blendBall, frameIndex, headingFor, heldBallPoint, nextHeading, PLAYER_VIEW_TUNING, spriteStateFor } from './playerView';
import { animationKey } from './sprites/bake';
import type { Heading } from './sprites/rig';
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

  it('en l’air : ballon levé avec le ballon, deux bras levés sans (contre), bras du lâcher après un tir', () => {
    expect(spriteStateFor({ ...ground, airborne: true, holding: true, speed: 5 })).toEqual({ kind: 'frame', frame: AIR_FRAMES.withBall, facing: 'right', heading: 'side' });
    expect(spriteStateFor({ ...ground, airborne: true })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.block });
    expect(spriteStateFor({ ...ground, airborne: true, followThrough: true })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.empty });
    // L'image en l'air avec ballon a bien un ballon dessiné, celles du lâcher et du contre non.
    expect(FRAMES[AIR_FRAMES.withBall].ball).toBe('overhead');
    expect(FRAMES[AIR_FRAMES.empty].ball).toBeUndefined();
    expect(FRAMES[AIR_FRAMES.block].ball).toBeUndefined();
    // Contre : les deux mains sont au plus haut, au-dessus de la tête.
    expect(FRAMES[AIR_FRAMES.block].front.hand[1]).toBeLessThan(0);
    expect(FRAMES[AIR_FRAMES.block].back.hand[1]).toBeLessThan(0);
  });

  it('tourné vers la gauche, de dos ou de 3/4 : blocs dédiés de la feuille, jamais de retournement', () => {
    expect(spriteStateFor({ ...ground, facing: -1, speed: 3 })).toEqual({ kind: 'anim', name: 'run', facing: 'left', heading: 'side' });
    expect(spriteStateFor({ ...ground, heading: 'back', speed: 3 })).toMatchObject({ name: 'run', heading: 'back' });
    expect(spriteStateFor({ ...ground, heading: 'front34', speed: 3 })).toMatchObject({ name: 'run', heading: 'front34' });
    const air = (facing: number, heading: Heading) => frameIndex(spriteStateFor({ ...ground, airborne: true, facing, heading }) as never);
    const n = FRAMES.length;
    expect(n).toBe(19);
    // Blocs : profil, dos, 3/4 face, 3/4 dos ; chacun vers la droite puis vers la gauche.
    expect(air(1, 'side')).toBe(18);
    expect(air(-1, 'side')).toBe(n + 18);
    expect(air(1, 'back')).toBe(2 * n + 18);
    expect(air(-1, 'back')).toBe(3 * n + 18);
    expect(air(1, 'front34')).toBe(4 * n + 18);
    expect(air(-1, 'front34')).toBe(5 * n + 18);
    expect(air(1, 'back34')).toBe(6 * n + 18);
    expect(air(-1, 'back34')).toBe(7 * n + 18);
    const keys = (['side', 'back', 'front34', 'back34'] as const).flatMap((h) => [animationKey('p', 'run', 'right', h), animationKey('p', 'run', 'left', h)]);
    expect(new Set(keys).size).toBe(8);
    expect(animationKey('p', 'run', 'right', 'side')).toBe('p:run');
  });

  it('dribble dessiné au rythme du dribble du monde (cadence de base)', () => {
    const total = (name: 'dribble' | 'dribbleIdle') => ANIMATIONS[name].durations.reduce((a, b) => a + b, 0);
    expect(total('dribble')).toBe(WORLD_TUNING.dribblePeriod * 1000);
    expect(total('dribbleIdle')).toBe(WORLD_TUNING.dribblePeriod * 1000);
  });
});

describe('vue selon la direction (8 secteurs)', () => {
  /** Vitesse de 6 m/s à `deg` degrés au-dessus de l'horizontale (vers le fond), à droite ou à gauche. */
  const run = (deg: number, right = true) => ({ x: (right ? 6 : -6) * Math.cos((deg * Math.PI) / 180), y: -6 * Math.sin((deg * Math.PI) / 180) });

  it('donne profil, 3/4 dos, dos et 3/4 face selon l’angle, à droite comme à gauche', () => {
    for (const right of [true, false]) {
      expect(nextHeading('side', run(0, right), false)).toBe('side');
      expect(nextHeading('side', run(45, right), false)).toBe('back34');
      expect(nextHeading('side', run(90, right), false)).toBe('back');
      expect(nextHeading('side', run(-45, right), false)).toBe('front34');
      // Descente tout droit : 3/4 face (décision de Matheo).
      expect(nextHeading('side', run(-90, right), false)).toBe('front34');
    }
  });

  it('ne clignote pas près d’une frontière : il faut la dépasser de la marge pour changer de vue', () => {
    const margin = PLAYER_VIEW_TUNING.hysteresis;
    expect(headingFor(run(22.5 + margin - 1), 'side')).toBe('side');
    expect(headingFor(run(22.5 + margin + 1), 'side')).toBe('back34');
    expect(headingFor(run(22.5 - margin + 1), 'back34')).toBe('back34');
    expect(headingFor(run(22.5 - margin - 1), 'back34')).toBe('side');
    expect(headingFor(run(67.5 - margin + 1), 'back')).toBe('back');
    expect(headingFor(run(-22.5 + margin - 1), 'front34')).toBe('front34');
    // Hors de toute marge, la vue du secteur l'emporte.
    expect(headingFor(run(0), 'back')).toBe('side');
    expect(headingFor(run(-80), 'back34')).toBe('front34');
  });

  it('garde la vue précédente à l’arrêt et en l’air', () => {
    expect(nextHeading('back', { x: 0, y: 0 }, false)).toBe('back');
    expect(nextHeading('back', { x: 0.3, y: 0.2 }, false)).toBe('back');
    expect(nextHeading('back', { x: 6, y: 0 }, true)).toBe('back');
    expect(nextHeading('side', { x: 0, y: -6 }, true)).toBe('side');
  });
});

describe('pendant un tir', () => {
  it('fait face au panier, dans la vue du secteur vers le cercle, même en l’air', () => {
    // Panier à droite : de face (même profondeur), depuis le coin proche (le cercle est vers le
    // fond), depuis l'aile du fond (le cercle est vers la caméra).
    expect(nextHeading('back', { x: 0, y: -6 }, false, { x: 7, y: 0 })).toBe('side');
    expect(nextHeading('side', { x: 0, y: 0 }, true, { x: 1.5, y: -6 })).toBe('back');
    expect(nextHeading('side', { x: 0, y: 0 }, true, { x: 4, y: -4 })).toBe('back34');
    expect(nextHeading('side', { x: 0, y: 0 }, true, { x: 4, y: 4 })).toBe('front34');
  });

  it('montre le ballon levé, le bras tendu du layup, puis les bras après le lâcher', () => {
    const air = { ...ground, airborne: true, holding: true };
    expect(spriteStateFor({ ...air, shot: 'jump' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.withBall });
    expect(spriteStateFor({ ...air, shot: 'layup' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.layup });
    expect(spriteStateFor({ ...air, holding: false, shot: null, followThrough: true })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.empty });
    expect(FRAMES[AIR_FRAMES.layup].ball).toBe('overhead');
  });

  it('dunk : bras tendu en montant avec le ballon, deux bras au cercle après le smash', () => {
    const air = { ...ground, airborne: true };
    expect(spriteStateFor({ ...air, holding: true, shot: 'dunk' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.layup });
    expect(spriteStateFor({ ...air, holding: false, shot: 'dunk' })).toMatchObject({ kind: 'frame', frame: AIR_FRAMES.dunkHang });
    expect(FRAMES[AIR_FRAMES.dunkHang].ball).toBeUndefined();
    expect(nextHeading('back', { x: 0, y: -3 }, true, { x: 3, y: 0 })).toBe('side');
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
