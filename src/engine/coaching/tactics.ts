import type { GamePlan, OffenseStyle, DefenseStyle } from '../gamePlan';
import type { Rng } from '../rng';
import type { Player } from '../types';

export type ShotZone = 'rim' | 'mid' | 'three';
export type PlayId = 'default' | 'fiveOut' | 'horns' | 'highPickRoll' | 'postEntry' | 'isolation';
export const OFFENSE_LABELS: Record<OffenseStyle, string> = {
  balanced: 'Équilibré', paceSpace: 'Pace & Space', motion: 'Motion', pickRoll: 'Pick & Roll', insideOut: 'Inside-Out', isolation: 'Isolation',
};
export const DEFENSE_LABELS: Record<DefenseStyle, string> = { man: 'Individuelle', switch: 'Switch', drop: 'Drop', zone23: 'Zone 2-3 (à venir)', press: 'Press (à venir)' };
export const PLAYS: Record<PlayId, { name: string; description: string; diagram: string; zone: [number, number, number] }> = {
  default: { name: 'Lecture libre', description: 'Tendances naturelles et identité offensive du plan.', diagram: 'Porteur → lecture → tir ou passe', zone: [1, 1, 1] },
  fiveOut: { name: 'Five-Out', description: 'Cinq joueurs écartés ; privilégie le tir extérieur et la pénétration.', diagram: 'Coin — Aile — Meneur — Aile — Coin', zone: [1.05, 0.65, 1.4] },
  horns: { name: 'Horns', description: 'Deux intérieurs aux coudes, lecture du porteur et coupe vers le cercle.', diagram: 'Coin   Intérieur — Intérieur   Coin\n              Meneur', zone: [1.15, 1.1, 0.95] },
  highPickRoll: { name: 'High Pick & Roll', description: 'Le porteur choisit entre attaquer, servir le roll et ressortir.', diagram: 'Meneur + écran haut → drive / roll / tir', zone: [1.25, 0.9, 1.05] },
  postEntry: { name: 'Entrée au poste', description: 'Fixation d’un intérieur puis finition ou passe ressortie.', diagram: 'Porteur → Poste bas → cercle / aile', zone: [1.5, 1, 0.8] },
  isolation: { name: 'Isolation', description: 'Création du leader ; moins de tirs assistés et davantage de fatigue concentrée.', diagram: 'Quatre joueurs écartés | créateur → duel', zone: [1.05, 1.2, 0.9] },
};

const IDENTITY: Record<OffenseStyle, { duration: number; zone: [number, number, number]; pass: number; turnover: number; rebound: number; defaultPlay: PlayId }> = {
  balanced: { duration: 1, zone: [1, 1, 1], pass: 1, turnover: 1, rebound: 1, defaultPlay: 'default' },
  paceSpace: { duration: 0.82, zone: [1.05, 0.7, 1.35], pass: 1.04, turnover: 1.05, rebound: 0.9, defaultPlay: 'fiveOut' },
  motion: { duration: 1.03, zone: [1.12, 0.9, 1.1], pass: 1.16, turnover: 1.06, rebound: 1, defaultPlay: 'horns' },
  pickRoll: { duration: 1, zone: [1.15, 0.9, 1.05], pass: 1.08, turnover: 1.02, rebound: 1, defaultPlay: 'highPickRoll' },
  insideOut: { duration: 1.08, zone: [1.3, 0.95, 0.9], pass: 1.06, turnover: 1.06, rebound: 1.08, defaultPlay: 'postEntry' },
  isolation: { duration: 1.1, zone: [1.05, 1.1, 0.85], pass: 0.68, turnover: 1.02, rebound: 0.97, defaultPlay: 'isolation' },
};
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
const slider = (plan: GamePlan | undefined, key: 'pace' | 'threePointFocus' | 'rimPressure' | 'offensiveReboundAggression' | 'defensiveHelp' | 'defensivePressure') => ((plan?.[key] ?? 50) - 50) / 50;

