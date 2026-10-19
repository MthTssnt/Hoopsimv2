import { describe, expect, it } from 'vitest';
import type { PlayerAppearance } from '../../../assets/characters/appearance';
import { HAIR_COLOR_IDS, SKIN_IDS } from '../../../assets/characters/colors';
import { composeHead } from '../../../assets/characters/composeHead';
import { appearance2DFor, characterOf, type Appearance } from './appearance';
import type { SlotCanvas, Slot } from './canvas';
import { slotColor } from './compose';
import { headSprite, renderFigure2D, renderFigure2DBoth } from './figure2d';
import { colorsPainted } from './paintedColors';
import { RUN_CYCLE_MS } from './layout';
import { poses2D } from './poses2d';
import { FRAME, type Heading } from './rig';
import { build2D, joints2D, project2D } from './skeleton2d';

const AILIER: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 0, hair: 1, hairColor: 0, number: 23 };
const HEADINGS: readonly Heading[] = ['down', 'up'];
/** Contour doux : le ton le plus profond de chaque matière (peau, cheveux, maillot, short liseré, chaussette, chaussure, pilosité, accessoire). */
const DEEP: ReadonlySet<Slot> = new Set<Slot>(['4', 'E', 'Q', 'T', 'Y', 'J', 'F', 'K']);

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

/** Hauteur du joueur (coupe rase : la silhouette du crâne, sans volume de cheveux au-dessus). */
const height = (look: Appearance, heading: Heading = 'down') => FRAME.groundY - renderFigure2D({ ...look, hair: 10 }, idle[0].pose, heading).canvas.bounds()!.top;

describe('rendu 2D : proportions et cadre', () => {
  it('ailier ~42 px à l’arrêt (tête à ~25 %), meneur 1-3 de moins, pivot 2-4 de plus', () => {
    for (const heading of HEADINGS) {
      const ailier = height(AILIER, heading);
      expect(ailier, heading).toBeGreaterThanOrEqual(40);
      expect(ailier).toBeLessThanOrEqual(44);
      expect(height({ ...AILIER, heightCm: 186 }, heading) - ailier).toBeGreaterThanOrEqual(-3);
      expect(height({ ...AILIER, heightCm: 186 }, heading) - ailier).toBeLessThanOrEqual(-1);
      expect(height({ ...AILIER, heightCm: 212 }, heading) - ailier).toBeGreaterThanOrEqual(2);
      expect(height({ ...AILIER, heightCm: 212 }, heading) - ailier).toBeLessThanOrEqual(4);
    }
  });

  it('tête à ~25 % du joueur (crâne de 12×11, coupe rase)', () => {
    for (const heading of HEADINGS) {
      const ratio = composeHead(characterOf({ ...AILIER, hair: 10 }), heading).rows.length / height(AILIER, heading);
      expect(ratio, heading).toBeGreaterThanOrEqual(0.24);
      expect(ratio, heading).toBeLessThanOrEqual(0.31);
    }
  });

  it('pieds sur la rangée du sol (contour dessous), à 1 px près à l’envol de la course ; tout tient dans le cadre', () => {
    for (const heading of HEADINGS) {
      for (const [k, f] of all.entries()) {
        const b = renderFigure2D(AILIER, f.pose, heading).canvas.bounds()!;
        expect(b.left, `${heading} ${k}`).toBeGreaterThan(0);
        expect(b.right).toBeLessThan(FRAME.width - 1);
        expect(b.top).toBeGreaterThan(0);
        expect(b.bottom, `${heading} ${k}`).toBeLessThanOrEqual(FRAME.groundY);
        expect(b.bottom, `${heading} ${k}`).toBeGreaterThanOrEqual(FRAME.groundY - 1);
      }
    }
  });
});

