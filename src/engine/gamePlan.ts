import { POSITION_INDEX } from './ratings';
import { minuteTargets, pickLineup, ROTATION_SIZE } from './coach';
import type { Player, Team } from './types';

export const OFFENSE_STYLES = ['balanced', 'paceSpace', 'motion', 'pickRoll', 'insideOut', 'isolation'] as const;
export const DEFENSE_STYLES = ['man', 'switch', 'drop', 'zone23', 'press'] as const;
export const PLAYER_ROLES = ['primaryCreator', 'secondaryCreator', 'shooter', 'slasher', 'rollMan', 'postScorer', 'defensiveStopper', 'rebounder', 'sixthMan', 'rolePlayer'] as const;
export type OffenseStyle = typeof OFFENSE_STYLES[number];
export type DefenseStyle = typeof DEFENSE_STYLES[number];
export type PlayerRole = typeof PLAYER_ROLES[number];
export const PLAYER_ROLE_LABELS: Record<PlayerRole, string> = { primaryCreator: 'créateur principal', secondaryCreator: 'créateur secondaire', shooter: 'tireur', slasher: 'pénétrateur', rollMan: 'intérieur sur écran', postScorer: 'scoreur au poste', defensiveStopper: 'stoppeur', rebounder: 'rebondeur', sixthMan: 'sixième homme', rolePlayer: 'équipier' };
export type Five = [string, string, string, string, string];
export interface RotationPlan {
  starterIds: Five;
  minutesByPlayerId: Record<string, number>;
  closingFiveIds?: Five;
  autoSubstitutions: boolean;
  preserveStartersInClutch: boolean;
  foulTroubleProtection: boolean;
}
export interface GamePlan {
  version: 1;
  name: string;
  offense: OffenseStyle;
  defense: DefenseStyle;
  pace: number;
  threePointFocus: number;
  rimPressure: number;
  offensiveReboundAggression: number;
  defensiveHelp: number;
  defensivePressure: number;
  substitutionAggression: number;
  rolesByPlayerId: Record<string, PlayerRole>;
  playbook: { playId: string; weight: number }[];
  rotation: RotationPlan;
}
const SLIDERS = ['pace', 'threePointFocus', 'rimPressure', 'offensiveReboundAggression', 'defensiveHelp', 'defensivePressure', 'substitutionAggression'] as const;
export const PLAY_IDS = ['default', 'fiveOut', 'horns', 'highPickRoll', 'isolation', 'postEntry'] as const;

export function eligibleIds(team: Pick<Team, 'id' | 'roster'>, players: Readonly<Record<string, Player>>): string[] {
  return [...new Set(team.roster)].filter(id => players[id]?.teamId === team.id && players[id].injuryGames === 0);
}

/** Bounded proportional distribution, deterministic, in minutes equivalent to a 48-minute game. */
export function distributeMinutes(ids: readonly string[], weights: Readonly<Record<string, number>>, total = 240): Record<string, number> {
  if (!Number.isFinite(total) || total < 0 || ids.length * 48 < total) throw new Error('Minutes impossibles à répartir : chaque joueur est limité à 48 minutes.');
  const result = Object.fromEntries(ids.map(id => [id, 0]));
  let remaining = total;
  let pool = [...ids];
  while (pool.length) {
    const weight = (id: string) => Number.isFinite(weights[id]) && weights[id] > 0 ? weights[id] : 1;
    const sum = pool.reduce((n, id) => n + weight(id), 0);
    const capped = pool.filter(id => remaining * weight(id) / sum > 48);
    if (!capped.length) {
      for (const id of pool) result[id] = remaining * weight(id) / sum;
      break;
    }
    for (const id of capped) { result[id] = 48; remaining -= 48; }
    pool = pool.filter(id => !capped.includes(id));
  }
  if (!Number.isInteger(total)) return result;
  // Integer defaults are easy to edit; largest remainder preserves exactly 240.
  const fractions = ids.map(id => ({ id, fraction: result[id] - Math.floor(result[id]) }));
  for (const id of ids) result[id] = Math.floor(result[id]);
  let rest = total - Object.values(result).reduce((a, b) => a + b, 0);
  for (const { id } of fractions.sort((a, b) => b.fraction - a.fraction)) {
    if (rest-- <= 0) break;
    result[id]++;
  }
  return result;
}

export function defaultGamePlan(team: Team, players: Readonly<Record<string, Player>>): GamePlan {
  const eligible = eligibleIds(team, players);
  const existing = [...new Set(team.rotation.filter(id => eligible.includes(id)))].slice(0, ROTATION_SIZE);
  const ids = existing.length >= 5 ? existing : [...new Set([...existing, ...eligible])].slice(0, ROTATION_SIZE);
  const targets = minuteTargets(ids.length);
  return {
    version: 1, name: 'Équilibré', offense: 'balanced', defense: 'man',
    pace: 50, threePointFocus: 50, rimPressure: 50, offensiveReboundAggression: 50,
    defensiveHelp: 50, defensivePressure: 50, substitutionAggression: 50,
    rolesByPlayerId: Object.fromEntries(ids.map(id => [id, 'rolePlayer'])),
    playbook: [{ playId: 'default', weight: 1 }],
    rotation: {
      starterIds: pickLineup(ids.slice(0, 5).map(id => ({ id, overall: players[id].overall, posIndex: POSITION_INDEX[players[id].pos] })), p => p.overall).map(p => p.id) as Five,
      minutesByPlayerId: distributeMinutes(ids, Object.fromEntries(ids.map((id, i) => [id, targets[i]]))),
      autoSubstitutions: true, preserveStartersInClutch: false, foulTroubleProtection: true,
    },
  };
}