export interface PreparedTactics {
  plan?: GamePlan;
  offense: OffenseStyle;
  defense: DefenseStyle;
  plays: { id: PlayId; weight: number }[];
  durationFactor: number;
  foulFactor: number;
  fatigueFactor: number;
}
/** Normalize once before the match. Zero weights never reach the weighted RNG. */
export function prepareTactics(plan?: GamePlan): PreparedTactics {
  const offense = plan?.offense ?? 'balanced';
  if (plan?.defense === 'zone23' || plan?.defense === 'press') throw new Error('Cette défense collective n’est pas encore disponible.');
  const source = plan?.playbook ?? [{ playId: 'default', weight: 1 }];
  const positive = source.filter(p => p.weight > 0 && Number.isFinite(p.weight) && Object.hasOwn(PLAYS, p.playId));
  if (!positive.length) throw new Error('Aucun système sélectionnable dans le playbook.');
  // Scale first: finite but very large weights must not overflow the normalization sum.
  const max = Math.max(...positive.map(p => p.weight));
  const sum = positive.reduce((n, p) => n + p.weight / max, 0);
  return {
    plan, offense, defense: plan?.defense ?? 'man',
    plays: positive.map(p => ({ id: p.playId as PlayId, weight: (p.weight / max) / sum })),
    durationFactor: clamp(IDENTITY[offense].duration * (1 - slider(plan, 'pace') * 0.16), 0.72, 1.3),
    foulFactor: 1 + slider(plan, 'defensivePressure') * 0.22,
    fatigueFactor: 1 + Math.max(0, slider(plan, 'defensivePressure')) * 0.12,
  };
}
export function pickPlay(prepared: PreparedTactics, rng: Rng): PlayId {
  const selected = prepared.plays.length === 1 ? prepared.plays[0].id : prepared.plays[rng.weightedIndex(prepared.plays.map(p => p.weight))].id;
  return selected === 'default' ? IDENTITY[prepared.offense].defaultPlay : selected;
}

export interface PossessionTactics {
  playId: PlayId;
  handlerId: string;
  usageByPlayerId: Record<string, number>;
  zoneWeights: Record<ShotZone, number>;
  passFactor: number;
  turnoverFactor: number;
  reboundFactor: number;
  fatiguePlayerId?: string;
  switchedDefenderId?: string;
}

/** Pure contract for a tactical read; no score, player mutation or additive shot-success bonus. */
export function resolvePossessionTactics(off: PreparedTactics, def: PreparedTactics, attackers: readonly Player[], defenders: readonly Player[], rng: Rng): PossessionTactics {
  if (!attackers.length || !defenders.length) throw new Error('Cinq de match absent.');
  const identity = IDENTITY[off.offense];
  // Weight systems by current lineup suitability, without reviving a play whose saved weight is zero.
  const weighted = off.plays.map(p => ({ ...p, weight: p.weight * (p.id === 'default' ? 1 : playSuitability(p.id, attackers).score / 100 + 0.35) }));
  const playId = pickPlay({ ...off, plays: weighted }, rng);
  const leader = attackers.find(p => off.plan?.rolesByPlayerId[p.id] === 'primaryCreator') ?? [...attackers].sort((a, b) => b.tendencies.usage - a.tendencies.usage)[0];
  const big = [...attackers].sort((a, b) => (b.attrs.inside + b.attrs.strength + b.heightCm * 0.15) - (a.attrs.inside + a.attrs.strength + a.heightCm * 0.15))[0];
  const handler = attackers[rng.weightedIndex(attackers.map(p => (p.attrs.handling * 0.6 + p.attrs.passing * 0.4) *
    (playId === 'isolation' && p.id === leader.id ? 2.8 : playId === 'highPickRoll' && ['PG', 'SG'].includes(p.pos) ? 1.45 : 1)))];
  const usage = Object.fromEntries(attackers.map(p => [p.id, 1]));
  if (playId === 'isolation') usage[leader.id] = 3.2;
  if (playId === 'postEntry') usage[big.id] = 2.4;
  if (playId === 'highPickRoll' || playId === 'horns') {
    usage[handler.id] = 1.35; usage[big.id] = 1.65;
  }
  if (playId === 'fiveOut') for (const p of attackers) usage[p.id] = clamp(p.attrs.three / 65, 0.65, 1.4);
  const [rim, mid, three] = identity.zone.map((v, i) => v * PLAYS[playId].zone[i]);
  const zones = {
    rim: rim * (1 + slider(off.plan, 'rimPressure') * 0.45), mid,
    three: three * (1 + slider(off.plan, 'threePointFocus') * 0.55),
  };
  const help = slider(def.plan, 'defensiveHelp');
  zones.rim *= 1 - help * 0.14; zones.three *= 1 + help * 0.14;
  if (def.defense === 'drop') { zones.rim *= 0.8; zones.mid *= 1.2; zones.three *= 1.15; }
  let switchedDefenderId: string | undefined;
  if (def.defense === 'switch' && (playId === 'highPickRoll' || playId === 'horns')) {
    const defender = [...defenders].sort((a, b) => b.heightCm - a.heightCm)[0];
    switchedDefenderId = defender.id;
    const mobility = (defender.attrs.speed + defender.attrs.perimeterDef) / 2;
    usage[handler.id] *= clamp(1.25 - (mobility - 60) / 100, 0.8, 1.5);
    zones.three *= clamp(1.1 - (mobility - 60) / 200, 0.9, 1.3);
  }
  const skill = attackers.reduce((sum, p) => sum + (p.attrs.passing + p.attrs.iq) / 2, 0) / attackers.length;
  const motionRisk = off.offense === 'motion' ? (65 - skill) / 160 : 0;
  const pressuredPost = playId === 'postEntry' ? Math.max(0, slider(def.plan, 'defensivePressure')) * 0.1 : 0;
  return {
    playId, handlerId: handler.id, usageByPlayerId: usage,
    zoneWeights: { rim: clamp(zones.rim, 0.35, 2.5), mid: clamp(zones.mid, 0.35, 2.5), three: clamp(zones.three, 0.35, 2.5) },
    passFactor: clamp(identity.pass * (playId === 'isolation' && off.offense !== 'isolation' ? 0.75 : 1), 0.5, 1.25),
    turnoverFactor: clamp((identity.turnover + motionRisk + pressuredPost) * (1 + slider(def.plan, 'defensivePressure') * 0.18), 0.7, 1.4),
    reboundFactor: clamp(identity.rebound * (1 + slider(off.plan, 'offensiveReboundAggression') * 0.2), 0.7, 1.3),
    fatiguePlayerId: playId === 'isolation' ? leader.id : undefined, switchedDefenderId,
  };
}

