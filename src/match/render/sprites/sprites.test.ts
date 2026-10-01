import { describe, expect, it } from 'vitest';
import { PALETTE, teamRamp } from '../../../assets/palette';
import { HAIRS } from '../../../assets/sprites/heads';
import { createNewGame, TEAM_SEEDS } from '../../../engine';
import { appearanceFor, appearanceSignature, type Appearance } from './appearance';
import { colorsFor, composeFrame, slotColor } from './compose';
import { bodyDims, FRAME, FRAMES } from './rig';

const players = Object.values(createNewGame('bos', 11).players);
const looks = players.map((p) => appearanceFor(p));
const team = TEAM_SEEDS[0];
const primary = teamRamp(team.colors.primary);
const secondary = teamRamp(team.colors.secondary);
const allowed = new Set<number>([...Object.values(PALETTE), ...primary, ...secondary]);

/** Un échantillon varié : toutes les coiffures, les deux corpulences, petits et grands. */
function sample(): Appearance[] {
  const out: Appearance[] = [];
  for (let hair = 0; hair < HAIRS.length; hair++) {
    for (const [heightCm, heavy] of [
      [183, false],
      [201, true],
      [226, true],
    ] as const) {
      out.push({ ...looks[hair], hair, heightCm, heavy, skin: hair % 4, head: hair % 4, face: (hair + 1) % 4, number: 7 + hair * 6 });
    }
  }
  return out;
}

describe('sprites des joueurs', () => {
  it('n’emploient que la palette maîtresse et les rampes de l’équipe', () => {
    for (const look of sample()) {
      const colors = colorsFor(look, primary, secondary);
      for (const frame of FRAMES) {
        composeFrame(look, frame, bodyDims(look.heightCm, look.heavy, 1.4)).canvas.forEach((_x, _y, slot) => {
          expect(allowed.has(slotColor(slot, colors))).toBe(true);
        });
      }
    }
  });

  it('tiennent dans leur cadre, contour compris, à toutes les échelles', () => {
    for (const scale of [1.1, 1.25, 1.4]) {
      for (const look of sample()) {
        for (const frame of FRAMES) {
          const b = composeFrame(look, frame, bodyDims(look.heightCm, look.heavy, scale)).canvas.bounds()!;
          expect(b.left).toBeGreaterThanOrEqual(0);
          expect(b.right).toBeLessThan(FRAME.width);
          expect(b.top).toBeGreaterThan(0);
          expect(b.bottom).toBeLessThanOrEqual(FRAME.groundY);
        }
      }
    }
  });

  it('posent les pieds au sol dans les images au sol', () => {
    const look = looks[0];
    for (const i of [0, 1, 2, 4, 10, 12, 15]) {
      const b = composeFrame(look, FRAMES[i], bodyDims(200, false, 1.25)).canvas.bounds()!;
      expect(b.bottom).toBe(FRAME.groundY); // contour sous la semelle
    }
  });

  it('ont un contour complet : aucun pixel coloré ne touche le vide', () => {
    for (const look of sample().slice(0, 6)) {
      for (const frame of FRAMES) {
        const c = composeFrame(look, frame, bodyDims(look.heightCm, look.heavy, 1.25)).canvas;
        c.forEach((x, y, slot) => {
          if (slot === 'o') return;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            expect(c.get(x + dx, y + dy)).not.toBeNull();
          }
        });
      }
    }
  });

  it('élargissent les lourds et grandissent les grands, et suivent l’échelle visuelle', () => {
    const look = looks[0];
    const box = (heightCm: number, heavy: boolean, scale = 1.25) =>
      composeFrame({ ...look, heightCm, heavy }, FRAMES[0], bodyDims(heightCm, heavy, scale)).canvas.bounds()!;
    const light = box(200, false);
    const heavy = box(200, true);
    expect(heavy.right - heavy.left).toBeGreaterThan(light.right - light.left);
    expect(box(220, false).top).toBeLessThan(box(185, false).top);
    expect(box(200, false, 1.4).top).toBeLessThan(box(200, false, 1.1).top);
  });

  it('gardent la tête autour du tiers de la hauteur', () => {
    for (const scale of [1.1, 1.25, 1.4]) {
      const dims = bodyDims(200, false, scale);
      expect(10 / dims.height).toBeGreaterThan(0.25);
      expect(10 / dims.height).toBeLessThan(0.42);
    }
  });

  it('placent le ballon dans la main pendant le dribble et le tir', () => {
    const dims = bodyDims(200, false, 1.25);
    const anchors = FRAMES.map((frame) => composeFrame(looks[0], frame, dims).ball);
    expect(anchors[6]).not.toBeNull();
    expect(anchors[8]!.y).toBeGreaterThan(anchors[6]!.y); // ballon au sol plus bas que dans la main
    expect(anchors[13]!.y).toBeLessThan(anchors[12]!.y); // ballon levé au-dessus de la tête
    expect(anchors[14]).toBeNull(); // lâché
  });
});

describe('apparence des joueurs', () => {
  it('donne des joueurs tous différents (≥ 95 % d’apparences distinctes sur 200)', () => {
    const sample200 = looks.slice(0, 200);
    expect(sample200).toHaveLength(200);
    const distinct = new Set(sample200.map(appearanceSignature));
    expect(distinct.size / sample200.length).toBeGreaterThanOrEqual(0.95);
  });

  it('est déterministe et suit le physique', () => {
    const p = players[0];
    expect(appearanceFor(p)).toEqual(appearanceFor({ ...p }));
    const tallHeavy = appearanceFor({ id: 'x', heightCm: 214, weightKg: 130, number: 50 });
    expect(tallHeavy.heightClass).toBe('grand');
    expect(tallHeavy.heavy).toBe(true);
    expect(appearanceFor({ id: 'y', heightCm: 185, weightKg: 82, number: 3 }).heightClass).toBe('petit');
  });
});

describe('rampes d’équipe', () => {
  it('restent lisibles même pour une couleur presque noire', () => {
    const [light, base, dark] = teamRamp('#111827');
    expect(light).toBeGreaterThan(base);
    expect(dark).toBeLessThanOrEqual(base);
    expect(((light >> 16) & 0xff) + ((light >> 8) & 0xff) + (light & 0xff)).toBeGreaterThan(150);
  });

  it('la palette maîtresse compte 32 couleurs distinctes', () => {
    const colors = Object.values(PALETTE);
    expect(colors).toHaveLength(32);
    expect(new Set(colors).size).toBe(32);
  });
});
