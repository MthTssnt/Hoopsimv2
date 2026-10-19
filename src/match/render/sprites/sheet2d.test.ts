import { describe, expect, it } from 'vitest';
import { appearance2DFor, type Appearance } from './appearance';
import { BakeQueue, SheetBaker } from './bake';
import type { SlotCanvas } from './canvas';
import { LAYOUT_2D } from './layout';
import { FRAME, type Heading } from './rig';
import { composeFrame2D, FLOOR_Y, metrics2D, sheetFrames2D, sheetHands2D, sheetPalms2D, strongArm, UNDER_HAND } from './sheet2d';

const base = appearance2DFor({ id: 'feuille-2d', heightCm: 200, weightKg: 98, number: 23, age: 27 });
const withHand = (dominantHand: 'droite' | 'gauche'): Appearance => ({ ...base, character: { ...base.character!, dominantHand } });
const RIGHTY = withHand('droite');
const LEFTY = withHand('gauche');
const HEADINGS: readonly Heading[] = ['down', 'up'];
const FACINGS = ['right', 'left'] as const;
const DRIBBLES = [LAYOUT_2D.animations.dribble.frames, LAYOUT_2D.animations.dribbleIdle.frames];
const DRIBBLE_FRAMES = DRIBBLES.flat();

/** Hauteur à l'écran (y) des deux paumes d'une image : [gauche du joueur, droite du joueur]. */
function handsAt(look: Appearance, index: number, heading: Heading, facing: 'right' | 'left'): [number, number] {
  const palms = sheetPalms2D(look, index, heading, facing);
  return [palms[0].y, palms[1].y];
}

