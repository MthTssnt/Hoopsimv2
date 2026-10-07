import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../assets/palette';
import { TEAM_SEEDS } from '../../../engine';
import { ARENA_APRON, WORLD_HEIGHT, WORLD_WIDTH } from '../../config';
import { COURT_LENGTH, makeCourt } from '../../physics/court';
import { PLAYER_TUNING } from '../../world/player';
import { ART_PPM, ART_VIEW } from '../artConfig';
import { MATCH_PROJECTION } from '../projection';
import { arenaLayout, drawArena, STYLE_APRON } from './arena';
import { makeProjection } from './artProjection';
import { teamLook, type PaintTarget } from './draw';

/** Tampon de pixels qui reçoit les aplats (sans alpha : la dernière couleur gagne). */
function paintBuffer(width: number, height: number) {
  const pixels = new Int32Array(width * height).fill(-1);
  let color = 0;
  const target: PaintTarget = {
    fillStyle(c: number) {
      color = c;
      return target;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      const x0 = Math.max(0, Math.round(x));
      const y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(width, Math.round(x + w));
      const y1 = Math.min(height, Math.round(y + h));
      for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) pixels[py * width + px] = color;
      return target;
    },
  };
  return { target, at: (x: number, y: number) => pixels[Math.round(y) * width + Math.round(x)] };
}

const home = teamLook(TEAM_SEEDS[0]);

describe('arène', () => {
  it('garde la mise en page validée de ?style (ligne de fond à 587 px, ligne du fond à 55 px)', () => {
    const proj = makeProjection(587 - COURT_LENGTH * ART_PPM, 55);
    const a = arenaLayout(proj, makeCourt('pro'), STYLE_APRON);
    expect(a.rightBaseline).toBe(587);
    expect(a.farLine).toBe(55);
    expect(a.nearLine).toBeLessThan(ART_VIEW.height);
    expect(a.farApronTop).toBeGreaterThan(0);
  });

  it('couvre de bandes toute la zone où un joueur peut aller, et tient dans le monde', () => {
    for (const side of [ARENA_APRON.far, ARENA_APRON.near, ARENA_APRON.baseline]) expect(side).toBeGreaterThan(PLAYER_TUNING.boundsMargin);
    const a = arenaLayout(MATCH_PROJECTION, makeCourt('pro'), ARENA_APRON);
    expect(a.leftApron).toBeGreaterThan(20); // du public derrière la ligne de fond de gauche…
    expect(WORLD_WIDTH - a.rightApron).toBeGreaterThan(20); // …et de droite
    expect(a.farApronTop).toBeGreaterThan(40); // tribunes au fond
    expect(a.nearApronBottom).toBeLessThanOrEqual(WORLD_HEIGHT);
  });

  it('dessine les deux moitiés du terrain, les bandes et le public dans le monde du match', () => {
    const court = makeCourt('pro');
    const buffer = paintBuffer(WORLD_WIDTH, WORLD_HEIGHT);
    drawArena(buffer.target, MATCH_PROJECTION, court, home, { size: { width: WORLD_WIDTH, height: WORLD_HEIGHT }, apron: ARENA_APRON });
    const a = arenaLayout(MATCH_PROJECTION, court, ARENA_APRON);
    const P = (x: number, y: number) => MATCH_PROJECTION.project(x, y);
    // Lignes de touche, de fond et médiane à la craie.
    expect(buffer.at(P(3, 0).x, a.farLine)).toBe(PALETTE.chalk);
    expect(buffer.at(P(3, court.width).x, a.nearLine)).toBe(PALETTE.chalk);
    expect(buffer.at(a.leftBaseline, P(0, 4).y)).toBe(PALETTE.chalk);
    expect(buffer.at(a.rightBaseline, P(0, 4).y)).toBe(PALETTE.chalk);
    // Les deux raquettes ont la même couleur, symétriques.
    const rimY = court.hoops.left.rim.y;
    const leftPaint = buffer.at(P(3, rimY + 1).x, P(3, rimY + 1).y);
    const rightPaint = buffer.at(P(court.length - 3, rimY + 1).x, P(court.length - 3, rimY + 1).y);
    expect(leftPaint).toBe(rightPaint);
    expect([PALETTE.wood, PALETTE.woodLight]).not.toContain(leftPaint);
    // Bandes aux couleurs de l'équipe : au fond, devant, derrière les deux lignes de fond.
    expect(buffer.at(P(5, -0.3).x, P(5, -0.3).y)).toBe(home.primary[1]);
    expect(buffer.at(P(5, court.width + 1).x, P(5, court.width + 1).y)).toBe(home.primary[1]);
    expect(buffer.at(P(-0.8, 6).x, P(-0.8, 6).y)).toBe(home.primary[1]);
    expect(buffer.at(P(court.length + 0.8, 6).x, P(court.length + 0.8, 6).y)).toBe(home.primary[1]);
    // Du public (autre chose que le fond) derrière chaque ligne de fond.
    const crowd = (x0: number, x1: number) => {
      let n = 0;
      for (let x = x0; x < x1; x++) for (let y = a.farLine; y < a.nearLine; y++) if (buffer.at(x, y) !== PALETTE.navy) n++;
      return n;
    };
    expect(crowd(0, a.leftApron - 3)).toBeGreaterThan(500);
    expect(crowd(a.rightApron + 3, WORLD_WIDTH)).toBeGreaterThan(500);
  });

  it('trace la ligne à 3 pts du niveau choisi, aux deux paniers', () => {
    const size = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
    const pro = makeCourt('pro');
    const college = makeCourt('college');
    /** Craie à ±1 px du sommet de l'arc (m du cercle, dans l'axe) pour chaque panier. */
    const arcAt = (level: 'pro' | 'college', arc: number) => {
      const court = makeCourt(level);
      const buffer = paintBuffer(WORLD_WIDTH, WORLD_HEIGHT);
      drawArena(buffer.target, MATCH_PROJECTION, court, home, { size, apron: ARENA_APRON });
      return (['left', 'right'] as const).map((side) => {
        const { rim, toCourt } = court.hoops[side];
        const p = MATCH_PROJECTION.project(rim.x + toCourt * arc, rim.y);
        return [-1, 0, 1].some((dx) => buffer.at(p.x + dx, p.y) === PALETTE.chalk);
      });
    };
    expect(arcAt('pro', pro.threeArc)).toEqual([true, true]);
    expect(arcAt('pro', college.threeArc)).toEqual([false, false]);
    expect(arcAt('college', college.threeArc)).toEqual([true, true]);
    expect(arcAt('college', pro.threeArc)).toEqual([false, false]);
  });
});
