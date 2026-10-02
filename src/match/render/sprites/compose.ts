import { HAIR_COLORS, PALETTE, SKIN_TONES, type TeamRamp } from '../../../assets/palette';
import { SHOES, SHOES_BACK, SHORTS, TORSOS, TORSOS_BACK, stretch, widen } from '../../../assets/sprites/body';
import { EXPRESSIONS, HAIRS, HEADS, type Expression } from '../../../assets/sprites/heads';
import { drawJerseyNumber, JERSEY_DIGIT_HEIGHT, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import type { Appearance } from './appearance';
import { SlotCanvas, type Slot } from './canvas';
import { bodyLayout, FRAME, FRAMES, HEAD_SIZE, type ArmPose, type BodyDims, type FrameDef, type LegPose } from './rig';

/** Tenue : celle de l'équipe, ou le maillot rayé (générique) de l'arbitre. */
export type Kit = 'team' | 'referee';
/** Orientation du joueur à l'écran. */
export type Facing = 'right' | 'left';
/** Vue : de profil (visage vers la caméra, course de côté) ou de dos (le joueur monte). */
export type Heading = 'side' | 'back';

/** Blocs de la feuille de sprites, dans l'ordre : profil droite, profil gauche, dos droite, dos gauche. */
export const SHEET_VIEWS: readonly { facing: Facing; heading: Heading }[] = [
  { facing: 'right', heading: 'side' },
  { facing: 'left', heading: 'side' },
  { facing: 'right', heading: 'back' },
  { facing: 'left', heading: 'back' },
];

/** Indice d'une image dans la feuille de sprites cuite. */
export function sheetIndex(frame: number, facing: Facing, heading: Heading = 'side'): number {
  const block = SHEET_VIEWS.findIndex((v) => v.facing === facing && v.heading === heading);
  return block * FRAMES.length + frame;
}

export interface ComposedFrame {
  canvas: SlotCanvas;
  /** Centre du ballon tenu dans cette image (coordonnées du cadre), ou null. */
  ball: { x: number; y: number } | null;
  /** Coin haut-gauche du numéro de maillot (coordonnées du cadre), ou null (arbitre). */
  numberAt: { x: number; y: number } | null;
}

type Point = { x: number; y: number };

const JERSEY = new Set<Slot>(['p', 'P', 'q', 's', 'S', 't']);

function refereeRemap(slot: Slot, x: number): Slot {
  return JERSEY.has(slot) ? (x % 2 === 0 ? 'w' : 'k') : slot;
}

/** Rangée du haut du numéro : la rangée 0 est le col, la 1 reste libre. */
export const NUMBER_TOP = 2;

/** Zone du numéro sur le torse (colonnes relatives) : toute la poitrine, hors bords. */
export function numberZone(torsoWidth: number): { left: number; width: number } {
  return { left: 1, width: torsoWidth - 2 };
}

/** Hauteur de torse minimale pour porter un numéro sans déborder sur le short. */
export const NUMBER_MIN_TORSO = NUMBER_TOP + JERSEY_DIGIT_HEIGHT;

/**
 * Un membre dans son propre calque, entouré de son propre contour : un bras qui passe devant le
 * maillot reste séparé de lui par un trait sombre (contour de chaque côté).
 */
function limb(points: Point[], thickness: number, slot: Slot, extra?: (c: SlotCanvas) => void): SlotCanvas {
  const c = new SlotCanvas(FRAME.width, FRAME.height);
  for (let i = 1; i < points.length; i++) c.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, thickness, slot);
  extra?.(c);
  c.outline('o');
  return c;
}

/** Bras : épaule → coude → main (main de 2×2 au bout du trait de 2 px). `side` = -1 à gauche, +1 à droite. */
function arm(shoulder: Point, pose: ArmPose, side: 1 | -1, skin: Slot): { layer: SlotCanvas; hand: Point } {
  const at = ([dx, dy]: [number, number]): Point => ({ x: shoulder.x + side * dx, y: shoulder.y + dy });
  const hand = at(pose.hand);
  return { layer: limb([shoulder, at(pose.elbow), hand], 2, skin), hand };
}

