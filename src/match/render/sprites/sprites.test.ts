import { describe, expect, it } from 'vitest';
import { PALETTE, teamRamp } from '../../../assets/palette';
import { EAR, EXPRESSIONS, EYE_ROWS, HAIRS, type Expression } from '../../../assets/sprites/heads';
import { BALL } from '../../../assets/sprites/arena';
import { drawJerseyNumber, JERSEY_DIGIT_HEIGHT, JERSEY_DIGITS, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import { createNewGame, TEAM_SEEDS } from '../../../engine';
import { colorDistance, teamLook } from '../arena/draw';
import { appearanceFor, appearanceSignature, type Appearance } from './appearance';
import type { Slot } from './canvas';
import { CHEEK, colorsFor, composeFrame, HEAD_TURN, NUMBER_MIN_TORSO, NUMBER_TOP, numberZone, SHEET_VIEWS, slotColor, type Heading } from './compose';
import { BUILDS, bodyDims, bodyLayout, FRAME, FRAMES, framesFor, HEAD_SIZE, NECK_ROWS, raisedHandTop, SHOE_ROWS, SHORTS_ROWS, UP_FRAMES } from './rig';
import { WORLD_TUNING } from '../../world/MatchWorld';
import { ART_PPM } from '../artConfig';

const players = Object.values(createNewGame('bos', 11).players);
const looks = players.map((p) => appearanceFor(p));
const team = TEAM_SEEDS[0];
const primary = teamRamp(team.colors.primary);
const secondary = teamRamp(team.colors.secondary);
const allowed = new Set<number>([...Object.values(PALETTE), ...primary, ...secondary]);
const SKIN = new Set<Slot>(['1', '2', '3']);

/** Un meneur (1,86 m), un ailier (2,00 m) et un pivot (2,12 m), légers. */
const SPECIMENS = { meneur: 186, ailier: 200, pivot: 212 } as const;
const specimen = (heightCm: number, heavy = false, number = 23): Appearance => ({ ...looks[0], heightCm, heavy, number, hair: 1, head: 0 });
const idle = (heightCm: number, heavy = false) => composeFrame(specimen(heightCm, heavy), FRAMES[0], bodyDims(heightCm, heavy)).canvas;
const framesOf = framesFor;
/** Les deux diagonales : bas (de face, de 3/4) et haut (de dos, de 3/4). */
const HEADINGS: readonly Heading[] = ['down', 'up'];

/** Un échantillon varié : toutes les coiffures, les deux corpulences, les trois gabarits. */
function sample(): Appearance[] {
  const out: Appearance[] = [];
  for (let hair = 0; hair < HAIRS.length; hair++) {
    for (const [heightCm, heavy] of [
      [183, false],
      [201, true],
      [226, true],
    ] as const) {
      out.push({ ...looks[hair], hair, heightCm, heavy, skin: hair % 4, head: hair % 4, number: 7 + hair * 6 });
    }
  }
  return out;
}

describe('sprites des joueurs : règles générales', () => {
  it('n’emploient que la palette maîtresse et les rampes de l’équipe', () => {
    const outside = new Set<number>();
    for (const look of sample()) {
      const colors = colorsFor(look, primary, secondary);
      for (const heading of HEADINGS) {
        for (const frame of framesOf(heading)) {
          composeFrame(look, frame, bodyDims(look.heightCm, look.heavy), 'team', 'right', heading).canvas.forEach((_x, _y, slot) => {
            const color = slotColor(slot, colors);
            if (!allowed.has(color)) outside.add(color);
          });
        }
      }
    }
    expect([...outside]).toEqual([]);
  });

  it('tiennent dans leur cadre, contour compris, dans les quatre positions', () => {
    for (const look of sample()) {
      for (const { facing, heading } of SHEET_VIEWS) {
        for (const frame of framesOf(heading)) {
          const b = composeFrame(look, frame, bodyDims(look.heightCm, look.heavy), 'team', facing, heading).canvas.bounds()!;
          expect(b.left).toBeGreaterThanOrEqual(0);
          expect(b.right).toBeLessThan(FRAME.width);
          expect(b.top).toBeGreaterThan(0);
          expect(b.bottom).toBeLessThanOrEqual(FRAME.groundY);
        }
      }
    }
  });

  it('posent le pied proche au sol dans les images au sol, dans les deux diagonales', () => {
    const bottom = (heading: Heading, i: number) => composeFrame(looks[0], framesOf(heading)[i], bodyDims(200, false), 'team', 'right', heading).canvas.bounds()!.bottom;
    for (const heading of HEADINGS) {
      // Arrêt, dribble à l'arrêt, flexion du tir et du dunk : pied proche sur la rangée du sol.
      for (const i of [0, 1, 10, 11, 12, 15]) expect(bottom(heading, i)).toBe(FRAME.groundY);
      // Passages : le pied proche peut passer (levé d'1 px) pendant que le pied éloigné, plus
      // loin donc plus haut, est posé.
      for (const i of [3, 5, 7, 9]) expect(bottom(heading, i)).toBeGreaterThanOrEqual(FRAME.groundY - 1);
    }
  });

  it('font rebondir la course : les foulées montent d’un pixel, sans rien allonger', () => {
    const dims = bodyDims(200, false);
    for (const heading of HEADINGS) {
      for (const i of [2, 4, 6, 8]) {
        const frame = framesOf(heading)[i];
        expect(frame.rise).toBe(1);
        const up = composeFrame(looks[0], frame, dims, 'team', 'right', heading).canvas;
        const flat = composeFrame(looks[0], { ...frame, rise: 0 }, dims, 'team', 'right', heading).canvas;
        expect(up.bounds()!.bottom).toBe(flat.bounds()!.bottom - 1);
        // Même dessin, décalé d'une rangée.
        flat.forEach((x, y, slot) => expect(up.get(x, y - 1)).toBe(slot));
      }
    }
  });

  it('ont un contour fermé : aucun pixel coloré ne touche le vide', () => {
    for (const look of sample().slice(0, 6)) {
      for (const [heading, frame] of HEADINGS.flatMap((h) => framesFor(h).map((fr) => [h, fr] as const))) {
        const c = composeFrame(look, frame, bodyDims(look.heightCm, look.heavy), 'team', 'right', heading).canvas;
        // Un seul `expect` par image : à 56×64, un par pixel rend le test trop lent.
        const gaps: string[] = [];
        c.forEach((x, y, slot) => {
          if (slot === 'o') return;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (c.get(x + dx, y + dy) === null) gaps.push(`${x},${y}`);
          }
        });
        expect(gaps).toEqual([]);
      }
    }
  });

  it('lèvent la main au cercle à la rangée de raisedHandTop (montée du dunk et accroche)', () => {
    for (const heightCm of Object.values(SPECIMENS)) {
      for (const heavy of [false, true]) {
        const dims = bodyDims(heightCm, heavy);
        for (const i of [16, 17]) {
          const c = composeFrame(specimen(heightCm, heavy), FRAMES[i], dims).canvas;
          // Bras avant, à droite de la tête : sa rangée de peau la plus haute est la main.
          let top: number = FRAME.height;
          c.forEach((x, y, slot) => {
            if (x >= FRAME.centerX + HEAD_SIZE / 2 && SKIN.has(slot)) top = Math.min(top, y);
          });
          expect(top).toBe(raisedHandTop(dims));
        }
      }
    }
  });

  it('placent le ballon : dans la main au dribble, au rebond plus bas, au-dessus de la main au tir', () => {
    const anchors = FRAMES.map((frame) => composeFrame(looks[0], frame, bodyDims(200, false)).ball);
    expect(anchors[6]).not.toBeNull();
    expect(anchors[8]!.y).toBeGreaterThan(anchors[6]!.y);
    expect(anchors[13]!.y).toBeLessThan(anchors[12]!.y);
    expect(anchors[14]).toBeNull();
  });

  it('dribblent en diagonale bas devant le corps, un peu en avant, et le ballon touche le sol au rebond', () => {
    for (const heightCm of Object.values(SPECIMENS)) {
      const dims = bodyDims(heightCm, false);
      const L = bodyLayout(dims);
      // Axe du corps : le sprite tourné vers la gauche est le miroir de celui tourné vers la droite.
      const axis = (FRAME.width - 1) / 2;
      for (const facing of ['right', 'left'] as const) {
        const ahead = facing === 'right' ? 1 : -1;
        for (const i of [6, 7, 8, 9, 10, 11]) {
          const ball = composeFrame(looks[0], FRAMES[i], dims, 'team', facing).ball!;
          const dx = (ball.x - axis) * ahead;
          // Devant les jambes : du côté de la course, mais à l'intérieur de la largeur du torse.
          expect(dx).toBeGreaterThanOrEqual(2);
          expect(dx).toBeLessThanOrEqual(L.torsoRight - axis + 1);
        }
        for (const i of [8, 11]) expect(composeFrame(looks[0], FRAMES[i], dims, 'team', facing).ball!.y).toBe(FRAME.groundY - 4);
      }
    }
  });

  it('placent l’ombre du ballon du monde sous le ballon dessiné (écart ≤ 1,5 px)', () => {
    for (const heightCm of Object.values(SPECIMENS)) {
      const ball = composeFrame(looks[0], FRAMES[11], bodyDims(heightCm, false)).ball!;
      expect(Math.abs(WORLD_TUNING.handForward * ART_PPM - (ball.x - FRAME.centerX))).toBeLessThanOrEqual(1.5);
    }
  });

  it('dribblent en diagonale haut sur le côté de la hanche, du côté de l’orientation', () => {
    const dims = bodyDims(200, false);
    const L = bodyLayout(dims);
    for (const facing of ['right', 'left'] as const) {
      const ahead = facing === 'right' ? 1 : -1;
      for (const i of [6, 7, 8, 9, 10, 11]) {
        const ball = composeFrame(looks[0], UP_FRAMES[i], dims, 'team', facing, 'up').ball!;
        expect((ball.x - FRAME.centerX) * ahead).toBeGreaterThan(L.torsoRight - FRAME.centerX + 1);
      }
    }
  });
});

