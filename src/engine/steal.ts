import type { Rng } from './rng';
import type { Athlete } from './shot';

/**
 * Vol, faute de main et interception pour le match joué (valeurs provisoires, réglables ici).
 * La simulation garde son propre modèle de pertes de balle : ces fonctions n'y entrent pas.
 */
export const STEAL_TUNING = {
  /** Vol réussi : base (défenseur et porteur moyens, main bien placée, ballon exposé). */
  steal: {
    base: 0.2,
    /** Par point d'interception du voleur, et par point de dribble du porteur, au-dessus de 60. */
    stealSlope: 0.006,
    handlingSlope: 0.005,
    /** Part gardée au bout des doigts (main mal placée), et ballon caché derrière le corps. */
    reachFloor: 0.35,
    hiddenFloor: 0.3,
    bounds: [0.02, 0.6],
  },
  /** Faute de main : rare à bonne distance, fréquente trop près ou à travers le corps. */
  foul: {
    base: 0.05,
    /** Par mètre sous la distance de contact. */
    closeSlope: 2.5,
    /** Main à travers le corps du porteur (ballon caché). */
    acrossWeight: 0.3,
    iqSlope: 0.003,
    strengthSlope: 0.002,
    bounds: [0.02, 0.85],
  },
  /** Passe qui passe à portée d'un défenseur : il la touche, puis il l'attrape ou la dévie. */
  intercept: {
    base: 0.22,
    stealSlope: 0.006,
    /** Qualité du contact (0 = au bout des doigts, 1 = en plein dans la ligne). */
    contactWeight: 0.4,
    /** Bras allongé : A appuyé au bon moment. */
    reachBonus: 0.15,
    /** Par m/s au-dessus de 12 m/s, et par point de passe du passeur au-dessus de 60. */
    speedSlope: 0.03,
    passingSlope: 0.003,
    touchBounds: [0.03, 0.85],
    /** Part des passes touchées qui sont attrapées (le reste est dévié) ; en l'air, beaucoup moins. */
    catchShare: 0.45,
    catchStealSlope: 0.005,
    airborneCatchPenalty: 0.25,
    catchBounds: [0.1, 0.8],
  },
} as const;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export interface StealContext {
  thief: Athlete;
  handler: Athlete;
  /** Qualité de la main mesurée par `match/` : 1 à bonne distance du ballon, 0 au bout des doigts. */
  reach: number;
  /** 1 : ballon du côté du voleur ; 0 : caché derrière le corps du porteur. */
  exposed: number;
}

/** Chance d'arracher le ballon au porteur. */
export function stealProbability(ctx: StealContext): number {
  const t = STEAL_TUNING.steal;
  const p = t.base + (ctx.thief.attrs.steal - 60) * t.stealSlope - (ctx.handler.attrs.handling - 60) * t.handlingSlope;
  const reach = t.reachFloor + (1 - t.reachFloor) * clamp(ctx.reach, 0, 1);
  const exposed = t.hiddenFloor + (1 - t.hiddenFloor) * clamp(ctx.exposed, 0, 1);
  return clamp(p * reach * exposed, t.bounds[0], t.bounds[1]);
}

export function resolveSteal(ctx: StealContext, rng: Rng): boolean {
  return rng.chance(stealProbability(ctx));
}

export interface ReachFoulContext {
  thief: Athlete;
  handler: Athlete;
  /** Rapprochement : mètres sous la distance de contact (0 = à bonne distance). */
  closeness: number;
  /** Main à travers le corps du porteur : 1 − exposition du ballon. */
  across: number;
}

/** Chance qu'un geste de vol soit sifflé (faute de main). */
export function reachFoulProbability(ctx: ReachFoulContext): number {
  const t = STEAL_TUNING.foul;
  const p =
    t.base +
    Math.max(0, ctx.closeness) * t.closeSlope +
    clamp(ctx.across, 0, 1) * t.acrossWeight -
    (ctx.thief.attrs.iq - 60) * t.iqSlope +
    (ctx.handler.attrs.strength - ctx.thief.attrs.strength) * t.strengthSlope;
  return clamp(p, t.bounds[0], t.bounds[1]);
}

export function resolveReachFoul(ctx: ReachFoulContext, rng: Rng): boolean {
  return rng.chance(reachFoulProbability(ctx));
}

export interface InterceptContext {
  defender: Athlete;
  passer: Athlete;
  /** Qualité du contact mesurée par `match/` : 1 = en plein dans la ligne, 0 = effleurée. */
  contact: number;
  /** Vitesse horizontale de la passe (m/s). */
  passSpeed: number;
  /** A appuyé au bon moment : bras allongé. */
  reaching: boolean;
  /** Défenseur en l'air (saut pour dévier). */
  airborne: boolean;
}

export type InterceptOutcome = 'catch' | 'deflect' | 'miss';

/** Chance de toucher la passe, puis part des passes touchées qui sont attrapées. */
export function interceptionChances(ctx: InterceptContext): { touch: number; catchShare: number } {
  const t = STEAL_TUNING.intercept;
  const touch = clamp(
    t.base +
      (ctx.defender.attrs.steal - 60) * t.stealSlope +
      clamp(ctx.contact, 0, 1) * t.contactWeight +
      (ctx.reaching ? t.reachBonus : 0) -
      Math.max(0, ctx.passSpeed - 12) * t.speedSlope -
      (ctx.passer.attrs.passing - 60) * t.passingSlope,
    t.touchBounds[0],
    t.touchBounds[1],
  );
  const catchShare = clamp(
    t.catchShare + (ctx.defender.attrs.steal - 60) * t.catchStealSlope - (ctx.airborne ? t.airborneCatchPenalty : 0),
    t.catchBounds[0],
    t.catchBounds[1],
  );
  return { touch, catchShare };
}

/** Issue d'une passe qui passe à portée d'un défenseur : attrapée, déviée ou ratée. */
export function resolveInterception(ctx: InterceptContext, rng: Rng): InterceptOutcome {
  const { touch, catchShare } = interceptionChances(ctx);
  if (!rng.chance(touch)) return 'miss';
  return rng.chance(catchShare) ? 'catch' : 'deflect';
}
