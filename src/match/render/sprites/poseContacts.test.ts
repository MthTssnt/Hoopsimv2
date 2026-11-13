import { describe, expect, it } from 'vitest';
import manifest from '../../../assets/players/painted/manifest.json';
import { contactPoint, POSE_CONTACTS } from './poseContacts';

describe('contacts explicites reconstruits', () => {
  it('couvre les 1 680 poses sans masque sortant de sa source', () => {
    expect(POSE_CONTACTS).toHaveLength(manifest.length);
    POSE_CONTACTS.forEach((atlas, a) => {
      expect(atlas.file).toBe(manifest[a].file);
      expect(atlas.frames).toHaveLength(84);
      atlas.frames.forEach((frame, f) => {
        const source = manifest[a].frames[f];
        if (frame.contact) expect(frame.ball).not.toBeNull();
        frame.fingers.forEach(([y, x, width]) => {
          expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
          expect(width).toBeGreaterThan(0); expect(x + width).toBeLessThanOrEqual(source.width);
          expect(y).toBeLessThan(source.height);
        });
      });
    });
  });
  it('conserve exactement la symétrie des repères aux tailles et corpulences extrêmes', () => {
    for (const height of [39, 45, 51]) for (const heavy of [false, true]) {
      const sy = height / 48, sx = sy * (heavy ? 1.1 : 1);
      for (const atlas of POSE_CONTACTS) for (const frame of atlas.frames) {
        for (const point of [frame.ball, frame.palm]) if (point) {
          const right = contactPoint(point, sx, sy, false), left = contactPoint(point, sx, sy, true);
          expect(right.x + left.x).toBeCloseTo(96); expect(right.y).toBe(left.y);
        }
      }
    }
  });
});
