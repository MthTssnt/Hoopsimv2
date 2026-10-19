import { describe, expect, it } from 'vitest';
import { WORLD_TUNING } from '../world/MatchWorld';
import { animTimeScale, blockGesture, dunkLift, blendBall, frameIndex, headingFor, heldBallPoint, nextHeading, PLAYER_VIEW_TUNING, spriteStateFor } from './playerView';
import { animationKey } from './sprites/bake';
import type { Heading } from './sprites/rig';
import { GESTURE_STEPS, GESTURES, LAYOUT_2D, RIG_LAYOUT, RUN_CYCLE_MS } from './sprites/layout';
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

  it('dispositions : le rig garde ses indices ; le rendu 2D a 55 images par bloc, chaque geste ses propres images', () => {
    expect(RIG_LAYOUT.framesPerBlock).toBe(19);
    expect(RIG_LAYOUT.animations).toBe(ANIMATIONS);
    expect(LAYOUT_2D.framesPerBlock).toBe(55);
    for (const g of GESTURES) expect(LAYOUT_2D.gestures[g], g).toHaveLength(GESTURE_STEPS[g]);
    // Aucune image n'appartient à deux gestes ni à un geste et une animation en boucle (pas de recyclage).
    const loops = (['idle', 'run', 'dribble', 'dribbleIdle'] as const).flatMap((a) => LAYOUT_2D.animations[a].frames);
    const gestures = GESTURES.flatMap((g) => LAYOUT_2D.gestures[g]);
    const all = [...loops, ...gestures];
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(LAYOUT_2D.framesPerBlock);
    for (const f of all) expect(f).toBeLessThan(55);
    // `shoot` et `dunk` (planche ?style) rejouent les images de leur geste.
    expect(LAYOUT_2D.animations.shoot.frames).toEqual(LAYOUT_2D.gestures.jumpShot);
    expect(LAYOUT_2D.animations.dunk.frames).toEqual(LAYOUT_2D.gestures.dunk);
    const blockTop = (facing: number, heading: Heading) => frameIndex(spriteStateFor({ ...ground, airborne: true, jumpKind: 'block', facing, heading }) as never, LAYOUT_2D);
    expect(blockTop(1, 'down')).toBe(LAYOUT_2D.gestures.block[1]);
    expect(blockTop(-1, 'up')).toBe(3 * 55 + LAYOUT_2D.gestures.block[1]);
  });

  it('quatre positions : blocs dédiés de la feuille (bas et haut, droite et gauche), jamais de retournement', () => {
    expect(spriteStateFor({ ...ground, facing: -1, speed: 3 })).toEqual({ kind: 'anim', name: 'run', facing: 'left', heading: 'down' });
    expect(spriteStateFor({ ...ground, heading: 'up', speed: 3 })).toMatchObject({ name: 'run', heading: 'up' });
    const air = (facing: number, heading: Heading) => frameIndex(spriteStateFor({ ...ground, airborne: true, jumpKind: 'block', facing, heading }) as never);
    const n = FRAMES.length;
    expect(n).toBe(19);
    // Blocs : diagonale bas droite, bas gauche, haut droite, haut gauche (le rig : deux bras levés, image 18).
    expect(air(1, 'down')).toBe(18);
    expect(air(-1, 'down')).toBe(n + 18);
    expect(air(1, 'up')).toBe(2 * n + 18);
    expect(air(-1, 'up')).toBe(3 * n + 18);
    const keys = (['down', 'up'] as const).flatMap((h) => [animationKey('p', 'run', 'right', h), animationKey('p', 'run', 'left', h)]);
    expect(new Set(keys).size).toBe(4);
    expect(animationKey('p', 'run', 'right', 'down')).toBe('p:run');
  });

  it('course et dribbles en 600 ms (décision de Matheo), au rythme du dribble du monde, dans les deux rendus', () => {
    expect(WORLD_TUNING.dribblePeriod).toBe(0.6);
    for (const layout of [RIG_LAYOUT, LAYOUT_2D]) {
      const total = (name: 'dribble' | 'dribbleIdle' | 'run') => layout.animations[name].durations.reduce((a, b) => a + b, 0);
      expect(total('dribble')).toBe(WORLD_TUNING.dribblePeriod * 1000);
      expect(total('dribbleIdle')).toBe(WORLD_TUNING.dribblePeriod * 1000);
    }
    expect(LAYOUT_2D.animations.run.durations.reduce((a, b) => a + b, 0)).toBe(RUN_CYCLE_MS);
    expect(LAYOUT_2D.animations.run.frames).toHaveLength(8);
    expect(LAYOUT_2D.animations.dribble.frames).toHaveLength(8);
  });
});

