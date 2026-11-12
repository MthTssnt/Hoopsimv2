import { COURT_DESIGNS, playerScale } from '../../../assets/players/courtDesigns';
import { PAINTED_ATLASES, PAINTED_ORIGIN } from '../../../assets/players/sources';
import { drawJerseyNumber, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import type { Appearance } from './appearance';
import { FRAME, SPRITE_DETAIL as D, type Facing, type Heading } from './views';
import { MOTION_INDICES } from './layout';
import { cleanPose, repairContact, handMask, skinPixel } from './contactPixels';
import { dribbleFlightY, type MotionId, type MotionPose, type Point } from './motion';

export interface MotionArtFrame {
  canvas: HTMLCanvasElement; hand: HTMLCanvasElement; pose: MotionPose; handCenter: Point;
  bounds: { left: number; right: number; top: number; bottom: number };
}
const cleaned = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement>>();
function sourcePose(image: HTMLImageElement, frame: { x: number; y: number; width: number; height: number; left: number; top: number; ball: Point | null }): HTMLCanvasElement {
  let cache = cleaned.get(image); if (!cache) { cache = new Map(); cleaned.set(image, cache); }
  const key = frame.y * image.width + frame.x;
  const existing = cache.get(key); if (existing) return existing;
  const c = document.createElement('canvas'); c.width = frame.width; c.height = frame.height;
  const ctx = c.getContext('2d')!; ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  const pixels = ctx.getImageData(0, 0, c.width, c.height); cleanPose(pixels.data, c.width, c.height);
  if (frame.ball) repairContact(pixels.data, c.width, c.height, frame.ball.x * D - frame.left, frame.ball.y * D - frame.top);
  ctx.putImageData(pixels, 0, 0);
  cache.set(key, c); return c;
}
const canvas = () => { const c = document.createElement('canvas'); c.width = FRAME.width * D; c.height = FRAME.height * D; return c; };
export function pixelBounds(c: HTMLCanvasElement): MotionArtFrame['bounds'] {
  const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let left = c.width, right = -1, top = c.height, bottom = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 180) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  return { left, right, top, bottom };
}

/** Une seule image complète par pose, gardée à double résolution jusqu'au rendu en match. */
export function paintMotion(images: readonly HTMLImageElement[], look: Appearance, team: number, id: MotionId, frame: number, heading: Heading = 'down', facing: Facing = 'right'): MotionArtFrame {
  const atlasIndex = PAINTED_ATLASES.findIndex((a) => a.team === team && a.variant === look.variant && a.heading === heading);
  if (atlasIndex < 0) throw new Error(`Planche peinte manquante : ${team}/${look.variant}/${heading}`);
  const indices = MOTION_INDICES[id];
  const original = PAINTED_ATLASES[atlasIndex].frames[indices[Math.max(0, Math.min(frame, indices.length - 1))]];
  if (!original) throw new Error(`Pose peinte manquante : ${id}/${frame}`);
  const c = canvas(), ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  const height = playerScale(look.heightCm, look.heavy, COURT_DESIGNS[team][look.variant]).height;
  const sy = height / 48, sx = sy * (look.heavy ? 1.1 : 1);
  const transform = (p: Point): Point => ({ x: FRAME.centerX + (p.x - PAINTED_ORIGIN.x) * sx, y: FRAME.groundY + (p.y - PAINTED_ORIGIN.y) * sy });
  const origin = transform({ x: original.left / D, y: original.top / D });
  ctx.drawImage(sourcePose(images[atlasIndex + 2], original), 0, 0, original.width, original.height,
    Math.round(origin.x * D), Math.round(origin.y * D), Math.round(original.width * sx), Math.round(original.height * sy));
  let output = c;
  const flipPoint = (p: Point): Point => facing === 'left' ? { x: FRAME.width - p.x, y: p.y } : p;
  if (facing === 'left') {
    output = canvas(); const dest = output.getContext('2d')!; dest.imageSmoothingEnabled = false;
    dest.translate(FRAME.width * D, 0); dest.scale(-1, 1); dest.drawImage(c, 0, 0);
  }
  // Reposer le véritable numéro, jamais en miroir et jamais sur une main qui passe devant.
  const oc = output.getContext('2d')!, number = flipPoint(transform(original.number));
  const pixels = oc.getImageData(0, 0, output.width, output.height).data;
  const nx = Math.round(number.x * D - jerseyNumberWidth(look.number) / 2), ny = Math.round(number.y * D - 5);
  oc.fillStyle = team === 0 ? '#fff5e5' : '#702437';
  drawJerseyNumber(look.number, 0, 0, (x, y) => {
    const px = nx + x;
    for (let dy = 0; dy < 2; dy++) {
      const py = ny + y * 2 + dy, i = (py * output.width + px) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (pixels[i + 3] > 200 && (team === 0 ? b > r * 1.3 && b > g : r > 190 && g > 180 && b > 155)) oc.fillRect(px, py, 1, 1);
    }
  });
  let ball = original.ball ? flipPoint(transform(original.ball)) : null;
  // Les gestes sans repère source prennent leur point de contact sur les pixels de la main.
  // Rien n'est redessiné : le même calcul est utilisé à la cuisson et dans l'atelier.
  const raised = (frame === 2 && ['jumpShot', 'layup', 'dunk', 'lobPass', 'freeThrow'].includes(id));
  const forward = (id === 'pass' && frame <= 2) || (id === 'catch' && frame <= 1) || (id === 'rebound' && frame >= 2);
  if (!ball && (raised || forward)) {
    const pixels = oc.getImageData(0, 0, output.width, output.height).data;
    const candidates: Point[] = [];
    for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++) {
      const i = (y * output.width + x) * 4;
      if (pixels[i + 3] > 180 && skinPixel(pixels[i], pixels[i + 1], pixels[i + 2])) candidates.push({ x, y });
    }
    if (candidates.length) {
      const edge = raised ? Math.min(...candidates.map((p) => p.y)) : (facing === 'left' ? Math.min(...candidates.map((p) => p.x)) : Math.max(...candidates.map((p) => p.x)));
      const palm = candidates.filter((p) => raised ? p.y <= edge + 5 : Math.abs(p.x - edge) <= 4);
      const x = palm.reduce((v, p) => v + p.x, 0) / palm.length / D;
      const y = palm.reduce((v, p) => v + p.y, 0) / palm.length / D;
      ball = { x: x + (facing === 'left' ? -1 : 1) * (raised ? 2 : 4), y: y + (raised ? 4 : 0) };
    }
  }
  let contact = !!ball && (original.contact || raised || forward);
  if (ball && (id === 'dribble' || id === 'dribbleIdle')) {
    const atlas = PAINTED_ATLASES[atlasIndex];
    const release = atlas.frames[indices[1]].ball, caught = atlas.frames[indices[6]].ball;
    if (release && caught) {
      const y = dribbleFlightY(frame, transform(release).y, transform(caught).y, FRAME.groundY - 5);
      if (y !== null) { ball.y = y; contact = false; }
    }
  }
  const hand = canvas();
  if (ball && contact) {
    const hc = hand.getContext('2d')!, pixels = oc.getImageData(0, 0, output.width, output.height);
    pixels.data.set(handMask(pixels.data, output.width, output.height, ball.x * D, ball.y * D, 5.5 * D));
    hc.putImageData(pixels, 0, 0);
  }
  return { canvas: output, hand, handCenter: ball ?? { x: FRAME.centerX, y: FRAME.groundY },
    pose: { height, ball, contact, palm: ball && contact ? { x: ball.x, y: ball.y - 5 } : null }, bounds: pixelBounds(output) };
}
