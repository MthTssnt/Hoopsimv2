export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export type Conference = 'Est' | 'Ouest';

/** Notes de 25 à 99, façon jeu de gestion. */
export interface Attributes {
  /** Finition près du cercle. */
  inside: number;
  /** Tir à mi-distance. */
  midRange: number;
  /** Tir à 3 points. */
  three: number;
  /** Lancers francs. */
  freeThrow: number;
  /** Vision et qualité de passe. */
  passing: number;
  /** Dribble / protection de balle. */
  handling: number;
  /** Rebond offensif. */
  offReb: number;
  /** Rebond défensif. */
  defReb: number;
  /** Défense intérieure. */
  interiorDef: number;
  /** Défense sur l'extérieur. */
  perimeterDef: number;
  /** Interception. */
  steal: number;
  /** Contre. */
  block: number;
  /** Vitesse / explosivité. */
  speed: number;
  /** Force / physique. */
  strength: number;
  /** Endurance (résistance à la fatigue). */
  stamina: number;
  /** QI basket (décisions, pertes de balle en moins). */
  iq: number;
  /** Détente (hauteur de saut). Utilisée par le match joué, pas par la simulation. */
  vertical: number;
  /** Dunk sans élan. Utilisé par le match joué, pas par la simulation. */
  standingDunk: number;
  /** Dunk en mouvement. Utilisé par le match joué, pas par la simulation. */
  drivingDunk: number;
}

export type AttributeKey = keyof Attributes;

/** Répartition des tirs tentés et appétit offensif. */
export interface Tendencies {
  /** Part des tirs pris près du cercle. */
  rim: number;
  /** Part des tirs pris à mi-distance. */
  mid: number;
  /** Part des tirs pris derrière l'arc. */
  three: number;
  /** Poids relatif dans la prise de tir de l'équipe. */
  usage: number;
}

export interface StatLine {
  gp: number;
  gs: number;
  /** Temps de jeu cumulé, en secondes. */
  secs: number;
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  plusMinus: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  pos: Position;
  age: number;
  /** Taille en centimètres. */
  heightCm: number;
  weightKg: number;
  number: number;
  attrs: Attributes;
  tendencies: Tendencies;
  /** Note globale 25-99, recalculée à chaque évolution. */
  overall: number;
  /** Plafond estimé de progression. */
  potential: number;
  /** Étiquette de style de jeu, purement descriptive. */
  archetype: string;
  teamId: string | null;
  contract: { salary: number; years: number };
  /** Énergie courante 0-100, remise à 100 avant chaque match. */
  energy: number;
  /** Nombre de matchs d'indisponibilité restants (0 = apte). */
  injuryGames: number;
  injuryLabel: string | null;
  stats: StatLine;
  playoffStats: StatLine;
  /** Cumul carrière, tous matchs confondus. */
  career: StatLine & { seasons: number; titles: number };
}

export interface Team {
  id: string;
  city: string;
  name: string;
  abbr: string;
  conference: Conference;
  division: string;
  colors: { primary: string; secondary: string };
  roster: string[];
  /** Ordre de rotation choisi par l'entraîneur (ids de joueurs, 8 à 10). */
  rotation: string[];
  wins: number;
  losses: number;
  /** Points marqués / encaissés sur la saison régulière. */
  pointsFor: number;
  pointsAgainst: number;
  /** Série en cours : positif = victoires, négatif = défaites. */
  streak: number;
  confWins: number;
  confLosses: number;
  /** Résultats des 10 derniers matchs, du plus ancien au plus récent. */
  lastTen: boolean[];
}

export interface PlayEvent {
  /** Période (1-4, puis 5+ pour les prolongations). */
  period: number;
  /** Secondes restantes dans la période. */
  clock: number;
  teamId: string | null;
  text: string;
  homeScore: number;
  awayScore: number;
  /** Événement marquant (dunk, 3 points décisif, contre…). */
  highlight?: boolean;
}

export interface BoxScoreRow {
  playerId: string;
  starter: boolean;
  line: StatLine;
}

export interface GameBox {
  gameId: string;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  periods: { home: number; away: number }[];
  rows: Record<string, BoxScoreRow[]>;
}

export interface GameResult {
  homeScore: number;
  awayScore: number;
  periods: { home: number; away: number }[];
  box: GameBox;
  pbp: PlayEvent[];
}

export interface Game {
  id: string;
  day: number;
  homeId: string;
  awayId: string;
  played: boolean;
  homeScore: number | null;
  awayScore: number | null;
  /** Renseigné pour les matchs de playoffs. */
  seriesId?: string;
}

export interface PlayoffSeries {
  id: string;
  round: number;
  conference: Conference | 'Finales';
  highSeed: { teamId: string; seed: number };
  lowSeed: { teamId: string; seed: number };
  highWins: number;
  lowWins: number;
  /** Scores des matchs joués, dans l'ordre. */
  games: { homeId: string; awayId: string; homeScore: number; awayScore: number; gameId: string }[];
  winnerId: string | null;
}

export interface Playoffs {
  round: number;
  rounds: PlayoffSeries[][];
  championId: string | null;
  finalsMvpId: string | null;
}

export interface SeasonAward {
  playerId: string;
  teamId: string;
  label: string;
}

export interface SeasonHistory {
  season: number;
  championId: string;
  runnerUpId: string;
  mvpId: string;
  finalsMvpId: string;
  /** Bilan de chaque équipe, pour l'historique. */
  standings: { teamId: string; wins: number; losses: number }[];
  allLeague: SeasonAward[];
}

export type Phase = 'regular' | 'playoffs' | 'offseason';

export interface League {
  seed: number;
  rngState: number;
  season: number;
  phase: Phase;
  /** Jour courant du calendrier (0-indexé). */
  day: number;
  teams: Team[];
  players: Record<string, Player>;
  schedule: Game[];
  playoffs: Playoffs | null;
  userTeamId: string;
  history: SeasonHistory[];
  /** Feuilles de match conservées (matchs de l'utilisateur + playoffs). */
  boxScores: Record<string, GameBox>;
  /** Journal des transactions et faits marquants de la saison. */
  feed: { day: number; text: string }[];
}

export function emptyStatLine(): StatLine {
  return {
    gp: 0,
    gs: 0,
    secs: 0,
    pts: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    plusMinus: 0,
  };
}

export function addStatLine(target: StatLine, source: StatLine): void {
  target.gp += source.gp;
  target.gs += source.gs;
  target.secs += source.secs;
  target.pts += source.pts;
  target.fgm += source.fgm;
  target.fga += source.fga;
  target.tpm += source.tpm;
  target.tpa += source.tpa;
  target.ftm += source.ftm;
  target.fta += source.fta;
  target.oreb += source.oreb;
  target.dreb += source.dreb;
  target.ast += source.ast;
  target.stl += source.stl;
  target.blk += source.blk;
  target.tov += source.tov;
  target.pf += source.pf;
  target.plusMinus += source.plusMinus;
}

export function totalReb(line: StatLine): number {
  return line.oreb + line.dreb;
}

export function playerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}
