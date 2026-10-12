import { describe, expect, it } from 'vitest';
import { HAIRS_2D, headGrid2D, SHAPES_2D } from '../../../assets/sprites/heads2d';
import type { Expression } from '../../../assets/sprites/heads';
import type { Appearance } from './appearance';
import type { SlotCanvas, Slot } from './canvas';
import { renderFigure2D, renderFigure2DBoth } from './figure2d';
import { poses2D } from './poses2d';
import { FRAME, type Heading } from './rig';
import { build2D, joints2D, project2D } from './skeleton2d';

const AILIER: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 0, hair: 1, hairColor: 0, number: 23 };
const HEADINGS: readonly Heading[] = ['down', 'up'];
const EXPRESSIONS: readonly Expression[] = ['neutre', 'concentree', 'joyeuse'];

const idle = poses2D('idle');
const run = poses2D('run');
const all = [...idle, ...run];

function count(c: SlotCanvas, slots: readonly Slot[]): number {
  let n = 0;
  c.forEach((_x, _y, slot) => (n += slots.includes(slot) ? 1 : 0));
  return n;
}

function pixels(c: SlotCanvas): string[] {
  const out: string[] = [];
  c.forEach((x, y, s) => out.push(`${x},${y},${s}`));
  return out;
}

const height = (look: Appearance, heading: Heading = 'down') => FRAME.groundY - renderFigure2D(look, idle[0].pose, heading).canvas.bounds()!.top;

describe('rendu 2D : proportions et cadre', () => {
  it('ailier ~42 px à l’arrêt (comme les sprites actuels), meneur 2-3 de moins, pivot 2-4 de plus', () => {
    for (const heading of HEADINGS) {
      const ailier = height(AILIER, heading);
      expect(ailier, heading).toBeGreaterThanOrEqual(41);
      expect(ailier).toBeLessThanOrEqual(44);
      expect(height({ ...AILIER, heightCm: 186 }, heading) - ailier).toBeGreaterThanOrEqual(-3);
      expect(height({ ...AILIER, heightCm: 186 }, heading) - ailier).toBeLessThanOrEqual(-1);
      expect(height({ ...AILIER, heightCm: 212 }, heading) - ailier).toBeGreaterThanOrEqual(2);
      expect(height({ ...AILIER, heightCm: 212 }, heading) - ailier).toBeLessThanOrEqual(4);
    }
  });

  it('tête ~1/4 du joueur', () => {
    const head = headGrid2D(AILIER, 'down');
    const rows = head.rows.filter((r) => /[^.]/.test(r)).length;
    expect(rows / height(AILIER)).toBeGreaterThan(0.22);
    expect(rows / height(AILIER)).toBeLessThan(0.3);
  });

  it('pieds sur la rangée du sol (contour dessous) au sol, en l’air à l’envol ; tout tient dans le cadre', () => {
    for (const heading of HEADINGS) {
      for (const [k, f] of all.entries()) {
        const b = renderFigure2D(AILIER, f.pose, heading).canvas.bounds()!;
        expect(b.left, `${heading} ${k}`).toBeGreaterThan(0);
        expect(b.right).toBeLessThan(FRAME.width - 1);
        expect(b.top).toBeGreaterThan(0);
        if (f.pose.lift) expect(b.bottom, `${heading} ${k}`).toBeLessThan(FRAME.groundY);
        else expect(b.bottom, `${heading} ${k}`).toBe(FRAME.groundY);
      }
    }
  });
});