/** Treat saves as untrusted input. No mutation and no partial acceptance of invalid commands. */
export function validateGamePlan(input: unknown, team: Pick<Team, 'id' | 'roster'>, players: Readonly<Record<string, Player>>): string[] {
  if (!input || typeof input !== 'object') return ['Plan absent ou illisible.'];
  const p = input as GamePlan;
  const errors: string[] = [];
  if (p.version !== 1 || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) errors.push('Nom ou version du plan invalide.');
  if (p.defense === 'zone23' || p.defense === 'press') errors.push('Cette défense collective n’est pas encore disponible.');
  if (!OFFENSE_STYLES.includes(p.offense) || !DEFENSE_STYLES.includes(p.defense)) errors.push('Stratégie inconnue.');
  if (SLIDERS.some(k => !Number.isFinite(p[k]) || p[k] < 0 || p[k] > 100)) errors.push('Les paramètres doivent être finis et compris entre 0 et 100.');
  if (!Array.isArray(p.playbook) || !p.playbook.length || p.playbook.filter(x => x?.weight > 0).length > 5 || p.playbook.some(x => !x || !PLAY_IDS.includes(x.playId as typeof PLAY_IDS[number]) || !Number.isFinite(x.weight) || x.weight < 0) || !p.playbook.some(x => x?.weight > 0) || new Set(p.playbook.map(x => x?.playId)).size !== p.playbook.length) errors.push('Playbook invalide.');
  const eligible = new Set(eligibleIds(team, players));
  const r = p.rotation;
  if (!r || typeof r !== 'object') return [...errors, 'Rotation absente.'];
  const minutes = r.minutesByPlayerId;
  if (!minutes || typeof minutes !== 'object' || Array.isArray(minutes)) return [...errors, 'Minutes absentes.'];
  const ids = Object.keys(minutes);
  if (ids.length < 5 || ids.length > ROTATION_SIZE || ids.some(id => !eligible.has(id) || !Number.isFinite(minutes[id]) || minutes[id] < 0 || minutes[id] > 48)) errors.push('Rotation : 5 à 10 joueurs aptes de l’équipe, entre 0 et 48 minutes chacun.');
  if (Math.abs(Object.values(minutes).reduce((a, b) => a + b, 0) - 240) > 1e-6) errors.push('Le total doit être de 240 minutes.');
  const validFive = (five: unknown): boolean => Array.isArray(five) && five.length === 5 && new Set(five).size === 5 && five.every(id => eligible.has(id) && minutes[id] > 0);
  if (!validFive(r.starterIds)) errors.push('Choisissez cinq titulaires distincts et aptes avec des minutes.');
  if (r.closingFiveIds !== undefined && !validFive(r.closingFiveIds)) errors.push('Cinq de fin de match invalide.');
  if (['autoSubstitutions', 'preserveStartersInClutch', 'foulTroubleProtection'].some(k => typeof r[k as keyof RotationPlan] !== 'boolean')) errors.push('Options de rotation invalides.');
  if (!p.rolesByPlayerId || typeof p.rolesByPlayerId !== 'object' || Object.entries(p.rolesByPlayerId).some(([id, role]) => !ids.includes(id) || !PLAYER_ROLES.includes(role))) errors.push('Rôles invalides.');
  return errors;
}

export function planRotationIds(plan: GamePlan): string[] {
  const ids = Object.keys(plan.rotation.minutesByPlayerId);
  // Keep legacy ranking stable; explicit position slots are carried separately to both coaches.
  return [...ids.filter(id => plan.rotation.starterIds.includes(id)), ...ids.filter(id => !plan.rotation.starterIds.includes(id))];
}

