import { POSE_CONTACTS, contactPoint } from './poseContacts';
import { artCanvas, type ArtCanvas, type ArtSource } from './artCanvas';
import { COURT_DESIGNS, playerScale } from '../../../assets/players/courtDesigns';
import { PAINTED_ATLASES, PAINTED_ORIGIN } from '../../../assets/players/sources';
import { drawJerseyNumber, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import type { Appearance } from './appearance';
import { FRAME, SPRITE_DETAIL as D, type Facing, type Heading } from './views';
import { MOTION_INDICES } from './layout';
import { cleanPose, repairContact } from './contactPixels';
import { dribbleFlightY, type MotionId, type MotionPose, type Point } from './motion';

export interface MotionArtFrame {
  canvas: ArtCanvas; hand: ArtCanvas; pose: MotionPose; handCenter: Point;
  bounds: { left: number; right: number; top: number; bottom: number };
}
const cleaned = new WeakMap<ArtSource, Map<number, ArtCanvas>>();
function sourcePose(image: ArtSource, frame: { x: number; y: number; width: number; height: number; left: number; top: number; ball: Point | null }): ArtCanvas {
  let cache = cleaned.get(image); if (!cache) { cache = new Map(); cleaned.set(image, cache); }
  const key = frame.y * image.width + frame.x;
  const existing = cache.get(key); if (existing) return existing;
  const c = artCanvas(frame.width, frame.height);
  const ctx = c.getContext('2d')!; ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  const pixels = ctx.getImageData(0, 0, c.width, c.height); cleanPose(pixels.data, c.width, c.height);
  if (frame.ball) repairContact(pixels.data, c.width, c.height, frame.ball.x * D - frame.left, frame.ball.y * D - frame.top);
  ctx.putImageData(pixels, 0, 0);
  cache.set(key, c); return c;
}
const canvas = () => artCanvas(FRAME.width * D, FRAME.height * D);
export function pixelBounds(c: ArtCanvas): MotionArtFrame['bounds'] {
  const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let left = c.width, right = -1, top = c.height, bottom = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 180) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  return { left, right, top, bottom };
}

/** Une seule image complète par pose, gardée à double résolution jusqu'au rendu en match. */
export function paintMotion(images: readonly ArtSource[], look: Appearance, team: number, id: MotionId, frame: number, heading: Heading = 'down', facing: Facing = 'right'): MotionArtFrame {
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
  const measured = POSE_CONTACTS[atlasIndex].frames[indices[Math.max(0, Math.min(frame, indices.length - 1))]];
  let ball = measured.ball ? contactPoint(measured.ball, sx, sy, facing === 'left') : null;
  let contact = measured.contact;
  if (ball && (id === 'dribble' || id === 'dribbleIdle')) {
    const atlas = PAINTED_ATLASES[atlasIndex];
    const release = atlas.frames[indices[1]].ball, caught = atlas.frames[indices[6]].ball;
    if (release && caught) {
      const y = dribbleFlightY(frame, transform(release).y, transform(caught).y, FRAME.groundY - 5);
      if (y !== null) { ball.y = y; contact = false; }
    }
  }
  let hand = canvas();
  if (ball && contact && measured.fingers.length) {
    const native = artCanvas(original.width, original.height), nc = native.getContext('2d')!;
    const cleanedSource = sourcePose(images[atlasIndex + 2], original);
    for (const [y, x, width] of measured.fingers) nc.drawImage(cleanedSource, x, y, width, 1, x, y, width, 1);
    const hc = hand.getContext('2d')!; hc.imageSmoothingEnabled = false;
    hc.drawImage(native, 0, 0, original.width, original.height, Math.round(origin.x * D), Math.round(origin.y * D), Math.round(original.width * sx), Math.round(original.height * sy));
    if (facing === 'left') {
      const flipped = canvas(), fc = flipped.getContext('2d')!; fc.imageSmoothingEnabled = false;
      fc.translate(FRAME.width * D, 0); fc.scale(-1, 1); fc.drawImage(hand, 0, 0); hand = flipped;
    }
  }
  const palm = measured.palm && contact ? contactPoint(measured.palm, sx, sy, facing === 'left') : null;
  return { canvas: output, hand, handCenter: ball ?? { x: FRAME.centerX, y: FRAME.groundY },
    pose: { height, ball: ball ? { ...ball, behind: measured.behind } : null, contact, palm }, bounds: pixelBounds(output) };
}
