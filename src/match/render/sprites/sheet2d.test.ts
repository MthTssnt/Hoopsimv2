import { describe, expect, it } from 'vitest';
import { appearance2DFor, type Appearance } from './appearance';
import { BakeQueue, SheetBaker } from './bake';
import type { SlotCanvas } from './canvas';
import { LAYOUT_2D } from './layout';
import { FRAME, type Heading } from './rig';
import { composeFrame2D, FLOOR_Y, metrics2D, sheetFrames2D, sheetHands2D, strongArm, UNDER_HAND } from './sheet2d';

const base = appearance2DFor({ id: 'feuille-2d', heightCm: 200, weightKg: 98, number: 23, age: 27 });
const withHand = (dominantHand: 'droite' | 'gauche'): Appearance => ({ ...base, character: { ...base.character!, dominantHand } });
const RIGHTY = withHand('droite');
const LEFTY = withHand('gauche');
const HEADINGS: readonly Heading[] = ['down', 'up'];
const FACINGS = ['right', 'left'] as const;
const DRIBBLES = [LAYOUT_2D.animations.dribble.frames, LAYOUT_2D.animations.dribbleIdle.frames];
const DRIBBLE_FRAMES = DRIBBLES.flat();

describe('feuille du match en rendu 2D', () => {
  it('28 images par bloc (LAYOUT_2D) ; ballon tenu au dribble, au tir, au layup et à la montée du dunk', () => {
    const frames = sheetFrames2D();
    expect(frames).toHaveLength(LAYOUT_2D.framesPerBlock);
    const fixed = LAYOUT_2D.fixed;
    const withBall = frames.flatMap((f, i) => (f.ball ? [i] : []));
    expect(withBall).toEqual([...DRIBBLE_FRAMES, fixed.withBall, fixed.layup, fixed.dunkRise]);
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
          // Suspension de la course : au-dessus du sol ; en l'air, c'est le monde qui monte le sprite.
          if (spec.air) expect(b.bottom, `${heading} ${i}`).toBeLessThanOrEqual(FRAME.groundY);
          else if (pose.lift) expect(b.bottom, `${heading} ${i}`).toBeLessThan(FRAME.groundY);
          else expect(b.bottom, `${heading} ${i}`).toBe(FRAME.groundY);
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

  it('tir et layup de la main forte : le ballon est au-dessus de sa paume ; au layup, genou du côté de la main faible levé', () => {
    const { withBall, layup, dunkRise } = LAYOUT_2D.fixed;
    for (const look of [RIGHTY, LEFTY]) {
      for (const heading of HEADINGS) {
        for (const facing of FACINGS) {
          for (const i of [withBall, layup, dunkRise]) {
            const ball = composeFrame2D(look, i, heading)[facing].ball!;
            const hand = sheetHands2D(look, i, heading, facing);
            expect(ball.y, `${i} ${heading} ${facing}`).toBeLessThan(Math.min(hand.palm.y, hand.tip.y));
            expect(Math.abs(ball.x - hand.palm.x)).toBeLessThanOrEqual(1);
          }
        }
      }
    }
    const pose = sheetFrames2D()[layup].pose;
    if (typeof pose !== 'function') throw new Error('layup : pose selon la main forte');
    for (const strong of [0, 1] as const) {
      const legs = pose(strong).legs;
      expect(legs[1 - strong].hip).toBeGreaterThan(legs[strong].hip + 1);
    }
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
    for (const i of Object.values(LAYOUT_2D.fixed)) expect(Math.abs(pelvis(i) - pelvis(0)), `image ${i}`).toBeLessThanOrEqual(4);
    const m = metrics2D(RIGHTY);
    expect(m.raisedHandTop).toBeLessThan(m.headTop + 4);
  });

  it('cuisson : 112 images et leurs ancres (avec la profondeur du ballon), pas à pas = d’un trait', () => {
    const colors = { primary: [0x2244aa, 0x1d4ed8, 0x102060] as [number, number, number], secondary: [0xffd070, 0xf59e0b, 0xa06000] as [number, number, number], renderer: '2d' as const };
    const a = new SheetBaker('a', RIGHTY, colors);
    const b = new SheetBaker('b', RIGHTY, colors);
    while (!a.step(0.01, () => 0));
    const queue = new BakeQueue<SheetBaker>();
    queue.add('b', b);
    while (queue.size > 0) queue.step(1000);
    expect(a.anchors).toHaveLength(112);
    expect(a.anchors.filter((x) => x?.behind).length).toBeGreaterThan(0);
    expect(a.anchors).toEqual(b.anchors);
    expect(a.pixels.every((v, k) => v === b.pixels[k])).toBe(true);
  });
});