/** Preserve valid choices; repair only ineligible players after injury, roster changes or save import. */
function repairPlan(team: Team, players: Readonly<Record<string, Player>>): string[] {
  if (team.gamePlan && !validateGamePlan(team.gamePlan, team, players).length) {
    team.rotation = planRotationIds(team.gamePlan);
    return [];
  }
  if (eligibleIds(team, players).length < 5) return ['Moins de cinq joueurs aptes : plan inchangé, match GM indisponible.'];
  const previous = team.gamePlan;
  const fallback = defaultGamePlan(team, players); // Fails recoverably if fewer than five healthy players.
  if (previous?.rotation?.minutesByPlayerId) {
    const ids = Object.keys(fallback.rotation.minutesByPlayerId);
    const kept = Array.isArray(previous.rotation.starterIds) ? previous.rotation.starterIds.filter(id => ids.includes(id)) : [];
    fallback.rotation.starterIds = [...new Set([...kept, ...ids])].slice(0, 5) as Five;
    fallback.rotation.minutesByPlayerId = distributeMinutes(ids, previous.rotation.minutesByPlayerId);
    fallback.rolesByPlayerId = Object.fromEntries(ids.map(id => [id, PLAYER_ROLES.includes(previous.rolesByPlayerId?.[id]) ? previous.rolesByPlayerId[id] : 'rolePlayer']));
    // Keep tactical settings only if the repaired candidate is valid.
    const rotation = { ...previous.rotation, starterIds: fallback.rotation.starterIds, minutesByPlayerId: fallback.rotation.minutesByPlayerId };
    if (rotation.closingFiveIds?.some(id => !ids.includes(id))) delete rotation.closingFiveIds;
    const candidate = { ...previous, rotation, rolesByPlayerId: fallback.rolesByPlayerId };
    if (!validateGamePlan(candidate, team, players).length) team.gamePlan = candidate;
    else team.gamePlan = fallback;
  } else team.gamePlan = fallback;
  team.rotation = planRotationIds(team.gamePlan);
  return previous ? ['Plan recomposé : joueurs indisponibles ou données invalides.'] : [];
}

/** Role semantics shared by the fast shooter choice and the physical AI's shot/passing decisions.
 * Never changes the persisted player or overall rating. */
export function coachedPlayer(player: Player, plan?: GamePlan): Player {
  const role = plan?.rolesByPlayerId[player.id];
  if (!role || role === 'rolePlayer') return player;
  const t = { ...player.tendencies };
  switch (role) {
    case 'primaryCreator': t.usage *= 1.25; break;
    case 'secondaryCreator': t.usage *= 1.1; break;
    case 'shooter': t.three *= 1.5; break;
    case 'slasher': t.rim *= 1.5; break;
    case 'rollMan': t.rim *= 1.4; t.three *= 0.5; break;
    case 'postScorer': t.rim *= 1.3; t.mid *= 1.2; break;
    case 'defensiveStopper': t.usage *= 0.8; break;
    case 'rebounder': t.usage *= 0.8; t.rim *= 1.2; break;
    case 'sixthMan': t.usage *= 1.15; break;
  }
  const sum = t.rim + t.mid + t.three;
  if (sum > 0) { t.rim /= sum; t.mid /= sum; t.three /= sum; }
  return { ...player, tendencies: t };
}

export type CoachingPreset = 'auto' | 'development' | 'competitive' | 'smallBall' | 'defensive';
export function coachingPreset(team: Team, players: Readonly<Record<string, Player>>, preset: CoachingPreset): GamePlan {
  const pool = eligibleIds(team, players).map(id => players[id]);
  const score = (p: Player) => {
    switch (preset) {
      case 'development': return p.overall + (p.potential - p.overall) * 0.5 + Math.max(0, 26 - p.age) * 2;
      case 'smallBall': return p.overall * 0.5 + p.attrs.speed * 0.25 + p.attrs.three * 0.25;
      case 'defensive': return p.overall * 0.4 + p.attrs.perimeterDef * 0.3 + p.attrs.interiorDef * 0.3;
      default: return p.overall;
    }
  };
  const starters = pickLineup(pool.map(p => ({ id: p.id, overall: score(p), posIndex: POSITION_INDEX[p.pos] })), p => p.overall);
  const ordered = [...starters.map(p => players[p.id]), ...pool.filter(p => !starters.some(s => s.id === p.id)).sort((a, b) => score(b) - score(a))];
  // The five positions remain explicit; the recommendation describes out-of-position costs in the UI.
  const ids = ordered.slice(0, ROTATION_SIZE).map(p => p.id);
  const plan = defaultGamePlan({ ...team, rotation: ids }, players);
  plan.name = { auto: 'Automatique', development: 'Développement', competitive: 'Compétitif', smallBall: 'Small Ball', defensive: 'Défensif' }[preset];
  const weights = Object.fromEntries(ids.map((id, i) => [id, (minuteTargets(ids.length)[i] / 60) * (preset === 'competitive' && i < 5 ? 1.15 : 1)]));
  plan.rotation.minutesByPlayerId = distributeMinutes(ids, weights);
  return plan;
}

export function repairGamePlan(team: Team, players: Readonly<Record<string, Player>>): string[] {
  const warnings = repairPlan(team, players);
  if (warnings.length) team.coachingWarnings = warnings;
  return warnings;
}

/** Preserve the explicitly edited targets and distribute only the unassigned remainder. */
export function distributeRemaining(minutes: Record<string, number>, lockedIds: readonly string[]): Record<string, number> {
  const locked = new Set(lockedIds);
  const free = Object.keys(minutes).filter(id => !locked.has(id));
  let remaining = 240;
  for (const id of locked) {
    if (!(id in minutes) || !Number.isFinite(minutes[id]) || minutes[id] < 0 || minutes[id] > 48) throw new Error('Corrigez les minutes saisies avant de répartir le reste.');
    remaining -= minutes[id];
  }
  return { ...minutes, ...distributeMinutes(free, minutes, remaining) };
}