describe('positions en diagonale', () => {
  const dims = bodyDims(200, false);
  const L = bodyLayout(dims);
  const pose = (heading: Heading, facing: 'right' | 'left' = 'right', i = 0, look = specimen(200)) =>
    composeFrame(look, framesFor(heading)[i], dims, 'team', facing, heading);
  /** Colonnes de blanc des yeux dans la tête, en séries contiguës (de gauche à droite). */
  const eyeRuns = (facing: 'right' | 'left') => {
    const c = pose('down', facing).canvas;
    const cols: number[] = [];
    for (let x = 0; x < FRAME.width; x++) if (c.get(x, L.headTop + EYE_ROWS[1]) === 'w') cols.push(x);
    const runs: number[][] = [];
    for (const x of cols) {
      if (runs.length && x === runs[runs.length - 1][runs[runs.length - 1].length - 1] + 1) runs[runs.length - 1].push(x);
      else runs.push([x]);
    }
    return runs;
  };

  it('gardent la taille de chaque gabarit : même sommet de la tête et même sol dans les deux diagonales', () => {
    for (const heightCm of Object.values(SPECIMENS)) {
      const d = bodyDims(heightCm, false);
      const down = composeFrame(specimen(heightCm), framesFor('down')[0], d, 'team', 'right', 'down').canvas.bounds()!;
      const up = composeFrame(specimen(heightCm), framesFor('up')[0], d, 'team', 'right', 'up').canvas.bounds()!;
      expect(up.top).toBe(down.top);
      expect(down.bottom).toBe(FRAME.groundY);
      expect(up.bottom).toBe(FRAME.groundY);
    }
  });

  it('diagonale bas : visage tourné, œil proche de 2 colonnes, œil éloigné d’une colonne du côté de la course', () => {
    const right = eyeRuns('right');
    expect(right.map((r) => r.length)).toEqual([2, 1]);
    // L'œil éloigné est contre le bord de la tête (décalée de HEAD_TURN), du côté de la course.
    const headRight = FRAME.centerX - HEAD_SIZE / 2 + HEAD_TURN + HEAD_SIZE - 1;
    expect(headRight - right[1][0]).toBeLessThanOrEqual(3);
    // Vers la gauche : le même visage, retourné.
    expect(eyeRuns('left').map((r) => r.length)).toEqual([1, 2]);
  });

  it('diagonale bas : oreille au ton d’ombre du côté qui s’éloigne, tête décalée vers la course', () => {
    const c = pose('down').canvas;
    const headLeft = FRAME.centerX - HEAD_SIZE / 2 + HEAD_TURN;
    for (const row of EAR.rows) expect(c.get(headLeft + EAR.col, L.headTop + row)).toBe('3');
    expect(HEAD_TURN).toBe(1);
  });

  it('diagonale haut : pas de visage, mais joue et oreille sur 3 colonnes du côté de la course', () => {
    const headLeft = FRAME.centerX - HEAD_SIZE / 2 + HEAD_TURN;
    for (let hair = 0; hair < HAIRS.length; hair++) {
      for (const facing of ['right', 'left'] as const) {
        const c = pose('up', facing, 0, { ...specimen(200), hair }).canvas;
        for (let y = L.headTop; y < L.neckY; y++) for (let x = 0; x < FRAME.width; x++) expect(['w', 'n']).not.toContain(c.get(x, y));
        const at = (col: number) => (facing === 'right' ? headLeft + col : FRAME.width - 1 - (headLeft + col));
        for (const row of [8, 9, 10]) for (const col of CHEEK.cols) expect(SKIN.has(c.get(at(col), L.headTop + row)!)).toBe(true);
      }
      expect(HAIRS[hair].back).toHaveLength(HEAD_SIZE);
      for (const row of HAIRS[hair].back) expect(row).toHaveLength(HEAD_SIZE);
    }
  });

  it('montrent un flanc de 2 colonnes au ton sombre : côté qui s’éloigne en bas, côté de la course en haut', () => {
    const rows = [L.torsoTop + 2, L.torsoTop + 5, L.torsoTop + 8];
    const down = pose('down', 'right', 0, { ...specimen(200), number: 1 }).canvas;
    const up = pose('up', 'right', 0, { ...specimen(200), number: 1 }).canvas;
    for (const y of rows) {
      expect([down.get(L.torsoLeft, y), down.get(L.torsoLeft + 1, y)]).toEqual(['q', 'q']);
      expect([up.get(L.torsoRight - 1, y), up.get(L.torsoRight, y)]).toEqual(['q', 'q']);
    }
  });

  it('posent le numéro sur le devant en bas, hors du flanc en haut', () => {
    for (const n of [0, 7, 12, 88]) {
      const look = { ...specimen(200), number: n };
      const down = pose('down', 'right', 0, look).numberAt!;
      const up = pose('up', 'right', 0, look).numberAt!;
      expect(down.x).toBeGreaterThanOrEqual(L.torsoLeft + 3);
      expect(down.x + jerseyNumberWidth(n) - 1).toBeLessThanOrEqual(L.torsoRight);
      expect(up.x).toBeGreaterThanOrEqual(L.torsoLeft + 1);
      expect(up.x + jerseyNumberWidth(n) - 1).toBeLessThanOrEqual(L.torsoRight - 2);
    }
  });

  it('étagent les bras : le bras éloigné, à moitié derrière le torse, se voit moins que le bras proche', () => {
    const visible = (heading: Heading, side: 'left' | 'right') => {
      const c = pose(heading).canvas;
      let n = 0;
      c.forEach((x, y, slot) => {
        if (y < L.torsoTop || y > L.shortsTop || !SKIN.has(slot)) return;
        if (side === 'left' ? x < L.torsoLeft : x > L.torsoRight) n++;
      });
      return n;
    };
    // En bas, le bras éloigné est à droite (côté de la course) ; en haut, à gauche.
    expect(visible('down', 'right')).toBeLessThan(visible('down', 'left'));
    expect(visible('up', 'left')).toBeLessThan(visible('up', 'right'));
  });

  it('dessinent le pied éloigné 2 px plus haut (côté de la course en bas, l’autre en haut)', () => {
    const sole = (heading: Heading, right: boolean) => {
      const c = pose(heading).canvas;
      let y = -1;
      c.forEach((x, py, slot) => {
        // Bords de chaque pied (la pointe de la chaussure gauche dépasse le milieu du cadre).
        const side = right ? x >= FRAME.centerX + 2 : x <= FRAME.centerX - 2;
        if (slot === 'w' && side) y = Math.max(y, py);
      });
      return y;
    };
    expect(sole('down', false) - sole('down', true)).toBe(2);
    expect(sole('up', true) - sole('up', false)).toBe(2);
  });

  it('gardent un entrejambe droit à l’arrêt, au-dessus du pied le plus haut', () => {
    for (const heightCm of Object.values(SPECIMENS)) {
      const d = bodyDims(heightCm, false);
      const layout = bodyLayout(d);
      for (const heading of HEADINGS) {
        const c = composeFrame(specimen(heightCm), framesFor(heading)[0], d, 'team', 'right', heading).canvas;
        const gaps = new Set<string>();
        for (let y = layout.shortsBottom + 1; y < layout.shoeTop - 3; y++) {
          const skin: number[] = [];
          for (let x = 0; x < FRAME.width; x++) if (SKIN.has(c.get(x, y)!)) skin.push(x);
          const inner = skin.findIndex((x, k) => k > 0 && x - skin[k - 1] > 1);
          gaps.add(`${skin[inner - 1]}-${skin[inner]}`);
        }
        expect([...gaps]).toHaveLength(1);
      }
    }
  });

  it('se distinguent franchement : à la même pose, la diagonale haut diffère de la diagonale bas', () => {
    const text = (heading: Heading, i: number) => {
      const c = pose(heading, 'right', i).canvas;
      let t = '';
      for (let y = 0; y < FRAME.height; y++) for (let x = 0; x < FRAME.width; x++) t += c.get(x, y) ?? '.';
      return t;
    };
    for (let i = 0; i < FRAMES.length; i++) expect(text('up', i)).not.toBe(text('down', i));
  });
});