describe('rendu 2D : une seule silhouette', () => {
  const frames = HEADINGS.flatMap((heading) => all.map((f) => renderFigure2D(AILIER, f.pose, heading).canvas));

  it('un seul contour, à l’extérieur : tout bord est du contour, aucun trait sombre isolé dans le corps', () => {
    const bad: string[] = [];
    frames.forEach((c, i) => {
      c.forEach((x, y, slot) => {
        const n4 = [c.get(x + 1, y), c.get(x - 1, y), c.get(x, y + 1), c.get(x, y - 1)];
        if (slot !== 'o' && n4.includes(null)) bad.push(`bord ${i}:${x},${y}`);
        // Le contour ne sert qu'autour de la silhouette (ou d'un vide entre deux membres), jamais entre deux pièces.
        if (slot === 'o' && !n4.some((n) => n === null || n === 'o')) bad.push(`intérieur ${i}:${x},${y}`);
      });
    });
    expect(bad).toEqual([]);
  });

  it('d’un seul tenant', () => {
    frames.forEach((c, i) => {
      const [x0, y0] = pixels(c)[0].split(',').map(Number);
      const seen = new Set([`${x0},${y0}`]);
      const stack = [[x0, y0]];
      while (stack.length) {
        const [x, y] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const key = `${x + dx},${y + dy}`;
          if (!seen.has(key) && c.get(x + dx, y + dy) !== null) {
            seen.add(key);
            stack.push([x + dx, y + dy]);
          }
        }
      }
      expect(seen.size, `image ${i}`).toBe(pixels(c).length);
    });
  });

  it('palette actuelle en 3 tons : aucun ton du style en volumes', () => {
    const extra: readonly Slot[] = ['0', '4', 'D', 'E', 'a', 'Q', 'T'];
    for (const c of frames) expect(count(c, extra)).toBe(0);
  });

  it('lumière en haut à gauche : jamais de ton clair sur le bord droit ou le bord bas d’une pièce', () => {
    const lit: string[] = [];
    frames.forEach((c, i) => {
      c.forEach((x, y, slot) => {
        if (slot !== '1' && slot !== 'p') return;
        const edge = (n: Slot | null) => n === null || n === 'o';
        if (edge(c.get(x + 1, y)) || edge(c.get(x, y + 1))) lit.push(`${i}:${slot}@${x},${y}`);
      });
    });
    expect(lit).toEqual([]);
  });

  it('chaussures à semelle blanche, chaussettes visibles', () => {
    for (const c of frames) {
      expect(count(c, ['G', 'k'])).toBeGreaterThan(6);
      expect(count(c, ['w', 'm'])).toBeGreaterThan(4);
    }
  });
});

describe('rendu 2D : tête, numéro, orientation', () => {
  it('visage en diagonale bas (yeux), aucun visage de dos', () => {
    for (const f of all) {
      expect(count(renderFigure2D(AILIER, f.pose, 'down').canvas, ['n'])).toBeGreaterThanOrEqual(2);
      expect(count(renderFigure2D(AILIER, f.pose, 'up').canvas, ['n'])).toBe(0);
    }
  });

  it('numéro sur la poitrine (diagonale bas) et dans le dos (diagonale haut), à l’arrêt', () => {
    for (const heading of HEADINGS) {
      for (const facing of ['right', 'left'] as const) {
        const { canvas, numberAt } = renderFigure2D(AILIER, idle[0].pose, heading, facing);
        expect(numberAt).not.toBeNull();
        expect(count(canvas, ['S', 't']), `${heading} ${facing}`).toBeGreaterThanOrEqual(14);
      }
    }
    expect(renderFigure2D(AILIER, idle[0].pose, 'down', 'right', 'referee').numberAt).toBeNull();
  });

  it('vers la gauche : le miroir de l’image vers la droite (hors numéro), peinte une seule fois', () => {
    for (const f of [idle[0], run[3]]) {
      const ref = renderFigure2DBoth(AILIER, f.pose, 'down', 'referee');
      expect(pixels(ref.left.canvas)).toEqual(pixels(ref.right.canvas.mirrored()));
      const both = renderFigure2DBoth(AILIER, f.pose, 'down');
      expect(pixels(both.left.canvas)).toEqual(pixels(renderFigure2D(AILIER, f.pose, 'down', 'left').canvas));
      expect(pixels(both.right.canvas)).toEqual(pixels(renderFigure2D(AILIER, f.pose, 'down', 'right').canvas));
    }
  });

  it('tourné vers la droite, on voit le côté droit du joueur dans les deux diagonales', () => {
    const b = build2D(200, false);
    for (const heading of HEADINGS) {
      const J = joints2D(b, idle[0].pose, heading);
      const near = (p: (typeof J.hips)[0]) => project2D(p, 0, 0).near;
      expect(near(J.shoulders[1]), heading).toBeGreaterThan(near(J.shoulders[0]));
      expect(near(J.hips[1])).toBeGreaterThan(near(J.hips[0]));
    }
  });

  it('déterministe', () => {
    expect(pixels(renderFigure2D(AILIER, run[2].pose, 'down').canvas)).toEqual(pixels(renderFigure2D(AILIER, run[2].pose, 'down').canvas));
  });
});