export function playSuitability(playId: PlayId, players: readonly Player[]): { score: number; label: string; reasons: string[] } {
  if (!players.length) return { score: 0, label: 'Faible', reasons: ['Aucun joueur disponible.'] };
  const avg = (key: 'three' | 'passing' | 'iq' | 'inside' | 'strength' | 'handling') => players.reduce((n, p) => n + p.attrs[key], 0) / players.length;
  let score = 65;
  let reason = 'Suit les tendances individuelles du cinq.';
  if (playId === 'fiveOut') { score = avg('three'); reason = `Tir extérieur moyen du cinq : ${Math.round(score)}.`; }
  if (playId === 'horns') { score = (avg('passing') + avg('iq')) / 2; reason = `Passe/QI moyens : ${Math.round(score)}.`; }
  if (playId === 'highPickRoll') { score = (Math.max(...players.map(p => (p.attrs.handling + p.attrs.passing) / 2)) + Math.max(...players.map(p => (p.attrs.inside + p.attrs.strength) / 2))) / 2; reason = `Porteur et finisseur : aptitude combinée ${Math.round(score)}.`; }
  if (playId === 'postEntry') { score = Math.max(...players.map(p => (p.attrs.inside + p.attrs.strength) / 2)); reason = `Meilleur intérieur finition/force : ${Math.round(score)}.`; }
  if (playId === 'isolation') { score = Math.max(...players.map(p => (p.attrs.handling + p.attrs.inside + p.attrs.three) / 3)); reason = `Meilleur créateur dribble/finition/tir : ${Math.round(score)}.`; }
  return { score, label: score >= 72 ? 'Bonne' : score >= 58 ? 'Moyenne' : 'Faible', reasons: [reason] };
}

export function scoutLineup(players: readonly Player[]): { strengths: string[]; weaknesses: string[] } {
  if (!players.length) return { strengths: [], weaknesses: [] };
  const axes = ([['three', 'Tir extérieur'], ['passing', 'Passe'], ['interiorDef', 'Défense intérieure'], ['perimeterDef', 'Défense extérieure'], ['defReb', 'Rebond défensif'], ['speed', 'Vitesse']] as const)
    .map(([key, label]) => ({ label, score: players.reduce((n, p) => n + p.attrs[key], 0) / players.length })).sort((a, b) => b.score - a.score);
  const describe = (x: typeof axes[number]) => `${x.label} : ${Math.round(x.score)}/99`;
  return { strengths: axes.slice(0, 3).map(describe), weaknesses: axes.slice(-3).reverse().map(describe) };
}
