import { minuteTargets, pickLineup, type LineupCandidate } from './coach';
import type { Player, StatLine, Team } from './types';

/**
 * Énergie et rotation d'un match, partagées par la simulation (`simGame`) et le match joué
 * (`match/`). Valeurs reprises telles quelles de `simGame` : `npm run calibrate` ne bouge pas.
 */
export const ENERGY_MODEL = {
  /** Au coup d'envoi : énergie de la ligue + 40, bornée à 70-100. */
  startBonus: 40,
  startMin: 70,
  startMax: 100,
  /** Sur le terrain, perte par seconde de jeu : 0,115 − 0,0005 × endurance. */
  drainBase: 0.115,
  drainPerStamina: 0.0005,
  /** Sur le banc, récupération par seconde : 0,16 + 0,0008 × endurance. */
  recoveryBase: 0.16,
  recoveryPerStamina: 0.0008,
  min: 5,
  max: 100,
  /** Repos entre deux périodes, plus long à la mi-temps (après la 2e). */
  periodRest: 15,
  halftimeRest: 30,
  /** Effet sur les notes : × (0,8 + 0,2 × énergie / 100). */
  effectBase: 0.8,
  effectSlope: 0.2,
} as const;

/** Intervalle minimum entre deux contrôles de rotation, en secondes de jeu (match de 48 min). */
export const SUB_INTERVAL = 95;
/** Nombre de fautes d'équipe à partir duquel l'adversaire tire des lancers. */
export const BONUS_THRESHOLD = 5;
/** Fautes personnelles qui éliminent un joueur. */
export const FOUL_OUT = 6;

/** Seuils de fin de match du coach (secondes du dernier quart-temps de 12 min, points d'écart). */
export const COACH_MODEL = {
  /** Fin de match serrée : moins de 5 min, 12 points d'écart ou moins. */
  closingClock: 300,
  closingMargin: 12,
  /** Match plié : moins de 8 min, plus de 19 points d'écart. */
  garbageClock: 480,
  garbageMargin: 19,
} as const;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Énergie au coup d'envoi. */
export function startingEnergy(player: Player): number {
  const m = ENERGY_MODEL;
  return clamp(player.energy + m.startBonus, m.startMin, m.startMax);
}

/** Facteur appliqué aux notes selon l'énergie (1 à 100 d'énergie, 0,8 à vide). */
export function energyFactor(energy: number): number {
  return ENERGY_MODEL.effectBase + ENERGY_MODEL.effectSlope * (energy / 100);
}

/** Énergie après `seconds` secondes de jeu, sur le terrain (perte) ou sur le banc (récupération). */
export function drainEnergy(energy: number, stamina: number, seconds: number, onCourt: boolean): number {
  const m = ENERGY_MODEL;
  if (onCourt) {
    const drain = m.drainBase - stamina * m.drainPerStamina;
    return clamp(energy - drain * seconds, m.min, m.max);
  }
  const recovery = m.recoveryBase + stamina * m.recoveryPerStamina;
  return clamp(energy + recovery * seconds, m.min, m.max);
}

/** Énergie après le repos qui suit la période `period` (plus long à la mi-temps). */
export function restEnergy(energy: number, period: number): number {
  const rest = period === 2 ? ENERGY_MODEL.halftimeRest : ENERGY_MODEL.periodRest;
  return clamp(energy + rest, 0, 100);
}

/** L'équipe qui a commis `teamFouls` fautes dans la période envoie l'adversaire aux lancers. */
export function inBonus(teamFouls: number): boolean {
  return teamFouls > BONUS_THRESHOLD;
}

/** Contexte utilisé par l'entraîneur virtuel pour composer son cinq. */
export interface CoachContext {
  /** Part du match déjà écoulée (0 → 1, au-delà en prolongation). */
  progress: number;
  period: number;
  /** Fin de match serrée : on sort les meilleurs, la fatigue passe au second plan. */
  closing: boolean;
  /** Match plié : on protège les cadres et on fait tourner le banc. */
  garbage: boolean;
  /**
   * Accélération du match : 1 pour un match de 48 min, 4 pour 4 × 3 min. Le temps de jeu de chacun
   * est ramené à l'échelle d'un match de 48 min avant d'être comparé à ses minutes visées.
   */
  timeScale: number;
}

export function newCoachContext(timeScale = 1): CoachContext {
  return { progress: 0, period: 1, closing: false, garbage: false, timeScale };
}

/**
 * Met à jour le contexte du coach : période, part du match écoulée (`elapsed` sur `regulation`
 * secondes), fin de match serrée ou match plié (seuils de temps divisés par l'échelle).
 */
