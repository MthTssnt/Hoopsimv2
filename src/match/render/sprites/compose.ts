import { HAIR_COLORS, HAIR_HIGHLIGHTS, PALETTE, SKIN_TONES, type TeamRamp } from '../../../assets/palette';
import { SHOES_DOWN, SHOES_UP, SHORTS_DOWN, SHORTS_UP, TORSOS_DOWN, TORSOS_UP, stretch, widen } from '../../../assets/sprites/body';
import { EAR, EXPRESSIONS, HAIRS, HEADS, type Expression } from '../../../assets/sprites/heads';
import { drawJerseyNumber, JERSEY_DIGIT_HEIGHT, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import type { Appearance } from './appearance';
import { SlotCanvas, type Slot } from './canvas';
import { bodyLayout, FRAME, FRAMES, HEAD_SIZE, seenFromBehind, type ArmPose, type BodyDims, type FrameDef, type Heading, type LegPose } from './rig';

export type { Heading } from './rig';

/** Tenue : celle de l'équipe, ou le maillot rayé (générique) de l'arbitre. */
export type Kit = 'team' | 'referee';
/** Orientation du joueur à l'écran. */
export type Facing = 'right' | 'left';
/**
 * Blocs de la feuille de sprites, dans l'ordre : diagonale bas (vers la droite, vers la gauche),
 * puis diagonale haut ; 19 images par bloc. Ce sont les quatre positions du joueur.
 */
export const SHEET_VIEWS: readonly { facing: Facing; heading: Heading }[] = [
  { facing: 'right', heading: 'down' },
  { facing: 'left', heading: 'down' },
  { facing: 'right', heading: 'up' },
  { facing: 'left', heading: 'up' },
];

/** Indice d'une image dans la feuille de sprites cuite. */
export function sheetIndex(frame: number, facing: Facing, heading: Heading = 'down'): number {
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

/** Rangée du haut du numéro : les rangées 0 et 1 sont le col, la 2 reste libre. */
export const NUMBER_TOP = 3;

/**
 * Zone du numéro sur le torse (colonnes relatives, joueur tourné vers la droite) : le devant du
 * maillot en diagonale bas (après le flanc et son bord clair), le dos hors du flanc en diagonale
 * haut. Au moins 7 px de large : tous les numéros de 0 à 99 y tiennent.
 */
export function numberZone(torsoWidth: number, heading: Heading = 'down'): { left: number; width: number } {
  return { left: heading === 'up' ? 1 : 3, width: torsoWidth - 4 };
}

/** Hauteur de torse minimale pour porter un numéro sans déborder sur le short. */
export const NUMBER_MIN_TORSO = NUMBER_TOP + JERSEY_DIGIT_HEIGHT;

/** Décalage de la tête vers le sens de la course, par rapport au torse (le corps est tourné). */
export const HEAD_TURN = 1;

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

/** Ton d'ombre de la peau, pour marquer le genou. */
const SKIN_SHADE: Partial<Record<Slot, Slot>> = { '1': '2', '2': '3' };

/**
 * Jambe : hanche → genou → chaussette, puis chaussure. `side` = -1 à gauche, +1 à droite.
 * Genou à 1 px de l'aplomb (arrêt, passages) : jambe droite et genou marqué d'un pixel d'ombre
 * côté extérieur (pas de croix sombre à l'entrejambe). `depth` remonte le pied éloigné.
 */
function leg(hip: Point, pose: LegPose, side: 1 | -1, dims: BodyDims, shoeTop: number, skin: Slot, heading: Heading): SlotCanvas {
  const sockY = shoeTop - 1 - pose.lift - (pose.depth ?? 0);
  const plumb = pose.knee === 1 && pose.foot === 0;
  const knee = { x: hip.x + side * (plumb ? 0 : pose.knee), y: Math.round((hip.y + sockY) / 2) };
  const foot = { x: hip.x + side * pose.foot, y: sockY };
  const off = Math.floor((dims.limb - 1) / 2);
  return limb([hip, knee, foot], dims.limb, skin, (c) => {
    const shade = SKIN_SHADE[skin];
    if (plumb && shade) c.set(side > 0 ? knee.x - off + dims.limb - 1 : knee.x - off, knee.y, shade);
    c.rect(foot.x - off, sockY, dims.limb, 1, 'w');
    const shoes = heading === 'up' ? SHOES_UP : SHOES_DOWN;
    c.stamp(shoes[dims.heavy || dims.build === 'pivot' ? 'heavy' : 'light'], foot.x - off, sockY + 1);
  });
}

const isSkin = (slot: Slot | null) => slot === '1' || slot === '2' || slot === '3';

/**
 * Tête vue en diagonale bas (forme, cheveux, visage de 3/4) dans son calque, avec son contour
 * fermé. Le visage regarde vers la droite ; l'oreille est posée du côté qui s'éloigne (à gauche),
 * seulement sur la peau (une coiffure longue la cache).
 */
export function headLayer(look: Appearance, expression: Expression, left: number, top: number, width: number = FRAME.width, height: number = FRAME.height): SlotCanvas {
  const c = new SlotCanvas(width, height);
  c.stamp(HEADS[look.head], left, top);
  const hair = HAIRS[look.hair];
  c.stamp(hair.grid, left, top, { clip: hair.clip });
  c.stamp(EXPRESSIONS[expression], left, top);
  for (const row of EAR.rows) if (isSkin(c.get(left + EAR.col, top + row))) c.set(left + EAR.col, top + row, '3');
  c.outline('o');
  return c;
}

/** Joue, mâchoire et oreille vues en diagonale haut : rangées et colonnes (côté de la course). */
export const CHEEK = { rows: [7, 8, 9, 10, 11, 12], cols: [13, 14, 15], ear: { col: 13, rows: [8, 9, 10] } } as const;

/**
 * Tête vue en diagonale haut : forme et coiffure de dos, sans visage, avec son contour fermé. Du
 * côté de la course (à droite), la joue, la mâchoire et l'oreille dépassent des cheveux sur
 * 3 colonnes, dans la silhouette de la tête ; l'oreille est au ton d'ombre.
 */
export function backHeadLayer(look: Appearance, left: number, top: number): SlotCanvas {
  const c = new SlotCanvas(FRAME.width, FRAME.height);
  const head = HEADS[look.head];
  c.stamp(head, left, top);
  const hair = HAIRS[look.hair];
  c.stamp(hair.back, left, top, { clip: hair.clip });
  for (const row of CHEEK.rows) {
    for (const col of CHEEK.cols) {
      const shape = head[row][col];
      if (shape === '.') continue;
      const ear = col === CHEEK.ear.col && (CHEEK.ear.rows as readonly number[]).includes(row);
      c.set(left + col, top + row, ear || shape === '3' ? '3' : '2');
    }
  }
  c.outline('o');
  return c;
}

/**
 * Assemble une image du joueur en diagonale, tourné vers la droite (vers la gauche, l'image est
 * retournée et le numéro reposé à l'endroit). Le corps est tourné : tête décalée de `HEAD_TURN`
 * vers le sens de la course, flanc de 2 colonnes au ton sombre, membres étagés.
 * - Diagonale bas (`down`, de 3/4 face) : le bras et la jambe du côté de la course (« avant », à
 *   droite) sont les plus éloignés : ils passent derrière le torse et derrière l'autre jambe,
 *   épaule et hanche rentrées d'1 px, au ton d'ombre ; le bras proche passe devant le torse.
 * - Diagonale haut (`up`, de 3/4 dos) : visage caché, joue et oreille du côté de la course, col
 *   et numéro dans le dos ; les deux bras sont derrière le torse ; le bras et la jambe opposés au
 *   sens de la course (« arrière », à gauche) sont les plus éloignés.
 * Une foulée en suspension (`rise`) monte tout le corps sans rien allonger.
 */
export function composeFrame(look: Appearance, frame: FrameDef, dims: BodyDims, kit: Kit = 'team', facing: Facing = 'right', heading: Heading = 'down'): ComposedFrame {
  let c = new SlotCanvas(FRAME.width, FRAME.height);
  const weight = dims.heavy ? 'heavy' : 'light';
  const remap = kit === 'referee' ? refereeRemap : undefined;
  const up = seenFromBehind(heading);
  const L = bodyLayout(dims, frame.bob);
  const W = dims.torsoWidth;
  const cx = FRAME.centerX;

  // Hanches sous le short, épaules au haut du torse : la hanche éloignée est rentrée d'1 px,
  // l'épaule éloignée de 2 (le bras éloigné passe à moitié derrière le torse). Un bras levé (tir,
  // dunk, contre) ressort sur le côté, sinon la tête le cacherait.
  const off = Math.floor((dims.limb - 1) / 2);
  const raised = (pose: ArmPose) => pose.hand[1] < 0;
  const tuckBack = up && !raised(frame.back);
  const tuckFront = !up && !raised(frame.front);
  const backHip = { x: cx - 1 - (dims.limb - off) + (up ? 1 : 0), y: L.shortsBottom };
  const frontHip = { x: cx + 2 + off - (up ? 0 : 1), y: L.shortsBottom };
  const backShoulder = { x: L.torsoLeft - 3 + (tuckBack ? 2 : 0), y: L.torsoTop };
  const frontShoulder = { x: L.torsoRight + 2 - (tuckFront ? 2 : 0), y: L.torsoTop };
  // Membres éloignés au ton d'ombre de la peau, membres proches au ton de base.
  const farSkin: Slot = '3';
  const nearSkin: Slot = '2';
  const backArm = arm(backShoulder, frame.back, -1, up ? farSkin : nearSkin);
  const frontArm = arm(frontShoulder, frame.front, 1, up ? nearSkin : farSkin);
  const backLeg = leg(backHip, frame.legs.back, -1, dims, L.shoeTop, up ? farSkin : nearSkin, heading);
  const frontLeg = leg(frontHip, frame.legs.front, 1, dims, L.shoeTop, up ? nearSkin : farSkin, heading);

  if (up) {
    // De dos : les deux bras derrière le torse ; la jambe éloignée (arrière) derrière l'autre.
    c.composite(backArm.layer);
    c.composite(frontArm.layer);
    c.composite(backLeg);
    c.composite(frontLeg);
  } else {
    // De face : bras (s'il n'est pas levé) et jambe éloignés (avant) derrière, la jambe proche
    // par-dessus.
    if (tuckFront) c.composite(frontArm.layer);
    c.composite(frontLeg);
    c.composite(backLeg);
  }
  const shorts = (up ? SHORTS_UP : SHORTS_DOWN)[weight];
  const shortsRows = widen(stretch(shorts, shorts.rows.length), shorts.stretchCol, W);
  c.stamp(shortsRows, cx - Math.floor(shortsRows[0].length / 2), L.shortsTop, { remap: kit === 'referee' ? () => 'k' : undefined });
  const torso = (up ? TORSOS_UP : TORSOS_DOWN)[weight];
  c.stamp(widen(stretch(torso, dims.torso), torso.stretchCol, W), L.torsoLeft, L.torsoTop, { remap });
  const headLeft = cx - HEAD_SIZE / 2 + HEAD_TURN;
  c.composite(up ? backHeadLayer(look, headLeft, L.headTop) : headLayer(look, frame.expression, headLeft, L.headTop));
  // Cou : une rangée de peau entre le menton (ou la nuque) et le col, par-dessus le contour.
  c.rect(cx - 2 + HEAD_TURN, L.neckY, 4, 1, '3');
  // De face, le bras proche passe devant le torse, et le bras éloigné levé devant la tête.
  if (!up) {
    if (!tuckFront) c.composite(frontArm.layer);
    c.composite(backArm.layer);
  }
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
    const zone = numberZone(W, heading);
    const zoneStart = L.torsoLeft + zone.left;
    const zoneLeft = mirror ? FRAME.width - 1 - (zoneStart + zone.width - 1) : zoneStart;
    const x = zoneLeft + Math.floor((zone.width - jerseyNumberWidth(look.number)) / 2);
    const y = L.torsoTop + NUMBER_TOP - rise;
    numberAt = { x, y };
    drawJerseyNumber(look.number, x, y, (px, py) => {
      const under = c.get(px, py);
      if (under === 'p' || under === 'P' || under === 'q') c.set(px, py, 'S');
    });
  }

  // Ballon tenu, dans la main avant. De face, il rebondit devant les jambes, un peu en avant dans
  // le sens de la course ; de dos, sur le côté de la hanche. Au rebond, il touche le sol même
  // pendant une foulée.
  let ball: ComposedFrame['ball'] = null;
  const hand = { x: frontArm.hand.x, y: frontArm.hand.y - rise };
  const out = up ? 3 : 2;
  // Ballon de 8 px (10 avec le contour) : au sol, son centre est 4 px au-dessus du sol.
  const floorY = FRAME.groundY - 4;
  switch (frame.ball) {
    case 'hand':
      ball = { x: hand.x + out, y: hand.y + 5 };
      break;
    case 'dribbleMid':
      ball = { x: hand.x + out + 1, y: Math.round((hand.y + 5 + floorY) / 2) };
      break;
    case 'dribbleLow':
      ball = { x: hand.x + out + 1, y: floorY };
      break;
    case 'chest':
      ball = { x: Math.round((hand.x + backArm.hand.x) / 2) + 1, y: hand.y + 1 };
      break;
    case 'overhead':
      ball = { x: hand.x + 1, y: hand.y - 4 };
      break;
  }
  if (ball && mirror) ball = { x: FRAME.width - 1 - ball.x, y: ball.y };
  return { canvas: c, ball, numberAt };
}

/** Couleurs réelles d'un joueur : peau, cheveux et rampes de son équipe. */
export interface SlotColors {
  skin: readonly [number, number, number];
  /** Cheveux : reflet, base, ombre. */
  hair: readonly [number, number, number];
  primary: TeamRamp;
  secondary: TeamRamp;
}

export function colorsFor(look: Appearance, primary: TeamRamp, secondary: TeamRamp): SlotColors {
  const [base, shadow] = HAIR_COLORS[look.hairColor];
  return { skin: SKIN_TONES[look.skin], hair: [HAIR_HIGHLIGHTS[look.hairColor], base, shadow], primary, secondary };
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
    case 'r':
      return colors.hair[0];
    case 'h':
      return colors.hair[1];
    case 'H':
      return colors.hair[2];
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
