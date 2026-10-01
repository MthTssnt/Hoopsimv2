/**
 * Géométrie réelle du terrain, en mètres.
 * Repère : x le long du terrain (0 = ligne de fond gauche), y en profondeur
 * (0 = ligne de touche du fond, côté tribune opposée), z en hauteur (0 = parquet).
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type CourtLevel = 'pro' | 'college';
export type HoopSide = 'left' | 'right';

export const COURT_LENGTH = 28.65;
export const COURT_WIDTH = 15.24;
export const RIM_HEIGHT = 3.05;
/** Rayon intérieur du cercle (diamètre 45,7 cm). */
export const RIM_RADIUS = 0.2286;
/** Rayon du fer du cercle. */
export const RIM_TUBE = 0.008;
export const BALL_RADIUS = 0.12;
/** Planche : distance à la ligne de fond, largeur, hauteur, hauteur du bas, épaisseur. */
export const BACKBOARD = { fromBaseline: 1.22, width: 1.83, height: 1.07, bottom: 2.9, thickness: 0.05 } as const;
/** Espace entre la planche et le fer du cercle. */
const RIM_GAP = 0.15;
export const PAINT_LENGTH = 5.79;
/** Rond central et cercle de lancer franc. */
export const CIRCLE_RADIUS = 1.83;

/** Ligne à 3 pts (rayon de l'arc, distance dans les coins) et largeur de raquette selon le niveau. */
const LEVELS: Record<CourtLevel, { threeArc: number; threeCorner: number; paintWidth: number }> = {
  pro: { threeArc: 7.24, threeCorner: 6.71, paintWidth: 4.88 },
  college: { threeArc: 6.75, threeCorner: 6.6, paintWidth: 3.66 },
};

export interface Hoop {
  side: HoopSide;
  /** Centre du cercle. */
  rim: Vec3;
  /** +1 si le terrain s'étend vers les x croissants depuis ce panier, -1 sinon. */
  toCourt: 1 | -1;
  baselineX: number;
  /** Planche, en boîte alignée sur les axes. */
  board: { min: Vec3; max: Vec3 };
}

export interface Court {
  level: CourtLevel;
  length: number;
  width: number;
  threeArc: number;
  threeCorner: number;
  paintWidth: number;
  paintLength: number;
  hoops: Record<HoopSide, Hoop>;
}

function makeHoop(side: HoopSide): Hoop {
  const baselineX = side === 'left' ? 0 : COURT_LENGTH;
  const toCourt = side === 'left' ? 1 : -1;
  const boardFront = baselineX + toCourt * BACKBOARD.fromBaseline;
  const boardBack = boardFront - toCourt * BACKBOARD.thickness;
  const cy = COURT_WIDTH / 2;
  return {
    side,
    toCourt,
    baselineX,
    rim: { x: boardFront + toCourt * (RIM_GAP + RIM_RADIUS), y: cy, z: RIM_HEIGHT },
    board: {
      min: { x: Math.min(boardFront, boardBack), y: cy - BACKBOARD.width / 2, z: BACKBOARD.bottom },
      max: { x: Math.max(boardFront, boardBack), y: cy + BACKBOARD.width / 2, z: BACKBOARD.bottom + BACKBOARD.height },
    },
  };
}

export function makeCourt(level: CourtLevel): Court {
  return {
    level,
    length: COURT_LENGTH,
    width: COURT_WIDTH,
    ...LEVELS[level],
    paintLength: PAINT_LENGTH,
    hoops: { left: makeHoop('left'), right: makeHoop('right') },
  };
}

/** Distance horizontale au centre du cercle. */
export function distanceToRim(hoop: Hoop, x: number, y: number): number {
  return Math.hypot(x - hoop.rim.x, y - hoop.rim.y);
}

/** Abscisse où la ligne droite des coins rejoint l'arc, mesurée depuis le cercle. */
function threeBreak(court: Court): number {
  return Math.sqrt(court.threeArc ** 2 - court.threeCorner ** 2);
}

/** Un tir pris depuis (x, y) vaut-il 3 points ? */
export function isThreePoint(court: Court, hoop: Hoop, x: number, y: number): boolean {
  const along = (x - hoop.rim.x) * hoop.toCourt;
  const lateral = Math.abs(y - hoop.rim.y);
  if (along <= threeBreak(court)) return lateral > court.threeCorner;
  return Math.hypot(along, lateral) > court.threeArc;
}

/** Points de la ligne à 3 pts (coin, arc, coin), pour le dessin. */
export function threePointLine(court: Court, hoop: Hoop, arcSegments = 48): { x: number; y: number }[] {
  const { rim, toCourt, baselineX } = hoop;
  const breakAlong = threeBreak(court);
  const maxAngle = Math.atan2(court.threeCorner, breakAlong);
  const points = [{ x: baselineX, y: rim.y - court.threeCorner }];
  for (let i = 0; i <= arcSegments; i++) {
    const a = -maxAngle + (2 * maxAngle * i) / arcSegments;
    points.push({ x: rim.x + toCourt * Math.cos(a) * court.threeArc, y: rim.y + Math.sin(a) * court.threeArc });
  }
  points.push({ x: baselineX, y: rim.y + court.threeCorner });
  return points;
}

/** Dans la moitié de la raquette côté panier (zone où le dunk devient possible). */
export function inPaintHalf(court: Court, hoop: Hoop, x: number, y: number): boolean {
  const fromBaseline = (x - hoop.baselineX) * hoop.toCourt;
  return fromBaseline >= 0 && fromBaseline <= court.paintLength / 2 && Math.abs(y - hoop.rim.y) <= court.paintWidth / 2;
}
