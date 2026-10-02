import { isThreePoint, type Court, type Hoop, type Vec3 } from '../physics/court';

/** Règles du 1 contre 1 de test (décisions de Matheo, valeurs réglables). */
export const ONE_ON_ONE = {
  /** Premier à ce nombre de points. */
  target: 11,
  /** Pause de fin de partie avant la reprise à 0-0 (s). */
  endPause: 3,
  /** Départ : l'attaquant juste derrière l'arc (m au-delà de la ligne), le défenseur entre lui et le cercle. */
  startBeyondArc: 0.6,
  startGap: 1.1,
} as const;

/** État du 1 contre 1 : ressorties dues, vainqueur, pause de fin. */
export interface OneOnOneState {
  target: number;
  /** Le joueur doit ressortir le ballon derrière la ligne à 3 pts avant de pouvoir marquer. */
  mustClear: boolean[];
  /** Dernier joueur à avoir tenu le ballon (rebond offensif : pas de ressortie). */
  lastHolder: number | null;
  winner: number | null;
  /** Temps de pause restant après une victoire (s). */
  pause: number;
}

export function newOneOnOne(players: number, target: number = ONE_ON_ONE.target): OneOnOneState {
  return { target, mustClear: Array.from({ length: players }, () => false), lastHolder: 0, winner: null, pause: 0 };
}

/** Le ballon est-il ressorti (tenu derrière la ligne à 3 pts) ? */
export function isCleared(court: Court, hoop: Hoop, pos: Vec3): boolean {
  return isThreePoint(court, hoop, pos.x, pos.y);
}

/**
 * Doit-on ressortir après avoir ramassé le ballon ? Oui après un panier, ou si l'on récupère le
 * ballon d'un autre (rebond défensif) ; non sur son propre rebond.
 */
export function mustClearAfterPickup(picker: number, lastHolder: number | null, afterBasket: boolean): boolean {
  return afterBasket || lastHolder !== picker;
}

/** Positions de départ : attaquant en haut de la raquette derrière l'arc, défenseur entre lui et le cercle. */
export function startPositions(court: Court, hoop: Hoop): { attacker: Vec3; defender: Vec3 } {
  const { rim, toCourt } = hoop;
  const ax = rim.x + toCourt * (court.threeArc + ONE_ON_ONE.startBeyondArc);
  return {
    attacker: { x: ax, y: rim.y, z: 0 },
    defender: { x: ax - toCourt * ONE_ON_ONE.startGap, y: rim.y, z: 0 },
  };
}