describe('sprites des joueurs : proportions chiffrées (ailier standard)', () => {
  const dims = bodyDims(SPECIMENS.ailier, false);
  const L = bodyLayout(dims);
  const c = idle(SPECIMENS.ailier);

  it('mesurent 43 px : tête 17 (16 + contour), cou 1, torse 11, short 4, jambes 6, chaussures 3', () => {
    const b = c.bounds()!;
    expect(b.bottom - b.top + 1).toBe(43);
    expect(L.neckY - (L.headTop - 1)).toBe(17);
    expect(L.torsoTop - L.neckY).toBe(NECK_ROWS);
    expect(L.shortsTop - L.torsoTop).toBe(11);
    expect(L.shortsBottom - L.shortsTop + 1).toBe(SHORTS_ROWS);
    expect(SHORTS_ROWS).toBe(4);
    expect(L.shoeTop - L.shortsBottom - 1).toBe(6);
    expect(SHOE_ROWS).toBe(3);
    expect(FRAME).toMatchObject({ width: 56, height: 64 });
  });

  it('sont minces : torse de 11 px (26 % de la hauteur), corps et bras de 19 px au plus de large', () => {
    expect(dims.torsoWidth).toBe(11);
    expect(dims.torsoWidth / 43).toBeLessThan(0.27);
    const b = c.bounds()!;
    expect(b.right - b.left + 1).toBeLessThanOrEqual(19);
  });

  it('ont une tête de 18 px de large, contour compris (≈ 40 % de la hauteur)', () => {
    let left = Infinity;
    let right = -Infinity;
    for (let y = L.headTop - 1; y < L.neckY; y++) {
      for (let x = 0; x < FRAME.width; x++) {
        if (!c.get(x, y)) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    expect(right - left + 1).toBe(HEAD_SIZE + 2);
    expect((L.neckY - L.headTop + 1) / 43).toBeGreaterThan(0.38);
  });

  it('ont des bras de 2 px avec un contour de chaque côté, de 12 px, la main de 2×2 à la taille', () => {
    // Le bras proche (côté qui s'éloigne, à gauche en diagonale bas), entier à côté du torse.
    const row = L.torsoTop + 3;
    expect(c.get(L.torsoLeft - 1, row)).toBe('o');
    expect(SKIN.has(c.get(L.torsoLeft - 2, row)!)).toBe(true);
    expect(SKIN.has(c.get(L.torsoLeft - 3, row)!)).toBe(true);
    expect(c.get(L.torsoLeft - 4, row)).toBe('o');
    let bottom = L.torsoTop;
    while (SKIN.has(c.get(L.torsoLeft - 3, bottom + 1)!)) bottom++;
    const length = bottom - L.torsoTop + 1;
    expect(length).toBe(12);
    // Main de 2×2 au bout, au niveau de la taille (bas du torse ou haut du short).
    expect(SKIN.has(c.get(L.torsoLeft - 2, bottom)!)).toBe(true);
    expect(SKIN.has(c.get(L.torsoLeft - 2, bottom - 1)!)).toBe(true);
    expect(bottom).toBeGreaterThanOrEqual(L.shortsTop - 1);
    expect(bottom).toBeLessThanOrEqual(L.shortsTop + 1);
  });

  it('ont des jambes de 3 à 4 px, séparées, en posture fléchie', () => {
    const row = L.shortsBottom + 2;
    const runs: number[] = [];
    let run = 0;
    for (let x = 0; x <= FRAME.width; x++) {
      if (SKIN.has(c.get(x, row)!)) run++;
      else if (run) {
        runs.push(run);
        run = 0;
      }
    }
    expect(runs).toHaveLength(2);
    for (const w of runs) {
      expect(w).toBeGreaterThanOrEqual(3);
      expect(w).toBeLessThanOrEqual(4);
    }
  });

  it('gardent un entrejambe droit à l’arrêt : même écart sur toutes les rangées (pas de croix)', () => {
    for (const heightCm of Object.values(SPECIMENS)) {
      for (const heavy of [false, true]) {
        const legs = idle(heightCm, heavy);
        const layout = bodyLayout(bodyDims(heightCm, heavy));
        const gaps = new Set<string>();
        // Rangées de peau des deux jambes : sous le short, au-dessus de la chaussette du pied
        // éloigné (2 px plus haut que l'autre).
        for (let y = layout.shortsBottom + 1; y < layout.shoeTop - 3; y++) {
          const skin: number[] = [];
          for (let x = 0; x < FRAME.width; x++) if (SKIN.has(legs.get(x, y)!)) skin.push(x);
          const inner = skin.findIndex((x, k) => k > 0 && x - skin[k - 1] > 1);
          gaps.add(`${skin[inner - 1]}-${skin[inner]}`);
        }
        expect([...gaps]).toHaveLength(1);
      }
    }
  });
});

describe('gabarits', () => {
  const height = (h: number, heavy = false) => {
    const b = idle(h, heavy).bounds()!;
    return b.bottom - b.top + 1;
  };

  it('pivot = ailier + 3 rangées et + 1 colonne ; meneur = ailier − 3 rangées ; même tête', () => {
    expect(height(SPECIMENS.pivot) - height(SPECIMENS.ailier)).toBe(3);
    expect(height(SPECIMENS.ailier) - height(SPECIMENS.meneur)).toBe(3);
    expect(height(SPECIMENS.meneur)).toBe(40);
    expect(height(SPECIMENS.pivot)).toBe(46);
    expect(bodyDims(SPECIMENS.pivot, false).torsoWidth - bodyDims(SPECIMENS.ailier, false).torsoWidth).toBe(1);
    expect(bodyDims(SPECIMENS.meneur, false).torsoWidth).toBe(bodyDims(SPECIMENS.ailier, false).torsoWidth);
    for (const h of Object.values(SPECIMENS)) {
      const L = bodyLayout(bodyDims(h, false));
      expect(L.neckY - L.headTop).toBe(HEAD_SIZE);
    }
    expect(BUILDS.pivot.torso + BUILDS.pivot.legs - BUILDS.ailier.torso - BUILDS.ailier.legs).toBe(3);
  });

  it('ne rallongent jamais les bras', () => {
    const armLength = (h: number) => {
      const c = idle(h);
      const L = bodyLayout(bodyDims(h, false));
      let bottom = L.torsoTop;
      while (SKIN.has(c.get(L.torsoRight + 2, bottom + 1)!)) bottom++;
      return bottom - L.torsoTop;
    };
    expect(armLength(SPECIMENS.meneur)).toBe(armLength(SPECIMENS.ailier));
    expect(armLength(SPECIMENS.pivot)).toBe(armLength(SPECIMENS.ailier));
  });
});

describe('visage de 3/4 (diagonale bas)', () => {
  const dark = (ch: string) => ch === 'n' || ch === 'o';
  const all = Object.entries(EXPRESSIONS) as [Expression, readonly string[]][];

  it('a un œil proche de 2×3 et un œil éloigné de 1×3, iris tournés vers le sens de la course', () => {
    for (const [, grid] of all) {
      for (const row of EYE_ROWS) expect(grid[row]).toBe('.....wwn....wn..');
      // Le visage est tourné : il n'est plus symétrique.
      expect(grid[EYE_ROWS[0]]).not.toBe([...grid[EYE_ROWS[0]]].reverse().join(''));
    }
  });

  it('a des sourcils de 4 px et 2 px (inclinés quand concentré)', () => {
    expect(EXPRESSIONS.neutre[6]).toBe('....nnnn....nn..');
    for (const [, grid] of all) {
      const brows = grid.slice(0, EYE_ROWS[0]).join('');
      expect([...brows].filter(dark)).toHaveLength(6);
    }
    expect(EXPRESSIONS.concentree[5]).not.toBe(EXPRESSIONS.concentree[6]);
  });

  it('décale le nez (3 px d’ombre de peau) et la bouche vers le sens de la course ; sourire seulement quand joyeux', () => {
    const center = (HEAD_SIZE - 1) / 2;
    for (const [, grid] of all) {
      const nose: number[] = [];
      grid.forEach((row) => [...row].forEach((ch, x) => ch === '3' && nose.push(x)));
      expect(nose).toHaveLength(3);
      for (const x of nose) expect(x - center).toBeGreaterThanOrEqual(2);
    }
    expect(EXPRESSIONS.neutre[13]).toBe('.........nnn....');
    expect(EXPRESSIONS.neutre.join('')).not.toContain('ww'.repeat(2));
    expect(EXPRESSIONS.joyeuse[13]).toContain('ww');
  });

  it('n’a aucun pixel sombre sur les joues', () => {
    for (const [, grid] of all) {
      for (let y = EYE_ROWS[1] + 1; y < HEAD_SIZE; y++) {
        for (const x of [0, 1, HEAD_SIZE - 2, HEAD_SIZE - 1]) expect(dark(grid[y][x])).toBe(false);
      }
    }
  });
});

describe('numéros de maillot', () => {
  it('ont 10 chiffres tous différents, de 6 rangées, avec un « 1 » étroit', () => {
    expect(new Set(JERSEY_DIGITS.map((g) => g.join('/'))).size).toBe(10);
    for (const glyph of JERSEY_DIGITS) expect(glyph).toHaveLength(JERSEY_DIGIT_HEIGHT);
    expect(JERSEY_DIGIT_HEIGHT).toBe(6);
    expect(JERSEY_DIGITS[1][0]).toHaveLength(2);
  });

  it('se lisent à l’endroit dans les quatre positions (jamais en miroir), dans le dos aussi', () => {
    const expected: string[] = [];
    drawJerseyNumber(12, 0, 0, (x, y) => void expected.push(`${x},${y}`));
    for (const { facing, heading } of SHEET_VIEWS) {
      const { canvas, numberAt } = composeFrame(specimen(186, false, 12), framesOf(heading)[0], bodyDims(186, false), 'team', facing, heading);
      const drawn: string[] = [];
      for (let y = 0; y < JERSEY_DIGIT_HEIGHT; y++) {
        for (let x = 0; x < jerseyNumberWidth(12); x++) if (canvas.get(numberAt!.x + x, numberAt!.y + y) === 'S') drawn.push(`${x},${y}`);
      }
      expect(drawn.sort()).toEqual([...expected].sort());
    }
  });

  it('tiennent tous (0 à 99) sur la poitrine du torse le plus étroit, sous le col', () => {
    const narrowest = Math.min(...Object.values(SPECIMENS).map((h) => bodyDims(h, false).torsoWidth));
    for (let n = 0; n < 100; n++) {
      for (const heading of HEADINGS) expect(jerseyNumberWidth(n)).toBeLessThanOrEqual(numberZone(narrowest, heading).width);
    }
    expect(NUMBER_TOP).toBeGreaterThanOrEqual(2);
    expect(NUMBER_MIN_TORSO).toBeLessThanOrEqual(BUILDS.meneur.torso);
  });
});

describe('ballon', () => {
  it('fait 8×8 (10×10 avec le contour), rond, avec des coutures et un reflet', () => {
    expect(BALL).toHaveLength(8);
    for (const row of BALL) expect(row).toHaveLength(8);
    const all = BALL.join('');
    expect(all).toContain('n');
    expect(all).toContain('l');
    // Coins vides : il est rond.
    expect(BALL[0][0]).toBe('.');
    expect(BALL[7][7]).toBe('.');
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
