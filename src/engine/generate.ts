import { makeName } from './names';
import { clampRating, computeOverall } from './ratings';
import { hashSeed, Rng } from './rng';
import { TEAM_SEEDS } from './teamsData';
import {
  emptyStatLine,
  type Attributes,
  type AttributeKey,
  type League,
  type Player,
  type Position,
  type Team,
  type Tendencies,
} from './types';

/** Écarts moyens par poste, appliqués au niveau de base du joueur. */
const POSITION_PROFILE: Record<Position, Partial<Record<AttributeKey, number>>> = {
  PG: { inside: -8, three: 2, freeThrow: 5, passing: 14, handling: 14, offReb: -18, defReb: -12, interiorDef: -14, perimeterDef: 2, steal: 6, block: -20, speed: 12, strength: -10, stamina: 4, iq: 4 },
  SG: { inside: -3, midRange: 4, three: 5, freeThrow: 4, handling: 5, offReb: -12, defReb: -7, interiorDef: -10, perimeterDef: 3, steal: 3, block: -12, speed: 7, strength: -4, stamina: 2, iq: 1 },
  SF: { inside: 2, midRange: 2, three: 1, passing: -2, handling: -1, offReb: -2, interiorDef: -2, perimeterDef: 2, block: -4, speed: 2, strength: 2 },
  PF: { inside: 7, midRange: -2, three: -6, freeThrow: -4, passing: -7, handling: -9, offReb: 8, defReb: 9, interiorDef: 8, perimeterDef: -4, steal: -3, block: 6, speed: -5, strength: 9, stamina: -1, iq: -1 },
  C: { inside: 12, midRange: -8, three: -16, freeThrow: -9, passing: -10, handling: -16, offReb: 13, defReb: 14, interiorDef: 14, perimeterDef: -10, steal: -6, block: 14, speed: -10, strength: 14, stamina: -3, iq: -1 },
};

interface Archetype {
  label: string;
  deltas: Partial<Record<AttributeKey, number>>;
  /** Multiplicateur d'appétit offensif. */
  usage: number;
}

const ARCHETYPES: Record<Position, Archetype[]> = {
  PG: [
    { label: 'Meneur créateur', deltas: { passing: 8, handling: 6, iq: 6, three: -2, inside: -3 }, usage: 0.95 },
    { label: 'Meneur scoreur', deltas: { three: 8, midRange: 6, inside: 4, passing: -6, perimeterDef: -3 }, usage: 1.25 },
    { label: 'Meneur défensif', deltas: { perimeterDef: 10, steal: 9, speed: 5, three: -6, midRange: -4 }, usage: 0.75 },
  ],
  SG: [
    { label: 'Sniper', deltas: { three: 11, freeThrow: 6, midRange: 4, perimeterDef: -5, defReb: -3 }, usage: 1.1 },
    { label: 'Arrière athlétique', deltas: { inside: 10, speed: 7, offReb: 4, three: -7, iq: -3 }, usage: 1.15 },
    { label: 'Arrière 3&D', deltas: { three: 6, perimeterDef: 9, steal: 5, passing: -4, handling: -3 }, usage: 0.8 },
  ],
  SF: [
    { label: 'Ailier polyvalent', deltas: { passing: 5, iq: 5, defReb: 3, perimeterDef: 3 }, usage: 0.95 },
    { label: 'Ailier scoreur', deltas: { midRange: 8, three: 6, inside: 6, interiorDef: -4, perimeterDef: -3 }, usage: 1.3 },
    { label: 'Ailier stoppeur', deltas: { perimeterDef: 11, interiorDef: 5, steal: 5, strength: 4, three: -6 }, usage: 0.75 },
  ],
  PF: [
    { label: 'Ailier fort stretch', deltas: { three: 14, midRange: 7, freeThrow: 5, interiorDef: -6, offReb: -5 }, usage: 1.0 },
    { label: 'Ailier fort intérieur', deltas: { inside: 8, offReb: 8, defReb: 6, strength: 6, three: -10 }, usage: 1.0 },
    { label: 'Ailier fort mobile', deltas: { speed: 7, perimeterDef: 7, passing: 4, strength: -4 }, usage: 0.95 },
  ],
  C: [
    { label: 'Pivot dominant', deltas: { inside: 9, strength: 7, offReb: 6, block: 4, speed: -4 }, usage: 1.2 },
    { label: 'Pivot moderne', deltas: { three: 15, passing: 8, freeThrow: 6, block: -5, strength: -4 }, usage: 1.0 },
    { label: 'Pivot protecteur', deltas: { block: 11, interiorDef: 9, defReb: 6, inside: -4, three: -8 }, usage: 0.75 },
  ],
};

