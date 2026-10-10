import { CANDIDATE_STYLES, type CandidateHair, type CandidatePose, type CandidateStyle, type StyleId } from '../../../assets/sprites/styleCandidates';
import type { Expression } from '../../../assets/sprites/heads';
import { drawJerseyNumber, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import { SlotCanvas } from './canvas';
import type { Facing } from './compose';
import { FRAME } from './rig';

/** Ce qui varie d'un joueur à l'autre sur la planche des styles (les couleurs sont posées au dessin). */
export interface CandidateLook {
  hair: CandidateHair;
  number: number;
  /** Expression imposée (sinon celle de la pose). */
  expression?: Expression;
}

export interface CandidateFrame {
  canvas: SlotCanvas;
  /** Centre du ballon tenu (coordonnées du cadre), ou null. */
  ball: { x: number; y: number } | null;
}

export function candidateStyle(id: StyleId): CandidateStyle {
  return CANDIDATE_STYLES.find((s) => s.id === id)!;
}

/**
 * Tête d'un style candidat : forme et ombrage de la peau, cheveux, puis visage (diagonale bas)
 * ou rien (diagonale haut, vue de dos). Sans contour : il est posé sur la silhouette entière.
 */
export function candidateHead(style: CandidateStyle, hair: CandidateHair, expression: Expression, back: boolean, left: number, top: number, canvas: SlotCanvas): void {
  canvas.stamp(back ? style.head.back : style.head.front, left, top);
  const grids = style.hairs[hair];
  const off = grids.offset ?? { x: 0, y: 0 };
  canvas.stamp(back ? grids.back : grids.front, left + off.x, top + off.y);
  if (!back) canvas.stamp(style.expressions[expression], left, top);
}

/**
 * Assemble une image de la planche des styles : corps de la pose, tête, pixels posés par-dessus
 * la tête (bras levé), contour de la silhouette, puis numéro sur le maillot encore visible. Vers
 * la gauche, le dessin est retourné et le numéro reposé à l'endroit.
 */
export function composeCandidate(id: StyleId, pose: CandidatePose, look: CandidateLook, facing: Facing = 'right'): CandidateFrame {
  const style = candidateStyle(id);
  const body = style.bodies[pose];
  let c = new SlotCanvas(FRAME.width, FRAME.height);
  const left = FRAME.centerX - body.center;
  const top = FRAME.groundY - body.rows.length;
  c.stamp(body.rows, left, top);
  candidateHead(style, look.hair, look.expression ?? body.expression ?? 'neutre', !!body.back, left + body.head.x, top + body.head.y, c);
  if (body.over) c.stamp(body.over, left, top);
  c.outline('o');
  const mirror = facing === 'left';
  if (mirror) c = c.mirrored();
  if (body.number) {
    const zone = body.number;
    const zoneLeft = mirror ? FRAME.width - 1 - (left + zone.x + zone.width - 1) : left + zone.x;
    const x = zoneLeft + Math.floor((zone.width - jerseyNumberWidth(look.number)) / 2);
    drawJerseyNumber(look.number, x, top + zone.y, (px, py) => {
      const under = c.get(px, py);
      if (under === 'p' || under === 'P') c.set(px, py, 'S');
    });
  }
  let ball: CandidateFrame['ball'] = body.ball ? { x: left + body.ball.x, y: top + body.ball.y } : null;
  if (ball && mirror) ball = { x: FRAME.width - 1 - ball.x, y: ball.y };
  return { canvas: c, ball };
}
