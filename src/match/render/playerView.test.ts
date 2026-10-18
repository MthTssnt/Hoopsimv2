import { describe, expect, it } from 'vitest';
import { WORLD_TUNING } from '../world/MatchWorld';
import { AIR_FRAMES, animTimeScale, dunkLift, blendBall, frameIndex, headingFor, heldBallPoint, nextHeading, PLAYER_VIEW_TUNING, spriteStateFor } from './playerView';
import { animationKey } from './sprites/bake';
import type { Heading } from './sprites/rig';
import { ANIMATIONS, FRAME, FRAMES } from './sprites/rig';

const ground = { airborne: false, speed: 0, holding: false, facing: 1, heading: 'down' as const };

describe('image du joueur selon l’état du monde', () => {
  it('au sol : arrêt, course, dribble à l’arrêt, dribble en course', () => {
    expect(spriteStateFor(ground)).toEqual({ kind: 'anim', name: 'idle', facing: 'right', heading: 'down' });
    expect(spriteStateFor({ ...ground, speed: 4 })).toMatchObject({ kind: 'anim', name: 'run' });
    expect(spriteStateFor({ ...ground, holding: true })).toMatchObject({ kind: 'anim', name: 'dribbleIdle' });
    expect(spriteStateFor({ ...ground, holding: true, speed: 4 })).toMatchObject({ kind: 'anim', name: 'dribble' });
    // Juste sous le seuil : encore à l'arrêt (pas de piétinement en fin de freinage).
    expect(spriteStateFor({ ...ground, speed: PLAYER_VIEW_TUNING.runSpeed })).toMatchObject({ kind: 'anim', name: 'idle' });
  });

  it('en l’air : ballon levé avec le ballon, deux bras levés sans (contre), bras du lâcher après un tir', () => {
    expect(spriteStateFor({ ...ground, airborne: true, holding: true, speed: 5 })).toEqual({ kind: 'frame', frame: AIR_FRAMES.withBall, facing: 'right', heading: 'down' });
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

  it('quatre positions : blocs dédiés de la feuille (bas et haut, droite et gauche), jamais de retournement', () => {
    expect(spriteStateFor({ ...ground, facing: -1, speed: 3 })).toEqual({ kind: 'anim', name: 'run', facing: 'left', heading: 'down' });
    expect(spriteStateFor({ ...ground, heading: 'up', speed: 3 })).toMatchObject({ name: 'run', heading: 'up' });
    const air = (facing: number, heading: Heading) => frameIndex(spriteStateFor({ ...ground, airborne: true, facing, heading }) as never);
    const n = FRAMES.length;
    expect(n).toBe(19);
    // Blocs : diagonale bas droite, bas gauche, haut droite, haut gauche.
    expect(air(1, 'down')).toBe(18);
    expect(air(-1, 'down')).toBe(n + 18);
    expect(air(1, 'up')).toBe(2 * n + 18);
    expect(air(-1, 'up')).toBe(3 * n + 18);
    const keys = (['down', 'up'] as const).flatMap((h) => [animationKey('p', 'run', 'right', h), animationKey('p', 'run', 'left', h)]);
    expect(new Set(keys).size).toBe(4);
    expect(animationKey('p', 'run', 'right', 'down')).toBe('p:run');
  });

  it('dribble dessiné au rythme du dribble du monde (cadence de base)', () => {
    const total = (name: 'dribble' | 'dribbleIdle') => ANIMATIONS[name].durations.reduce((a, b) => a + b, 0);
    expect(total('dribble')).toBe(WORLD_TUNING.dribblePeriod * 1000);
    expect(total('dribbleIdle')).toBe(WORLD_TUNING.dribblePeriod * 1000);
  });
});

describe('position selon la direction (toujours en diagonale)', () => {
  /** Vitesse de 6 m/s à `deg` degrés au-dessus de l'horizontale (vers le fond), à droite ou à gauche. */
  const run = (deg: number, right = true) => ({ x: (right ? 6 : -6) * Math.cos((deg * Math.PI) / 180), y: -6 * Math.sin((deg * Math.PI) / 180) });

  it('passe en diagonale haut en montant, en diagonale bas en descendant, tout droit compris', () => {
    for (const right of [true, false]) {
      for (const deg of [30, 45, 70, 90]) expect(nextHeading('down', run(deg, right), false)).toBe('up');
      for (const deg of [-30, -45, -70, -90]) expect(nextHeading('up', run(deg, right), false)).toBe('down');
    }
  });

  it('garde sa diagonale à l’horizontale (décision de Matheo) : zone morte de ±15°', () => {
    const dead = PLAYER_VIEW_TUNING.deadZone;
    expect(dead).toBe(15);
    for (const deg of [0, dead - 1, -(dead - 1)]) {
      expect(headingFor(run(deg), 'up')).toBe('up');
      expect(headingFor(run(deg), 'down')).toBe('down');
      expect(headingFor(run(deg, false), 'up')).toBe('up');
    }
    expect(headingFor(run(dead + 1), 'down')).toBe('up');
    expect(headingFor(run(-(dead + 1)), 'up')).toBe('down');
  });

  it('garde la position à l’arrêt et en l’air', () => {
    expect(nextHeading('up', { x: 0, y: 0 }, false)).toBe('up');
    expect(nextHeading('up', { x: 0.3, y: 0.2 }, false)).toBe('up');
    expect(nextHeading('up', { x: 0, y: 6 }, true)).toBe('up');
    expect(nextHeading('down', { x: 0, y: -6 }, true)).toBe('down');
  });
});

describe('pendant un tir', () => {
  it('fait face au panier : diagonale haut depuis l’aile proche, bas depuis l’aile du fond, gardée de face', () => {
    // Panier à droite : depuis l'aile proche, le cercle est vers le fond ; depuis l'aile du fond,
    // vers la caméra ; de face (même profondeur), la position est gardée.
    expect(nextHeading('down', { x: 0, y: 0 }, true, { x: 4, y: -4 })).toBe('up');
    expect(nextHeading('up', { x: 0, y: 0 }, true, { x: 4, y: 4 })).toBe('down');
    expect(nextHeading('up', { x: 0, y: 6 }, false, { x: 7, y: 0 })).toBe('up');
    expect(nextHeading('down', { x: 0, y: -6 }, false, { x: 7, y: 0 })).toBe('down');
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
    expect(nextHeading('up', { x: 0, y: -3 }, true, { x: 3, y: 0 })).toBe('up');
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
