import { describe, expect, it } from 'vitest';
import { CANDIDATE_HAIRS, CANDIDATE_POSES, CANDIDATE_STYLES, type CandidatePose } from '../../../assets/sprites/styleCandidates';
import { composeCandidate } from './candidates';
import { SlotCanvas, slotOf, type Slot } from './canvas';
import { FRAME } from './rig';

/** Poses au sol (le tir est un saut ; la course, une foulée en suspension d'un pixel). */
const GROUNDED: CandidatePose[] = ['arret', 'dribble', 'courseHaut'];

/** Toutes les grilles d'un style, nommées. */
function gridsOf(style: (typeof CANDIDATE_STYLES)[number]): [string, readonly string[]][] {
  const out: [string, readonly string[]][] = [
    ['tête de face', style.head.front],
    ['tête de dos', style.head.back],
  ];
  for (const hair of CANDIDATE_HAIRS) out.push([`${hair} de face`, style.hairs[hair].front], [`${hair} de dos`, style.hairs[hair].back]);
  for (const [name, grid] of Object.entries(style.expressions)) out.push([`visage ${name}`, grid]);
  for (const pose of CANDIDATE_POSES) {
    out.push([`corps ${pose}`, style.bodies[pose].rows]);
    const over = style.bodies[pose].over;
    if (over) out.push([`par-dessus ${pose}`, over]);
  }
  return out;
}

/** Pixels sans aucun voisin (à 8) du même emplacement : « pixels orphelins ». */
function orphans(canvas: SlotCanvas, ignore: ReadonlySet<Slot>): string[] {
  const found: string[] = [];
  canvas.forEach((x, y, slot) => {
    if (ignore.has(slot)) return;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && canvas.get(x + dx, y + dy) === slot) return;
    found.push(`${slot}@${x},${y}`);
  });
  return found;
}

const FACE: ReadonlySet<Slot> = new Set<Slot>(['n', 'w', 'o']);

describe('planche des styles : grilles', () => {
  for (const style of CANDIDATE_STYLES) {
    it(`style ${style.id} : grilles rectangulaires, emplacements connus`, () => {
      for (const [name, grid] of gridsOf(style)) {
        expect(new Set(grid.map((r) => r.length)).size, `${style.id} ${name}`).toBe(1);
        const unknown = grid.join('').split('').filter((ch) => ch !== '.' && slotOf(ch) === null);
        expect(unknown, `${style.id} ${name}`).toEqual([]);
      }
    });

    it(`style ${style.id} : aucun pixel orphelin dans les corps, les têtes et les cheveux`, () => {
      const check = (name: string, paint: (c: SlotCanvas) => void) => {
        const c = new SlotCanvas(FRAME.width, FRAME.height);
        paint(c);
        expect(orphans(c, FACE), `${style.id} ${name}`).toEqual([]);
      };
      for (const pose of CANDIDATE_POSES) check(`corps ${pose}`, (c) => c.stamp(style.bodies[pose].rows, 4, 0));
      for (const hair of CANDIDATE_HAIRS) {
        for (const back of [false, true]) {
          check(`tête ${hair}${back ? ' de dos' : ''}`, (c) => {
            c.stamp(back ? style.head.back : style.head.front, 10, 10);
            const off = style.hairs[hair].offset ?? { x: 0, y: 0 };
            c.stamp(back ? style.hairs[hair].back : style.hairs[hair].front, 10 + off.x, 10 + off.y);
          });
        }
      }
    });
  }
});

describe('planche des styles : images assemblées', () => {
  for (const style of CANDIDATE_STYLES) {
    it(`style ${style.id} : 42 à 44 px, pieds sur la rangée du sol (foulée : 1 px au-dessus), dans le cadre`, () => {
      for (const pose of CANDIDATE_POSES) {
        const { canvas, ball } = composeCandidate(style.id, pose, { hair: 'court', number: 23 });
        const b = canvas.bounds()!;
        expect(b.top, `${style.id} ${pose}`).toBeGreaterThanOrEqual(0);
        expect(b.left).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThan(FRAME.width);
        if (GROUNDED.includes(pose) || pose === 'course') {
          expect(b.bottom, `${style.id} ${pose}`).toBe(pose === 'course' ? FRAME.groundY - 1 : FRAME.groundY);
          expect(b.bottom - b.top + 1, `${style.id} ${pose}`).toBeGreaterThanOrEqual(42);
          expect(b.bottom - b.top + 1, `${style.id} ${pose}`).toBeLessThanOrEqual(44);
        } else {
          expect(b.bottom, `${style.id} ${pose} en l'air`).toBeLessThan(FRAME.groundY);
        }
        if (ball) {
          expect(ball.x - 4).toBeGreaterThanOrEqual(0);
          expect(ball.y - 4).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it(`style ${style.id} : contour fermé autour de la silhouette`, () => {
      for (const pose of CANDIDATE_POSES) {
        for (const hair of CANDIDATE_HAIRS) {
          const { canvas } = composeCandidate(style.id, pose, { hair, number: 88 });
          const holes: string[] = [];
          canvas.forEach((x, y, slot) => {
            if (slot === 'o') return;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (canvas.get(x + dx, y + dy) === null) holes.push(`${x},${y}`);
          });
          expect(holes, `${style.id} ${pose} ${hair}`).toEqual([]);
        }
      }
    });

    it(`style ${style.id} : visage de 3/4 en diagonale bas, aucun visage de dos`, () => {
      const front = composeCandidate(style.id, 'arret', { hair: 'court', number: 23 }).canvas;
      const back = composeCandidate(style.id, 'courseHaut', { hair: 'court', number: 23 }).canvas;
      const count = (c: SlotCanvas, slot: Slot) => {
        let n = 0;
        c.forEach((_x, _y, s) => (n += s === slot ? 1 : 0));
        return n;
      };
      expect(count(front, 'n')).toBeGreaterThan(0);
      expect(count(back, 'n')).toBe(0);
      // Pas de blanc d'œil en A et en C (yeux en points sombres) ; les seuls blancs sont les
      // chaussettes et les semelles, sous la tête.
      if (style.id !== 'B') for (const grid of Object.values(style.expressions)) expect(grid.join('')).not.toMatch(/[we]/);
    });
  }

  it('vers la gauche : le dessin est retourné, le numéro reste à l’endroit', () => {
    const right = composeCandidate('A', 'arret', { hair: 'court', number: 7 }).canvas;
    const left = composeCandidate('A', 'arret', { hair: 'court', number: 7 }, 'left').canvas;
    let same = 0;
    let total = 0;
    right.forEach((x, y, slot) => {
      if (slot === 'S') return;
      total++;
      if (left.get(FRAME.width - 1 - x, y) === slot) same++;
    });
    expect(same / total).toBeGreaterThan(0.97);
  });
});
