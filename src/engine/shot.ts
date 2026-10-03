import type { Rng } from './rng';
import type { Player } from './types';

/**
 * Modèle de réussite au tir : partagé par la simulation (`simGame`) et le match joué.
 * Les deux partent de la même base par zone et du même poids de l'attribut de tir.
 */
export type ShotZone = 'rim' | 'mid' | 'three';

export const SHOT_MODEL = {
  /** Réussite d'un tireur noté 64 face à une défense notée 64. */
  base: { rim: 0.6, mid: 0.4, three: 0.348 },
  /** Note de référence (tireur et défense « moyens »). */
  pivot: 64,
  /** Gain de réussite par point d'attribut de tir au-dessus de la référence. */
  skillSlope: 0.0036,
  /** Perte de réussite par point de défense au-dessus de la référence (simulation). */
  defenseSlope: 0.0032,
  /** Bornes de la probabilité par zone. Le plafond vaut aussi pour le match joué. */
  bounds: { rim: [0.34, 0.82], mid: [0.22, 0.6], three: [0.2, 0.5] },
} as const;

/** Lancer franc : partagé par la simulation et le match joué (réussite selon la stat de lancer franc). */
export const FREE_THROW_MODEL = {
  base: 0.4,
  /** Gain par point de stat de lancer franc. */
  slope: 0.0055,
  bounds: [0.45, 0.95],
} as const;

/** Réussite d'un lancer franc pour la simulation ; c'est aussi la cible d'un lâcher humain moyen au match joué. */
export function freeThrowBase(rating: number): number {
  const m = FREE_THROW_MODEL;
  return clamp(m.base + rating * m.slope, m.bounds[0], m.bounds[1]);
}

// ---------------------------------------------------------------------------
// Match joué : valeurs provisoires, réglables ici (voir GAMEPLAY_SPEC, phase 1).
// ---------------------------------------------------------------------------

export type ShotMode = 'timing' | 'realPct';
export type ShotSpeed = 'slow' | 'normal' | 'fast';
export type ShotKind = 'jump' | 'layup';
export type TimingGrade = 'perfect' | 'green' | 'early' | 'late';

/** Ce que le moteur lit d'un joueur pour le match joué. */
export type Athlete = Pick<Player, 'attrs' | 'heightCm' | 'weightKg'>;

export const SHOT_TUNING = {
  /** Durée entre l'appui sur Tir et le sommet du saut, selon la vitesse de tir (s). */
  gaugeTime: { slow: 0.75, normal: 0.6, fast: 0.45 },
  /**
   * Demi-largeur de la zone verte, en fraction de `gaugeTime`. Fixe en mode Timing ;
   * en Real Player %, elle s'élargit avec la stat de tir (de `min` à 25 jusqu'à `max` à 99).
   */
  greenFraction: { timing: 0.1, realPct: { min: 0.06, max: 0.16 } },
  /** Lâcher « parfait » : écart inférieur à cette fraction de la demi-largeur du vert. */
  perfectFraction: 0.3,
  /**
   * Multiplicateur de réussite selon l'écart au sommet : `perfect` au centre du vert,
   * `edge` au bord du vert, puis baisse linéaire jusqu'à `floor` sur `falloff`
   * (fraction de `gaugeTime`). Le timing pèse fort en Timing, moins en Real Player %.
   */
  timingCurve: {
    timing: { perfect: 1.3, edge: 0.95, floor: 0.15, falloff: 0.2 },
    realPct: { perfect: 1.15, edge: 0.95, floor: 0.6, falloff: 0.333 },
  },
  /**
   * Écart-type du lâcher d'un humain moyen à vitesse normale (s). C'est la cible de
   * calibration : avec cette dispersion, un tireur moyen ouvert tourne autour de 35 % à 3 pts,
   * alors que le vert parfait lui donne ~45 %.
   */
  humanTimingSd: 0.065,
  /** Contestation : aucun effet au-delà de `range` (m), effet maximal en deçà de `tight` (m). */
  contest: {
    range: 2,
    tight: 0.6,
    /** Part de l'effet qui reste quand le défenseur n'est pas en face (sur le côté). */
    sideWeight: 0.25,
    /** Perte relative maximale, par zone. */
    maxPenalty: { rim: 0.3, mid: 0.4, three: 0.4 },
  },
  /** Tir en mouvement (sauf layup) : perte relative maximale atteinte à `fullSpeed` (m/s). */
  moving: { fullSpeed: 5, maxPenalty: 0.2 },
  /** Probabilité minimale d'un tir, même très mal lâché. */
  minProbability: 0.02,
} as const;