const HEIGHT_BY_POS: Record<Position, [number, number]> = {
  PG: [186, 5],
  SG: [194, 5],
  SF: [201, 5],
  PF: [206, 5],
  C: [212, 6],
};

/** Niveau visé pour chaque place de l'effectif, du meilleur joueur au dernier. */
const SLOT_LEVELS = [82, 78, 75, 72, 69, 67, 64, 62, 60, 58, 57, 56, 55, 54];

const ATTR_KEYS: AttributeKey[] = [
  'inside', 'midRange', 'three', 'freeThrow', 'passing', 'handling', 'offReb', 'defReb',
  'interiorDef', 'perimeterDef', 'steal', 'block', 'speed', 'strength', 'stamina', 'iq',
];

/** Attributs propres au match joué, déduits du physique et des autres attributs. */
const ATHLETIC_KEYS = ['vertical', 'standingDunk', 'drivingDunk'] as const;
type AthleticKey = (typeof ATHLETIC_KEYS)[number];

/**
 * Détente et dunks. Le tirage utilise un générateur propre au joueur et ne consomme
 * pas le flux aléatoire de la ligue : à graine égale, les ligues générées (et donc la
 * calibration) restent identiques à ce qu'elles étaient avant l'ajout de ces attributs.
 */
function athleticAttrs(player: Pick<Player, 'id' | 'heightCm' | 'weightKg' | 'attrs'>): Record<AthleticKey, number> {
  const { attrs: a, heightCm, weightKg } = player;
  const rng = new Rng(hashSeed(`${player.id}|${heightCm}|${weightKg}|${a.speed}|${a.inside}`));
  // Kilos en trop par rapport à la corpulence attendue pour la taille et la force.
  const extraKg = weightKg - (heightCm - 100) * 1.02 - a.strength * 0.12;
  const vertical = clampRating(a.speed * 0.65 + a.inside * 0.15 + 14 - (heightCm - 198) * 0.15 - extraKg * 0.3 + rng.normal(0, 5));
  // Le dunk sans élan profite surtout de la taille, le dunk en mouvement de la détente.
  const standingDunk = clampRating(a.inside * 0.35 + vertical * 0.3 + a.strength * 0.15 + (heightCm - 198) * 1.2 + 4 + rng.normal(0, 5));
  const drivingDunk = clampRating(a.inside * 0.25 + vertical * 0.5 + a.speed * 0.1 + (heightCm - 198) * 0.6 + 6 + rng.normal(0, 5));
  return { vertical, standingDunk, drivingDunk };
}

/** Complète les attributs athlétiques absents (sauvegardes antérieures à leur ajout). */
export function ensureAthleticAttrs(player: Player): void {
  if (ATHLETIC_KEYS.every((key) => typeof player.attrs[key] === 'number')) return;
  const derived = athleticAttrs(player);
  for (const key of ATHLETIC_KEYS) {
    if (typeof player.attrs[key] !== 'number') player.attrs[key] = derived[key];
  }
}

function buildTendencies(attrs: Attributes, pos: Position, overall: number, usageMult: number): Tendencies {
  const posIndex = { PG: 1, SG: 2, SF: 3, PF: 4, C: 5 }[pos];
  // Répartition « basket moderne » : beaucoup de tirs au cercle et derrière l'arc,
  // très peu à mi-distance sauf pour les spécialistes.
  const rim = Math.max(6, attrs.inside * 0.95 + posIndex * 4 + attrs.speed * 0.15 - 22);
  const mid = Math.max(5, attrs.midRange * 0.55 - 12);
  const three = Math.max(3, attrs.three * 1.35 - posIndex * 3 - 20);
  const total = rim + mid + three;
  return {
    rim: rim / total,
    mid: mid / total,
    three: three / total,
    usage: Math.max(0.35, (0.55 + (overall - 55) / 40) * usageMult),
  };
}

function salaryFor(overall: number, age: number): number {
  const scale = Math.max(0, (overall - 48) / 45);
  const base = Math.pow(scale, 2.6) * 48 + 1.1;
  const ageFactor = age < 22 ? 0.55 : age > 33 ? 0.85 : 1;
  return Math.round(base * ageFactor * 10) / 10;
}

