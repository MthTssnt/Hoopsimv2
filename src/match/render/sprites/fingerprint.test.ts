import { describe, expect, it } from 'vitest';
import type { Appearance } from './appearance';
import { composeFrame, type Facing, type Heading, type Kit } from './compose';
import { BACK_FRAMES, bodyDims, FRAME, FRAMES } from './rig';

/**
 * Empreinte des images de profil et de dos (incrément 15 bis) : elle garantit que l'accélération
 * de la composition et l'ajout des vues de 3/4 ne changent pas un pixel des vues existantes.
 * À ne mettre à jour que si l'on redessine volontairement le profil ou le dos.
 */
const LOOKS: Appearance[] = [
  { heightCm: 186, heavy: false, heightClass: 'petit', skin: 0, head: 0, hair: 0, hairColor: 0, number: 12 },
  { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 1, hair: 3, hairColor: 1, number: 23 },
  { heightCm: 200, heavy: true, heightClass: 'moyen', skin: 2, head: 2, hair: 5, hairColor: 2, number: 7 },
  { heightCm: 212, heavy: false, heightClass: 'grand', skin: 3, head: 3, hair: 7, hairColor: 3, number: 16 },
  { heightCm: 215, heavy: true, heightClass: 'grand', skin: 2, head: 4, hair: 9, hairColor: 4, number: 99 },
  { heightCm: 190, heavy: true, heightClass: 'petit', skin: 1, head: 2, hair: 2, hairColor: 0, number: 0 },
];

function fingerprint(): string {
  let hash = 0x811c9dc5;
  const add = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  const kits: [Appearance, Kit][] = [...LOOKS.map((look): [Appearance, Kit] => [look, 'team']), [LOOKS[1], 'referee']];
  for (const [look, kit] of kits) {
    const dims = bodyDims(look.heightCm, look.heavy);
    for (const heading of ['side', 'back'] as Heading[]) {
      for (const facing of ['right', 'left'] as Facing[]) {
        for (const frame of heading === 'back' ? BACK_FRAMES : FRAMES) {
          const { canvas, ball, numberAt } = composeFrame(look, frame, dims, kit, facing, heading);
          let pixels = '';
          for (let y = 0; y < FRAME.height; y++) for (let x = 0; x < FRAME.width; x++) pixels += canvas.get(x, y) ?? '.';
          add(pixels + JSON.stringify(ball) + JSON.stringify(numberAt));
        }
      }
    }
  }
  return hash.toString(16);
}

describe('empreinte des vues de profil et de dos', () => {
  it('ne change pas (composition plus rapide, vues de 3/4 ajoutées à côté)', () => {
    expect(fingerprint()).toBe('50e4793c');
  });
});
