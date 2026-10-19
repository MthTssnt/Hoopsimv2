import { describe, expect, it } from 'vitest';
import { animsReels, JUMP_PX, liftAt, reelAt, reelLength } from './animsReel';
import { GESTURES, LAYOUT_2D } from './sprites/layout';

describe('page ?anims : bobines des gestes', () => {
  const reels = animsReels();

  it('une bobine par animation en boucle et par geste, avec toutes ses images', () => {
    expect(reels).toHaveLength(4 + GESTURES.length);
    for (const g of GESTURES) {
      const reel = reels.find((r) => r.id === g)!;
      for (const frame of LAYOUT_2D.gestures[g]) expect(reel.frames.some((f) => f.frame === frame), g).toBe(true);
    }
    expect(reelLength(reels.find((r) => r.id === 'run')!)).toBe(600);
  });

  it('suit le temps en boucle ; un geste en l’air monte puis redescend (parabole), au sol rien', () => {
    const shot = reels.find((r) => r.id === 'jumpShot')!;
    expect(reelAt(shot, 0).index).toBe(0);
    expect(reelAt(shot, reelLength(shot)).index).toBe(0);
    const airIndex = shot.frames.findIndex((f) => f.air);
    expect(liftAt(shot, 0, 0)).toBe(0);
    const lifts = shot.frames.map((f, i) => (f.air ? liftAt(shot, i, f.ms / 2) : 0));
    expect(Math.max(...lifts)).toBeLessThanOrEqual(JUMP_PX);
    expect(Math.max(...lifts)).toBeGreaterThan(JUMP_PX / 2);
    expect(liftAt(shot, airIndex, 0)).toBe(0);
  });
});
