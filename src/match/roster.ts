import { pickLineup } from '../engine/coach';
import { POSITION_INDEX } from '../engine/ratings';
import type { Player, Team } from '../engine/types';

/** Rôles du demi-terrain, selon le nombre de joueurs par équipe : arrière, ailier, intérieur. */
const SLOTS: Readonly<Record<number, readonly Slot[]>> = {
  1: ['guard'],
  2: ['guard', 'big'],
  3: ['guard', 'wing', 'big'],
};

type Slot = 'guard' | 'wing' | 'big';

const FITS: Record<Slot, readonly Player['pos'][]> = {
  guard: ['PG', 'SG'],
  wing: ['SF', 'SG', 'PF'],
  big: ['C', 'PF'],
};

/**
 * Les `perTeam` joueurs d'une équipe pour le demi-terrain : le meilleur à chaque rôle (arrière,
 * ailier, intérieur), blessés exclus ; s'il manque un poste, le meilleur restant.
 */
export function halfCourtRoster(players: readonly Player[], teamId: string, perTeam: number): Player[] {
  const pool = players.filter((p) => p.teamId === teamId && p.injuryGames === 0).sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const picked: Player[] = [];
  for (const slot of SLOTS[perTeam] ?? SLOTS[3]) {
    const pick = pool.find((p) => !picked.includes(p) && FITS[slot].includes(p.pos)) ?? pool.find((p) => !picked.includes(p));
    if (pick) picked.push(pick);
  }
  return picked;
}

/**
 * Le cinq majeur d'une équipe pour le terrain entier, comme la simulation : les cinq premiers
 * valides de la rotation, rangés par poste (meneur … pivot) par `pickLineup`. S'il en manque, les
 * meilleurs joueurs valides de l'équipe complètent.
 */
export function fullCourtRoster(players: Readonly<Record<string, Player>>, team: Team): Player[] {
  const healthy = (p: Player | undefined): p is Player => !!p && p.injuryGames === 0;
  const rotation = team.rotation.map((id) => players[id]).filter(healthy);
  const extras = Object.values(players)
    .filter((p) => p.teamId === team.id && healthy(p) && !rotation.includes(p))
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const five = [...rotation, ...extras].slice(0, 5);
  const candidates = five.map((player) => ({ id: player.id, overall: player.overall, posIndex: POSITION_INDEX[player.pos], player }));
  return pickLineup(candidates, (c) => c.overall).map((c) => c.player);
}
