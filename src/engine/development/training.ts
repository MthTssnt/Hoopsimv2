import { clampRating, computeOverall } from '../ratings';
import type { Rng } from '../rng';
import { playerName, type AttributeKey, type League, type Player } from '../types';
import { TRAINING_FOCI, type DevelopmentRecord, type TrainingFocus } from './types';
export const TRAINING_LABELS: Record<TrainingFocus, string> = { balanced: 'Équilibré', shooting: 'Tir extérieur', finishing: 'Finition', playmaking: 'Création et lecture', defense: 'Défense', physical: 'Physique et endurance' };
export const TRAINING_ATTRIBUTES: Record<TrainingFocus, readonly AttributeKey[]> = {
  balanced: [], shooting: ['three', 'midRange', 'freeThrow'], finishing: ['inside', 'standingDunk', 'drivingDunk'],
  playmaking: ['passing', 'handling', 'iq'], defense: ['interiorDef', 'perimeterDef', 'steal', 'block'], physical: ['speed', 'strength', 'stamina', 'vertical'],
};
export function setTrainingFocus(league: League, playerId: string, focus: TrainingFocus): string[] {
  const p = Object.hasOwn(league.players, playerId) ? league.players[playerId] : undefined;
  if (!p || p.teamId !== league.userTeamId || !TRAINING_FOCI.includes(focus)) return ['Joueur ou focus invalide.'];
  p.training ??= { focus: 'balanced', days: {} }; p.training.focus = focus;
  return [];
}
/** One exposure per real regular-season day. Changing a selector never adds exposure or attributes. */
export function accrueTraining(league: League): void {
  const key = `${league.season}:${league.day}`;
  if (league.phase !== 'regular' || league.lastTrainingDay === key || league.day < 0 || league.day > Math.max(-1, ...league.schedule.map(g => g.day))) return;
  league.lastTrainingDay = key;
  for (const p of Object.values(league.players)) if (p.teamId) {
    p.training ??= { focus: 'balanced', days: {} };
    const focus = p.training.focus;
    p.training.days[focus] = (p.training.days[focus] ?? 0) + (p.injuryGames > 0 ? 0.25 : 1);
  }
}
export function recommendTraining(p: Player): TrainingFocus {
  const choices: TrainingFocus[] = p.age >= 31 ? ['shooting', 'playmaking', 'defense'] : ['shooting', 'finishing', 'playmaking', 'defense', 'physical'];
  return choices.sort((a, b) => average(p, a) - average(p, b))[0];
}
function average(p: Player, focus: TrainingFocus) { const keys = TRAINING_ATTRIBUTES[focus]; return keys.reduce((n, key) => n + p.attrs[key], 0) / Math.max(1, keys.length); }
export function progressPlayer(rng: Rng, player: Player, seasonDays: number): DevelopmentRecord {
  const attrs = { ...player.attrs }, before = player.overall;
  let delta: number;
  if (player.age <= 24) delta = (player.potential - player.overall) * rng.range(0.18, 0.5) + rng.normal(0.6, 1.2);
  else if (player.age <= 28) delta = (player.potential - player.overall) * rng.range(0.05, 0.22) + rng.normal(0.2, 1.4);
  else if (player.age <= 31) delta = rng.normal(-0.6, 1.4);
  else delta = -(player.age - 30) * rng.range(0.35, 1.1) + rng.normal(0, 1);
  const experience = Math.min(1, (player.developmentSeconds ?? player.stats.secs) / (82 * 24 * 60));
  if (delta > 0 && player.age <= 28) delta *= 0.85 + 0.3 * experience;
  const days = player.training?.days ?? {};
  const total = Object.values(days).reduce((n, v) => n + v, 0);
  const focus = [...TRAINING_FOCI].sort((a, b) => (days[b] ?? 0) - (days[a] ?? 0))[0];
  for (const key of Object.keys(attrs) as AttributeKey[]) {
    const bias = ['speed', 'stamina', 'vertical'].includes(key) ? -0.5 : ['iq', 'three'].includes(key) ? 0.4 : 0;
    let adjustment = 0;
    for (const f of TRAINING_FOCI) if (f !== 'balanced') {
      const exposure = Math.min(1, Math.max(0, days[f] ?? 0) / Math.max(1, seasonDays));
      // Bounded redistribution, smaller near the ceiling and in older bodies. No effect from a late click.
      const headroom = Math.max(0, Math.min(1, (player.potential - player.overall + 5) / 25));
      const age = Math.max(0.15, Math.min(1, (38 - player.age) / 14));
      adjustment += exposure * (TRAINING_ATTRIBUTES[f].includes(key) ? 1.8 * headroom * age * Math.max(0, (100 - attrs[key]) / 60) : -0.18);
    }
    player.attrs[key] = clampRating(attrs[key] + delta + bias + rng.normal(0, 1.2) + adjustment);
  }
  player.overall = computeOverall(player.attrs, player.pos);
  player.potential = clampRating(Math.max(player.overall, player.age <= 24 ? player.potential : player.potential - rng.range(0, 1.5)));
  if (player.training) player.training.days = {};
  return { id: player.id, name: playerName(player), pos: player.pos, age: player.age, overall: player.overall, before, after: player.overall,
    focus, trainingDays: Math.round(total * 10) / 10, minutes: Math.round((player.developmentSeconds ?? player.stats.secs) / 60),
    changes: Object.fromEntries((Object.keys(attrs) as AttributeKey[]).map(key => [key, player.attrs[key] - attrs[key]])),
  };
}
