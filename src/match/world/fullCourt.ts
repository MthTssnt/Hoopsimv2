import { CIRCLE_RADIUS, type Court, type Hoop, type Vec3 } from '../physics/court';

/**
 * Règles du match sur terrain entier (décisions de Matheo, règles NBA ramenées à nos quart-temps ;
 * valeurs réglables) : quart-temps et prolongations, shot clock, remises en jeu, sorties,
 * violations (8 s, retour en zone, 24 s, 5 s), entre-deux.
 */
export const FULL_COURT = {
  /** Durée d'un quart-temps par défaut (min), nombre de quart-temps. */
  quarterMinutes: 3,
  periods: 4,
  /** Prolongation : part d'un quart-temps (5/12 comme en NBA), arrondie à 5 s, au moins (s). */
  overtimeRatio: 5 / 12,
  overtimeMin: 30,
  /** Shot clock (s), et sa valeur après un rebond offensif qui a touché le cercle ou une faute de main. */
  shotClock: 24,
  shotClockReset: 14,
  /** Pour passer dans sa moitié avant (s), pour faire la remise (s). */
  backcourtLimit: 8,
  inboundLimit: 5,
  /** Dernière minute du QT4 et des prolongations : le chrono s'arrête aussi après un panier (s). */
  lastMinute: 60,
  /** Ballon mort avant la remise (s) : violation ou faute, panier marqué (le ballon passe le filet). */
  deadPause: 1,
  basketPause: 0.8,
  /** Fin de période, mi-temps, fin de match (s). */
  periodPause: 2,
  halftimePause: 4,
  finalPause: 6,
  /** Point de remise : à (m) hors de la ligne ; sur la ligne de fond, au moins à (m) de l'axe du cercle (poteau du panier). */
  inboundOut: 0.5,
  baselineClear: 2,
  /** Pied sur la ligne (m depuis le centre du joueur) ; ballon sur la ligne (m). La ligne est dehors. */
  footMargin: 0.12,
  ballMargin: 0.05,
  /** Entre-deux : sauteurs écartés de (m) de part et d'autre du centre ; lancer depuis (m), sommet à (m) au-dessus de la plus haute main. */
  jumperGap: 0.45,
  tossFrom: 2.2,
  tossAbove: 0.45,
  /** Les autres joueurs se tiennent à (m) du centre, hors du rond. */
  tipRing: CIRCLE_RADIUS + 0.6,
} as const;

/** Phase du match : entre-deux, jeu, ballon mort (pause avant une remise), remise, fin de période, fin de match. */
export type GamePhase = 'entre-deux' | 'jeu' | 'mort' | 'remise' | 'fin-periode' | 'fin-match';
export type ViolationKind = 'sortie' | '8 secondes' | 'retour en zone' | '24 secondes' | '5 secondes' | 'entre-deux';

/** Remise en jeu : prévue pendant le ballon mort, active pendant la remise. */
export interface Inbound {
  team: number;
  /** Lanceur, choisi à la mise en place (le plus proche du point de remise). */
  thrower: number | null;
  /** Point de remise, hors du terrain. */
  spot: Vec3;
  /** Temps écoulé depuis que le lanceur a le ballon (violation à 5 s). */
  timer: number;
  /** Shot clock au toucher sur le terrain : une valeur, ou garder celui qui reste. */
  shotClock: number | 'garde';
  /** Le chrono tourne pendant cette remise (après un panier, hors dernière minute). */
  clockRuns: boolean;
  /** Remise après un panier (sous ce panier). */
  afterBasket: boolean;
}