describe('feuille du match en rendu 2D', () => {
  it('55 images par bloc (LAYOUT_2D) ; ballon tenu au dribble et dans les gestes où il est en main', () => {
    const frames = sheetFrames2D();
    expect(frames).toHaveLength(LAYOUT_2D.framesPerBlock);
    const g = LAYOUT_2D.gestures;
    const withBall = frames.flatMap((f, i) => (f.ball ? [i] : []));
    const expected = [
      ...DRIBBLE_FRAMES,
      ...g.jumpShot.slice(0, 3),
      ...g.layup.slice(0, 3),
      ...g.dunk.slice(0, 3),
      g.rebound[1],
      g.pass[0],
      g.lobPass[0],
      g.catch[0],
      ...g.freeThrow.slice(0, 2),
    ].sort((x, y) => x - y);
    expect(withBall).toEqual(expected);
  });

  it('chaque image tient dans le cadre, pieds au sol (sauf en suspension et en l’air) ; le ballon tenu est dans le cadre', () => {
    for (const heading of HEADINGS) {
      for (let i = 0; i < LAYOUT_2D.framesPerBlock; i++) {
        const both = composeFrame2D(RIGHTY, i, heading);
        const spec = sheetFrames2D()[i];
        const pose = typeof spec.pose === 'function' ? spec.pose(1) : spec.pose;
        for (const facing of FACINGS) {
          const { canvas, ball } = both[facing];
          const b = canvas.bounds()!;
          expect(b.top, `${heading} ${i}`).toBeGreaterThan(0);
          expect(b.left).toBeGreaterThan(0);
          expect(b.right).toBeLessThan(FRAME.width - 1);
          // Au sol : sur la rangée du sol (à 1 px près à l'envol de la course) ; en l'air, c'est le monde qui monte le sprite.
          expect(b.bottom, `${heading} ${i}`).toBeLessThanOrEqual(FRAME.groundY);
          if (!spec.air && !pose.lift) expect(b.bottom, `${heading} ${i}`).toBeGreaterThanOrEqual(FRAME.groundY - 1);
          if (ball) {
            expect(ball.x, `${heading} ${i} ${facing}`).toBeGreaterThanOrEqual(4);
            expect(ball.x).toBeLessThanOrEqual(FRAME.width - 4);
            expect(ball.y).toBeGreaterThanOrEqual(5);
            expect(ball.y).toBeLessThanOrEqual(FLOOR_Y);
          }
        }
      }
    }
  });

  it('dribble : le ballon touche le sol une fois par cycle ; dans la main, il est sous la paume, sans la couvrir', () => {
    for (const look of [RIGHTY, LEFTY]) {
      for (const heading of HEADINGS) {
        for (const facing of FACINGS) {
          for (const frames of DRIBBLES) {
            const balls = frames.map((i) => composeFrame2D(look, i, heading)[facing].ball!);
            expect(balls.filter((b) => b.y === FLOOR_Y), `${heading} ${facing}`).toHaveLength(1);
            // Le ballon monte et descend d'au moins 8 px.
            expect(Math.max(...balls.map((b) => FLOOR_Y - b.y)), `${heading} ${facing}`).toBeGreaterThanOrEqual(8);
            const contact = frames[0];
            const hand = sheetHands2D(look, contact, heading, facing);
            const ball = composeFrame2D(look, contact, heading)[facing].ball!;
            expect(ball.y - Math.round(Math.max(hand.palm.y, hand.tip.y)), `${heading} ${facing}`).toBe(UNDER_HAND);
          }
        }
      }
    }
  });

  it('main forte : de face, un droitier dribble de la main proche vers la droite (ballon devant), de la main éloignée vers la gauche (derrière) ; l’inverse pour un gaucher', () => {
    expect(strongArm(RIGHTY, 'right')).toBe(1);
    expect(strongArm(RIGHTY, 'left')).toBe(0);
    expect(strongArm(LEFTY, 'right')).toBe(0);
    for (const i of DRIBBLE_FRAMES) {
      expect(composeFrame2D(RIGHTY, i, 'down').right.ball!.behind, `${i}`).toBe(false);
      expect(composeFrame2D(RIGHTY, i, 'down').left.ball!.behind, `${i}`).toBe(true);
      expect(composeFrame2D(LEFTY, i, 'down').right.ball!.behind, `${i}`).toBe(true);
      expect(composeFrame2D(LEFTY, i, 'down').left.ball!.behind, `${i}`).toBe(false);
      // De dos, le dribble se fait devant le joueur, donc derrière lui pour la caméra ; la main éloignée toujours.
      expect(composeFrame2D(RIGHTY, i, 'up').left.ball!.behind, `${i}`).toBe(true);
      expect(composeFrame2D(LEFTY, i, 'up').right.ball!.behind, `${i}`).toBe(true);
    }
    // La profondeur ne change pas au cours d'un cycle (pas de ballon qui saute devant puis derrière).
    for (const look of [RIGHTY, LEFTY]) for (const heading of HEADINGS) for (const facing of FACINGS) for (const frames of DRIBBLES) expect(new Set(frames.map((i) => composeFrame2D(look, i, heading)[facing].ball!.behind)).size).toBe(1);
    // Vers la gauche, un droitier n'est pas le miroir de son image vers la droite : il change de main.
    const px = (c: SlotCanvas) => {
      const out: string[] = [];
      c.forEach((x, y, s) => out.push(`${x},${y},${s}`));
      return out;
    };
    expect(px(composeFrame2D(RIGHTY, 10, 'down').left.canvas)).not.toEqual(px(composeFrame2D(RIGHTY, 10, 'down').right.canvas.mirrored()));
    expect(px(composeFrame2D(RIGHTY, 10, 'down').right.canvas)).not.toEqual(px(composeFrame2D(LEFTY, 10, 'down').right.canvas));
  });

  it('ballon derrière le porteur : le corps en couvre moins de la moitié (il reste lisible)', () => {
    for (const look of [RIGHTY, LEFTY]) {
      for (const heading of HEADINGS) {
        for (const i of DRIBBLE_FRAMES) {
          for (const facing of FACINGS) {
            const { canvas, ball } = composeFrame2D(look, i, heading)[facing];
            if (!ball?.behind) continue;
            let covered = 0;
            let total = 0;
            for (let dy = -4; dy <= 4; dy++) {
              for (let dx = -4; dx <= 4; dx++) {
                if (dx * dx + dy * dy > 16) continue;
                total++;
                if (canvas.get(ball.x + dx, ball.y + dy) !== null) covered++;
              }
            }
            expect(covered / total, `${heading} ${i} ${facing}`).toBeLessThan(0.5);
          }
        }
      }
    }
  });

  it('tir, layup, dunk et lancer de la main forte : le ballon est au-dessus de sa paume', () => {
    const g = LAYOUT_2D.gestures;
    for (const look of [RIGHTY, LEFTY]) {
      for (const heading of HEADINGS) {
        for (const facing of FACINGS) {
          for (const i of [g.jumpShot[1], g.jumpShot[2], g.layup[1], g.layup[2], g.dunk[1], g.freeThrow[1]]) {
            const ball = composeFrame2D(look, i, heading)[facing].ball!;
            const hand = sheetHands2D(look, i, heading, facing);
            expect(ball.y, `${i} ${heading} ${facing}`).toBeLessThan(Math.min(hand.palm.y, hand.tip.y));
            expect(Math.abs(ball.x - hand.palm.x)).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  /** Pose d'une image pour la main forte `strong`. */
  const poseOf = (i: number, strong: 0 | 1) => {
    const pose = sheetFrames2D()[i].pose;
    return typeof pose === 'function' ? pose(strong) : pose;
  };
  const g = LAYOUT_2D.gestures;

  it('tir en suspension : coude sous le ballon au point de déclenchement (avant-bras vertical), col de cygne au lâcher', () => {
    for (const strong of [0, 1] as const) {
      for (const i of [g.jumpShot[2], g.freeThrow[1]]) {
        const arm = poseOf(i, strong).arms[strong];
        expect(Math.abs(arm.pitch + arm.elbow - Math.PI), `${i}`).toBeLessThan(0.25);
        expect(arm.elbow).toBeGreaterThanOrEqual(1.0);
        expect(arm.elbow).toBeLessThanOrEqual(1.6);
        // Le ballon au-dessus du front.
        const ball = composeFrame2D(RIGHTY, i, 'down').right.ball!;
        expect(ball.y).toBeLessThan(metrics2D(RIGHTY).headTop + 6);
      }
      for (const i of [g.jumpShot[3], g.freeThrow[2]]) {
        const arm = poseOf(i, strong).arms[strong];
        expect(arm.elbow, `${i}`).toBeLessThan(0.3);
        expect(arm.wrist!).toBeLessThan(-1);
      }
    }
  });

  it('layup : appel sur le pied opposé, c’est le genou du côté de la main forte qui monte', () => {
    for (const strong of [0, 1] as const) {
      for (const i of [g.layup[1], g.layup[2]]) {
        const legs = poseOf(i, strong).legs;
        expect(legs[strong].hip, `${i} ${strong}`).toBeGreaterThan(legs[1 - strong].hip + 1);
      }
    }
  });

  it('contre : une seule main au plus haut, l’autre au moins 6 px plus bas ; de la main forte ou de l’autre', () => {
    for (const heading of HEADINGS) {
      for (const [gesture, raised] of [
        ['block', 'strong'],
        ['blockOff', 'weak'],
      ] as const) {
        const i = g[gesture][1];
        for (const facing of FACINGS) {
          const strong = strongArm(RIGHTY, facing);
          const up = raised === 'strong' ? strong : 1 - strong;
          const palms = handsAt(RIGHTY, i, heading, facing);
          expect(palms[1 - up] - palms[up], `${gesture} ${heading} ${facing}`).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });

  it('rebond : deux mains au-dessus de la tête, puis le ballon à hauteur du menton', () => {
    const top = metrics2D(RIGHTY).headTop;
    for (const heading of HEADINGS) {
      const palms = handsAt(RIGHTY, g.rebound[0], heading, 'right');
      expect(Math.max(...palms), heading).toBeLessThan(top + 2);
      const ball = composeFrame2D(RIGHTY, g.rebound[1], heading).right.ball!;
      expect(ball.y, heading).toBeGreaterThan(top + 6);
      expect(ball.y, heading).toBeLessThan(top + 22);
    }
  });

  it('passe : deux mains sur le ballon à la poitrine, puis bras tendus pouces vers le bas', () => {
    expect(sheetFrames2D()[g.pass[0]].ball).toEqual({ at: 'between' });
    for (const arm of poseOf(g.pass[1], 1).arms) {
      expect(arm.elbow).toBeLessThan(0.2);
      expect(Math.abs(arm.pitch - Math.PI / 2)).toBeLessThan(0.2);
      expect(arm.wrist!).toBeLessThan(0);
    }
  });

  it('lancer franc : jamais en l’air, sur la pointe des pieds au lâcher', () => {
    for (const i of g.freeThrow) expect(sheetFrames2D()[i].air, `${i}`).toBeFalsy();
    for (const leg of poseOf(g.freeThrow[2], 1).legs) expect(leg.foot!).toBeLessThan(-0.3);
  });

  it('membres éloignés plus sombres : au dribble, le bras éloigné a moins de tons clairs que le bras proche', () => {
    for (const heading of HEADINGS) {
      const c = composeFrame2D(RIGHTY, 18, heading).right.canvas;
      const hand = sheetHands2D(RIGHTY, 18, heading, 'right');
      const b = c.bounds()!;
      let near = 0;
      let far = 0;
      c.forEach((x, y, slot) => {
        if (y < b.top + 12 || y > b.bottom - 12 || !['1', '5', '2'].includes(slot)) return;
        if (Math.sign(x - hand.pelvis.x) === Math.sign(hand.palm.x - hand.pelvis.x) && Math.abs(x - hand.pelvis.x) > 4) near++;
        else if (Math.abs(x - hand.pelvis.x) > 4) far++;
      });
      expect(near, heading).toBeGreaterThan(far);
    }
  });

  it('en l’air, le bassin reste à la hauteur de l’arrêt (le monde monte le sprite)', () => {
    const pelvis = (i: number) => sheetHands2D(RIGHTY, i, 'down', 'right').pelvis.y;
    const air = sheetFrames2D().flatMap((f, i) => (f.air ? [i] : []));
    expect(air.length).toBeGreaterThan(10);
    for (const i of air) expect(Math.abs(pelvis(i) - pelvis(0)), `image ${i}`).toBeLessThanOrEqual(4);
    const m = metrics2D(RIGHTY);
    expect(m.raisedHandTop).toBeLessThan(m.headTop + 4);
  });

  it('cuisson : 220 images et leurs ancres (avec la profondeur du ballon), pas à pas = d’un trait', () => {
    const colors = { primary: [0x2244aa, 0x1d4ed8, 0x102060] as [number, number, number], secondary: [0xffd070, 0xf59e0b, 0xa06000] as [number, number, number], renderer: '2d' as const };
    const a = new SheetBaker('a', RIGHTY, colors);
    const b = new SheetBaker('b', RIGHTY, colors);
    while (!a.step(0.01, () => 0));
    const queue = new BakeQueue<SheetBaker>();
    queue.add('b', b);
    while (queue.size > 0) queue.step(1000);
    expect(a.anchors).toHaveLength(220);
    expect(a.anchors.filter((x) => x?.behind).length).toBeGreaterThan(0);
    expect(a.anchors).toEqual(b.anchors);
    expect(a.pixels.every((v, k) => v === b.pixels[k])).toBe(true);
  });
});
