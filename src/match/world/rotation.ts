import {
  drainEnergy,
  energyFactor,
  rotationTargets,
  seatLineup,
  startingEnergy,
  type RotationMember,
} from '../../engine/rotation';
import { POSITION_INDEX } from '../../engine/ratings';
import { emptyStatLine, type Attributes, type Player, type StatLine } from '../../engine/types';
import { FULL_COURT, periodLength } from './fullCourt';

/**
 * Effectifs du match joué sur terrain entier : la rotation de chaque équipe, l'énergie et la ligne
 * de stats de chaque joueur, les fautes d'équipe. Les règles (énergie, coach) sont celles de la
 * simulation (`engine/rotation.ts`), ramenées à la durée du match.
 */

/** Durée de référence d'un match (s) : les coefficients de la simulation valent pour 4 × 12 min. */
const REFERENCE_MATCH = 4 * 12 * 60;

/** Un joueur de la rotation pendant le match. */
export interface MatchMember extends RotationMember {
  /** Fiche de la ligue (notes brutes, jamais modifiée). */
  player: Player;
  team: number;
  starter: boolean;
  /** Corps du monde qu'il occupe sur le terrain, ou null sur le banc. */
  body: number | null;
  /** Ligne de stats du match (box score en direct). */
  line: StatLine;
}

/** Une équipe pendant le match : sa rotation, ses fautes d'équipe de la période. */
export interface Squad {
  team: number;
  members: MatchMember[];
  /** Fautes d'équipe de la période en cours. */
  fouls: number;
  /** Temps de chrono depuis le dernier contrôle du coach (s). */
  sinceSub: number;
}

/** Équipe `team` à partir de sa rotation (dans l'ordre du coach) : énergie de départ, minutes visées, stats à 0. */
export function createSquad(team: number, rotation: readonly Player[]): Squad {
  const targets = rotationTargets(rotation);
  const members = rotation.map(
    (player): MatchMember => ({
      id: player.id,
      overall: player.overall,
      posIndex: POSITION_INDEX[player.pos],
      energy: startingEnergy(player),
      onCourt: false,
      fouledOut: false,
      targetSecs: targets.get(player.id) ?? 0,
      line: emptyStatLine(),
      player,
      team,
      starter: false,
      body: null,
    }),
  );
  return { team, members, fouls: 0, sinceSub: 0 };
}

/** Accélération d'un match de `quarterMinutes` par quart-temps par rapport à un match de 48 min (×4 pour 3 min). */
export function matchTimeScale(quarterMinutes: number): number {
  return REFERENCE_MATCH / (FULL_COURT.periods * quarterMinutes * 60);
}

/**
 * Part du match écoulée (0 → 1 à la fin du temps réglementaire, au-delà en prolongation, chaque
 * prolongation valant 5/12 de quart-temps), comme `progress` dans la simulation.
 */
export function matchProgress(period: number, clock: number, quarterMinutes: number): number {
  const length = periodLength(quarterMinutes, period);
  const done = Math.min(1, Math.max(0, (length - clock) / length));
  const quarters = FULL_COURT.periods;
  if (period <= quarters) return (period - 1 + done) / quarters;
  return (quarters + (period - quarters - 1 + done) * FULL_COURT.overtimeRatio) / quarters;
}

/** Notes que la fatigue n'entame pas : les lancers francs (comme en simulation) et l'endurance elle-même. */
const UNTIRED: readonly (keyof Attributes)[] = ['freeThrow', 'stamina'];

/** Le joueur tel qu'il joue avec cette énergie : notes × (0,8 + 0,2 × énergie / 100), sauf lancers francs. */
export function tiredAthlete(player: Player, energy: number): Player {
  const k = energyFactor(energy);
  const attrs = { ...player.attrs };
  for (const key of Object.keys(attrs) as (keyof Attributes)[]) {
    if (!UNTIRED.includes(key)) attrs[key] = player.attrs[key] * k;
  }
  return { ...player, attrs };
}

/**
 * `seconds` de chrono écoulées : ceux qui sont sur le terrain jouent (minutes) et se fatiguent, ceux
 * du banc récupèrent, à l'échelle `scale` du match.
 */
export function tickSquad(squad: Squad, seconds: number, scale: number): void {
  for (const m of squad.members) {
    if (m.body !== null) m.line.secs += seconds;
    m.energy = drainEnergy(m.energy, m.player.attrs.stamina, seconds * scale, m.body !== null);
  }
  squad.sinceSub += seconds;
}

/** Un joueur qui entre : il prend le corps `body`. */
export interface SubIn {
  member: MatchMember;
  body: number;
  /** Joueur qui sort de ce corps. */
  out: MatchMember | null;
}

/**
 * Applique le cinq `five` (rangé par poste, meneur d'abord) choisi par le coach. Ceux qui restent
 * gardent leur corps ; un remplaçant prend le corps (et donc la place) de celui qui sort à son poste,
 * sinon d'un autre sortant. `slots` donne les corps de l'équipe rangés par poste avant le changement ;
 * renvoie les corps rangés par poste après, et les entrées.
 */
export function substitute(squad: Squad, five: readonly MatchMember[], slots: readonly number[]): { lineup: number[]; entering: SubIn[] } {
  const occupant = (body: number) => squad.members.find((m) => m.body === body) ?? null;
  const freed = new Map<number, MatchMember | null>();
  slots.forEach((body) => {
    const m = occupant(body);
    if (!m || !five.includes(m)) freed.set(body, m);
  });
  for (const [, m] of freed) if (m) m.body = null;
  const entering: SubIn[] = [];
  five.forEach((m, k) => {
    if (m.body !== null) return;
    const atSlot = slots[k];
    const body = atSlot !== undefined && freed.has(atSlot) ? atSlot : [...freed.keys()][0];
    if (body === undefined) return;
    entering.push({ member: m, body, out: freed.get(body) ?? null });
    freed.delete(body);
    m.body = body;
    m.line.gp = 1;
  });
  seatLineup(squad.members, five);
  return { lineup: five.map((m) => m.body!).filter((b) => b !== null), entering };
}
