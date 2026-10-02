import { describe, expect, it } from 'vitest';
import { PALETTE, teamRamp } from '../../../assets/palette';
import { HAIRS } from '../../../assets/sprites/heads';
import { createNewGame, TEAM_SEEDS } from '../../../engine';
import { appearanceFor, appearanceSignature, type Appearance } from './appearance';
import { colorsFor, composeFrame, slotColor } from './compose';
import { colorDistance, teamLook } from '../arena/draw';
import { VISUAL_SCALE } from '../artConfig';
import { bodyDims, FRAME, FRAMES, HEAD_SIZE } from './rig';
import { drawJerseyNumber, JERSEY_DIGITS, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import { NUMBER_MIN_TORSO, NUMBER_TOP, numberZone } from './compose';

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
        composeFrame(look, frame, bodyDims(look.heightCm, look.heavy, VISUAL_SCALE)).canvas.forEach((_x, _y, slot) => {
          expect(allowed.has(slotColor(slot, colors))).toBe(true);
        });
      }
    }
  });

  it('tiennent dans leur cadre, contour compris, avec de la marge au-delà de l’échelle choisie', () => {
    for (const scale of [VISUAL_SCALE, 1.25]) {
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
      const b = composeFrame(look, FRAMES[i], bodyDims(200, false, VISUAL_SCALE)).canvas.bounds()!;
      expect(b.bottom).toBe(FRAME.groundY); // contour sous la semelle
    }
  });

  it('ont un contour complet : aucun pixel coloré ne touche le vide', () => {
    for (const look of sample().slice(0, 6)) {
      for (const frame of FRAMES) {
        const c = composeFrame(look, frame, bodyDims(look.heightCm, look.heavy, VISUAL_SCALE)).canvas;
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
    const box = (heightCm: number, heavy: boolean, scale = VISUAL_SCALE) =>
      composeFrame({ ...look, heightCm, heavy }, FRAMES[0], bodyDims(heightCm, heavy, scale)).canvas.bounds()!;
    const light = box(200, false);
    const heavy = box(200, true);
    expect(heavy.right - heavy.left).toBeGreaterThan(light.right - light.left);
    expect(box(220, false).top).toBeLessThan(box(185, false).top);
    expect(box(200, false, 1.4).top).toBeLessThan(box(200, false, 1.1).top);
  });

  it('gardent une grosse tête (un quart à deux cinquièmes de la hauteur), et un joueur de 2 m vers 45 px', () => {
    for (const heightCm of [180, 200, 220]) {
      const dims = bodyDims(heightCm, false, VISUAL_SCALE);
      expect(HEAD_SIZE / dims.height).toBeGreaterThan(0.24);
      expect(HEAD_SIZE / dims.height).toBeLessThan(0.43);
    }
    expect(bodyDims(200, false, VISUAL_SCALE).height).toBe(45);
  });

  it('accentuent les gabarits : un pivot dépasse un meneur d’environ une tête et il est plus large', () => {
    const box = (heightCm: number, heavy: boolean, number: number) =>
      composeFrame({ ...looks[0], heightCm, heavy, number }, FRAMES[0], bodyDims(heightCm, heavy, VISUAL_SCALE)).canvas.bounds()!;
    const guard = box(186, false, 12);
    const center = box(212, true, 16);
    expect(guard.top - center.top).toBeGreaterThanOrEqual(12);
    expect(center.right - center.left - (guard.right - guard.left)).toBeGreaterThanOrEqual(4);
  });

  it('placent le ballon dans la main pendant le dribble et le tir', () => {
    const dims = bodyDims(200, false, VISUAL_SCALE);
    const anchors = FRAMES.map((frame) => composeFrame(looks[0], frame, dims).ball);
    expect(anchors[6]).not.toBeNull();
    expect(anchors[8]!.y).toBeGreaterThan(anchors[6]!.y); // ballon au sol plus bas que dans la main
    expect(anchors[13]!.y).toBeLessThan(anchors[12]!.y); // ballon levé au-dessus de la tête
    expect(anchors[14]).toBeNull(); // lâché
  });
});

describe('numéros de maillot', () => {
  it('ont 10 chiffres tous différents, de 5 rangées, avec un « 1 » étroit', () => {
    expect(new Set(JERSEY_DIGITS.map((g) => g.join('/'))).size).toBe(10);
    for (const glyph of JERSEY_DIGITS) expect(glyph).toHaveLength(5);
    expect(JERSEY_DIGITS[1][0]).toHaveLength(2);
  });

  it('se lisent à l’endroit dans les deux orientations (jamais en miroir)', () => {
    const expected: string[] = [];
    drawJerseyNumber(12, 0, 0, (x, y) => void expected.push(`${x},${y}`));
    for (const facing of ['right', 'left'] as const) {
      const look = { ...looks[0], heightCm: 186, heavy: false, number: 12 };
      const { canvas, numberAt } = composeFrame(look, FRAMES[0], bodyDims(186, false, VISUAL_SCALE), 'team', facing);
      const drawn: string[] = [];
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < jerseyNumberWidth(12); x++) if (canvas.get(numberAt!.x + x, numberAt!.y + y) === 'S') drawn.push(`${x},${y}`);
      }
      expect(drawn.sort()).toEqual([...expected].sort());
    }
  });

  it('tiennent tous (0 à 99) dans la zone visible du torse le plus étroit, sous le col', () => {
    const narrowest = Math.min(...[180, 200, 220].flatMap((h) => [false, true].map((heavy) => bodyDims(h, heavy, VISUAL_SCALE).torsoWidth)));
    for (let n = 0; n < 100; n++) expect(jerseyNumberWidth(n)).toBeLessThanOrEqual(numberZone(narrowest).width);
    expect(NUMBER_TOP).toBeGreaterThanOrEqual(2); // une rangée de maillot entre le col et le chiffre
    expect(NUMBER_MIN_TORSO).toBeLessThanOrEqual(bodyDims(170, false, VISUAL_SCALE).torso);
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

  it('gardent numéros et noms lisibles sur le maillot de chaque équipe', () => {
    for (const seed of TEAM_SEEDS) {
      const look = teamLook(seed);
      expect(colorDistance(look.secondary[1], look.primary[1])).toBeGreaterThanOrEqual(130);
    }
  });

  it('la palette maîtresse compte 32 couleurs distinctes', () => {
    const colors = Object.values(PALETTE);
    expect(colors).toHaveLength(32);
    expect(new Set(colors).size).toBe(32);
  });
});