describe('têtes : toutes les variantes existent', () => {
  it('5 formes × 10 coiffures × 3 expressions, dans les deux diagonales ; coiffures toutes différentes', () => {
    expect(SHAPES_2D).toHaveLength(5);
    expect(HAIRS_2D).toHaveLength(10);
    for (const heading of HEADINGS) {
      for (let head = 0; head < 5; head++) {
        const byHair = new Set<string>();
        for (let hair = 0; hair < 10; hair++) {
          for (const expression of EXPRESSIONS) {
            const g = headGrid2D({ head, hair }, heading, expression);
            expect(g.rows.every((r) => r.length === g.rows[0].length)).toBe(true);
            expect(g.rows[g.anchor.y][g.anchor.x], `${heading} ${head} ${hair}`).not.toBe('.');
          }
          byHair.add(headGrid2D({ head, hair }, heading).rows.join('/'));
        }
        expect(byHair.size, `${heading} ${head}`).toBe(10);
      }
    }
  });

  it('les coiffures dégagent les yeux ; les expressions diffèrent', () => {
    for (let head = 0; head < 5; head++) {
      for (let hair = 0; hair < 10; hair++) {
        const eyes = headGrid2D({ head, hair }, 'down').rows.join('').split('n').length - 1;
        expect(eyes, `${head} ${hair}`).toBeGreaterThanOrEqual(2);
      }
      const faces = new Set(EXPRESSIONS.map((e) => headGrid2D({ head, hair: 1 }, 'down', e).rows.join('/')));
      expect(faces.size).toBe(3);
    }
  });

  it('forme de tête et coiffure se voient dans l’image du joueur (teint et couleurs : choisis à la cuisson)', () => {
    const base = pixels(renderFigure2D(AILIER, idle[0].pose, 'down').canvas);
    for (const look of [{ ...AILIER, head: 3 }, { ...AILIER, hair: 2 }]) expect(pixels(renderFigure2D(look, idle[0].pose, 'down').canvas)).not.toEqual(base);
  });
});

describe('poses : arrêt et course', () => {
  const b = build2D(200, false);
  const screen = (heading: Heading, k: number) => {
    const J = joints2D(b, run[k].pose, heading);
    return { neck: project2D(J.neckTop, 0, 0), pelvis: project2D(J.pelvis, 0, 0) };
  };

  it('arrêt : 2 images de 400 ms, respiration d’un pixel, pieds immobiles', () => {
    expect(idle.map((f) => f.ms)).toEqual([400, 400]);
    const [a, c] = idle.map((f) => renderFigure2D(AILIER, f.pose, 'down').canvas);
    expect(a.bounds()!.top - c.bounds()!.top).toBe(1);
    const feet = (cv: SlotCanvas) => pixels(cv).filter((p) => Number(p.split(',')[1]) >= FRAME.groundY - 6);
    expect(feet(c)).toEqual(feet(a));
  });

  it('course : 8 images, un cycle de 360 ms, chaque jambe passe devant à son tour', () => {
    expect(run).toHaveLength(8);
    expect(run.reduce((t, f) => t + f.ms, 0)).toBe(360);
    expect(run[0].pose.legs[1].hip).toBeGreaterThan(run[0].pose.legs[0].hip);
    expect(run[4].pose.legs[0].hip).toBeGreaterThan(run[4].pose.legs[1].hip);
  });

  it('bras opposés aux jambes (avec une image de retard), coudes pliés vers 90°', () => {
    for (const k of [1, 5]) {
      const [left, right] = run[k].pose.arms;
      const [legL, legR] = run[k - 1].pose.legs;
      expect(Math.sign(left.pitch - right.pitch), `image ${k}`).toBe(Math.sign(legR.hip - legL.hip));
    }
    for (const f of run) for (const arm of f.pose.arms) expect(Math.abs(arm.elbow - Math.PI / 2)).toBeLessThan(0.45);
  });

  it('buste penché vers l’avant de 15 à 20°, jamais vers l’arrière (le cou devant le bassin)', () => {
    for (const [k, f] of run.entries()) {
      expect(f.pose.lean!).toBeGreaterThanOrEqual(0.26);
      expect(f.pose.lean!).toBeLessThanOrEqual(0.35);
      for (const heading of HEADINGS) {
        const { neck, pelvis } = screen(heading, k);
        expect(neck.x, `${heading} ${k}`).toBeGreaterThan(pelvis.x);
      }
    }
  });

  it('rebond : le corps est plus bas à l’amorti qu’à l’envol, écrasé puis étiré', () => {
    const top = (k: number) => renderFigure2D(AILIER, run[k].pose, 'down').canvas.bounds()!.top;
    expect(top(1)).toBeGreaterThan(top(3) + 1);
    expect(top(5)).toBeGreaterThan(top(7) + 1);
    expect(run[1].pose.stretch!).toBeLessThan(0);
    expect(run[3].pose.stretch!).toBeGreaterThan(0);
  });
});
