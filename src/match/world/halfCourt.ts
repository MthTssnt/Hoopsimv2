import { isThreePoint, type Court, type Hoop, type Vec3 } from '../physics/court';

/**
 * Règles du demi-terrain, de 1 contre 1 à 3 contre 3 (décisions de Matheo, valeurs réglables) :
 * un seul panier, ressortie derrière l'arc, panier non valable, premier à N.
 */
export const HALF_COURT = {
  /** Premier à ce nombre de points, selon le nombre de joueurs par équipe. */
  target: { 1: 11, 2: 21, 3: 21 } as Readonly<Record<number, number>>,
  /** Pause de fin de partie avant la reprise à 0-0 (s). */
  endPause: 3,
  /** Départ : attaquants juste derrière l'arc (m au-delà de la ligne), chaque défenseur entre son attaquant et le cercle. */
  startBeyondArc: 0.6,
  startGap: 1.1,
  /** Places de départ des attaquants autour de l'arc (degrés de part et d'autre de l'axe du cercle). */
  startAngles: { 1: [0], 2: [-35, 35], 3: [0, -58, 58] } as Readonly<Record<number, readonly number[]>>,
} as const;

/** Cible par défaut pour `perTeam` joueurs par équipe. */
export function defaultTarget(perTeam: number): number {
  return HALF_COURT.target[perTeam] ?? HALF_COURT.target[3];
}

/** État du demi-terrain : ressorties dues (par équipe), vainqueur, pauses. */
export interface HalfCourtState {
  target: number;
  /** L'équipe doit ressortir le ballon derrière la ligne à 3 pts avant de pouvoir marquer. */
  mustClear: boolean[];
  /** Dernière équipe à avoir tenu le ballon (rebond offensif : pas de ressortie). */
  lastTeam: number | null;
  /** Équipe gagnante. */
  winner: number | null;
  /** Temps de pause restant après une victoire (s). */
  pause: number;
  /** Faute puis tir raté : ballon mort, puis remise en jeu au tireur en haut de la raquette. */
  restart: { shooter: number; pause: number } | null;
}

export function newHalfCourt(teams: number, target: number): HalfCourtState {
  return { target, mustClear: Array.from({ length: teams }, () => false), lastTeam: 0, winner: null, pause: 0, restart: null };
}

/** Le ballon est-il ressorti (tenu derrière la ligne à 3 pts) ? */
export function isCleared(court: Court, hoop: Hoop, pos: Vec3): boolean {
  return isThreePoint(court, hoop, pos.x, pos.y);
}

/**
 * Doit-on ressortir après avoir ramassé le ballon ? Oui après un panier, ou si l'on récupère le
 * ballon de l'autre équipe (rebond défensif) ; non sur un rebond de son équipe.
 */
export function mustClearAfterPickup(pickerTeam: number, lastTeam: number | null, afterBasket: boolean): boolean {
  return afterBasket || lastTeam !== pickerTeam;
}

/**
 * Positions de départ : les attaquants en haut et sur les ailes, juste derrière l'arc (le premier
 * au centre, avec le ballon), chaque défenseur entre son attaquant et le cercle.
 */
export function startPositions(court: Court, hoop: Hoop, perTeam = 1): { attackers: Vec3[]; defenders: Vec3[] } {
  const { rim, toCourt } = hoop;
  const radius = court.threeArc + HALF_COURT.startBeyondArc;
  const angles = HALF_COURT.startAngles[perTeam] ?? HALF_COURT.startAngles[3];
  const attackers = angles.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: rim.x + toCourt * Math.cos(a) * radius, y: rim.y + Math.sin(a) * radius, z: 0 };
  });
  const defenders = attackers.map((p) => {
    const dx = rim.x - p.x;
    const dy = rim.y - p.y;
    const d = Math.hypot(dx, dy);
    return { x: p.x + (dx / d) * HALF_COURT.startGap, y: p.y + (dy / d) * HALF_COURT.startGap, z: 0 };
  });
  return { attackers, defenders };
}
