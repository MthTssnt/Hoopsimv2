import { describe, expect, it } from 'vitest';
import { WORLD_TUNING } from '../../world/MatchWorld';
import { renderAthlete, ATHLETE_FRAME, type AthleteFacing, type AthleteHair, type AthleteHeading, type AthleteLook } from './athlete';
import { mirrorPose, sampleFrames, type SampleAnimation } from './athleteAnims';
import { athleteSheet, SAMPLE_ANIMATIONS, SAMPLE_VIEWS } from './athleteBake';
import { framesToPixels } from './bake';
import type { SlotCanvas, Slot } from './canvas';

const AILIER: AthleteLook = { heightCm: 200, heavy: false, hair: 'court', number: 23 };
/** Emplacements du contour : ombres profondes de chaque matière, encre et contour. */
const OUTLINE: ReadonlySet<Slot> = new Set<Slot>(['4', 'Q', 'T', 'E', 'k', 'o']);
const EYE: Slot = 'n';

function frameOf(anim: SampleAnimation, k: number, heading: AthleteHeading = 'down', facing: AthleteFacing = 'right', look = AILIER) {
  const f = mirrorPose(sampleFrames(anim, heading)[k], facing);
  return renderAthlete(look, f.lower, f.upper, heading, facing);
}

function count(c: SlotCanvas, slot: Slot): number {
  let n = 0;
  c.forEach((_x, _y, s) => (n += s === slot ? 1 : 0));
  return n;
}

describe('style en volumes : proportions', () => {
  it('ailier à ~42 px au-dessus du sol à l’arrêt ; meneur 3 de moins, pivot 3 de plus ; même tête', () => {
    const top = (heightCm: number, heavy = false) => {
      const f = sampleFrames('idle')[0];
      return renderAthlete({ ...AILIER, heightCm, heavy }, f.lower, f.upper, 'down', 'right').canvas.bounds()!.top;
    };
    const ailier = ATHLETE_FRAME.groundY - top(200);
    expect(ailier).toBeGreaterThanOrEqual(41);
    expect(ailier).toBeLessThanOrEqual(43);
    expect(ATHLETE_FRAME.groundY - top(186) - ailier).toBeGreaterThanOrEqual(-4);
    expect(ATHLETE_FRAME.groundY - top(186) - ailier).toBeLessThanOrEqual(-2);
    expect(ATHLETE_FRAME.groundY - top(212) - ailier).toBeGreaterThanOrEqual(2);
    expect(ATHLETE_FRAME.groundY - top(212) - ailier).toBeLessThanOrEqual(4);
  });

  it('pieds au sol à l’arrêt et au dribble (le pied qui avance vers la caméra descend un peu), en l’air au tir', () => {
    for (const { heading, facing } of SAMPLE_VIEWS) {
      for (const anim of ['idle', 'dribbleIdle'] as const) {
        const bottom = frameOf(anim, 0, heading, facing).canvas.bounds()!.bottom;
        expect(bottom, `${anim} ${heading} ${facing}`).toBeGreaterThanOrEqual(ATHLETE_FRAME.groundY);
        expect(bottom).toBeLessThan(ATHLETE_FRAME.height);
      }
      const apex = frameOf('shoot', 2, heading, facing).canvas.bounds()!.bottom;
      const stand = frameOf('idle', 0, heading, facing).canvas.bounds()!.bottom;
      expect(apex, `tir ${heading} ${facing}`).toBeLessThan(stand - 2);
    }
  });
});

