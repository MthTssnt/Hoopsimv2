import { describe, expect, it } from 'vitest';
import { EYE_COLORS, HAIR_RAMPS } from '../../../assets/palette';
import { FACE_EXPRESSIONS, FACE_TRAITS, FACIAL_HAIR_2D, HAIRS_2D, headGrid2D, SHAPES_2D, type FaceExpression } from '../../../assets/sprites/heads2d';
import type { Appearance } from './appearance';
import type { SlotCanvas, Slot } from './canvas';
import { colors2D } from './compose';
import { renderFigure2D, renderFigure2DBoth } from './figure2d';
import { poses2D } from './poses2d';
import { FRAME, type Heading } from './rig';
import { build2D, joints2D, project2D } from './skeleton2d';

const AILIER: Appearance = { heightCm: 200, heavy: false, heightClass: 'moyen', skin: 1, head: 0, hair: 1, hairColor: 0, number: 23 };
const HEADINGS: readonly Heading[] = ['down', 'up'];
/** Pixels de bord permis : contour du corps (o) et contours colorés de la tête (cheveux E/D, peau 4/3). */
const EDGE: ReadonlySet<Slot> = new Set<Slot>(['o', 'E', 'D', '4', '3']);

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
  it('ailier ~45 px à l’arrêt (corps d’origine, tête agrandie), meneur 2-3 de moins, pivot 2-4 de plus', () => {
    for (const heading of HEADINGS) {
      const ailier = height(AILIER, heading);
      expect(ailier, heading).toBeGreaterThanOrEqual(44);
      expect(ailier).toBeLessThanOrEqual(47);
      expect(height({ ...AILIER, heightCm: 186 }, heading) - ailier).toBeGreaterThanOrEqual(-3);
      expect(height({ ...AILIER, heightCm: 186 }, heading) - ailier).toBeLessThanOrEqual(-1);
      expect(height({ ...AILIER, heightCm: 212 }, heading) - ailier).toBeGreaterThanOrEqual(2);
      expect(height({ ...AILIER, heightCm: 212 }, heading) - ailier).toBeLessThanOrEqual(4);
    }
  });

  it('tête ~1/3 du joueur (coupe sans volume au-dessus)', () => {
    const head = headGrid2D({ ...AILIER, hair: 10 }, 'down');
    const rows = head.rows.filter((r) => /[^.]/.test(r)).length;
    expect(rows / height(AILIER)).toBeGreaterThan(0.31);
    expect(rows / height(AILIER)).toBeLessThanOrEqual(0.38);
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
        // Contour : sombre autour du corps, coloré autour de la tête (ton le plus foncé de chaque matière).
        if (!EDGE.has(slot) && n4.includes(null)) bad.push(`bord ${i}:${x},${y}`);
        // Le contour ne sert qu'autour de la silhouette (ou d'un vide entre deux membres), jamais entre deux pièces.
        if (slot === 'o' && !n4.some((n) => n === null || n === 'o' || n === 'E' || n === '4')) bad.push(`intérieur ${i}:${x},${y}`);
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

  it('palette actuelle : aucun ton du style en volumes (seuls les contours colorés et l’ombre profonde des cheveux s’ajoutent)', () => {
    const extra: readonly Slot[] = ['0', 'a', 'Q', 'T'];
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

describe('têtes : variantes', () => {
  const count = (rows: string[], chars: string) => rows.join('').split('').filter((c) => chars.includes(c)).length;
  const HAIR_NAMES = HAIRS_2D.map((h) => h.name);

  it('5 formes × 13 coiffures × 6 visages × 5 pilosités × bandeau, dans les deux diagonales : grilles valides', () => {
    expect(SHAPES_2D).toHaveLength(5);
    expect(HAIRS_2D.length).toBeGreaterThanOrEqual(12);
    expect(FACE_TRAITS.length).toBeGreaterThanOrEqual(4);
    expect(FACIAL_HAIR_2D).toHaveLength(5);
    for (const heading of HEADINGS) {
      for (let head = 0; head < 5; head++) {
        for (let hair = 0; hair < HAIRS_2D.length; hair++) {
          for (let facialHair = 0; facialHair < 5; facialHair++) {
            const g = headGrid2D({ head, hair, facialHair, face: (head + hair) % FACE_TRAITS.length, headband: facialHair === 2 }, heading);
            expect(g.rows.every((r) => r.length === g.rows[0].length)).toBe(true);
            expect(g.rows[g.anchor.y][g.anchor.x], `${heading} ${head} ${HAIR_NAMES[hair]}`).not.toBe('.');
          }
        }
      }
    }
  });

  it('13 coiffures aux silhouettes différentes, de face comme de dos ; reflet et 3 tons au moins (sauf le crâne chauve)', () => {
    for (const heading of HEADINGS) {
      // Le rasé garde la silhouette du crâne, comme le chauve : on le compare aux autres seulement.
      const styles = HAIRS_2D.map((h, hair) => ({ h, hair })).filter(({ h }) => h.name !== 'chauve');
      const shapes = styles.map(({ hair }) => headGrid2D({ head: 0, hair }, heading).rows.map((r) => r.replace(/[^.]/g, 'x')).join('/'));
      expect(new Set(shapes).size, heading).toBe(styles.length);
    }
    for (const hair of HAIRS_2D) {
      if (hair.name === 'chauve') continue;
      for (const heading of HEADINGS) {
        const rows = hair[heading].rows;
        const tones = new Set(rows.join('').split('').filter((c) => 'rhHD'.includes(c)));
        expect(tones.size, `${hair.name} ${heading}`).toBeGreaterThanOrEqual(3);
        expect(tones.has('r') || tones.has('h'), `${hair.name} ${heading} : reflet`).toBe(true);
      }
    }
  });

  it('6 couleurs de cheveux (noir, brun, blond, roux, gris, châtain)', () => {
    expect(HAIR_RAMPS).toHaveLength(6);
  });

  it('bandeau et pilosité : options combinables qui se voient', () => {
    for (let hair = 0; hair < HAIRS_2D.length; hair++) {
      const plain = headGrid2D({ head: 0, hair }, 'down').rows.join('/');
      const band = headGrid2D({ head: 0, hair, headband: true }, 'down').rows;
      expect(count(band, 'sS'), HAIR_NAMES[hair]).toBeGreaterThan(6);
      expect(band.join('/')).not.toBe(plain);
    }
    const faces = [0, 1, 2, 3, 4].map((facialHair) => headGrid2D({ head: 0, hair: 0, facialHair }, 'down').rows.join('/'));
    expect(new Set(faces).size).toBe(5);
  });
});

describe('têtes : visage', () => {
  const count = (rows: string[], chars: string) => rows.join('').split('').filter((c) => chars.includes(c)).length;
  const BALD = HAIRS_2D.findIndex((h) => h.name === 'chauve');

  it('visages types différents d’au moins 4 pixels deux à deux (lisibles à l’échelle du match)', () => {
    const grids = FACE_TRAITS.map((_, face) => headGrid2D({ head: 0, hair: BALD, face }, 'down').rows.join(''));
    for (let a = 0; a < grids.length; a++) {
      for (let b = a + 1; b < grids.length; b++) {
        let diff = 0;
        for (let i = 0; i < Math.min(grids[a].length, grids[b].length); i++) diff += grids[a][i] !== grids[b][i] ? 1 : 0;
        expect(diff, `${a} / ${b}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('grands yeux : blanc, iris de couleur et pupille ; l’œil éloigné plus étroit que l’œil proche', () => {
    for (let face = 0; face < FACE_TRAITS.length; face++) {
      const rows = headGrid2D({ head: 0, hair: BALD, face }, 'down').rows;
      // Colonnes peintes en blanc, iris ou pupille, regroupées par œil (séparées par une colonne de peau).
      const cols = [...new Set(rows.flatMap((r) => [...r].flatMap((c, x) => ('win'.includes(c) ? [x] : []))))].sort((a, b) => a - b);
      const eyes: number[][] = [];
      for (const x of cols) (eyes.length && x === eyes[eyes.length - 1].at(-1)! + 1 ? eyes[eyes.length - 1] : (eyes[eyes.length] = [])).push(x);
      expect(eyes, `visage ${face}`).toHaveLength(2);
      expect(eyes[0].length).toBeGreaterThan(eyes[1].length);
      const tall = (xs: number[]) => rows.filter((r) => xs.some((x) => 'win'.includes(r[x]))).length;
      expect(tall(eyes[0])).toBe(3);
      for (const ch of 'win') expect(count(rows, ch), `visage ${face} : ${ch}`).toBeGreaterThan(0);
    }
  });

  it('peau du visage en 2 tons (base et ombre), sans ton clair ni trait sombre isolé', () => {
    for (let face = 0; face < FACE_TRAITS.length; face++) {
      for (const e of FACE_EXPRESSIONS) {
        const rows = headGrid2D({ head: 0, hair: 0, face }, 'down', e).rows;
        expect(count(rows, '1'), `visage ${face} ${e}`).toBe(0);
      }
    }
  });

  it('barbe d’un ton nettement différent de la peau, pour tous les teints et toutes les couleurs de cheveux', () => {
    const luma = (c: number) => (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
    for (let skin = 0; skin < 4; skin++) {
      for (let hairColor = 0; hairColor < HAIR_RAMPS.length; hairColor++) {
        const c = colors2D({ ...AILIER, skin, hairColor }, [0, 0, 0], [0, 0, 0]);
        expect(Math.abs(luma(c.beard![0]) - luma(c.skin[1])), `${skin} ${hairColor}`).toBeGreaterThanOrEqual(0.15);
      }
    }
    expect(EYE_COLORS).toHaveLength(4);
  });

  it('expressions exagérées : joie et effort montrent les dents, l’effort ouvre la bouche (2×2 sombre)', () => {
    const grid = (e: FaceExpression) => headGrid2D({ head: 0, hair: 0, face: 3 }, 'down', e).rows;
    expect(new Set(FACE_EXPRESSIONS.map((e) => grid(e).join('/'))).size).toBe(FACE_EXPRESSIONS.length);
    expect(count(grid('joyeuse'), 'w')).toBeGreaterThanOrEqual(3);
    const effort = grid('effort');
    const open = effort.some((r, y) => [...r].some((c, x) => c === '4' && r[x + 1] === '4' && effort[y + 1]?.[x] === '4' && effort[y + 1]?.[x + 1] === '4'));
    expect(open).toBe(true);
  });

  it('noir réservé aux pupilles, sourcils séparés de l’œil et de la frange par la peau, sur toutes les coiffures', () => {
    for (let hair = 0; hair < HAIRS_2D.length; hair++) {
      for (let face = 0; face < FACE_TRAITS.length; face++) {
        for (const e of FACE_EXPRESSIONS) {
          const bald = headGrid2D({ head: 0, hair: BALD, face }, 'down', e);
          const g = headGrid2D({ head: 0, hair, face }, 'down', e);
          expect(count(g.rows, 'n'), `${HAIRS_2D[hair].name} ${face} ${e}`).toBeLessThanOrEqual(2);
          // Sourcils : les pixels E du crâne chauve, recalés sur le cou.
          const dy = g.anchor.y - bald.anchor.y;
          bald.rows.forEach((r, y) =>
            [...r].forEach((c, x) => {
              if (c !== 'E') return;
              const at = (yy: number) => g.rows[yy + dy]?.[x] ?? '.';
              expect(at(y), `${HAIRS_2D[hair].name} ${face} ${e} : sourcil`).toBe('E');
              // Le pixel du dessus ne doit pas être des cheveux, sauf s'il fait lui-même partie du sourcil.
              const above = bald.rows[y - 1]?.[x] === 'E' ? '.' : at(y - 1);
              expect('rhHDE'.includes(above) && above !== '.', `${HAIRS_2D[hair].name} ${face} ${e} : frange collée au sourcil`).toBe(false);
              expect('nw'.includes(at(y + 1)) && at(y + 1) !== '.', `${HAIRS_2D[hair].name} ${face} ${e} : sourcil collé à l’œil`).toBe(false);
            }),
          );
        }
      }
    }
  });

  it('de dos : aucun élément du visage ; les cheveux couvrent la plus grande partie de la tête (coupes avec volume)', () => {
    for (let hair = 0; hair < HAIRS_2D.length; hair++) {
      const rows = headGrid2D({ head: 0, hair }, 'up').rows;
      expect(count(rows, 'nw'), HAIRS_2D[hair].name).toBe(0);
      if (['chauve', 'rase', 'degrade', 'crete', 'tresses'].includes(HAIRS_2D[hair].name)) continue;
      expect(count(rows, 'rhHDE') / count(rows, 'rhHDE1234'), HAIRS_2D[hair].name).toBeGreaterThan(0.55);
    }
  });

  it('contour coloré autour de la tête, contour sombre autour du corps, rien entre la tête et le cou', () => {
    const c = renderFigure2D(AILIER, idle[0].pose, 'down').canvas;
    const top = c.bounds()!.top;
    let colored = 0;
    for (let x = 0; x < c.width; x++) if (c.get(x, top) === 'E' || c.get(x, top) === 'D') colored++;
    expect(colored).toBeGreaterThan(0);
    c.forEach((x, y, slot) => {
      if (slot !== 'o') return;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect('rhHD'.includes(c.get(x + dx, y + dy) ?? '.'), `${x},${y}`).toBe(false);
    });
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

  it('forme de tête, coiffure, visage et pilosité se voient dans l’image du joueur', () => {
    const base = pixels(renderFigure2D(AILIER, idle[0].pose, 'down').canvas);
    for (const look of [{ ...AILIER, head: 1 }, { ...AILIER, hair: 6 }, { ...AILIER, face: 2 }, { ...AILIER, facialHair: 2 }]) expect(pixels(renderFigure2D(look, idle[0].pose, 'down').canvas)).not.toEqual(base);
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
