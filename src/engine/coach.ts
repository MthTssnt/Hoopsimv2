import { POSITION_INDEX } from './ratings';
import type { League, Player, Team } from './types';

/** Pénalité de note appliquée pour chaque cran d'écart avec le poste naturel. */
const POSITION_PENALTY = 6.5;

/** Taille visée d'une rotation. */
export const ROTATION_SIZE = 10;

/**
 * Minutes visées par joueur, du premier au dernier de la rotation.
 * Elles sont ensuite normalisées pour retomber sur les 240 minutes d'un match.
 */
export const MINUTE_TARGETS = [34, 32, 30, 28, 26, 23, 20, 17, 14, 11, 8, 6];

export interface LineupCandidate {
  id: string;
  overall: number;
  posIndex: number;
}

/**
 * Choisit les cinq joueurs sur le terrain.
 * On évalue toutes les paires (joueur, poste) et on attribue gloutonnement
 * les meilleures : ça évite qu'un pivot dominant soit aligné meneur juste
 * parce qu'il a la meilleure note.
 */
export function pickLineup<T extends LineupCandidate>(candidates: T[], valueFn: (c: T) => number): T[] {
  if (candidates.length < 5) return [...candidates];

  const pairs: { player: T; slot: number; score: number }[] = [];
  for (const c of candidates) {
    const value = valueFn(c);
    for (let slot = 1; slot <= 5; slot++) {
      pairs.push({ player: c, slot, score: value - Math.abs(c.posIndex - slot) * POSITION_PENALTY });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const bySlot = new Map<number, T>();
  const usedPlayers = new Set<string>();
  for (const pair of pairs) {
    if (bySlot.size === 5) break;
    if (bySlot.has(pair.slot) || usedPlayers.has(pair.player.id)) continue;
    bySlot.set(pair.slot, pair.player);
    usedPlayers.add(pair.player.id);
  }

  return [1, 2, 3, 4, 5].map((slot) => bySlot.get(slot)!).filter(Boolean);
}

/**
 * Répartit les 240 minutes d'un match sur les joueurs de la rotation,
 * du meilleur au moins bon. Renvoie des secondes.
 */
export function minuteTargets(count: number): number[] {
  const base = MINUTE_TARGETS.slice(0, Math.max(5, count));
  while (base.length < count) base.push(4);
  const sum = base.reduce((s, v) => s + v, 0);
  const scale = (5 * 48) / sum;
  return base.map((m) => m * scale * 60);
}

function toCandidate(p: Player): LineupCandidate {
  return { id: p.id, overall: p.overall, posIndex: POSITION_INDEX[p.pos] };
}

/** Rotation par défaut : un cinq majeur cohérent puis les meilleurs remplaçants. */
export function defaultRotation(team: Team, players: Record<string, Player>): string[] {
  const healthy = team.roster.map((id) => players[id]).filter((p) => p && p.injuryGames === 0);
  const pool = healthy.length >= 5 ? healthy : team.roster.map((id) => players[id]).filter(Boolean);
  const starters = pickLineup(pool.map(toCandidate), (c) => c.overall);
  const starterIds = new Set(starters.map((s) => s.id));
  const bench = pool
    .filter((p) => !starterIds.has(p.id))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, ROTATION_SIZE - 5);
  // L'ordre de la rotation détermine les minutes : on place les titulaires
  // du meilleur au moins bon, puis le banc.
  const orderedStarters = [...starters].sort((a, b) => b.overall - a.overall);
  return [...orderedStarters.map((s) => s.id), ...bench.map((p) => p.id)];
}

/** Recalcule les rotations de toutes les équipes (en préservant celle du joueur). */
export function refreshRotations(league: League, skipUserTeam = false): void {
  for (const team of league.teams) {
    if (skipUserTeam && team.id === league.userTeamId && team.rotation.length > 0) {
      // On garde le choix du coach humain, mais on retire les blessés
      // et on complète la rotation avec les meilleurs joueurs disponibles.
      const valid = team.rotation.filter((id) => {
        const p = league.players[id];
        return p && p.teamId === team.id && p.injuryGames === 0;
      });
      const inRotation = new Set(valid);
      const fillers = team.roster
        .map((id) => league.players[id])
        .filter((p) => p && p.injuryGames === 0 && !inRotation.has(p.id))
        .sort((a, b) => b.overall - a.overall);
      while (valid.length < ROTATION_SIZE && fillers.length > 0) valid.push(fillers.shift()!.id);
      if (valid.length >= 5) {
        team.rotation = valid;
        continue;
      }
    }
    team.rotation = defaultRotation(team, league.players);
  }
}