/** Jambe : hanche → genou → chaussette, puis chaussure. `side` = -1 à gauche, +1 à droite. */
function leg(hip: Point, pose: LegPose, side: 1 | -1, dims: BodyDims, shoeTop: number, skin: Slot, heading: Heading): SlotCanvas {
  const sockY = shoeTop - 1 - pose.lift;
  const knee = { x: hip.x + side * pose.knee, y: Math.round((hip.y + sockY) / 2) };
  const foot = { x: hip.x + side * pose.foot, y: sockY };
  const off = Math.floor((dims.limb - 1) / 2);
  return limb([hip, knee, foot], dims.limb, skin, (c) => {
    c.rect(foot.x - off, sockY, dims.limb, 1, 'w');
    c.stamp((heading === 'back' ? SHOES_BACK : SHOES)[dims.heavy || dims.build === 'pivot' ? 'heavy' : 'light'], foot.x - off, sockY + 1);
  });
}

/** Tête complète (forme, cheveux, expression) dans son calque, avec son contour fermé. */
export function headLayer(look: Appearance, expression: Expression, left: number, top: number, width: number = FRAME.width, height: number = FRAME.height): SlotCanvas {
  const c = new SlotCanvas(width, height);
  c.stamp(HEADS[look.head], left, top);
  const hair = HAIRS[look.hair];
  c.stamp(hair.grid, left, top, { clip: hair.clip });
  c.stamp(EXPRESSIONS[expression], left, top);
  c.outline('o');
  return c;
}

/** Tête vue de dos : forme et coiffure de dos, sans visage, avec son contour fermé. */
export function backHeadLayer(look: Appearance, left: number, top: number): SlotCanvas {
  const c = new SlotCanvas(FRAME.width, FRAME.height);
  c.stamp(HEADS[look.head], left, top);
  const hair = HAIRS[look.hair];
  c.stamp(hair.back, left, top, { clip: hair.clip });
  c.outline('o');
  return c;
}

/**
 * Assemble une image du joueur, par calques : bras et jambe arrière, jambe avant, short, torse
 * et numéro, bras avant, tête et cou, puis contour général. De profil, le bras et la jambe
 * « avant » sont du côté droit de l'image ; tourné vers la gauche, l'image est retournée et le
 * numéro reposé à l'endroit. De dos (`heading` = 'back', avec les poses de `BACK_FRAMES`) : tête
 * sans visage, col de dos, numéro dans le dos, les deux bras derrière le torse. Une foulée en
 * suspension (`rise`) monte tout le corps sans rien allonger.
 */