function makePlayer(
  rng: Rng,
  usedNames: Set<string>,
  pos: Position,
  level: number,
  idSeq: () => string,
): Player {
  const archetype = rng.pick(ARCHETYPES[pos]);
  const profile = POSITION_PROFILE[pos];
  const attrs = {} as Attributes;
  for (const key of ATTR_KEYS) {
    const base = level + (profile[key] ?? 0) + (archetype.deltas[key] ?? 0) + rng.normal(0, 3.5);
    attrs[key] = clampRating(base);
  }

  const age = Math.round(Math.max(19, Math.min(38, rng.normal(26.5, 3.9))));
  const [hMean, hSd] = HEIGHT_BY_POS[pos];
  const heightCm = Math.round(rng.normal(hMean, hSd));
  const weightKg = Math.round((heightCm - 100) * 1.02 + rng.normal(0, 6) + attrs.strength * 0.12);
  const overall = computeOverall(attrs, pos);

  // Les jeunes ont de la marge, les vétérans sont proches de leur plafond.
  const growthRoom = age <= 21 ? rng.range(6, 20) : age <= 25 ? rng.range(2, 11) : age <= 29 ? rng.range(0, 4) : 0;
  const potential = clampRating(overall + growthRoom);

  const { firstName, lastName } = makeName(rng, usedNames);
  const id = idSeq();
  Object.assign(attrs, athleticAttrs({ id, heightCm, weightKg, attrs }));
  return {
    id,
    firstName,
    lastName,
    pos,
    age,
    heightCm,
    weightKg,
    number: 0,
    attrs,
    tendencies: buildTendencies(attrs, pos, overall, archetype.usage),
    overall,
    potential,
    archetype: archetype.label,
    teamId: null,
    contract: { salary: salaryFor(overall, age), years: rng.int(1, 4) },
    energy: 100,
    injuryGames: 0,
    injuryLabel: null,
    stats: emptyStatLine(),
    playoffStats: emptyStatLine(),
    career: { ...emptyStatLine(), seasons: 0, titles: 0 },
  };
}

/** Répartition des postes sur les 14 places d'un effectif. */
const ROSTER_POSITIONS: Position[] = ['PG', 'PG', 'PG', 'SG', 'SG', 'SG', 'SF', 'SF', 'SF', 'PF', 'PF', 'PF', 'C', 'C'];

function assignNumbers(rng: Rng, players: Player[]): void {
  const pool = rng.shuffle(Array.from({ length: 56 }, (_, i) => i));
  players.forEach((p, i) => {
    p.number = pool[i];
  });
}

export function generateLeague(rng: Rng, seed: number, userTeamId: string, season: number): League {
  const usedNames = new Set<string>();
  let counter = 0;
  const idSeq = () => `p${(counter++).toString(36)}`;

  const players: Record<string, Player> = {};
  const teams: Team[] = TEAM_SEEDS.map((seedTeam) => {
    // Chaque franchise reçoit un modificateur de talent : c'est ce qui crée
    // les prétendants au titre et les équipes en reconstruction.
    const teamMod = Math.max(-9, Math.min(9, rng.normal(0, 3.6)));
    const positions = rng.shuffle([...ROSTER_POSITIONS]);
    const roster: Player[] = [];

    SLOT_LEVELS.forEach((slotLevel, slot) => {
      let level = slotLevel + teamMod + rng.normal(0, 2.2);
      // Une franchise sur trois possède une véritable superstar.
      if (slot === 0 && rng.chance(0.3)) level += rng.range(4, 16);
      const player = makePlayer(rng, usedNames, positions[slot], level, idSeq);
      player.teamId = seedTeam.id;
      roster.push(player);
    });

    roster.sort((a, b) => b.overall - a.overall);
    assignNumbers(rng, roster);
    for (const p of roster) players[p.id] = p;

    return {
      ...seedTeam,
      roster: roster.map((p) => p.id),
      rotation: [],
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
      confWins: 0,
      confLosses: 0,
      lastTen: [],
    };
  });

  return {
    seed,
    rngState: rng.state,
    season,
    phase: 'regular',
    day: 0,
    teams,
    players,
    schedule: [],
    playoffs: null,
    userTeamId,
    history: [],
    boxScores: {},
    feed: [],
  };
}

/** Génère une classe de rookies pour la draft d'intersaison. */
export function generateDraftClass(rng: Rng, size: number, startId: number): Player[] {
  const usedNames = new Set<string>();
  let counter = startId;
  const idSeq = () => `r${(counter++).toString(36)}`;
  const out: Player[] = [];
  for (let i = 0; i < size; i++) {
    // Les premiers choix sont meilleurs, avec un fort potentiel de progression.
    const level = 66 - i * 0.45 + rng.normal(0, 3);
    const pos = rng.pick(ROSTER_POSITIONS);
    const p = makePlayer(rng, usedNames, pos, level, idSeq);
    p.age = rng.int(19, 22);
    p.potential = clampRating(p.overall + rng.range(8, 24));
    p.contract = { salary: salaryFor(p.overall, p.age), years: 3 };
    out.push(p);
  }
  return out.sort((a, b) => b.potential + b.overall - (a.potential + a.overall));
}
