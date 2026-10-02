import { describe, expect, it } from 'vitest';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { integerZoom } from './screen';

describe('mise à l’échelle entière', () => {
  it('prend le plus grand facteur entier qui tient dans la fenêtre', () => {
    expect(integerZoom(1920, 1080, VIEW_WIDTH, VIEW_HEIGHT)).toBe(4); // 1080p plein écran
    expect(integerZoom(1920, 950, VIEW_WIDTH, VIEW_HEIGHT)).toBe(3); // fenêtre de navigateur en 1080p
    expect(integerZoom(1366, 768, VIEW_WIDTH, VIEW_HEIGHT)).toBe(2); // portable
    expect(integerZoom(3840, 2160, VIEW_WIDTH, VIEW_HEIGHT)).toBe(8); // 4K
  });

  it('ne descend jamais sous ×1', () => {
    expect(integerZoom(300, 200, VIEW_WIDTH, VIEW_HEIGHT)).toBe(1);
  });
});