export function composeFrame(look: Appearance, frame: FrameDef, dims: BodyDims, kit: Kit = 'team', facing: Facing = 'right', heading: Heading = 'side'): ComposedFrame {
  let c = new SlotCanvas(FRAME.width, FRAME.height);
  const weight = dims.heavy ? 'heavy' : 'light';
  const remap = kit === 'referee' ? refereeRemap : undefined;
  const back = heading === 'back';
  const L = bodyLayout(dims, frame.bob);
  const W = dims.torsoWidth;
  const cx = FRAME.centerX;

  // Jambes : hanches sous le short, 2 px d'écart entre les deux.
  const off = Math.floor((dims.limb - 1) / 2);
  const backHip = { x: cx - 2 - (dims.limb - off), y: L.shortsBottom };
  const frontHip = { x: cx + 1 + off, y: L.shortsBottom };
  const backShoulder = { x: L.torsoLeft - 3, y: L.torsoTop };
  const frontShoulder = { x: L.torsoRight + 2, y: L.torsoTop };

  const backArm = arm(backShoulder, frame.back, -1, back ? '2' : '3');
  const frontArm = arm(frontShoulder, frame.front, 1, '2');
  c.composite(backArm.layer);
  // De dos, les deux bras sont derrière le torse : une main ramenée devant le corps est cachée.
  if (back) c.composite(frontArm.layer);
  c.composite(leg(backHip, frame.legs.back, -1, dims, L.shoeTop, back ? '2' : '3', heading));
  c.composite(leg(frontHip, frame.legs.front, 1, dims, L.shoeTop, '2', heading));
  const shortsRows = widen(stretch(SHORTS[weight], SHORTS[weight].rows.length), SHORTS[weight].stretchCol, W);
  c.stamp(shortsRows, cx - Math.floor(shortsRows[0].length / 2), L.shortsTop, { remap: kit === 'referee' ? () => 'k' : undefined });
  const torso = (back ? TORSOS_BACK : TORSOS)[weight];
  c.stamp(widen(stretch(torso, dims.torso), torso.stretchCol, W), L.torsoLeft, L.torsoTop, { remap });
  c.composite(back ? backHeadLayer(look, cx - HEAD_SIZE / 2, L.headTop) : headLayer(look, frame.expression, cx - HEAD_SIZE / 2, L.headTop));
  // Cou : une rangée de peau entre le menton (ou la nuque) et le col, par-dessus le contour.
  c.rect(cx - 2, L.neckY, 4, 1, '3');
  if (!back) c.composite(frontArm.layer);
  c.outline('o');
  const rise = frame.rise;
  if (rise) c = c.shifted(0, -rise);

  // Tourné vers la gauche : on retourne le dessin, puis on pose le numéro à l'endroit (un sprite
  // simplement retourné afficherait des chiffres en miroir). Le numéro ne peint que le maillot
  // encore visible, donc un bras qui passe devant le cache toujours.
  const mirror = facing === 'left';
  if (mirror) c = c.mirrored();
  let numberAt: ComposedFrame['numberAt'] = null;
  if (kit === 'team') {
    const zone = numberZone(W);
    const zoneLeft = mirror ? FRAME.width - 1 - (L.torsoLeft + zone.left + zone.width - 1) : L.torsoLeft + zone.left;
    const x = zoneLeft + Math.floor((zone.width - jerseyNumberWidth(look.number)) / 2);
    const y = L.torsoTop + NUMBER_TOP - rise;
    numberAt = { x, y };
    drawJerseyNumber(look.number, x, y, (px, py) => {
      const under = c.get(px, py);
      if (under === 'p' || under === 'P' || under === 'q') c.set(px, py, 'S');
    });
  }

  // Ballon tenu. De profil, il est sous la main ramenée devant le corps, un peu en avant ; de
  // dos, sur le côté de la hanche. Au rebond, il touche le sol même pendant une foulée.
  let ball: ComposedFrame['ball'] = null;
  const hand = { x: frontArm.hand.x, y: frontArm.hand.y - rise };
  const out = back ? 2 : 0;
  const floorY = FRAME.groundY - 3;
  switch (frame.ball) {
    case 'hand':
      ball = { x: hand.x + out, y: hand.y + 4 };
      break;
    case 'dribbleMid':
      ball = { x: hand.x + out + 1, y: Math.round((hand.y + 4 + floorY) / 2) };
      break;
    case 'dribbleLow':
      ball = { x: hand.x + out + 1, y: floorY };
      break;
    case 'chest':
      ball = { x: Math.round((hand.x + backArm.hand.x) / 2) + 1, y: hand.y + 1 };
      break;
    case 'overhead':
      ball = { x: hand.x + 1, y: hand.y - 3 };
      break;
  }
  if (ball && mirror) ball = { x: FRAME.width - 1 - ball.x, y: ball.y };
  return { canvas: c, ball, numberAt };
}

/** Couleurs réelles d'un joueur : peau, cheveux et rampes de son équipe. */
export interface SlotColors {
  skin: readonly [number, number, number];
  hair: readonly [number, number];
  primary: TeamRamp;
  secondary: TeamRamp;
}

export function colorsFor(look: Appearance, primary: TeamRamp, secondary: TeamRamp): SlotColors {
  return { skin: SKIN_TONES[look.skin], hair: HAIR_COLORS[look.hairColor], primary, secondary };
}

export function slotColor(slot: Slot, colors: SlotColors): number {
  switch (slot) {
    case 'o':
    case 'n':
      return PALETTE.outline;
    case 'k':
      return PALETTE.ink;
    case 'w':
      return PALETTE.chalk;
    case '1':
      return colors.skin[0];
    case '2':
      return colors.skin[1];
    case '3':
      return colors.skin[2];
    case 'h':
      return colors.hair[0];
    case 'H':
      return colors.hair[1];
    case 'p':
      return colors.primary[0];
    case 'P':
      return colors.primary[1];
    case 'q':
      return colors.primary[2];
    case 's':
      return colors.secondary[0];
    case 'S':
      return colors.secondary[1];
    case 't':
      return colors.secondary[2];
  }
}