describe('style en volumes : dessin', () => {
  const all = athleteSheet(AILIER).frames;

  it('contour coloré fermé : tout pixel au bord de la silhouette est une ombre profonde (jamais un ton clair)', () => {
    const bad: string[] = [];
    all.forEach(({ canvas }, i) => {
      canvas.forEach((x, y, slot) => {
        if (OUTLINE.has(slot)) return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (canvas.get(x + dx, y + dy) === null) bad.push(`${i}:${x},${y}`);
      });
    });
    expect(bad).toEqual([]);
  });

  it('pas de noir hors des chaussures : le contour noir touche toujours une chaussure', () => {
    const shoe: ReadonlySet<Slot | null> = new Set<Slot | null>(['k', 'G', 'o']);
    const stray: string[] = [];
    all.forEach(({ canvas }, i) => {
      canvas.forEach((x, y, slot) => {
        if (slot !== 'o') return;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && shoe.has(canvas.get(x + dx, y + dy)) && canvas.get(x + dx, y + dy) !== null) return;
        stray.push(`${i}:${x},${y}`);
      });
    });
    expect(stray).toEqual([]);
  });

  it('aucun trou entre le haut et le bas du corps : la silhouette est d’un seul tenant', () => {
    all.forEach(({ canvas }, i) => {
      const b = canvas.bounds()!;
      const start = [...Array(b.right - b.left + 1).keys()].map((k) => b.left + k).find((x) => canvas.get(x, b.bottom) !== null)!;
      const seen = new Set<string>([`${start},${b.bottom}`]);
      const stack: [number, number][] = [[start, b.bottom]];
      while (stack.length) {
        const [x, y] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const key = `${x + dx},${y + dy}`;
          if (!seen.has(key) && canvas.get(x + dx, y + dy) !== null) {
            seen.add(key);
            stack.push([x + dx, y + dy]);
          }
        }
      }
      let painted = 0;
      canvas.forEach(() => painted++);
      expect(seen.size, `image ${i}`).toBe(painted);
    });
  });

  it('aucun pixel isolé dans les tons de base et d’ombre (hors reflets, numéro et traits du visage)', () => {
    const tones: ReadonlySet<Slot> = new Set<Slot>(['1', '2', '3', 'p', 'P', 'q', 'h', 'H', 'D']);
    // Les chiffres du numéro et les traits du visage dessinent volontairement de petites formes.
    const details: ReadonlySet<Slot | null> = new Set<Slot | null>(['s', 'S', 't', 'n', 'E']);
    const lonely: string[] = [];
    all.forEach(({ canvas }, i) => {
      canvas.forEach((x, y, slot) => {
        if (!tones.has(slot)) return;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const n = canvas.get(x + dx, y + dy);
            if (n === slot || details.has(n)) return;
          }
        }
        lonely.push(`${i}:${slot}@${x},${y}`);
      });
    });
    expect(lonely.length, lonely.slice(0, 8).join(' ')).toBeLessThanOrEqual(Math.ceil(all.length / 4));
  });

  it('visage de 3/4 en diagonale bas (yeux), aucun visage de dos ; numéro sur le maillot', () => {
    for (const facing of ['right', 'left'] as const) {
      const down = frameOf('idle', 0, 'down', facing).canvas;
      const up = frameOf('idle', 0, 'up', facing).canvas;
      expect(count(down, EYE), facing).toBeGreaterThanOrEqual(2);
      expect(count(up, EYE), facing).toBe(0);
      for (const c of [down, up]) expect(count(c, 'S') + count(c, 's') + count(c, 't')).toBeGreaterThan(6);
    }
  });

  it('les 3 coiffures dégagent le visage', () => {
    for (const hair of ['court', 'afro', 'tresses'] as AthleteHair[]) {
      expect(count(frameOf('idle', 0, 'down', 'right', { ...AILIER, hair }).canvas, EYE), hair).toBeGreaterThanOrEqual(2);
    }
  });

  it('déterministe : les mêmes entrées donnent les mêmes pixels', () => {
    const a = frameOf('run', 3).canvas;
    const b = frameOf('run', 3).canvas;
    const px: string[] = [];
    a.forEach((x, y, s) => px.push(`${x},${y},${s}`));
    const py: string[] = [];
    b.forEach((x, y, s) => py.push(`${x},${y},${s}`));
    expect(py).toEqual(px);
  });
});

describe('style en volumes : animations', () => {
  it('course en 8 images : chaque jambe passe devant à son tour', () => {
    const run = sampleFrames('run');
    expect(run).toHaveLength(8);
    expect(run[0].lower.legs[0].hip).toBeGreaterThan(run[0].lower.legs[1].hip);
    expect(run[4].lower.legs[1].hip).toBeGreaterThan(run[4].lower.legs[0].hip);
  });

  it('dribble calé sur le monde : 8 images en une période, le ballon touche le sol à l’image 3', () => {
    for (const anim of ['dribble', 'dribbleIdle'] as const) {
      const frames = sampleFrames(anim);
      expect(frames).toHaveLength(8);
      expect(frames.reduce((t, f) => t + f.ms, 0)).toBeCloseTo(WORLD_TUNING.dribblePeriod * 1000, 6);
      for (const heading of ['down', 'up'] as const) {
        const ballY = (k: number) => frameOf(anim, k, heading).ball!.y;
        // Au sol : le bas du ballon (rayon 4) touche la hauteur des pieds, à la profondeur de la main.
        expect(ballY(3), `${anim} ${heading}`).toBeGreaterThanOrEqual(ATHLETE_FRAME.groundY - 9);
        expect(ballY(0)).toBeLessThan(ballY(3) - 8);
      }
    }
  });

  it('ballon devant le corps au dribble en diagonale bas (le pied avant peut passer devant au rebond)', () => {
    const front = [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => frameOf('dribble', k).ball!.front);
    expect(front.length).toBeGreaterThanOrEqual(7);
    for (const k of [0, 6, 7]) expect(front).toContain(k);
  });

  it('vers la gauche : la pose est retournée (jambes et bras échangés, ballon dans l’autre main)', () => {
    const f = sampleFrames('dribble')[2];
    const m = mirrorPose(f, 'left');
    expect(m.lower.legs[0]).toEqual(f.lower.legs[1]);
    expect(m.upper.arms[1]).toEqual(f.upper.arms[0]);
    expect(m.upper.ball).toEqual({ ...f.upper.ball, hand: 0 });
    expect(mirrorPose(f, 'right')).toBe(f);
  });
});

describe('cuisson de l’échantillon', () => {
  it('une image par animation et par position, rangées en grille', () => {
    const { frames, starts } = athleteSheet(AILIER, SAMPLE_ANIMATIONS);
    const perView = SAMPLE_ANIMATIONS.reduce((n, a) => n + sampleFrames(a).length, 0);
    expect(frames).toHaveLength(perView * SAMPLE_VIEWS.length);
    expect(starts.get('run:up:left')).toBe(3 * perView + sampleFrames('idle').length);
    const sheet = framesToPixels(
      frames.slice(0, 40).map((f) => f.canvas),
      () => 0xffffff,
      16,
    );
    expect(sheet.width).toBe(16 * ATHLETE_FRAME.width);
    expect(sheet.height).toBe(3 * ATHLETE_FRAME.height);
    expect(new Set(sheet.cells.map((c) => `${c.x},${c.y}`)).size).toBe(40);
  });
});