export interface FullCourtState {
  quarterMinutes: number;
  /** 1 à 4, puis 5, 6… pour les prolongations. */
  period: number;
  /** Temps restant dans la période (s). */
  clock: number;
  shotClock: number;
  phase: GamePhase;
  /** Pause restante (ballon mort, fin de période, fin de match ; s). */
  pause: number;
  /** Dernier joueur à avoir touché le ballon (sorties). */
  lastTouch: { player: number; team: number } | null;
  /** L'équipe qui a le ballon l'a amené dans sa moitié avant (retour en zone possible). */
  frontcourt: boolean;
  /** Temps passé dans la moitié arrière depuis la prise du ballon (violation à 8 s). */
  backcourtTime: number;
  inbound: Inbound | null;
  /** Équipe qui a gagné l'entre-deux du début de match. */
  tipWinner: number | null;
  /** Entre-deux en cours : les deux sauteurs ; ballon déjà passé à son sommet. */
  tip: { jumpers: [number, number]; falling: boolean } | null;
  winner: number | null;
  /** Tir lâché, pas encore repris : le shot clock s'arrête dès que le ballon touche le cercle. */
  shotUp: boolean;
  /** Shot clock à 0 avec un tir en l'air : violation s'il ne touche pas le cercle. */
  shotClockPending: boolean;
  /** Chrono à 0 avec un tir en l'air : la période finit à son issue. */
  buzzerPending: boolean;
  lastViolation: { kind: ViolationKind; team: number; player: number; time: number } | null;
}

export function newFullCourt(quarterMinutes: number = FULL_COURT.quarterMinutes): FullCourtState {
  return {
    quarterMinutes,
    period: 1,
    clock: periodLength(quarterMinutes, 1),
    shotClock: FULL_COURT.shotClock,
    phase: 'entre-deux',
    pause: 0,
    lastTouch: null,
    frontcourt: false,
    backcourtTime: 0,
    inbound: null,
    tipWinner: null,
    tip: null,
    winner: null,
    shotUp: false,
    shotClockPending: false,
    buzzerPending: false,
    lastViolation: null,
  };
}

/** Durée d'une période (s) : un quart-temps, ou une prolongation (5/12, arrondie à 5 s). */
export function periodLength(quarterMinutes: number, period: number): number {
  const quarter = quarterMinutes * 60;
  if (period <= FULL_COURT.periods) return quarter;
  return Math.max(FULL_COURT.overtimeMin, Math.round((quarter * FULL_COURT.overtimeRatio) / 5) * 5);
}

/** L'équipe attaque-t-elle le panier de droite ? L'équipe 0 en première mi-temps ; on change à la mi-temps (et on garde en prolongation). */
export function attacksRight(team: number, period: number): boolean {
  return period <= 2 ? team === 0 : team !== 0;
}

export function attackHoop(court: Court, team: number, period: number): Hoop {
  return attacksRight(team, period) ? court.hoops.right : court.hoops.left;
}

export function defendHoop(court: Court, team: number, period: number): Hoop {
  return attacksRight(team, period) ? court.hoops.left : court.hoops.right;
}

/** Le point est-il dans la moitié avant de l'équipe (celle du panier qu'elle attaque) ? */
export function inFrontcourt(court: Court, team: number, period: number, x: number): boolean {
  return attacksRight(team, period) ? x > court.length / 2 : x < court.length / 2;
}

/** Hors du terrain : la ligne compte comme dehors (`margin` : pied ou ballon qui la touche). */
export function isOut(court: Court, p: { x: number; y: number }, margin = 0): boolean {
  return p.x < margin || p.x > court.length - margin || p.y < margin || p.y > court.width - margin;
}

/**
 * Point de remise pour un ballon sorti (ou une faute) en `p` : sur la ligne la plus proche, à
 * `inboundOut` m dehors. Sur la ligne de fond, jamais derrière le panier (écarté de l'axe du cercle).
 */
export function outSpot(court: Court, p: { x: number; y: number }, sideOnly = false): Vec3 {
  const t = FULL_COURT;
  const x = Math.min(court.length, Math.max(0, p.x));
  const y = Math.min(court.width, Math.max(0, p.y));
  const toSide = Math.min(y, court.width - y);
  const toBase = Math.min(x, court.length - x);
  if (sideOnly || toSide <= toBase) {
    return { x: Math.min(court.length - 1, Math.max(1, x)), y: y < court.width / 2 ? -t.inboundOut : court.width + t.inboundOut, z: 0 };
  }
  const cy = court.width / 2;
  const dy = y - cy;
  const by = Math.abs(dy) < t.baselineClear ? cy + (dy < 0 ? -t.baselineClear : t.baselineClear) : y;
  return { x: x < court.length / 2 ? -t.inboundOut : court.length + t.inboundOut, y: by, z: 0 };
}