describe('rendu 2D : une seule silhouette', () => {
  const frames = HEADINGS.flatMap((heading) => all.map((f) => renderFigure2D(AILIER, f.pose, heading).canvas));

  it('un seul contour doux, à l’extérieur : tout bord est le ton le plus profond d’une matière', () => {
    const bad: string[] = [];
    frames.forEach((c, i) => {
      c.forEach((x, y, slot) => {
        const n4 = [c.get(x + 1, y), c.get(x - 1, y), c.get(x, y + 1), c.get(x, y - 1)];
        if (!DEEP.has(slot) && n4.includes(null)) bad.push(`bord ${i}:${x},${y} ${slot}`);
      });
      expect(count(c, ['o'])).toBe(0);
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

  it('modelé peint : 4 à 5 tons de peau et de maillot dans chaque image', () => {
    for (const c of frames) {
      expect(['1', '5', '2', '3', '4'].filter((t) => count(c, [t as Slot]) > 0).length).toBeGreaterThanOrEqual(4);
      expect(['a', 'p', 'P', 'q', 'Q'].filter((t) => count(c, [t as Slot]) > 0).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('lumière en haut à gauche : jamais de reflet ni de clair sur le bord droit ou le bord bas de la silhouette', () => {
    const lit: string[] = [];
    frames.forEach((c, i) => {
      c.forEach((x, y, slot) => {
        // (les liserés d'un pixel, ceinture et col, n'ont pas d'épaisseur à modeler)
        if (!['1', 'a', 'x', 'z'].includes(slot)) return;
        const edge = (n: Slot | null) => n === null || DEEP.has(n);
        if (edge(c.get(x + 1, y)) && edge(c.get(x, y + 1))) lit.push(`${i}:${slot}@${x},${y}`);
      });
    });
    expect(lit).toEqual([]);
  });

  it('membres éloignés plus sombres : le bras éloigné a moins de tons clairs que le bras proche', () => {
    // Bras le long du corps, à l'arrêt : tons de peau à gauche (bras éloigné) et à droite (bras proche) du torse.
    for (const heading of HEADINGS) {
      const c = renderFigure2D(AILIER, idle[0].pose, heading).canvas;
      const b = c.bounds()!;
      const J = joints2D(build2D(200, false), idle[0].pose, heading);
      // Côté de l'écran du bras proche (épaule droite du joueur, index 1).
      const nearSide = Math.sign(project2D(J.shoulders[1], 0, 0).x - project2D(J.shoulders[0], 0, 0).x);
      const mid = Math.round((b.left + b.right) / 2);
      let farLight = 0;
      let nearLight = 0;
      c.forEach((x, y, slot) => {
        if (y < b.top + 14 || y > b.bottom - 14 || !['1', '5', '2'].includes(slot)) return;
        if (Math.sign(x - mid) === nearSide && Math.abs(x - mid) > 4) nearLight++;
        if (Math.sign(x - mid) === -nearSide && Math.abs(x - mid) > 4) farLight++;
      });
      expect(nearLight, heading).toBeGreaterThan(farLight);
    }
  });

  it('chaussures à semelle blanche, chaussettes visibles', () => {
    for (const c of frames) {
      expect(count(c, ['z', 'Z', 'G', 'j'])).toBeGreaterThan(6);
      expect(count(c, ['x', 'w', 'y', 'Y'])).toBeGreaterThan(4);
    }
  });
});

describe('rendu 2D : tête, numéro, orientation', () => {
  it('visage en diagonale bas (yeux), aucun visage de dos', () => {
    for (const f of all) {
      expect(count(renderFigure2D(AILIER, f.pose, 'down').canvas, ['n', 'i'])).toBeGreaterThanOrEqual(2);
      expect(count(renderFigure2D(AILIER, f.pose, 'up').canvas, ['n', 'i'])).toBe(0);
    }
  });

  it('numéro sur la poitrine (diagonale bas) et dans le dos (diagonale haut), à l’arrêt', () => {
    for (const heading of HEADINGS) {
      for (const facing of ['right', 'left'] as const) {
        const { canvas, numberAt } = renderFigure2D(AILIER, idle[0].pose, heading, facing);
        expect(numberAt).not.toBeNull();
        expect(count(canvas, ['s', 'T']), `${heading} ${facing}`).toBeGreaterThanOrEqual(14);
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

describe('rendu 2D : tête du système de pièces', () => {
  it('contour doux autour de la tête (ton le plus profond de chaque matière), rien entre la tête et le cou', () => {
    const c = renderFigure2D(AILIER, idle[0].pose, 'down').canvas;
    const top = c.bounds()!.top;
    for (let x = 0; x < c.width; x++) if (c.get(x, top) !== null) expect(c.get(x, top)).toBe('E');
    expect(count(c, ['o'])).toBe(0);
  });

  it('la tête suit le cou à chaque image de la course (même écart entre le haut des cheveux et le cou)', () => {
    const b = build2D(200, false);
    for (const heading of HEADINGS) {
      const gaps = run.map((f) => {
        const c = renderFigure2D(AILIER, f.pose, heading).canvas;
        const J = joints2D(b, f.pose, heading);
        const sole = Math.max(...J.shoes.flat().map((p) => project2D(p, 0, 0).y)) + (f.pose.lift ?? 0) * Math.cos(0.3);
        return Math.round(project2D(J.neckTop, 0, FRAME.groundY - sole).y) - c.bounds()!.top;
      });
      expect(new Set(gaps).size, heading).toBe(1);
    }
  });

  it('chaque catégorie de pièce se voit dans l’image du joueur', () => {
    const base = characterOf(AILIER);
    const ref = pixels(renderFigure2D(AILIER, idle[0].pose, 'down').canvas);
    const looks = [
      { ...base, headShape: 'longue' },
      { ...base, eyes: 'vifs' },
      { ...base, brows: 'epais' },
      { ...base, nose: 'droit' },
      { ...base, mouth: 'large' },
      { ...base, hair: 'rase', ears: 'decollees' },
      { ...base, facialHair: 'barbe' },
      { ...base, hair: 'afro' },
      { ...base, accessories: ['bandeau'] },
    ];
    for (const character of looks) expect(pixels(renderFigure2D({ ...AILIER, character }, idle[0].pose, 'down').canvas), JSON.stringify(character)).not.toEqual(ref);
  });

  it('apparences du match : le personnage est tiré de l’identifiant, avec le teint et les cheveux du portrait', () => {
    const src = { id: 'j-42', heightCm: 198, weightKg: 95, number: 8, age: 30 };
    const a = appearance2DFor(src);
    expect(a.character).toEqual(appearance2DFor(src).character);
    expect(a.character!.skin).toBe(SKIN_IDS[a.skin]);
    expect(JSON.parse(JSON.stringify(a.character))).toEqual(a.character);
  });

  it('expression du jeu : joyeuse donne le visage « joie », concentrée reste neutre', () => {
    const face = (expression: 'neutre' | 'concentree' | 'joyeuse') => pixels(renderFigure2D(AILIER, { ...idle[0].pose, expression }, 'down').canvas);
    expect(face('concentree')).toEqual(face('neutre'));
    expect(face('joyeuse')).not.toEqual(face('neutre'));
  });

  it('tête seule (portrait) : contour fermé, même tête que dans l’image du joueur', () => {
    const head = headSprite(AILIER, 'down');
    const b = head.bounds()!;
    expect(b.left).toBe(0);
    expect(b.top).toBe(0);
    head.forEach((x, y, slot) => {
      const n4 = [head.get(x + 1, y), head.get(x - 1, y), head.get(x, y + 1), head.get(x, y - 1)];
      if (n4.includes(null)) expect(DEEP.has(slot), `${x},${y} ${slot}`).toBe(true);
    });
  });
});

describe('couleurs du style 5', () => {
  const blue: [number, number, number] = [0x6080e0, 0x1d4ed8, 0x102060];
  const gold: [number, number, number] = [0xffd070, 0xf59e0b, 0xa06000];
  const withChar = (patch: Partial<PlayerAppearance['colors']>, extra: Partial<PlayerAppearance> = {}) => ({ ...AILIER, character: { ...characterOf(AILIER), ...extra, colors: { ...characterOf(AILIER).colors, ...patch } } });

  it('rampes de 5 tons : du plus clair au plus sombre pour la peau, les cheveux, le maillot', () => {
    const c = colorsPainted(AILIER, blue, gold);
    const luma = (slot: Slot) => {
      const v = slotColor(slot, c);
      return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
    };
    for (const ramp of [['1', '5', '2', '3', '4'], ['r', 'h', 'H', 'D', 'E'], ['a', 'p', 'P', 'q', 'Q'], ['v', 's', 'S', 't', 'T']] as Slot[][]) {
      for (let i = 1; i < ramp.length; i++) expect(luma(ramp[i]), ramp.join('')).toBeLessThan(luma(ramp[i - 1]));
    }
  });

  it('pilosité sur sa propre rampe : barbe grise sur cheveux bruns', () => {
    const c = colorsPainted(withChar({ hair: 'brun', facialHair: 'gris' }, { facialHair: 'barbe' }), blue, gold);
    expect(slotColor('b', c)).not.toBe(slotColor('h', c));
    expect(slotColor('b', colorsPainted(withChar({ hair: 'brun', facialHair: 'brun' }), blue, gold))).not.toBe(slotColor('b', c));
  });

  it('couleur des yeux et de l’accessoire tirées du personnage ; « equipe » suit la couleur secondaire', () => {
    const eyes = new Set(['brun-fonce', 'noisette', 'bleu', 'vert', 'gris'].map((e) => slotColor('i', colorsPainted(withChar({ eyes: e as PlayerAppearance['colors']['eyes'] }), blue, gold))));
    expect(eyes.size).toBe(5);
    const team = (secondary: [number, number, number]) => slotColor('C', colorsPainted(withChar({ accessory: 'equipe' }), blue, secondary));
    expect(team(gold)).not.toBe(team(blue));
    expect(slotColor('C', colorsPainted(withChar({ accessory: 'blanc' }), blue, gold))).not.toBe(team(gold));
  });

  it('barbe d’un ton qui se lit sur la peau, pour tous les teints et toutes les couleurs', () => {
    const luma = (v: number) => (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
    for (const skin of SKIN_IDS) {
      for (const facialHair of HAIR_COLOR_IDS) {
        const c = colorsPainted({ ...AILIER, character: { ...characterOf(AILIER), skin, colors: { ...characterOf(AILIER).colors, facialHair } } }, blue, gold);
        expect(Math.abs(luma(slotColor('b', c)) - luma(slotColor('5', c))), `${skin} ${facialHair}`).toBeGreaterThan(0.1);
      }
    }
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

  it('course : 8 images, un cycle de 600 ms (décision de Matheo : plus posée), chaque jambe passe devant à son tour', () => {
    expect(run).toHaveLength(8);
    expect(run.reduce((t, f) => t + f.ms, 0)).toBe(RUN_CYCLE_MS);
    expect(RUN_CYCLE_MS).toBe(600);
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

  it('tête posée : elle bouge d’au plus 1 px d’une image à la suivante, et de 2 px au plus sur le cycle (pas de saccade)', () => {
    for (const heightCm of [186, 200, 212]) {
      for (const heading of HEADINGS) {
        // Le cou (sous la tête) à l'écran : les bras qui balancent peuvent dépasser, pas la tête.
        const b = build2D(heightCm, false);
        const tops = run.map((f) => Math.round(project2D(joints2D(b, f.pose, heading).neckTop, 0, 0).y));
        tops.forEach((t, k) => expect(Math.abs(t - tops[(k + 1) % tops.length]), `${heightCm} ${heading} ${k}`).toBeLessThanOrEqual(1));
        expect(Math.max(...tops) - Math.min(...tops), `${heightCm} ${heading}`).toBeLessThanOrEqual(2);
      }
    }
  });
});
