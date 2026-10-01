import type { AttributeKey, Attributes, Player, Position } from './types';

/**
 * Poids servant à condenser les 16 attributs en une note globale.
 * Chaque poste valorise des qualités différentes : un meneur vit de sa passe,
 * un pivot de sa présence dans la raquette.
 */
const WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  PG: {
    inside: 5, midRange: 7, three: 11, freeThrow: 3, passing: 15, handling: 13,
    offReb: 1, defReb: 3, interiorDef: 2, perimeterDef: 8, steal: 7, block: 1,
    speed: 9, strength: 2, stamina: 5, iq: 8,
  },
  SG: {
    inside: 7, midRange: 10, three: 14, freeThrow: 4, passing: 8, handling: 9,
    offReb: 2, defReb: 4, interiorDef: 2, perimeterDef: 10, steal: 6, block: 2,
    speed: 8, strength: 3, stamina: 5, iq: 6,
  },
  SF: {
    inside: 10, midRange: 10, three: 12, freeThrow: 3, passing: 7, handling: 7,
    offReb: 4, defReb: 6, interiorDef: 5, perimeterDef: 9, steal: 5, block: 3,
    speed: 7, strength: 5, stamina: 5, iq: 6,
  },
  PF: {
    inside: 14, midRange: 8, three: 8, freeThrow: 3, passing: 5, handling: 4,
    offReb: 8, defReb: 10, interiorDef: 10, perimeterDef: 5, steal: 3, block: 7,
    speed: 4, strength: 8, stamina: 5, iq: 5,
  },
  C: {
    inside: 17, midRange: 5, three: 4, freeThrow: 2, passing: 4, handling: 3,
    offReb: 10, defReb: 12, interiorDef: 14, perimeterDef: 3, steal: 2, block: 11,
    speed: 3, strength: 10, stamina: 4, iq: 5,
  },
};

export function computeOverall(attrs: Attributes, pos: Position): number {
  const weights = WEIGHTS[pos];
  let sum = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(weights) as [AttributeKey, number][]) {
    sum += attrs[key] * weight;
    total += weight;
  }
  const raw = sum / total;
  // On étire légèrement l'échelle : les moyennes brutes se tassent autour de 65-75,
  // alors qu'on veut retrouver la plage 45-99 habituelle des jeux de gestion.
  const stretched = 66 + (raw - 70) * 1.08;
  return clampRating(Math.round(stretched));
}

export function clampRating(value: number): number {
  return Math.max(25, Math.min(99, Math.round(value)));
}

export function refreshOverall(player: Player): void {
  player.overall = computeOverall(player.attrs, player.pos);
}

export const POSITION_INDEX: Record<Position, number> = { PG: 1, SG: 2, SF: 3, PF: 4, C: 5 };

/** Note offensive synthétique, utilisée pour l'affichage et l'IA d'équipe. */
export function offenseRating(p: Player): number {
  const a = p.attrs;
  return clampRating(
    (a.inside * 2 + a.midRange * 2 + a.three * 2.5 + a.passing * 1.5 + a.handling * 1.2 + a.freeThrow * 0.8) / 10,
  );
}

/** Note défensive synthétique. */
export function defenseRating(p: Player): number {
  const a = p.attrs;
  return clampRating(
    (a.interiorDef * 2 + a.perimeterDef * 2 + a.defReb * 1.6 + a.steal * 1.2 + a.block * 1.2 + a.strength * 1) / 9,
  );
}

/** Force d'une équipe : moyenne pondérée des 9 meilleurs joueurs. */
export function teamStrength(players: Player[]): number {
  const sorted = [...players].sort((a, b) => b.overall - a.overall).slice(0, 9);
  if (sorted.length === 0) return 50;
  const weights = [1, 0.95, 0.9, 0.85, 0.8, 0.6, 0.45, 0.3, 0.2];
  let sum = 0;
  let total = 0;
  sorted.forEach((p, i) => {
    const w = weights[i] ?? 0.15;
    sum += p.overall * w;
    total += w;
  });
  return sum / total;
}