export interface Contest {
  /** Distance horizontale entre le défenseur et le tireur (m). */
  distance: number;
  /** 1 = défenseur pile entre le tireur et le cercle ; 0 = sur le côté ou derrière. */
  facing: number;
}

export interface ShotContext {
  shooter: Athlete;
  zone: ShotZone;
  kind: ShotKind;
  mode: ShotMode;
  speed: ShotSpeed;
  /** Écart entre le lâcher et le sommet du saut (s) : négatif = trop tôt. */
  timingError: number;
  /** Défenseur le plus proche, ou `null` si personne. */
  contest: Contest | null;
  /** Vitesse horizontale du tireur au moment du tir (m/s). */
  moveSpeed: number;
  /** Énergie 0-100 (fixe à 100 en phase 1). */
  energy?: number;
}

export interface ShotResult {
  made: boolean;
  probability: number;
  grade: TimingGrade;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

const ZONE_SKILL = { rim: 'inside', mid: 'midRange', three: 'three' } as const;

/** Note d'attribut corrigée par la fatigue (même formule que la simulation). */
function effective(rating: number, energy = 100): number {
  return rating * (0.8 + 0.2 * (energy / 100));
}

export function gaugeTime(speed: ShotSpeed): number {
  return SHOT_TUNING.gaugeTime[speed];
}

/** Demi-largeur de la zone verte (s) autour du sommet du saut. */
export function greenWindow(mode: ShotMode, skill: number, speed: ShotSpeed): number {
  const { timing, realPct } = SHOT_TUNING.greenFraction;
  const fraction =
    mode === 'timing' ? timing : realPct.min + ((realPct.max - realPct.min) * (clamp(skill, 25, 99) - 25)) / 74;
  return fraction * gaugeTime(speed);
}

export function timingGrade(error: number, window: number): TimingGrade {
  const gap = Math.abs(error);
  if (gap <= window * SHOT_TUNING.perfectFraction) return 'perfect';
  if (gap <= window) return 'green';
  return error < 0 ? 'early' : 'late';
}

/** Multiplicateur de réussite dû au timing. */
export function timingMultiplier(mode: ShotMode, error: number, window: number, speed: ShotSpeed): number {
  const curve = SHOT_TUNING.timingCurve[mode];
  const gap = Math.abs(error);
  if (gap <= window) return curve.perfect - (curve.perfect - curve.edge) * (gap / window);
  const falloff = curve.falloff * gaugeTime(speed);
  return Math.max(curve.floor, curve.edge - ((curve.edge - curve.floor) * (gap - window)) / falloff);
}

/** Intensité de la contestation, de 0 (ouvert) à 1 (collé et bien en face). */
export function contestLevel(contest: Contest | null): number {
  if (!contest) return 0;
  const { range, tight, sideWeight } = SHOT_TUNING.contest;
  const closeness = clamp((range - contest.distance) / (range - tight), 0, 1);
  const front = clamp(contest.facing, 0, 1);
  return closeness * (sideWeight + (1 - sideWeight) * front);
}

export function shotSkill(ctx: Pick<ShotContext, 'shooter' | 'zone' | 'energy'>): number {
  return effective(ctx.shooter.attrs[ZONE_SKILL[ctx.zone]], ctx.energy);
}

export function shotProbability(ctx: ShotContext): number {
  const skill = shotSkill(ctx);
  const base = SHOT_MODEL.base[ctx.zone] + (skill - SHOT_MODEL.pivot) * SHOT_MODEL.skillSlope;
  const window = greenWindow(ctx.mode, skill, ctx.speed);
  const timing = timingMultiplier(ctx.mode, ctx.timingError, window, ctx.speed);
  const contest = 1 - SHOT_TUNING.contest.maxPenalty[ctx.zone] * contestLevel(ctx.contest);
  const { fullSpeed, maxPenalty } = SHOT_TUNING.moving;
  const moving = ctx.kind === 'layup' ? 1 : 1 - maxPenalty * clamp(ctx.moveSpeed / fullSpeed, 0, 1);
  return clamp(base * timing * contest * moving, SHOT_TUNING.minProbability, SHOT_MODEL.bounds[ctx.zone][1]);
}

export interface FreeThrowContext {
  shooter: Athlete;
  mode: ShotMode;
  speed: ShotSpeed;
  /** Écart entre le lâcher et la fin de la jauge (s) : négatif = trop tôt. */
  timingError: number;
}

export const FREE_THROW_TUNING = {
  /** Plafond d'un lancer franc parfaitement lâché. */
  max: 0.98,
} as const;

/**
 * Lancer franc au match joué : la base de la simulation (stat de lancer franc) multipliée par la
 * courbe de timing du tir. La jauge est la même que celle du tir, sans saut ; en Real Player %,
 * la stat de lancer franc élargit la zone verte. Un lâcher parfait passe au-dessus de la base, un
 * timing humain moyen retombe autour d'elle.
 */
export function freeThrowProbability(ctx: FreeThrowContext): number {
  const skill = ctx.shooter.attrs.freeThrow;
  const window = greenWindow(ctx.mode, skill, ctx.speed);
  const timing = timingMultiplier(ctx.mode, ctx.timingError, window, ctx.speed);
  return clamp(freeThrowBase(skill) * timing, SHOT_TUNING.minProbability, FREE_THROW_TUNING.max);
}

/** Tire le résultat d'un lancer franc au lâcher, avec la note du lâcher. */
export function resolveFreeThrow(ctx: FreeThrowContext, rng: Rng): ShotResult {
  const probability = freeThrowProbability(ctx);
  const window = greenWindow(ctx.mode, ctx.shooter.attrs.freeThrow, ctx.speed);
  return { made: rng.chance(probability), probability, grade: timingGrade(ctx.timingError, window) };
}

/** Tire le résultat d'un tir ou d'un layup au moment du lâcher. */
export function resolveShot(ctx: ShotContext, rng: Rng): ShotResult {
  const probability = shotProbability(ctx);
  const window = greenWindow(ctx.mode, shotSkill(ctx), ctx.speed);
  return { made: rng.chance(probability), probability, grade: timingGrade(ctx.timingError, window) };
}

// ---------------------------------------------------------------------------
// Dunk
// ---------------------------------------------------------------------------

export const DUNK_TUNING = {
  /** Au-delà de cette vitesse (m/s), c'est la stat de dunk en mouvement qui compte. */
  movingSpeed: 1.5,
  /** Score minimal pour pouvoir dunker. */
  threshold: 55,
  /** Bonus par cm au-dessus de 2 m, et par point de détente au-dessus de 60. */
  heightWeight: 0.4,
  verticalWeight: 0.3,
  /** Malus de contestation : base + taille, détente et contre du défenseur. */
  contest: { base: 10, heightWeight: 0.4, verticalWeight: 0.2, blockWeight: 0.2 },
  /** Réussite d'un dunk : base au seuil, gain par point de score, malus de contestation. */
  make: { base: 0.88, scoreSlope: 0.006, contestPenalty: 0.25, bounds: [0.5, 0.97] },
} as const;

export interface DunkContext {
  dunker: Athlete;
  /** Le joueur est dans la moitié de la raquette côté panier (mesuré par `match/`). */
  inDunkZone: boolean;
  /** Vitesse horizontale au moment de l'appui (m/s). */
  moveSpeed: number;
  /** Défenseur le plus proche, ou `null` si personne. */
  defender: (Contest & { player: Athlete }) | null;
}

/** Aptitude au dunk dans ce contexte : stat de dunk, taille, détente, moins la contestation. */
export function dunkScore(ctx: DunkContext): number {
  const { dunker } = ctx;
  const stat = ctx.moveSpeed >= DUNK_TUNING.movingSpeed ? dunker.attrs.drivingDunk : dunker.attrs.standingDunk;
  let score =
    stat + (dunker.heightCm - 200) * DUNK_TUNING.heightWeight + (dunker.attrs.vertical - 60) * DUNK_TUNING.verticalWeight;
  if (ctx.defender) {
    const d = ctx.defender.player;
    const c = DUNK_TUNING.contest;
    const strength =
      c.base + (d.heightCm - 200) * c.heightWeight + (d.attrs.vertical - 60) * c.verticalWeight + (d.attrs.block - 60) * c.blockWeight;
    score -= contestLevel(ctx.defender) * Math.max(0, strength);
  }
  return score;
}

export function canDunk(ctx: DunkContext): boolean {
  return ctx.inDunkZone && dunkScore(ctx) >= DUNK_TUNING.threshold;
}

export function dunkProbability(ctx: DunkContext): number {
  const m = DUNK_TUNING.make;
  const p = m.base + (dunkScore(ctx) - DUNK_TUNING.threshold) * m.scoreSlope - m.contestPenalty * contestLevel(ctx.defender);
  return clamp(p, m.bounds[0], m.bounds[1]);
}

export function resolveDunk(ctx: DunkContext, rng: Rng): { made: boolean; probability: number } {
  const probability = dunkProbability(ctx);
  return { made: rng.chance(probability), probability };
}

// ---------------------------------------------------------------------------
// Contre et faute
// ---------------------------------------------------------------------------

export const BLOCK_TUNING = {
  /** Réussite quand la main touche le ballon en plein, à notes et tailles égales. */
  base: 0.5,
  blockSlope: 0.008,
  verticalSlope: 0.003,
  /** Par cm d'écart de taille avec le tireur. */
  heightSlope: 0.004,
  bounds: [0.1, 0.9],
  /** Part de la réussite conservée quand la main ne fait qu'effleurer le ballon. */
  grazeFactor: 0.4,
} as const;

export interface BlockContext {
  blocker: Athlete;
  shooter: Athlete;
  /** Qualité du contact main-ballon mesurée par `match/` : 0 = effleure, 1 = en plein. */
  contact: number;
}

export function blockProbability(ctx: BlockContext): number {
  const t = BLOCK_TUNING;
  const p =
    t.base +
    (ctx.blocker.attrs.block - 60) * t.blockSlope +
    (ctx.blocker.attrs.vertical - 60) * t.verticalSlope +
    (ctx.blocker.heightCm - ctx.shooter.heightCm) * t.heightSlope;
  const contact = clamp(ctx.contact, 0, 1);
  return clamp(p, t.bounds[0], t.bounds[1]) * (t.grazeFactor + (1 - t.grazeFactor) * contact);
}

/** Contre réussi : il annule le résultat tiré au lâcher (voir ENGINE_VIEW_CONTRACT). */
export function resolveBlock(ctx: BlockContext, rng: Rng): boolean {
  return rng.chance(blockProbability(ctx));
}

export const FOUL_TUNING = {
  base: 0.25,
  /** Par mètre de recouvrement des corps. */
  overlapSlope: 1.5,
  /** Par m/s de vitesse du défenseur vers le tireur. */
  approachSlope: 0.08,
  /** Un défenseur malin se jette moins ; un tireur plus fort que lui provoque plus. */
  iqSlope: 0.004,
  strengthSlope: 0.003,
  bounds: [0.05, 0.95],
} as const;

export interface FoulContext {
  defender: Athlete;
  shooter: Athlete;
  /** Recouvrement des corps (m) : 0 = simple frôlement. */
  overlap: number;
  /** Vitesse du défenseur vers le tireur (m/s). */
  approachSpeed: number;
}

export function foulProbability(ctx: FoulContext): number {
  const t = FOUL_TUNING;
  const p =
    t.base +
    Math.max(0, ctx.overlap) * t.overlapSlope +
    Math.max(0, ctx.approachSpeed) * t.approachSlope -
    (ctx.defender.attrs.iq - 60) * t.iqSlope +
    (ctx.shooter.attrs.strength - ctx.defender.attrs.strength) * t.strengthSlope;
  return clamp(p, t.bounds[0], t.bounds[1]);
}

/** Contact pendant un contre : faute sifflée ou non. */
export function foulOnContact(ctx: FoulContext, rng: Rng): boolean {
  return rng.chance(foulProbability(ctx));
}