/** Remise sous un panier (après un panier marqué, ou en début de période) : derrière la ligne de fond, à côté du poteau, côté spectateur. */
export function baselineSpot(court: Court, hoop: Hoop): Vec3 {
  return { x: hoop.baselineX - hoop.toCourt * FULL_COURT.inboundOut, y: court.width / 2 + FULL_COURT.baselineClear, z: 0 };
}

/** Le chrono s'arrête-t-il après un panier ? Seulement dans la dernière minute du QT4 et des prolongations. */
export function clockStopsAfterBasket(period: number, clock: number): boolean {
  return period >= FULL_COURT.periods && clock <= FULL_COURT.lastMinute;
}

/** Chrono affiché : « 2:47 », puis « 45.3 » sous la minute. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s >= 60) {
    const whole = Math.ceil(s - 1e-9);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }
  return (Math.ceil(s * 10 - 1e-9) / 10).toFixed(1);
}

/** Période affichée : QT1 à QT4, puis P1, P2… pour les prolongations. */
export function periodLabel(period: number): string {
  return period <= FULL_COURT.periods ? `QT${period}` : `P${period - FULL_COURT.periods}`;
}

/** Équipe qui remet en jeu au début d'une période (après le QT1) : le perdant de l'entre-deux aux QT2 et QT3, le gagnant au QT4. */
export function periodStarter(period: number, tipWinner: number): number {
  return period === 4 ? tipWinner : 1 - tipWinner;
}

/**
 * Places de l'entre-deux : les deux sauteurs dans le rond, chacun du côté du panier qu'il défend ;
 * les autres autour du rond, en alternant les équipes. `order[team]` : les joueurs de l'équipe, le
 * sauteur d'abord.
 */
export function tipPositions(court: Court, period: number, order: readonly (readonly number[])[]): Map<number, Vec3> {
  const t = FULL_COURT;
  const cx = court.length / 2;
  const cy = court.width / 2;
  const result = new Map<number, Vec3>();
  const others: number[][] = [];
  order.forEach((members, team) => {
    const side = attacksRight(team, period) ? -1 : 1;
    result.set(members[0], { x: cx + side * t.jumperGap, y: cy, z: 0 });
    others.push(members.slice(1) as number[]);
  });
  // Autour du rond : chaque équipe dans sa moitié défensive, de part et d'autre de l'axe.
  others.forEach((members, team) => {
    const side = attacksRight(team, period) ? -1 : 1;
    members.forEach((i, k) => {
      const angle = ((-60 + (120 * k) / Math.max(1, members.length - 1)) * Math.PI) / 180;
      result.set(i, { x: cx + side * Math.cos(angle) * t.tipRing, y: cy + Math.sin(angle) * t.tipRing * 1.6, z: 0 });
    });
  });
  return result;
}

/**
 * Places en début de période : l'équipe qui remet dans sa moitié arrière (le lanceur au point de
 * remise, les autres dans l'ordre des postes), l'autre dans sa moitié défensive.
 */
export function periodPositions(
  court: Court,
  period: number,
  offense: number,
  order: readonly (readonly number[])[],
  spot: Vec3,
  thrower: number,
): Map<number, Vec3> {
  const cx = court.length / 2;
  const w = court.width;
  const result = new Map<number, Vec3>();
  const dir = attacksRight(offense, period) ? 1 : -1;
  const att = [
    { x: cx - dir * 3, y: w * 0.3 },
    { x: cx - dir * 3, y: w * 0.7 },
    { x: cx - dir * 7, y: w * 0.25 },
    { x: cx - dir * 7, y: w * 0.75 },
  ];
  const def = [
    { x: cx + dir * 3.5, y: w * 0.5 },
    { x: cx + dir * 6, y: w * 0.25 },
    { x: cx + dir * 6, y: w * 0.75 },
    { x: cx + dir * 9, y: w * 0.35 },
    { x: cx + dir * 9, y: w * 0.65 },
  ];
  result.set(thrower, { ...spot });
  order[offense].filter((i) => i !== thrower).forEach((i, k) => result.set(i, { ...att[k % att.length], z: 0 }));
  order[1 - offense].forEach((i, k) => result.set(i, { ...def[k % def.length], z: 0 }));
  return result;
}
