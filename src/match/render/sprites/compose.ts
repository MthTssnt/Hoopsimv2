import { HAIR_COLORS, PALETTE, SKIN_TONES, type TeamRamp } from '../../../assets/palette';
import { SHOES, SHORTS, TORSOS, stretch } from '../../../assets/sprites/body';
import { FACES, HAIR_OFFSET, HAIRS, HEADS } from '../../../assets/sprites/heads';
import { drawMiniNumber, miniNumberWidth } from '../pixelFont';
import type { Appearance } from './appearance';
import { SlotCanvas, type Slot } from './canvas';
import { FRAME, HEAD_SIZE, SOCK_Y, type ArmPose, type BodyDims, type FrameDef, type LegPose } from './rig';

/** Tenue : celle de l'équipe, ou le maillot rayé (générique) de l'arbitre. */
export type Kit = 'team' | 'referee';

export interface ComposedFrame {
  canvas: SlotCanvas;
  /** Centre du ballon tenu dans cette image (coordonnées du cadre), ou null. */
  ball: { x: number; y: number } | null;
}

type Point = { x: number; y: number };

const JERSEY = new Set<Slot>(['p', 'P', 'q', 's', 'S', 't']);

function refereeRemap(slot: Slot, x: number): Slot {
  return JERSEY.has(slot) ? (x % 2 === 0 ? 'w' : 'k') : slot;
}

function drawLeg(c: SlotCanvas, hip: Point, pose: LegPose, dims: BodyDims, skin: Slot, heavy: boolean): void {
  const L = dims.legs;
  const foot = { x: Math.round(hip.x + pose.foot[0] * L), y: Math.round(SOCK_Y - pose.foot[1] * L) };
  const knee = { x: Math.round(hip.x + pose.knee[0] * L), y: Math.round(hip.y + pose.knee[1] * (foot.y - hip.y)) };
  c.line(hip.x, hip.y, knee.x, knee.y, dims.limb, skin);
  c.line(knee.x, knee.y, foot.x, foot.y, dims.limb, skin);
  c.rect(foot.x - Math.floor((dims.limb - 1) / 2), foot.y - 1, dims.limb, 2, 'w');
  c.stamp(SHOES[heavy ? 'heavy' : 'light'], foot.x - 1, foot.y + 1);
}

function drawArm(c: SlotCanvas, shoulder: Point, pose: ArmPose, length: number, skin: Slot): Point {
  const elbow = { x: Math.round(shoulder.x + pose.elbow[0] * length), y: Math.round(shoulder.y + pose.elbow[1] * length) };
  const hand = { x: Math.round(shoulder.x + pose.hand[0] * length), y: Math.round(shoulder.y + pose.hand[1] * length) };
  c.line(shoulder.x, shoulder.y, elbow.x, elbow.y, 3, skin);
  c.line(elbow.x, elbow.y, hand.x, hand.y, 3, skin);
  c.rect(hand.x - 1, hand.y - 1, 4, 4, skin);
  return hand;
}

/**
 * Assemble une image du joueur par couches (bras et jambe arrière, short, torse, tête, visage,
 * coiffure, jambe et bras avant), puis l'entoure d'un contour. Tourné vers la droite.
 */
export function composeFrame(look: Appearance, frame: FrameDef, dims: BodyDims, kit: Kit = 'team'): ComposedFrame {
  const c = new SlotCanvas(FRAME.width, FRAME.height);
  const cx = FRAME.centerX;
  const weight = dims.heavy ? 'heavy' : 'light';
  const remap = kit === 'referee' ? refereeRemap : undefined;

  const hipY = SOCK_Y - dims.legs + frame.bob;
  const backHip = { x: cx - (dims.heavy ? 4 : 3), y: hipY };
  const frontHip = { x: cx + (dims.heavy ? 3 : 2), y: hipY };
  const shortsRows = SHORTS[weight];
  const shortsTop = hipY - dims.shorts + 3;
  const torsoRows = stretch(TORSOS[weight], dims.torso);
  const torsoWidth = torsoRows[0].length;
  const torsoLeft = cx - Math.floor(torsoWidth / 2);
  const torsoTop = shortsTop - torsoRows.length;
  const headTop = torsoTop - HEAD_SIZE;
  const backShoulder = { x: torsoLeft + 2, y: torsoTop + 2 };
  const frontShoulder = { x: torsoLeft + torsoWidth - 3, y: torsoTop + 2 };

  drawArm(c, backShoulder, frame.back, dims.arm, '3');
  drawLeg(c, backHip, frame.legs.back, dims, '3', dims.heavy);
  drawLeg(c, frontHip, frame.legs.front, dims, '2', dims.heavy);
  c.stamp(shortsRows, cx - Math.floor(shortsRows[0].length / 2), shortsTop, { remap: kit === 'referee' ? () => 'k' : undefined });
  c.stamp(torsoRows, torsoLeft, torsoTop, { remap });
  if (kit === 'team' && torsoRows.length >= 7) {
    const target = { fillRect: (x: number, y: number) => c.set(x, y, 'S') };
    // Centré sur la partie du maillot que le bras avant ne couvre pas.
    drawMiniNumber(target, look.number, torsoLeft + Math.floor((torsoWidth - 3 - miniNumberWidth(look.number)) / 2), torsoTop + 2);
  }
  const headLeft = cx - Math.floor(HEAD_SIZE / 2) + 1;
  c.stamp(HEADS[look.head], headLeft, headTop);
  c.stamp(FACES[look.face], headLeft, headTop);
  const hair = HAIRS[look.hair];
  c.stamp(hair.grid, headLeft + HAIR_OFFSET.x, headTop + HAIR_OFFSET.y, { clip: hair.clip });
  const hand = drawArm(c, frontShoulder, frame.front, dims.arm, '2');
  c.outline('o');

  let ball: ComposedFrame['ball'] = null;
  switch (frame.ball) {
    case 'hand':
      ball = { x: hand.x + 4, y: hand.y + 2 };
      break;
    case 'overhead':
      ball = { x: hand.x + 1, y: hand.y - 4 };
      break;
    case 'dribbleMid':
      ball = { x: hand.x + 4, y: Math.round((hand.y + FRAME.groundY - 5) / 2) };
      break;
    case 'dribbleLow':
      ball = { x: hand.x + 4, y: FRAME.groundY - 5 };
      break;
  }
  return { canvas: c, ball };
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