describe('gestes : l’image suit la phase du saut et le temps écoulé', () => {
  const air = (time: number, rising: boolean, progress: number) => ({ time, rising, progress });
  const flying = { ...ground, airborne: true };
  const pick = (body: Parameters<typeof spriteStateFor>[0]) => {
    const s = spriteStateFor(body);
    return s.kind === 'frame' ? `${s.gesture}:${s.step}` : s.name;
  };

  it('tir en suspension : ramassage, montée, point de déclenchement, lâcher, retombée', () => {
    const shot = { ...flying, holding: true, shot: 'jump' as const };
    expect(pick({ ...shot, air: air(0.03, true, 0.1) })).toBe('jumpShot:0');
    expect(pick({ ...shot, air: air(0.2, true, 0.4) })).toBe('jumpShot:1');
    expect(pick({ ...shot, air: air(0.4, true, 0.8) })).toBe('jumpShot:2');
    expect(pick({ ...shot, air: air(0.6, false, 0.95) })).toBe('jumpShot:2');
    const after = { ...flying, shot: 'jump' as const, followThrough: true };
    expect(pick({ ...after, air: air(0.65, false, 0.95), sinceRelease: 0.05 })).toBe('jumpShot:3');
    expect(pick({ ...after, air: air(0.9, false, 0.5), sinceRelease: 0.3 })).toBe('jumpShot:4');
  });

  it('layup : deuxième appui, envol, extension, après le lâcher', () => {
    const lay = { ...flying, holding: true, shot: 'layup' as const };
    expect(pick({ ...lay, air: air(0.02, true, 0.05) })).toBe('layup:0');
    expect(pick({ ...lay, air: air(0.2, true, 0.3) })).toBe('layup:1');
    expect(pick({ ...lay, air: air(0.4, true, 0.8) })).toBe('layup:2');
    expect(pick({ ...flying, shot: 'layup', followThrough: true, air: air(0.6, false, 0.7) })).toBe('layup:3');
  });

  it('dunk : ramassage, armé en montant, smash au sommet, accroche après le smash', () => {
    const dunk = { ...flying, holding: true, shot: 'dunk' as const };
    expect(pick({ ...dunk, air: air(0.02, true, 0.05) })).toBe('dunk:0');
    expect(pick({ ...dunk, air: air(0.2, true, 0.4) })).toBe('dunk:1');
    expect(pick({ ...dunk, air: air(0.4, true, 0.9) })).toBe('dunk:2');
    expect(pick({ ...flying, shot: 'dunk', air: air(0.6, false, 1) })).toBe('dunk:3');
  });

  it('sans le ballon : contre (impulsion puis verticalité), rebond (ballon sous le menton une fois pris), entre-deux', () => {
    expect(pick({ ...flying, jumpKind: 'block', air: air(0.1, true, 0.3) })).toBe('block:0');
    expect(pick({ ...flying, jumpKind: 'block', air: air(0.3, true, 0.8) })).toBe('block:1');
    expect(pick({ ...flying, jumpKind: 'blockOff', air: air(0.3, false, 0.8) })).toBe('blockOff:1');
    expect(pick({ ...flying, jumpKind: 'rebound', air: air(0.3, true, 0.8) })).toBe('rebound:0');
    expect(pick({ ...flying, jumpKind: 'rebound', holding: true, air: air(0.4, false, 0.8) })).toBe('rebound:1');
    expect(pick({ ...flying, jumpKind: 'tipoff', air: air(0.3, true, 0.8) })).toBe('tipoff:0');
    // Saut sans contexte : deux mains hautes.
    expect(pick({ ...flying, air: air(0.3, true, 0.8) })).toBe('rebound:0');
  });

  it('contre de la main en face de la main de tir adverse', () => {
    expect(blockGesture('droite', 'droite')).toBe('blockOff');
    expect(blockGesture('droite', 'gauche')).toBe('block');
    expect(blockGesture('gauche', 'droite')).toBe('block');
    expect(blockGesture('gauche', 'gauche')).toBe('blockOff');
  });

  it('au sol : lancer franc, vol, déséquilibre, passe (lobée si longue), réception, réception au sol', () => {
    expect(pick({ ...ground, holding: true, freeThrow: { stage: 'setup' } })).toBe('freeThrow:0');
    expect(pick({ ...ground, holding: true, freeThrow: { stage: 'aim' } })).toBe('freeThrow:1');
    expect(pick({ ...ground, freeThrow: { stage: 'after', since: 0.05 } })).toBe('freeThrow:2');
    expect(pick({ ...ground, freeThrow: { stage: 'after', since: 0.3 } })).toBe('freeThrow:3');
    expect(pick({ ...ground, freeThrow: { stage: 'after', since: 0.5 } })).toBe('idle');
    expect(pick({ ...ground, sinceReach: 0.05 })).toBe('steal:0');
    expect(pick({ ...ground, sinceReach: 0.2 })).toBe('steal:1');
    expect(pick({ ...ground, offBalance: true })).toBe('offBalance:0');
    expect(pick({ ...ground, sincePass: 0.03 })).toBe('pass:0');
    expect(pick({ ...ground, sincePass: 0.2 })).toBe('pass:1');
    expect(pick({ ...ground, sincePass: 0.2, lob: true })).toBe('lobPass:1');
    expect(pick({ ...ground, sincePass: 0.3 })).toBe('idle');
    expect(pick({ ...ground, catching: true })).toBe('catch:0');
    expect(pick({ ...ground, sinceLanding: 0.05 })).toBe('landing:0');
    expect(pick({ ...ground, sinceLanding: 0.05, holding: true })).toBe('dribbleIdle');
    expect(pick({ ...ground, sinceLanding: 0.2, speed: 4 })).toBe('run');
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
    expect(animTimeScale(run, 5.5)).toBeCloseTo(1.1, 5);
    expect(animTimeScale(run, 20)).toBe(PLAYER_VIEW_TUNING.cadence[1]);
    expect(animTimeScale(run, 1)).toBe(PLAYER_VIEW_TUNING.cadence[0]);
    expect(animTimeScale(spriteStateFor({ ...ground, speed: 7, holding: true }), 5.5)).toBeCloseTo(1.1, 5);
  });

  it('à pleine vitesse, entre 3,4 et 4,2 pas par seconde (cadence d’un sprint réel)', () => {
    const stepsPerSecond = (speed: number) => (2 * animTimeScale(run, speed) * 1000) / RUN_CYCLE_MS;
    expect(stepsPerSecond(7.2)).toBeGreaterThanOrEqual(3.4);
    expect(stepsPerSecond(7.2)).toBeLessThanOrEqual(4.2);
    expect(stepsPerSecond(PLAYER_VIEW_TUNING.strideSpeed)).toBeCloseTo(3.33, 1);
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