export function updateCoachContext(
  ctx: CoachContext,
  period: number,
  clock: number,
  elapsed: number,
  regulation: number,
  margin: number,
  regulationPeriods = 4,
): void {
  const m = COACH_MODEL;
  ctx.period = period;
  ctx.progress = elapsed / regulation;
  ctx.closing = period >= regulationPeriods && clock < m.closingClock / ctx.timeScale && margin <= m.closingMargin;
  ctx.garbage = !ctx.closing && period >= regulationPeriods && clock < m.garbageClock / ctx.timeScale && margin > m.garbageMargin;
}

/** Un joueur de la rotation, tel que le coach le voit. */
export interface RotationMember extends LineupCandidate {
  energy: number;
  onCourt: boolean;
  fouledOut: boolean;
  /** Temps de jeu visé sur l'ensemble d'un match de 48 min, en secondes. */
  targetSecs: number;
  line: Pick<StatLine, 'secs' | 'pf'>;
}

/**
 * Valeur d'un joueur aux yeux du coach à l'instant T.
 * Le temps de jeu suit d'abord un plan de rotation (minutes visées) ; la
 * fatigue, les fautes et le money time viennent ensuite le corriger.
 */
export function coachValue(lp: RotationMember, ctx: CoachContext): number {
  if (ctx.closing) {
    return lp.overall * (0.85 + 0.15 * (lp.energy / 100)) + (lp.onCourt ? 2 : 0) - (lp.line.pf >= 5 ? 10 : 0);
  }
  const expected = lp.targetSecs * ctx.progress;
  const deficitMinutes = clamp((expected - lp.line.secs * ctx.timeScale) / 60, -10, 10);
  if (ctx.garbage) {
    // Écart trop large pour être rattrapé : les cadres vont s'asseoir.
    return 55 + deficitMinutes * 4 - (lp.overall - 60) * 0.55 + (lp.onCourt ? 2 : 0);
  }
  let value = 55 + deficitMinutes * 4 + (lp.overall - 60) * 0.25 + (lp.energy - 65) * 0.12;
  if (lp.onCourt) value += 2;
  if (lp.line.pf >= 5) value -= 15;
  else if (lp.line.pf >= 4 && ctx.period <= 3) value -= 8;
  else if (lp.line.pf >= 3 && ctx.period <= 2) value -= 5;
  return value;
}

/** Cinq de départ : les cinq premiers de la rotation, chacun au poste qui lui va le mieux. */
export function startingLineup<T extends RotationMember>(rotation: readonly T[]): T[] {
  return pickLineup(rotation.slice(0, 5), (lp) => lp.overall);
}

/** Cinq choisi par le coach parmi les joueurs non éliminés (tous, s'il en reste moins de cinq). */
export function nextLineup<T extends RotationMember>(rotation: readonly T[], ctx: CoachContext): T[] {
  const candidates = rotation.filter((lp) => !lp.fouledOut);
  const pool = candidates.length >= 5 ? candidates : [...rotation];
  return pickLineup(pool, (lp) => coachValue(lp, ctx));
}

/** Marque sur le terrain les joueurs du cinq `lineup`, et sur le banc tous les autres. */
export function seatLineup(rotation: readonly RotationMember[], lineup: readonly RotationMember[]): void {
  for (const lp of rotation) lp.onCourt = false;
  for (const lp of lineup) lp.onCourt = true;
}

/**
 * Joueurs disponibles pour un match, dans l'ordre de la rotation choisie par l'entraîneur :
 * les valides de la rotation, complétés jusqu'à 8 par les meilleurs valides de l'effectif ; dans
 * le cas extrême d'un effectif décimé, les blessés légers jouent.
 */
export function matchRotation(team: Team, players: Readonly<Record<string, Player>>): Player[] {
  const available = team.rotation
    .map((id) => players[id])
    .filter((p): p is Player => Boolean(p) && p.teamId === team.id && p.injuryGames === 0);

  if (available.length < 8) {
    const known = new Set(available.map((p) => p.id));
    const extras = team.roster
      .map((id) => players[id])
      .filter((p) => p && p.injuryGames === 0 && !known.has(p.id))
      .sort((a, b) => b.overall - a.overall);
    while (available.length < 8 && extras.length > 0) available.push(extras.shift()!);
  }
  // Cas extrême (effectif décimé) : on fait jouer les blessés légers.
  if (available.length < 5) {
    const known = new Set(available.map((p) => p.id));
    for (const id of team.roster) {
      if (available.length >= 5) break;
      if (!known.has(id) && players[id]) available.push(players[id]);
    }
  }
  return available;
}

/**
 * Minutes visées de chaque joueur disponible (secondes d'un match de 48 min) : l'ordre de la
 * rotation les fixe, le premier joue le plus, le dernier le moins.
 */
export function rotationTargets(available: readonly Player[]): Map<string, number> {
  const targets = minuteTargets(available.length);
  return new Map(available.map((p, i) => [p.id, targets[i]]));
}
