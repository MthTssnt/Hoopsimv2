import { reach } from '../../engine/athletics';
import type { Rng } from '../../engine/rng';
import {
  blockProbability,
  canDunk,
  FREE_THROW_TUNING,
  foulOnContact,
  foulProbability,
  gaugeTime,
  resolveBlock,
  resolveDunk,
  resolveFreeThrow,
  resolveShot,
  type Contest,
  type DunkContext,
  type ShotKind,
  type ShotMode,
  type ShotSpeed,
  type ShotZone,
  type TimingGrade,
} from '../../engine/shot';
import { FOUL_OUT, inBonus, newCoachContext, nextLineup, restEnergy, seatLineup, startingLineup, SUB_INTERVAL, updateCoachContext } from '../../engine/rotation';
import type { Player } from '../../engine/types';
import { BALL_PHYSICS, stepBall, type BallState } from '../physics/ball';
import { BALL_RADIUS, distanceToRim, inPaintHalf, type Court, type Hoop, type HoopSide, type Vec3 } from '../physics/court';
import { solveDunk } from '../physics/dunk';
import {
  interceptionChances,
  reachFoulProbability,
  resolveInterception,
  resolveReachFoul,
  resolveSteal,
  stealProbability,
  type InterceptOutcome,
} from '../../engine/steal';
import { deflectVelocity, laneContact, measureSteal, pokeVelocity, STEAL_FLOW, type StealMeasure } from './steal';
import { armContact, bodyContact, DEFENSE_FLOW, inGoaltendZone, swatVelocity } from './defense';
import { solveShot } from '../physics/shotSolver';
import {
  attackHoop,
  baselineSpot,
  clockStopsAfterBasket,
  defendHoop,
  freeThrowPositions,
  FULL_COURT,
  inFrontcourt,
  isOut,
  newFullCourt,
  outSpot,
  periodLength,
  periodPositions,
  periodStarter,
  tipPositions,
  type FullCourtState,
  type Inbound,
  type ViolationKind,
} from './fullCourt';
import { defaultTarget, HALF_COURT, isCleared, mustClearAfterPickup, newHalfCourt, startPositions, type HalfCourtState } from './halfCourt';
import { leadPoint, PASS_FLOW, passSpeed, passTarget, passVelocity } from './passing';
import { BOX_RULES, LiveBox, type ShotValue } from './boxScore';
import { createPlayerBody, PLAYER_TUNING, setBodyAthlete, setJumpTiming, stepPlayer, type MoveInput, type PlayerBody } from './player';
import { createSquad, matchProgress, matchTimeScale, substitute, tickSquad, tiredAthlete, type MatchMember, type Squad } from './rotation';
import { attacksRim, dunkFinish, dunkJumpHeight, layupFinish, releasePoint, SHOT_FLOW, shotZone, targetHoop } from './shooting';

/** Valeurs provisoires, réglables à l'œil. */
export const WORLD_TUNING = {
  /** Un ballon libre est ramassé à moins de cette distance horizontale des pieds (m)… */
  pickupRadius: 0.65,
  /** …et s'il est sous la main tendue (+ marge, m). */
  pickupReachMargin: 0.1,
  /** Délai pendant lequel le tireur ne peut pas rattraper son propre tir (s). */
  pickupCooldown: 0.5,
  /** Dribble : durée d'un aller-retour main → sol → main (s), hauteur de la main (m). */
  dribblePeriod: 0.5,
  dribbleHandHeight: 0.85,
  /**
   * Main qui tient le ballon : écart devant le joueur et vers le spectateur (m). Le ballon est
   * dribblé devant le corps, un peu en avant : l'écart suit le dessin (voir le rig).
   */
  handForward: 0.22,
  handDepth: 0.12,
  /** Rayon d'un joueur au sol (m) : deux joueurs ne se chevauchent jamais. */
  bodyRadius: 0.35,
} as const;

/** Geste de tir : tir en suspension, layup (avec la jauge) ou dunk (simple appui). */
export type PlayKind = ShotKind | 'dunk' | 'lancer';

/** Un tir dans le monde : vrai tir (jauge), dunk, ou tir de démo (R/M). */
export interface ShotRecord {
  /** Tir de démo (touches R/M, résultat imposé) ou vrai tir (résultat tiré par `engine/`). */
  demo: boolean;
  /** Index du tireur. */
  shooter: number;
  kind: PlayKind;
  zone: ShotZone;
  /** Point de lâcher du ballon. */
  start: Vec3;
  /** Distance au cercle et 3 pts, mesurées là où le tireur a décollé. */
  distance: number;
  three: boolean;
  hoop: HoopSide;
  /** Défenseur le plus proche au lâcher (au décollage pour un dunk), ou null. */
  contest: Contest | null;
  /** Le tireur avait bien ressorti le ballon (1 contre 1) : sinon, le panier ne compte pas. */
  cleared: boolean;
  /** Résultat tiré par `engine/` (ou imposé pour une démo). */
  wanted: boolean;
  probability: number | null;
  grade: TimingGrade | null;
  /** Écart entre le lâcher et le sommet du saut (s), négatif = trop tôt. */
  timingError: number | null;
  /** Parti tout seul : Tir encore enfoncé à l'atterrissage. */
  forced: boolean;
  /** Panier marqué avant le premier contact avec le parquet. */
  scored: boolean;
  /** Panier marqué mais non valable (ballon pas ressorti). */
  invalid: boolean;
  /** Résultat observé en direct (null tant que le ballon n'a pas touché le sol). */
  live: boolean | null;
  /** Contre tenté (une fois, ballon en montée) ; réussi, il annule le résultat tiré. */
  block: BlockAttempt | null;
  /** Faute évaluée au premier contact des corps pendant le tir (de l'appui à l'atterrissage). */
  foul: FoulCall | null;
  /** Panier accordé : ballon touché en redescente au-dessus du cercle. */
  goaltend: boolean;
}

/** Main d'un défenseur sur le ballon pendant sa montée : `engine/` tranche. */
export interface BlockAttempt {
  blocker: number;
  /** Qualité du contact mesurée (0 = effleure, 1 = en plein). */
  contact: number;
  probability: number;
  success: boolean;
}

/** Contact des corps pendant un tir : faute sifflée ou non. */
export interface FoulCall {
  defender: number;
  probability: number;
  called: boolean;
}

/** Un vrai tir, de l'appui à son issue : fenêtre de faute et ballon mort après une faute. */
interface Play {
  shooter: number;
  /** Tir enregistré dès le lâcher (au smash pour un dunk). */
  record: ShotRecord | null;
  foul: FoulCall | null;
  /** Fenêtre de faute ouverte : de l'appui jusqu'à l'atterrissage du tireur. */
  watching: boolean;
  /** Le tir est raté (ou contré, ou non valable) : avec une faute, le ballon revient au tireur. */
  missed: boolean;
  /** Lancers francs déjà accordés pour la faute sur ce tir (terrain entier). */
  freeThrows: boolean;
  /** Passeur décisif si ce tir est marqué (passe reçue juste avant, même possession), noté au lâcher. */
  assist: number | null;
}

/** Dunk en cours : résultat déjà tiré à l'appui, smash au sommet, puis accroche si réussi. */
export interface ActiveDunk {
  made: boolean;
  probability: number;
  /** Ballon smashé (le joueur ne le tient plus). */
  slammed: boolean;
  /** Temps d'accroche au cercle restant (s). */
  hang: number;
  /** Hauteur des pieds au sommet (m) : saut relevé si besoin pour que la main dépasse le cercle. */
  apex: number;
}

/**
 * Tir en cours : le tireur est en l'air. Tir et layup : le ballon est au-dessus de la tête et la
 * jauge tourne jusqu'au lâcher. Dunk : jusqu'à l'atterrissage (smash, puis accroche).
 */
export interface ActiveShot {
  shooter: number;
  kind: PlayKind;
  /** Zone mesurée au décollage (layup et dunk : toujours « près du cercle »). */
  zone: ShotZone;
  hoop: Hoop;
  /** Temps passé en l'air depuis le décollage (s). */
  airTime: number;
  /** Vitesse au sol au décollage (m/s) : pénalité du tir en mouvement. */
  takeoffSpeed: number;
  takeoff: Vec3;
  /** Défenseur au décollage (pour un dunk, déjà pris en compte à l'appui). */
  contest: Contest | null;
  dunk: ActiveDunk | null;
}

/** Réglages du tir choisis dans le panneau. */
export interface ShotSettings {
  mode: ShotMode;
  speed: ShotSpeed;
}

/** Ce que le monde reçoit à chaque pas pour un joueur : direction, appui et relâche de Tir, passe. */
export interface WorldInput extends MoveInput {
  /** Tir relâché à ce pas. */
  release?: boolean;
  /** Passe demandée à ce pas (en défense, pour le joueur contrôlé : changer de défenseur). */
  pass?: boolean;
  /** Interception (A) : geste de vol sur le porteur, ou bras allongé dans une ligne de passe. */
  steal?: boolean;
}

/** Geste de vol sur le porteur : mesures de `match/`, probabilités du moteur, issue. */
export interface StealAttempt extends StealMeasure {
  thief: number;
  handler: number;
  foulProbability: number;
  stealProbability: number;
  result: 'vol' | 'faute' | 'raté';
  time: number;
}

/** Passe passée à portée d'un défenseur : contact mesuré, chances du moteur, issue. */
export interface InterceptAttempt {
  defender: number;
  passer: number;
  contact: number;
  touch: number;
  catchShare: number;
  outcome: InterceptOutcome;
  time: number;
}

/** Perte de balle : vol, interception, ballon dévié ramassé par la défense, ou violation (sans voleur). */
export interface Turnover {
  kind: 'vol' | 'interception' | 'déviation' | Exclude<ViolationKind, 'entre-deux'>;
  thief: number | null;
  loser: number;
  time: number;
}

/** Événement à annoncer (messages du rendu), numéroté dans l'ordre : `by` est le joueur au-dessus duquel l'annoncer. */
export interface MatchEvent {
  id: number;
  kind: 'vol' | 'faute-main' | 'interception' | 'déviation' | 'bonus' | '6 fautes' | 'changement' | ViolationKind;
  by: number;
  of: number;
  time: number;
}

/** Passe en vol : seuls les coéquipiers du passeur peuvent l'attraper (l'interception arrive au 9). */
export interface PassFlight {
  passer: number;
  receiver: number;
  team: number;
  /** Point visé (poitrine du receveur à l'arrivée) et temps de vol prévu (s). */
  target: Vec3;
  time: number;
  elapsed: number;
  /** Défenseurs déjà évalués sur cette passe (une seule chance chacun). */
  checked: number[];
}

const IDLE_INPUT: WorldInput = { x: 0, y: 0, jump: false };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class MatchWorld {
  court: Court;
  readonly players: PlayerBody[] = [];
  /** Équipe de chaque joueur : 0 pour toi et tes coéquipiers, 1 pour l'adversaire. */
  readonly team: number[] = [0];
  /** Ton équipe : le contrôle passe d'un de ses joueurs à l'autre. */
  readonly userTeam = 0;
  /** Joueur que tu contrôles : le porteur en attaque, le défenseur le plus proche du ballon en défense. */
  controlled = 0;
  ball: BallState;
  /** Index du joueur qui tient le ballon, ou null s'il est libre. */
  holder: number | null = null;
  /** Tir en cours (en l'air, ballon pas encore lâché, ou dunk jusqu'à l'atterrissage). */
  shot: ActiveShot | null = null;
  lastShot: ShotRecord | null = null;
  /** Points marqués par chaque équipe (vrais tirs seulement). */
  points: number[] = [0];
  /** Règles du demi-terrain, ou null pour un joueur seul (panier le plus proche, pas de règle) ou un match sur terrain entier. */
  rules: HalfCourtState | null = null;
  /** Match sur terrain entier (5 contre 5) : périodes, chrono, shot clock, remises, violations. */
  full: FullCourtState | null = null;
  /** Joueurs de chaque équipe dans l'ordre des postes (1 meneur … 5 pivot) : duels par poste, sauteur de l'entre-deux. */
  readonly lineup: number[][] = [];
  /** Passe en vol, ou null. */
  pass: PassFlight | null = null;
  /** Dernière passe attrapée (pour la future passe décisive) : passeur, receveur, instant (s). */
  lastPass: { passer: number; receiver: number; time: number } | null = null;
  /** Temps de jeu écoulé depuis la création du monde (s). */
  clock = 0;
  /** Possession : équipe qui a le ballon (ou l'a eu en dernier) et depuis quand (s). */
  possession: { team: number; since: number } | null = null;
  shotSettings: ShotSettings;
  /** Le joueur a lâché le ballon pendant son saut en cours (pose de la retombée du tir). */
  readonly followThrough: boolean[] = [];
  /** Par joueur : bras allongé (A) jusqu'à cet instant (s), délai avant un nouveau geste, déséquilibre restant (s). */
  readonly reachUntil: number[] = [];
  readonly stealCooldown: number[] = [];
  readonly offBalance: number[] = [];
  /** Dernière tentative de vol, dernière passe à portée d'un défenseur (debug). */
  lastSteal: StealAttempt | null = null;
  lastIntercept: InterceptAttempt | null = null;
  /** Pertes de balle de la partie (pour le box score). */
  readonly turnovers: Turnover[] = [];
  /** Derniers événements à annoncer, et leur nombre total. */
  readonly events: MatchEvent[] = [];
  eventCount = 0;
  /** Terrain entier : rotation, énergie, fautes et stats de chaque équipe (null ailleurs). */
  squads: Squad[] | null = null;
  /** Box score en direct (terrain entier). */
  box: LiveBox | null = null;
  /** Nombre de changements de cinq depuis la création (les IA recalculent alors leurs duels). */
  lineupVersion = 0;
  private readonly rng: Rng;
  /** Rotations de départ (ordre du coach) : un nouveau match repart d'elles. */
  private rosters: Player[][] = [];
  private readonly coach = newCoachContext();
  /** Ballon mort à ce pas : le coach regardera son cinq à la fin du pas. */
  private subsDue = false;
  /** Temps de chrono depuis la dernière mise à jour des notes (fatigue, s). */
  private tiredClock = 0;
  private dribbleTime = 0;
  private cooldown = 0;
  private play: Play | null = null;
  private passCooldown = 0;
  /** Panier marqué, ballon pas encore ramassé depuis : le prochain qui le ramasse doit ressortir. */
  private basketPending = false;
  /** Ballon arraché ou dévié : qui l'a touché, à qui il appartenait (perte si la défense le ramasse). */
  private loose: { by: number; from: number; kind: 'vol' | 'déviation' } | null = null;
  /** Le tir en vol a déjà touché le cercle ou la planche (plus de goaltending possible). */
  private rimTouched = false;

  constructor(court: Court, athlete: Player, start: Vec3, shotSettings: ShotSettings, rng: Rng) {
    this.court = court;
    this.rng = rng;
    this.shotSettings = { ...shotSettings };
    this.players.push(createPlayerBody(athlete, start, gaugeTime(shotSettings.speed)));
    this.holder = 0;
    this.ball = { pos: this.handPosition(this.players[0]), vel: { x: 0, y: 0, z: 0 } };
  }

  get player(): PlayerBody {
    return this.players[this.controlled];
  }

  /** Faute évaluée sur le tir en cours ou le dernier tir (dès le contact, avant même le lâcher). */
  get currentFoul(): FoulCall | null {
    return this.play?.foul ?? null;
  }

  /**
   * Demi-terrain sur le panier de droite : `home` (ton équipe, joueurs 0…n-1) contre `away`
   * (joueurs n…2n-1). Chacun à sa place de départ, ballon au joueur 0, score à 0-0.
   */
  startTeams(home: readonly Player[], away: readonly Player[], target: number = defaultTarget(home.length)): void {
    const timeToApex = this.players[0]?.timeToApex ?? gaugeTime(this.shotSettings.speed);
    this.players.length = 0;
    this.team.length = 0;
    this.followThrough.length = 0;
    [...home, ...away].forEach((athlete, i) => {
      this.players.push(createPlayerBody(athlete, { x: 0, y: 0, z: 0 }, timeToApex));
      this.team.push(i < home.length ? 0 : 1);
    });
    this.lineup.length = 0;
    this.lineup.push(this.membersOf(0), this.membersOf(1));
    this.full = null;
    this.rules = newHalfCourt(2, target);
    this.resetGame();
  }

  /**
   * Match sur terrain entier : la rotation de `home` (ton équipe, corps 0…4 sur le terrain) contre
   * celle de `away` (corps 5…9), chacune dans l'ordre du coach (le premier joue le plus). Le cinq de
   * départ vient des cinq premiers, rangés par poste (meneur d'abord, pivot en dernier) ; les autres
   * attendent sur le banc. Le match commence par un entre-deux.
   */
  startFullCourt(home: readonly Player[], away: readonly Player[], quarterMinutes: number = FULL_COURT.quarterMinutes): void {
    this.rosters = [[...home], [...away]];
    const fives = this.rosters.map((rotation, team) => startingLineup(createSquad(team, rotation).members).map((m) => m.player));
    this.startTeams(fives[0], fives[1]);
    this.rules = null;
    this.full = newFullCourt(quarterMinutes);
    this.startMatch();
  }

  /** Partie en équipes (demi-terrain ou terrain entier) : fautes, vols, changement de défenseur. */
  get teamPlay(): boolean {
    return this.rules !== null || this.full !== null;
  }

  /** Panier attaqué par une équipe : celui de droite au demi-terrain, selon la mi-temps sur terrain entier. */
  attackHoop(team: number): Hoop {
    return this.full ? attackHoop(this.court, team, this.full.period) : this.court.hoops.right;
  }

  /** Panier défendu par une équipe (au demi-terrain, les deux défendent celui de droite). */
  defendHoop(team: number): Hoop {
    return this.full ? defendHoop(this.court, team, this.full.period) : this.court.hoops.right;
  }

  /** Durée d'un quart-temps (min), appliquée à partir du suivant. */
  setQuarterMinutes(minutes: number): void {
    if (this.full) this.full.quarterMinutes = minutes;
  }

  /** 1 contre 1 : ton joueur contre `opponent`. */
  startOneOnOne(opponent: Player, target: number = defaultTarget(1)): void {
    this.startTeams([this.players[0].athlete], [opponent], target);
  }

  /** Joueurs par équipe. */
  get perTeam(): number {
    return this.team.filter((t) => t === 0).length;
  }

  /** Coéquipiers du joueur `i` (sans lui). */
  teammatesOf(i: number): number[] {
    return this.players.map((_, j) => j).filter((j) => j !== i && this.team[j] === this.team[i]);
  }

  /** Adversaires du joueur `i`. */
  opponentsOf(i: number): number[] {
    return this.players.map((_, j) => j).filter((j) => this.team[j] !== this.team[i]);
  }

  /** Joueurs d'une équipe, dans l'ordre. */
  membersOf(team: number): number[] {
    return this.players.map((_, j) => j).filter((j) => this.team[j] === team);
  }

  /** Joueur de `team` le plus proche d'un point (au sol). */
  nearestOf(team: number, point: { x: number; y: number }, except: number | null = null): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const j of this.membersOf(team)) {
      if (j === except) continue;
      const d = Math.hypot(this.players[j].pos.x - point.x, this.players[j].pos.y - point.y);
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    return best;
  }

  /** Panier visé par le joueur `index` : celui que son équipe attaque, ou le plus proche pour un joueur seul. */
  hoopFor(index: number): Hoop {
    if (this.rules || this.full) return this.attackHoop(this.team[index]);
    return targetHoop(this.court, this.players[index].pos.x);
  }

  /** Change un joueur en gardant sa position, sa vitesse et son saut en cours. */
  setAthlete(athlete: Player, index: number = this.controlled): void {
    const old = this.players[index];
    const body = createPlayerBody(athlete, old.pos, old.timeToApex);
    body.facing = old.facing;
    body.vel = { ...old.vel };
    body.airborne = old.airborne;
    this.players[index] = body;
  }

  /** Mode et vitesse de tir : la vitesse règle aussi la durée du saut (sommet = fin de la jauge). */
  setShotSettings(settings: ShotSettings): void {
    this.shotSettings = { ...settings };
    for (const body of this.players) setJumpTiming(body, gaugeTime(settings.speed));
  }

  /** Position du ballon tenu : dribble au sol, levé au-dessus de la tête en l'air. */
  handPosition(body: PlayerBody): Vec3 {
    const t = WORLD_TUNING;
    const x = body.pos.x + body.facing * t.handForward;
    const y = body.pos.y + t.handDepth;
    if (body.airborne) return { x, y, z: body.pos.z + (body.athlete.heightCm / 100) * 1.1 };
    const phase = Math.abs(Math.cos((Math.PI * this.dribbleTime) / t.dribblePeriod));
    return { x, y, z: BALL_RADIUS + (t.dribbleHandHeight - BALL_RADIUS) * phase };
  }

  /**
   * Défenseur le plus proche du joueur `index` face au cercle `hoop` : distance horizontale et
   * `facing`, cosinus de l'angle (tireur → défenseur, tireur → cercle) ramené à 0-1.
   */
  contestFor(index: number, hoop: Hoop): (Contest & { player: Player }) | null {
    const shooter = this.players[index].pos;
    let best: (Contest & { player: Player }) | null = null;
    this.players.forEach((body, i) => {
      if (this.team[i] === this.team[index]) return;
      const dx = body.pos.x - shooter.x;
      const dy = body.pos.y - shooter.y;
      const distance = Math.hypot(dx, dy);
      if (best && distance >= best.distance) return;
      const rx = hoop.rim.x - shooter.x;
      const ry = hoop.rim.y - shooter.y;
      const rimDist = Math.hypot(rx, ry);
      const facing = distance < 1e-6 || rimDist < 1e-6 ? 1 : clamp01((dx * rx + dy * ry) / (distance * rimDist));
      best = { distance, facing, player: body.athlete };
    });
    return best;
  }

  /** Contexte de dunk d'un joueur, s'il appuyait sur Tir maintenant (mesures de `match/`). */
  dunkContext(index: number = this.controlled): DunkContext {
    const body = this.players[index];
    const hoop = this.hoopFor(index);
    return {
      dunker: body.athlete,
      inDunkZone: inPaintHalf(this.court, hoop, body.pos.x, body.pos.y),
      moveSpeed: Math.hypot(body.vel.x, body.vel.y),
      defender: this.contestFor(index, hoop),
    };
  }

  /**
   * Avance le monde d'un pas. Une entrée par joueur (une seule : celle du joueur 0). Pendant la
   * pause de fin de partie (ou de période), personne ne bouge, puis la partie reprend.
   */
  step(dt: number, inputs: WorldInput | readonly WorldInput[]): void {
    let list: readonly WorldInput[] = Array.isArray(inputs) ? inputs : [inputs as WorldInput];
    this.clock += dt;
    this.passCooldown = Math.max(0, this.passCooldown - dt);
    for (let i = 0; i < this.players.length; i++) {
      this.stealCooldown[i] = Math.max(0, (this.stealCooldown[i] ?? 0) - dt);
      this.offBalance[i] = Math.max(0, (this.offBalance[i] ?? 0) - dt);
    }
    if (this.rules && this.rules.winner !== null) {
      this.rules.pause -= dt;
      if (this.rules.pause <= 0) this.resetGame();
      list = [];
    }
    // Faute puis tir raté : ballon mort, personne ne joue, puis remise en jeu au tireur.
    const restart = this.rules?.restart ?? null;
    if (restart) {
      restart.pause -= dt;
      list = [];
      if (restart.pause <= 0) this.restartPlay(restart.shooter);
    }
    // Terrain entier : pauses (ballon mort, fin de période), mise en place des remises.
    if (this.full && this.stepPauses(dt)) list = [];
    // Lancers francs : seul le tireur joue (appui, relâche) ; les autres attendent le dernier lâcher.
    if (this.full?.phase === 'lancers' && this.full.freeThrows) {
      this.stepFreeThrow(dt, list[this.full.freeThrows.shooter] ?? IDLE_INPUT);
      list = [];
    }
    const full = this.full;
    const thrower = full?.phase === 'remise' && this.holder === full.inbound?.thrower ? this.holder : null;

    this.players.forEach((body, i) => {
      let raw = list[i] ?? IDLE_INPUT;
      // Le lanceur d'une remise ne bouge pas et ne tire pas : il passe.
      if (i === thrower) raw = { x: 0, y: 0, jump: false, pass: raw.pass };
      // Déséquilibré après un vol raté : il avance au ralenti et ne peut pas sauter.
      const k = STEAL_FLOW.offBalanceSpeed;
      const input = this.offBalance[i] > 0 ? { ...raw, x: raw.x * k, y: raw.y * k, jump: false } : raw;
      // Appui sur Tir avec le ballon, au sol : le tir commence avec le saut. Dunk d'abord (s'il
      // est possible), sinon layup en attaquant le cercle, sinon tir en suspension.
      const startsShot = input.jump && this.holder === i && !body.airborne && this.shot === null;
      const takeoffSpeed = Math.hypot(body.vel.x, body.vel.y);
      const takeoff = { ...body.pos };
      let kind: PlayKind | null = null;
      let dunkCtx: DunkContext | null = null;
      if (startsShot) {
        dunkCtx = this.dunkContext(i);
        if (canDunk(dunkCtx)) kind = 'dunk';
        else kind = attacksRim(body.pos, body.vel, this.hoopFor(i)) ? 'layup' : 'jump';
      }
      // Accroché au cercle : le dunkeur ne bouge plus jusqu'à la fin de l'accroche.
      const dunk = this.shot?.shooter === i ? this.shot.dunk : null;
      if (dunk && dunk.hang > 0) dunk.hang = Math.max(0, dunk.hang - dt);
      else stepPlayer(body, startsShot ? { ...input, shotJump: true } : input, dt, this.court);
      if (!body.airborne) this.followThrough[i] = false;
      if (kind) this.startShot(i, kind, takeoffSpeed, takeoff, dunkCtx);
    });
    this.separateBodies();
    this.checkFoul();
    this.cooldown = Math.max(0, this.cooldown - dt);

    // Passe du porteur, au sol et hors tir ; en défense, le joueur contrôlé change de défenseur.
    if (this.holder !== null && this.shot === null) {
      const input = list[this.holder] ?? IDLE_INPUT;
      if (input.pass && this.passCooldown <= 0 && !this.players[this.holder].airborne) this.passBall(this.holder, input);
    }
    const mine = list[this.controlled];
    const defending = this.holder === null ? this.pass === null || this.pass.team !== this.userTeam : this.team[this.holder] !== this.userTeam;
    if (mine?.pass && defending && this.teamPlay && !this.rules?.restart) this.switchDefender();
    // Interception (A) : geste de vol sur le porteur, ou bras allongé dans une ligne de passe.
    if (this.teamPlay && !this.rules?.restart && (!full || full.phase === 'jeu' || full.phase === 'remise')) {
      for (let i = 0; i < this.players.length; i++) if (list[i]?.steal) this.stealGesture(i);
    }

    if (this.shot) {
      const shooter = this.players[this.shot.shooter];
      const input = list[this.shot.shooter] ?? IDLE_INPUT;
      this.shot.airTime += dt;
      if (this.shot.dunk) this.stepDunk();
      // Lâcher au relâchement de Tir ; Tir encore enfoncé à l'atterrissage : le tir part tout seul.
      else if (input.release) this.releaseShot(false);
      else if (!shooter.airborne) this.releaseShot(true);
    }

    let wall = false;
    if (this.holder !== null) {
      const holder = this.players[this.holder];
      // Le lanceur d'une remise tient le ballon devant lui, sans dribbler.
      this.dribbleTime = holder.airborne || this.holder === thrower ? 0 : this.dribbleTime + dt;
      this.ball.pos = this.handPosition(holder);
      this.ball.vel = { ...holder.vel };
      // Demi-terrain : tenir le ballon derrière l'arc le « ressort » pour toute l'équipe.
      const team = this.team[this.holder];
      if (this.rules?.mustClear[team] && isCleared(this.court, this.court.hoops.right, holder.pos)) {
        this.rules.mustClear[team] = false;
      }
    } else {
      if (this.pass) {
        this.pass.elapsed += dt;
        if (this.pass.elapsed > PASS_FLOW.maxFlight) this.pass = null;
      }
      for (const event of stepBall(this.ball, this.court, dt)) {
        if (event.type === 'wall') wall = true;
        // Passe ratée : au premier rebond, c'est un ballon libre.
        if (event.type === 'floor' && this.pass) this.pass = null;
        if (event.type === 'floor' && full?.phase === 'entre-deux') this.tossBall();
        const shot = this.lastShot;
        if (!shot || shot.live !== null) continue;
        if (event.type === 'rim' || event.type === 'board') this.rimTouched = true;
        if (event.type === 'score' && event.hoop === shot.hoop && !shot.scored) this.onBasket(shot);
        if (event.type === 'floor') shot.live = shot.scored;
        // Raté : au sol, ou dès le cercle ou la planche quand le résultat tiré est un raté.
        if (!shot.scored && (event.type === 'floor' || ((event.type === 'rim' || event.type === 'board') && !shot.wanted))) {
          this.boxMissed(shot);
          this.markMissed(shot);
        }
      }
      if (full?.phase === 'entre-deux') this.checkTip();
      else if (!this.rules?.restart && this.ballLive) {
        if (this.pass) this.checkPassLane();
        this.checkTouch();
        this.tryPickup();
      }
    }
    if (this.full) this.referee(dt, wall);
    // Ballon mort à ce pas : le coach de chaque équipe regarde son cinq (le tireur des lancers reste).
    if (this.subsDue) {
      this.subsDue = false;
      if (this.full?.phase === 'mort') this.coachSubs(this.full.freeThrows?.shooter ?? null);
    }
  }

  /**
   * Ton équipe défend-elle ? L'adversaire a le ballon, ou sa passe est en l'air, ou c'est sa remise
   * (ballon mort compris), ou il a eu le ballon en dernier (ballon libre).
   */
  get userDefending(): boolean {
    if (this.holder !== null) return this.team[this.holder] !== this.userTeam;
    if (this.pass) return this.pass.team !== this.userTeam;
    const full = this.full;
    if (full?.inbound && (full.phase === 'mort' || full.phase === 'remise')) return full.inbound.team !== this.userTeam;
    return this.possession !== null && this.possession.team !== this.userTeam;
  }

  /** Le ballon peut-il être ramassé ou touché ? (Pas pendant un ballon mort, une fin de période ou l'entre-deux.) */
  get ballLive(): boolean {
    const phase = this.full?.phase;
    return phase === undefined || phase === 'jeu' || phase === 'remise';
  }

  // --- Terrain entier : effectifs, fatigue, box score ---

  /** Joueur de la rotation qui occupe le corps `body` (terrain entier), ou null. */
  memberOf(body: number): MatchMember | null {
    return this.squads?.[this.team[body]]?.members.find((m) => m.body === body) ?? null;
  }

  /** Temps de chrono avant le prochain contrôle du coach de l'équipe `team` (s), 0 s'il est dû. */
  nextSubCheck(team: number): number {
    const full = this.full;
    const squad = this.squads?.[team];
    if (!full || !squad) return 0;
    return Math.max(0, SUB_INTERVAL / matchTimeScale(full.quarterMinutes) - squad.sinceSub);
  }

  /** Nouveau match : rotations remises à neuf (énergie, stats, fautes), cinq de départ sur les corps de chaque équipe. */
  private setupSquads(): void {
    if (this.rosters.length !== 2) return;
    const squads = this.rosters.map((rotation, team) => createSquad(team, rotation));
    squads.forEach((squad, team) => {
      const five = startingLineup(squad.members);
      const bodies = this.membersOf(team);
      five.forEach((m, k) => {
        m.body = bodies[k];
        m.starter = true;
        m.line.gs = 1;
        m.line.gp = 1;
      });
      seatLineup(squad.members, five);
      this.lineup[team] = five.map((m) => m.body!);
    });
    this.squads = squads;
    this.box = new LiveBox(squads.map((s) => s.members));
    this.box.startPeriod();
    this.tiredClock = 0;
    this.subsDue = false;
    this.lineupVersion++;
    this.refreshAthletes(true);
  }

  /**
   * Le corps de chaque joueur sur le terrain prend ses notes du moment (fatigue). Hors `all`, on ne
   * touche pas à un joueur en l'air ni au tireur : son saut en cours garde ses notes.
   */
  private refreshAthletes(all: boolean): void {
    for (const squad of this.squads ?? []) {
      for (const m of squad.members) {
        if (m.body === null) continue;
        const body = this.players[m.body];
        if (!all && (body.airborne || this.shot?.shooter === m.body)) continue;
        setBodyAthlete(body, tiredAthlete(m.player, m.energy));
      }
    }
  }

  /** Le chrono a tourné de `seconds` : minutes jouées, fatigue et récupération ; notes recalculées chaque seconde. */
  private playTime(seconds: number): void {
    const full = this.full;
    if (!full || !this.squads || seconds <= 0) return;
    const scale = matchTimeScale(full.quarterMinutes);
    for (const squad of this.squads) tickSquad(squad, seconds, scale);
    this.tiredClock += seconds;
    if (this.tiredClock >= 1) {
      this.tiredClock = 0;
      this.refreshAthletes(false);
    }
  }

  /**
   * Ballon mort : le coach de chaque équipe recompose son cinq (logique de la simulation), si
   * l'intervalle des changements est passé ou si un de ses joueurs vient d'être éliminé. Un
   * remplaçant prend le corps de celui qui sort ; `keep` (tireur des lancers) reste sur le terrain.
   */
  private coachSubs(keep: number | null): void {
    const full = this.full;
    if (!full || !this.squads) return;
    const ctx = this.coach;
    ctx.timeScale = matchTimeScale(full.quarterMinutes);
    const progress = matchProgress(full.period, full.clock, full.quarterMinutes);
    updateCoachContext(ctx, full.period, full.clock, progress, 1, Math.abs(this.points[0] - this.points[1]), FULL_COURT.periods);
    const keeper = keep !== null ? this.memberOf(keep) : null;
    for (const squad of this.squads) {
      const forced = squad.members.some((m) => m.body !== null && m.fouledOut);
      if (!forced && squad.sinceSub * ctx.timeScale < SUB_INTERVAL) continue;
      const five = nextLineup(squad.members, ctx);
      if (keeper && keeper.team === squad.team && !five.includes(keeper)) continue;
      squad.sinceSub = 0;
      const before = this.lineup[squad.team].join();
      const { lineup, entering } = substitute(squad, five, this.lineup[squad.team]);
      this.lineup[squad.team] = lineup;
      for (const sub of entering) {
        const body = this.players[sub.body];
        setBodyAthlete(body, tiredAthlete(sub.member.player, sub.member.energy));
        this.followThrough[sub.body] = false;
        this.reachUntil[sub.body] = 0;
        this.stealCooldown[sub.body] = 0;
        this.offBalance[sub.body] = 0;
        this.pushEvent('changement', sub.body, sub.body);
      }
      if (entering.length > 0 || lineup.join() !== before) this.lineupVersion++;
    }
  }

  /** Faute personnelle de `fouler` : faute d'équipe ; à la 6e, il est éliminé (il sortira au ballon mort). */
  private foulCommitted(fouler: number): void {
    const member = this.memberOf(fouler);
    const squad = this.squads?.[this.team[fouler]];
    if (!member || !squad) return;
    this.box?.foul(member);
    squad.fouls += 1;
    if (member.line.pf >= FOUL_OUT && !member.fouledOut) {
      member.fouledOut = true;
      this.pushEvent('6 fautes', fouler, fouler);
    }
  }

  /** Perte de balle : notée, et comptée au box score (perte au joueur, interception au voleur). */
  private addTurnover(turnover: Turnover): void {
    this.turnovers.push(turnover);
    const loser = this.memberOf(turnover.loser);
    if (!loser || !this.box) return;
    this.box.turnover(loser, turnover.thief !== null ? this.memberOf(turnover.thief) : null);
  }

  /** Tir lâché par `shooter` : tentative au box score. */
  private boxAttempt(shooter: number, value: ShotValue): void {
    const member = this.memberOf(shooter);
    if (member) this.box?.attempt(member, value);
  }

  /** Tir raté (sauf un lancer suivi d'un autre) : le prochain qui prend le ballon a le rebond. */
  private boxMissed(shot: ShotRecord): void {
    if (!this.box || shot.demo || (shot.kind === 'lancer' && this.full?.phase === 'lancers')) return;
    this.box.missed(this.team[shot.shooter]);
  }

  /**
   * Passeur décisif possible d'un tir de `shooter` lâché maintenant : il a reçu la passe il y a
   * moins de 4 s, et son équipe n'a pas perdu le ballon depuis.
   */
  private assistFor(shooter: number): number | null {
    const pass = this.lastPass;
    const possession = this.possession;
    if (!pass || pass.receiver !== shooter || !possession || possession.team !== this.team[shooter]) return null;
    if (possession.since > pass.time || this.clock - pass.time > BOX_RULES.assistWindow) return null;
    return pass.passer;
  }

  // --- Terrain entier : arbitrage ---

  /**
   * Pauses du terrain entier : ballon mort (puis mise en place de la remise), fin de période (puis
   * la suivante), fin de match (puis un nouveau). Renvoie vrai si personne ne doit jouer ce pas-ci.
   */
  private stepPauses(dt: number): boolean {
    const full = this.full!;
    if (full.phase === 'mort') {
      if (full.inbound?.clockRuns && this.runClock(dt)) return true;
      full.pause -= dt;
      if (full.pause <= 0) {
        if (full.freeThrows) this.setupFreeThrows(true);
        else this.setupInbound();
      }
      return false;
    }
    if (full.phase === 'fin-periode' || full.phase === 'fin-match') {
      full.pause -= dt;
      if (full.pause <= 0) {
        if (full.phase === 'fin-match') this.startMatch();
        else this.startPeriod(full.period + 1);
      }
      return true;
    }
    return false;
  }

  /**
   * Le chrono de jeu tourne ; à 0, la période se termine (après le tir en l'air s'il y en a un).
   * Renvoie vrai si la période vient de finir.
   */
  private runClock(dt: number): boolean {
    const full = this.full!;
    if (full.buzzerPending || full.waitTouch) return false;
    const before = full.clock;
    full.clock = Math.max(0, full.clock - dt);
    this.playTime(before - full.clock);
    if (full.clock > 0) return false;
    const shot = this.lastShot;
    const inAir = full.phase === 'jeu' && full.shotUp && shot !== null && !shot.demo && shot.live === null && !shot.scored && this.holder === null;
    if (inAir) {
      full.buzzerPending = true;
      return false;
    }
    this.endPeriod();
    return true;
  }

  /**
   * Arbitre du terrain entier, après chaque pas : entre-deux, chrono et shot clock, 8 s, retour en
   * zone, sorties, 5 s sur remise.
   */
  private referee(dt: number, wall: boolean): void {
    const full = this.full!;
    if (full.phase === 'remise') {
      if (full.inbound?.clockRuns && this.runClock(dt)) return;
      const inbound = full.inbound;
      if (inbound && inbound.thrower !== null && this.holder === inbound.thrower) {
        inbound.timer += dt;
        if (inbound.timer >= FULL_COURT.inboundLimit) {
          this.callViolation('5 secondes', inbound.team, inbound.thrower, inbound.spot);
          return;
        }
      }
      if (this.holder === null) this.checkLooseOut(wall);
      return;
    }
    if (full.phase !== 'jeu') return;
    // Fin de période sur un tir lâché avant la sirène : on attend son issue.
    if (full.buzzerPending) {
      const shot = this.lastShot;
      if (!shot || shot.scored || shot.live !== null || this.holder !== null) this.endPeriod();
      return;
    }
    if (this.runClock(dt)) return;
    if (this.stepShotClock(dt)) return;
    const holder = this.holder;
    if (holder !== null) {
      const body = this.players[holder];
      const team = this.team[holder];
      if (!body.airborne && isOut(this.court, body.pos, FULL_COURT.footMargin)) {
        this.callViolation('sortie', team, holder, body.pos);
        return;
      }
      const front = inFrontcourt(this.court, team, full.period, body.pos.x);
      if (front) full.frontcourt = true;
      else if (full.frontcourt && !body.airborne) {
        this.callViolation('retour en zone', team, holder, body.pos);
        return;
      }
    }
    // 8 s pour passer dans sa moitié avant, ballon tenu ou en passe.
    const control = holder !== null ? this.team[holder] : this.pass ? this.pass.team : null;
    if (control !== null && control === this.possession?.team && !full.frontcourt) {
      full.backcourtTime += dt;
      if (full.backcourtTime >= FULL_COURT.backcourtLimit) {
        const at = holder ?? this.pass!.passer;
        this.callViolation('8 secondes', control, at, this.players[at].pos);
        return;
      }
    }
    if (holder === null) this.checkLooseOut(wall);
  }

  /**
   * Shot clock : il tourne tant qu'un tir n'a pas touché le cercle ; à 0, violation (après l'issue
   * d'un tir en l'air). Renvoie vrai s'il y a violation.
   */
  private stepShotClock(dt: number): boolean {
    const full = this.full!;
    const team = this.possession?.team ?? null;
    if (team === null || full.waitTouch) return false;
    // Plus de shot clock quand il reste moins de temps au chrono de jeu.
    if (full.clock < full.shotClock) return false;
    if (full.shotClockPending) {
      if (this.rimTouched || this.lastShot?.scored) full.shotClockPending = false;
      else if (this.lastShot && this.lastShot.live !== null) return this.shotClockViolation(team);
      return false;
    }
    if (full.shotUp && this.rimTouched) return false;
    full.shotClock = Math.max(0, full.shotClock - dt);
    if (full.shotClock > 0) return false;
    if (full.shotUp && this.holder === null && this.lastShot && this.lastShot.live === null) {
      full.shotClockPending = true;
      return false;
    }
    return this.shotClockViolation(team);
  }

  private shotClockViolation(team: number): boolean {
    const at = this.holder ?? this.shot?.shooter ?? this.full!.lastTouch?.player ?? this.membersOf(team)[0];
    this.callViolation('24 secondes', team, at, this.players[at].pos);
    return true;
  }

  /** Ballon libre qui touche le sol dehors, ou le bord de la salle : sorti, au détriment du dernier à l'avoir touché. */
  private checkLooseOut(wall: boolean): void {
    const ball = this.ball.pos;
    const onFloor = ball.z <= BALL_RADIUS + 0.02;
    if (!wall && !(onFloor && isOut(this.court, ball, FULL_COURT.ballMargin))) return;
    const last = this.full!.lastTouch;
    const team = last?.team ?? this.possession?.team ?? 0;
    const player = last?.player ?? this.membersOf(team)[0];
    this.callViolation('sortie', team, player, ball);
  }

  /**
   * Violation (ou sortie) de l'équipe `team` : perte de balle, message au-dessus de `player`,
   * ballon mort, puis remise pour l'autre équipe au point le plus proche de `at`.
   */
  private callViolation(kind: ViolationKind, team: number, player: number, at: { x: number; y: number }): void {
    const full = this.full!;
    if (kind !== 'entre-deux') this.addTurnover({ kind, thief: null, loser: player, time: this.clock });
    this.pushEvent(kind, player, player);
    full.lastViolation = { kind, team, player, time: this.clock };
    const spot = kind === '5 secondes' && full.inbound ? full.inbound.spot : outSpot(this.court, at, kind !== 'sortie');
    this.deadBall({ team: 1 - team, thrower: null, spot, timer: 0, shotClock: FULL_COURT.shotClock, clockRuns: false, afterBasket: false }, FULL_COURT.deadPause);
  }

  /** Ballon mort : plus de tir, de passe ni de porteur ; la remise `inbound` sera mise en place après `pause`. */
  private deadBall(inbound: Inbound, pause: number): void {
    const full = this.full!;
    if (this.shot) this.endShot();
    this.play = null;
    this.pass = null;
    this.loose = null;
    if (this.holder !== null) this.ball.vel = { x: 0, y: 0, z: 0 };
    this.holder = null;
    full.phase = 'mort';
    full.pause = pause;
    full.inbound = inbound;
    full.shotUp = false;
    full.shotClockPending = false;
    this.box?.dead();
    this.subsDue = true;
  }

  /**
   * Faute (en attendant les lancers francs du 11) : ballon mort, puis remise de côté pour l'équipe
   * qui l'a subie, près de l'endroit de la faute ; au moins 14 s au shot clock.
   */
  private foulInbound(fouled: number): void {
    const full = this.full!;
    if (full.phase !== 'jeu' && full.phase !== 'remise') return;
    const team = this.team[fouled];
    const keep = this.possession?.team === team ? Math.max(full.shotClock, FULL_COURT.shotClockReset) : FULL_COURT.shotClock;
    this.deadBall({ team, thrower: null, spot: outSpot(this.court, this.players[fouled].pos, true), timer: 0, shotClock: keep, clockRuns: false, afterBasket: false }, FULL_COURT.deadPause);
  }

  /**
   * Mise en place de la remise : le joueur de l'équipe le plus proche va au point de remise (hors
   * du terrain) avec le ballon ; possession, shot clock, contrôle. Le chrono repart au toucher.
   */
  private setupInbound(): void {
    const full = this.full!;
    const inbound = full.inbound!;
    const thrower = inbound.thrower ?? this.nearestOf(inbound.team, inbound.spot) ?? this.lineup[inbound.team][0];
    inbound.thrower = thrower;
    inbound.timer = 0;
    const body = this.players[thrower];
    body.pos = { ...inbound.spot };
    body.vel = { x: 0, y: 0, z: 0 };
    body.airborne = false;
    body.facing = inbound.spot.x < this.court.length / 2 ? 1 : -1;
    this.followThrough[thrower] = false;
    if (this.shot) this.endShot();
    this.play = null;
    this.pass = null;
    this.loose = null;
    this.holder = thrower;
    this.dribbleTime = 0;
    this.cooldown = 0;
    this.passCooldown = 0;
    this.ball = { pos: this.handPosition(body), vel: { x: 0, y: 0, z: 0 } };
    this.box?.dead();
    full.phase = 'remise';
    full.lastTouch = { player: thrower, team: inbound.team };
    full.frontcourt = false;
    full.backcourtTime = 0;
    full.shotUp = false;
    full.shotClockPending = false;
    if (inbound.shotClock !== 'garde') full.shotClock = inbound.shotClock;
    this.possession = { team: inbound.team, since: this.clock };
    this.followPossession(thrower);
  }

  /** Nouveau match : 0-0, première période, entre-deux. */
  private startMatch(): void {
    const full = this.full!;
    const fresh = newFullCourt(full.quarterMinutes);
    Object.assign(full, fresh);
    this.points = [0, 0];
    this.lastPass = null;
    this.lastSteal = null;
    this.lastIntercept = null;
    this.lastShot = null;
    this.turnovers.length = 0;
    this.setupSquads();
    this.setupTip();
  }

  /** Période `period` : chrono plein ; entre-deux en prolongation, sinon remise de la ligne de fond dans sa moitié. */
  private startPeriod(period: number): void {
    const full = this.full!;
    full.period = period;
    full.clock = periodLength(full.quarterMinutes, period);
    full.buzzerPending = false;
    // Fautes d'équipe remises à 0 ; le coach peut changer son cinq avant la reprise.
    for (const squad of this.squads ?? []) squad.fouls = 0;
    this.box?.startPeriod();
    this.coachSubs(null);
    if (period > FULL_COURT.periods) {
      this.setupTip();
      return;
    }
    const team = periodStarter(period, full.tipWinner ?? 0);
    const spot = baselineSpot(this.court, this.defendHoop(team));
    const thrower = this.lineup[team][this.lineup[team].length - 1];
    const positions = periodPositions(this.court, period, team, this.lineup, spot, thrower);
    this.placeAll(positions);
    full.inbound = { team, thrower, spot, timer: 0, shotClock: FULL_COURT.shotClock, clockRuns: false, afterBasket: false };
    this.setupInbound();
  }

  /** Fin de période : pause, mi-temps, prolongation sur égalité, ou fin du match. */
  private endPeriod(): void {
    const full = this.full!;
    if (this.shot) this.endShot();
    this.play = null;
    this.pass = null;
    this.holder = null;
    full.buzzerPending = false;
    full.shotClockPending = false;
    full.inbound = null;
    full.freeThrows = null;
    full.waitTouch = false;
    full.clock = 0;
    this.box?.dead();
    // Repos entre les périodes (plus long à la mi-temps), comme en simulation.
    for (const squad of this.squads ?? []) for (const m of squad.members) m.energy = restEnergy(m.energy, full.period);
    if (full.period >= FULL_COURT.periods && this.points[0] !== this.points[1]) {
      full.phase = 'fin-match';
      full.winner = this.points[0] > this.points[1] ? 0 : 1;
      full.pause = FULL_COURT.finalPause;
      return;
    }
    full.phase = 'fin-periode';
    full.pause = full.period === 2 ? FULL_COURT.halftimePause : FULL_COURT.periodPause;
  }

  /** Tous les joueurs à leur place, immobiles ; plus de tir, de passe ni de vol en cours. */
  private placeAll(positions: Map<number, Vec3>): void {
    for (const [i, pos] of positions) {
      const body = this.players[i];
      body.pos = { ...pos };
      body.vel = { x: 0, y: 0, z: 0 };
      body.airborne = false;
      body.facing = pos.x < this.court.length / 2 ? 1 : -1;
      this.followThrough[i] = false;
      this.reachUntil[i] = 0;
      this.stealCooldown[i] = 0;
      this.offBalance[i] = 0;
    }
    if (this.shot) this.endShot();
    this.play = null;
    this.pass = null;
    this.loose = null;
    this.basketPending = false;
    this.dribbleTime = 0;
    this.cooldown = 0;
    this.box?.dead();
  }

  /**
   * Entre-deux : les pivots dans le rond, chacun côté de son panier, les autres autour ; tu joues
   * ton pivot. Le ballon est lancé du centre.
   */
  private setupTip(): void {
    const full = this.full!;
    const jumpers = this.lineup.map((members) => members[members.length - 1]) as [number, number];
    const order = this.lineup.map((members, team) => [jumpers[team], ...members.filter((i) => i !== jumpers[team])]);
    this.placeAll(tipPositions(this.court, full.period, order));
    jumpers.forEach((j, team) => (this.players[j].facing = team === 0 ? (full.period <= 2 ? 1 : -1) : full.period <= 2 ? -1 : 1));
    full.phase = 'entre-deux';
    full.tip = { jumpers, falling: false };
    full.inbound = null;
    full.lastTouch = null;
    full.frontcourt = false;
    full.backcourtTime = 0;
    full.shotUp = false;
    full.shotClock = FULL_COURT.shotClock;
    this.holder = null;
    this.possession = null;
    this.controlled = jumpers[this.userTeam];
    this.tossBall();
  }

  /** Lancer de l'entre-deux : du centre, le sommet un peu au-dessus de la plus haute main des deux sauteurs. */
  private tossBall(): void {
    const full = this.full!;
    if (!full.tip) return;
    const top = Math.max(...full.tip.jumpers.map((j) => this.players[j].jumpHeight + reach(this.players[j].athlete)));
    const apex = top + FULL_COURT.tossAbove;
    const vz = Math.sqrt(2 * BALL_PHYSICS.gravity * Math.max(0.1, apex - FULL_COURT.tossFrom));
    this.ball = { pos: { x: this.court.length / 2, y: this.court.width / 2, z: FULL_COURT.tossFrom }, vel: { x: 0, y: 0, z: vz } };
    full.tip.falling = false;
  }

  /**
   * Entre-deux : la première main en l'air sur le ballon après son sommet le tape vers un
   * coéquipier (la plus haute si les deux le touchent au même pas). Toucher avant le sommet est
   * une violation.
   */
  private checkTip(): void {
    const full = this.full!;
    const tip = full.tip!;
    if (this.ball.vel.z <= 0) tip.falling = true;
    const touching = tip.jumpers.filter((j) => {
      const body = this.players[j];
      return body.airborne && armContact(body.pos, body.athlete.heightCm, reach(body.athlete), this.ball.pos) !== null;
    });
    if (touching.length === 0) return;
    if (!tip.falling) {
      const j = touching[0];
      full.tip = null;
      full.tipWinner ??= 1 - this.team[j];
      this.callViolation('entre-deux', this.team[j], j, { x: this.court.length / 2, y: 0 });
      return;
    }
    const hand = (j: number) => this.players[j].pos.z + reach(this.players[j].athlete);
    const winner = touching.reduce((a, b) => (hand(b) > hand(a) ? b : a));
    const team = this.team[winner];
    // Tapé vers le coéquipier le plus proche du ballon.
    const mate = this.nearestOf(team, this.ball.pos, winner) ?? winner;
    const to = this.players[mate].pos;
    const dx = to.x - this.ball.pos.x;
    const dy = to.y - this.ball.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = Math.min(5, d * 1.6);
    this.ball.vel = { x: (dx / d) * speed, y: (dy / d) * speed, z: 1 };
    this.cooldown = 0.15;
    full.tip = null;
    full.tipWinner ??= team;
    full.lastTouch = { player: winner, team };
    full.phase = 'jeu';
  }

  /**
   * Joueur qui touche le ballon (prise, passe, déviation, contre, tir) : dernier toucher. Une
   * remise touchée sur le terrain lance le jeu (chrono) ; une touche de la défense excuse le
   * retour en zone.
   */
  private touchBall(i: number): void {
    const full = this.full;
    if (!full) return;
    const team = this.team[i];
    full.waitTouch = false;
    if (full.phase === 'remise' && i !== full.inbound?.thrower) {
      full.phase = 'jeu';
      full.inbound = null;
    }
    if (this.possession && team !== this.possession.team) {
      full.frontcourt = false;
      full.backcourtTime = 0;
    }
    full.lastTouch = { player: i, team };
  }

  /** Ballon libre touché (dévié) par `i` : dernier toucher ; touché depuis l'extérieur, il est sorti. Renvoie faux si le jeu s'arrête. */
  private touchLoose(i: number): boolean {
    if (!this.full) return true;
    this.touchBall(i);
    if (!isOut(this.court, this.players[i].pos, FULL_COURT.footMargin)) return true;
    this.callViolation('sortie', this.team[i], i, this.players[i].pos);
    return false;
  }

  /**
   * Terrain entier : le joueur `picker` prend le ballon. Dehors, c'est une sortie ; une prise dans
   * sa moitié arrière après que son équipe l'a amené devant (sans touche de la défense), un retour
   * en zone. Renvoie faux si le jeu s'arrête.
   */
  private fullGain(picker: number): boolean {
    const full = this.full;
    if (!full) return true;
    const team = this.team[picker];
    const body = this.players[picker];
    const before = full.lastTouch;
    this.touchBall(picker);
    if (isOut(this.court, body.pos, FULL_COURT.footMargin)) {
      this.callViolation('sortie', team, picker, body.pos);
      return false;
    }
    if (full.phase !== 'jeu') return true;
    const sameTeam = this.possession?.team === team;
    if (!sameTeam) {
      full.shotClock = FULL_COURT.shotClock;
      full.frontcourt = false;
      full.backcourtTime = 0;
    } else if (full.shotUp && this.rimTouched) {
      // Rebond offensif après le cercle : 14 s.
      full.shotClock = FULL_COURT.shotClockReset;
    } else if (full.frontcourt && before?.team === team && !full.shotUp && !inFrontcourt(this.court, team, full.period, body.pos.x)) {
      this.callViolation('retour en zone', team, picker, body.pos);
      return false;
    }
    full.shotUp = false;
    full.shotClockPending = false;
    return true;
  }

  /** Tir lâché (ou smash) : dernier toucher au tireur ; le shot clock s'arrêtera quand le ballon touchera le cercle. */
  private shotReleased(shooter: number): void {
    const full = this.full;
    if (!full) return;
    full.lastTouch = { player: shooter, team: this.team[shooter] };
    full.shotUp = true;
    full.frontcourt = false;
    full.backcourtTime = 0;
  }

  /**
   * Geste de vol (A) d'un joueur au sol : le bras s'allonge un instant (ligne de passe). Sur le
   * porteur adverse, `match/` mesure la main (distance, exposition du ballon, rapprochement) et
   * `engine/` tranche : faute de main d'abord, puis vol. Raté ou dans le vide : déséquilibre.
   */
  private stealGesture(i: number): void {
    const body = this.players[i];
    if (this.stealCooldown[i] > 0 || body.airborne || this.holder === i) return;
    this.stealCooldown[i] = STEAL_FLOW.cooldown;
    this.reachUntil[i] = this.clock + STEAL_FLOW.gesture;
    const h = this.holder;
    if (h === null || this.team[h] === this.team[i] || this.full?.phase === 'remise') return;
    const handler = this.players[h];
    const m = measureSteal(body.pos, handler.pos, this.ball.pos);
    if (!m) {
      this.offBalance[i] = STEAL_FLOW.offBalance;
      return;
    }
    const foulCtx = { thief: body.athlete, handler: handler.athlete, closeness: m.closeness, across: 1 - m.exposed };
    const stealCtx = { thief: body.athlete, handler: handler.athlete, reach: m.reach, exposed: m.exposed };
    const attempt: StealAttempt = {
      ...m,
      thief: i,
      handler: h,
      foulProbability: reachFoulProbability(foulCtx),
      stealProbability: stealProbability(stealCtx),
      result: 'raté',
      time: this.clock,
    };
    this.lastSteal = attempt;
    if (resolveReachFoul(foulCtx, this.rng)) {
      // Faute de main : ballon mort, puis le porteur reprend en haut de la raquette.
      attempt.result = 'faute';
      this.pushEvent('faute-main', i, h);
      this.foulCommitted(i);
      // En bonus (plus de 5 fautes d'équipe dans la période) : 2 lancers au porteur au lieu de la remise.
      const squad = this.squads?.[this.team[i]];
      if (this.full && squad && inBonus(squad.fouls)) {
        this.pushEvent('bonus', i, h);
        this.freeThrowsFor(h, 2);
        return;
      }
      this.startRestart(h);
      return;
    }
    if (resolveSteal(stealCtx, this.rng)) {
      // Ballon arraché : il part vers le défenseur, libre.
      attempt.result = 'vol';
      this.touchBall(i);
      this.ball = { pos: { ...this.ball.pos }, vel: pokeVelocity(handler.pos, body.pos, this.rng) };
      this.holder = null;
      this.cooldown = STEAL_FLOW.pokeCooldown;
      this.loose = { by: i, from: h, kind: 'vol' };
      this.pushEvent('vol', i, h);
      return;
    }
    this.offBalance[i] = STEAL_FLOW.offBalance;
  }

  /**
   * Passe en vol : chaque adversaire du passeur a une chance, au premier contact (corps et mains
   * au sol, bras allongé avec A, bras levé en l'air). `engine/` tranche : attrapée, déviée ou ratée.
   */
  private checkPassLane(): void {
    const pass = this.pass!;
    const ball = this.ball;
    for (const j of this.membersOf(1 - pass.team)) {
      if (pass.checked.includes(j)) continue;
      const body = this.players[j];
      const reaching = this.clock < (this.reachUntil[j] ?? 0);
      // En l'air : le corps qui monte dans la ligne, ou le bras levé sur une passe haute.
      const contact =
        laneContact(body.pos, reach(body.athlete), ball.pos, reaching, ball.vel) ??
        (body.airborne ? armContact(body.pos, body.athlete.heightCm, reach(body.athlete), ball.pos) : null);
      if (!contact) continue;
      pass.checked.push(j);
      const ctx = {
        defender: body.athlete,
        passer: this.players[pass.passer].athlete,
        contact: contact.quality,
        passSpeed: Math.hypot(ball.vel.x, ball.vel.y),
        reaching,
        airborne: body.airborne,
      };
      const outcome = resolveInterception(ctx, this.rng);
      this.lastIntercept = { defender: j, passer: pass.passer, contact: contact.quality, ...interceptionChances(ctx), outcome, time: this.clock };
      if (outcome === 'catch') {
        this.pass = null;
        if (!this.fullGain(j)) return;
        this.holder = j;
        this.dribbleTime = 0;
        this.addTurnover({ kind: 'interception', thief: j, loser: pass.passer, time: this.clock });
        this.pushEvent('interception', j, pass.passer);
        this.takeBall(j);
        return;
      }
      if (outcome === 'deflect') {
        if (!this.touchLoose(j)) return;
        this.ball.vel = deflectVelocity(this.rng);
        this.pass = null;
        this.cooldown = STEAL_FLOW.deflectCooldown;
        this.loose = { by: j, from: pass.passer, kind: 'déviation' };
        this.pushEvent('déviation', j, pass.passer);
        return;
      }
    }
  }

  private pushEvent(kind: MatchEvent['kind'], by: number, of: number): void {
    this.eventCount++;
    this.events.push({ id: this.eventCount, kind, by, of, time: this.clock });
    if (this.events.length > 20) this.events.shift();
  }

  /** Panier marqué : points au tireur, ou panier non valable (pas ressorti) et ballon à l'autre. */
  private onBasket(shot: ShotRecord): void {
    shot.scored = true;
    this.basketPending = true;
    if (shot.demo) return;
    const rules = this.rules;
    if (rules && !shot.cleared) {
      shot.invalid = true;
      shot.live = true;
      // Faute sur ce tir : un panier non valable compte comme un raté (ballon au tireur).
      if (this.play?.record === shot && this.play.foul?.called) {
        this.markMissed(shot);
        return;
      }
      // Ballon à l'adversaire le plus proche, dont l'équipe doit ressortir.
      this.basketPending = false;
      const otherTeam = 1 - this.team[shot.shooter];
      const other = this.nearestOf(otherTeam, this.ball.pos) ?? 0;
      this.holder = other;
      this.dribbleTime = 0;
      this.pass = null;
      rules.mustClear[otherTeam] = true;
      rules.mustClear[this.team[shot.shooter]] = false;
      rules.lastTeam = otherTeam;
      this.possession = { team: otherTeam, since: this.clock };
      this.followPossession(other);
      return;
    }
    const team = this.team[shot.shooter];
    const value: ShotValue = shot.kind === 'lancer' ? 1 : shot.three ? 3 : 2;
    this.points[team] += value;
    const scorer = this.memberOf(shot.shooter);
    if (scorer && this.box) {
      const assist = this.play?.record === shot ? this.play.assist : null;
      this.box.scored(team, scorer, value, assist !== null ? this.memberOf(assist) : null);
    }
    if (rules && rules.winner === null && this.points[team] >= rules.target) {
      rules.winner = team;
      rules.pause = HALF_COURT.endPause;
    }
    // Terrain entier : l'autre équipe remet derrière la ligne de fond, sous ce panier (le chrono
    // continue, sauf dans la dernière minute du QT4 et des prolongations).
    const full = this.full;
    if (!full) return;
    // Lancer franc réussi : la série continue, ou c'était le dernier (remise adverse, chrono arrêté).
    if (shot.kind === 'lancer' && full.phase === 'lancers') {
      if (full.freeThrows) full.freeThrows.made++;
      return;
    }
    // Panier avec faute : il compte, plus un lancer.
    const play = this.play;
    if (shot.kind !== 'lancer' && play?.record === shot && play.foul?.called && !play.freeThrows) {
      this.awardFreeThrows(play, 1);
      return;
    }
    if (!full.buzzerPending && (full.phase === 'jeu' || full.phase === 'remise')) {
      const hoop = shot.hoop === 'left' ? this.court.hoops.left : this.court.hoops.right;
      const clockRuns = shot.kind !== 'lancer' && !clockStopsAfterBasket(full.period, full.clock);
      this.basketPending = false;
      this.deadBall(
        { team: 1 - team, thrower: null, spot: baselineSpot(this.court, hoop), timer: 0, shotClock: FULL_COURT.shotClock, clockRuns, afterBasket: true },
        FULL_COURT.basketPause,
      );
    }
  }

  /**
   * Faute : au premier contact des corps pendant le tir (de l'appui à l'atterrissage du tireur),
   * au sol ou en l'air, `engine/` dit si elle est sifflée. Une seule évaluation par tir.
   */
  private checkFoul(): void {
    const play = this.play;
    if (!play || !play.watching || play.foul || !this.teamPlay) return;
    const shooter = this.players[play.shooter];
    if (this.shot?.shooter !== play.shooter && !shooter.airborne) {
      play.watching = false;
      return;
    }
    for (let i = 0; i < this.players.length; i++) {
      if (this.team[i] === this.team[play.shooter]) continue;
      const defender = this.players[i];
      const contact = bodyContact(defender, shooter);
      if (!contact) continue;
      const ctx = { defender: defender.athlete, shooter: shooter.athlete, ...contact };
      const foul: FoulCall = { defender: i, probability: foulProbability(ctx), called: foulOnContact(ctx, this.rng) };
      play.foul = foul;
      if (play.record) play.record.foul = foul;
      if (foul.called) this.foulCommitted(i);
      if (foul.called && play.missed) this.foulOnMiss(play);
      // Contact après que le ballon est entré (dunk) : panier et un lancer.
      else if (foul.called && this.full && play.record?.scored && !play.record.invalid) this.awardFreeThrows(play, 1);
      return;
    }
  }

  /**
   * Main d'un défenseur en l'air sur le ballon d'un vrai tir. En montée : contre tenté (une fois),
   * `engine/` tranche ; réussi, il annule le résultat tiré et le ballon est frappé. En redescente
   * au-dessus du cercle, avant le cercle et la planche : goaltending, le panier compte.
   */
  private checkTouch(): void {
    const play = this.play;
    const shot = this.lastShot;
    if (!play || !shot || play.record !== shot || shot.kind === 'dunk' || shot.kind === 'lancer' || shot.live !== null || shot.scored) return;
    const hoop = shot.hoop === 'left' ? this.court.hoops.left : this.court.hoops.right;
    const rising = this.ball.vel.z > 0;
    const goaltend = !rising && !this.rimTouched && inGoaltendZone(hoop, this.ball);
    const blockable = rising && shot.block === null && !play.foul?.called;
    if (!goaltend && !blockable) return;
    for (let i = 0; i < this.players.length; i++) {
      if (this.team[i] === this.team[shot.shooter]) continue;
      const body = this.players[i];
      if (!body.airborne) continue;
      const contact = armContact(body.pos, body.athlete.heightCm, reach(body.athlete), this.ball.pos);
      if (!contact) continue;
      const shooter = this.players[shot.shooter];
      if (goaltend) {
        shot.goaltend = true;
        this.swat(body, shooter);
        this.touchBall(i);
        this.onBasket(shot);
        return;
      }
      const ctx = { blocker: body.athlete, shooter: shooter.athlete, contact: contact.quality };
      const probability = blockProbability(ctx);
      const success = resolveBlock(ctx, this.rng);
      shot.block = { blocker: i, contact: contact.quality, probability, success };
      if (success) {
        this.touchBall(i);
        this.swat(body, shooter);
        shot.live = false;
        const blocker = this.memberOf(i);
        if (blocker) this.box?.block(blocker);
        this.boxMissed(shot);
        this.markMissed(shot);
      }
      return;
    }
  }

  /** Ballon frappé par la main de `by` : il part loin de lui, libre. */
  private swat(by: PlayerBody, shooter: PlayerBody): void {
    this.ball.vel = swatVelocity(by.pos, this.ball.pos, shooter.pos, this.rng);
    // Le temps que le ballon s'éloigne : la main qui l'a frappé ne le rattrape pas aussitôt.
    this.cooldown = DEFENSE_FLOW.swatCooldown;
  }

  /** Tir raté (ou contré, ou non valable) : avec une faute sifflée, ballon mort puis au tireur. */
  private markMissed(shot: ShotRecord): void {
    const play = this.play;
    if (!play || play.record !== shot || play.missed) return;
    play.missed = true;
    if (play.foul?.called) this.foulOnMiss(play);
  }

  /** Faute sur un tir raté : lancers francs sur terrain entier (3 sur un tir à 3 pts, sinon 2), ballon au tireur au demi-terrain. */
  private foulOnMiss(play: Play): void {
    if (!this.full) {
      this.startRestart(play.shooter);
      return;
    }
    const record = play.record;
    if (this.awardFreeThrows(play, record?.three ? 3 : 2) && record) {
      // Tir raté avec faute : il ne compte pas comme tenté, et un contre sifflé faute n'est pas un contre.
      const shooter = this.memberOf(record.shooter);
      if (shooter) this.box?.cancelAttempt(shooter, record.three ? 3 : 2);
      const blocker = record.block?.success ? this.memberOf(record.block.blocker) : null;
      if (blocker) blocker.line.blk = Math.max(0, blocker.line.blk - 1);
    }
  }

  /** Lancers francs pour le tireur fautif (une seule série par tir). Renvoie vrai s'ils sont accordés. */
  private awardFreeThrows(play: Play, total: number): boolean {
    if (play.freeThrows) return false;
    if (!this.freeThrowsFor(play.shooter, total)) return false;
    play.freeThrows = true;
    return true;
  }

  /** Lancers francs pour `shooter` : ballon mort, puis la série (chrono arrêté). Renvoie vrai s'ils sont accordés. */
  private freeThrowsFor(shooter: number, total: number): boolean {
    const full = this.full;
    // Contact sifflé juste après un panier (dunk) : le lancer remplace la remise prévue.
    const afterBasket = full?.phase === 'mort' && full.inbound?.afterBasket === true;
    if (!full || (full.phase !== 'jeu' && full.phase !== 'remise' && !afterBasket)) return false;
    if (this.shot) this.endShot();
    this.play = null;
    this.pass = null;
    this.loose = null;
    this.holder = null;
    full.phase = 'mort';
    full.pause = FULL_COURT.deadPause;
    full.inbound = null;
    full.shotUp = false;
    full.shotClockPending = false;
    full.freeThrows = { shooter, team: this.team[shooter], total, taken: 0, made: 0, aim: null, flying: false, pause: 0 };
    this.box?.dead();
    this.subsDue = true;
    return true;
  }

  /**
   * Mise en place des lancers : le tireur derrière la ligne avec le ballon, les autres le long de
   * la raquette ou en haut, immobiles. Pour les lancers suivants, seul le ballon revient au tireur.
   */
  private setupFreeThrows(first: boolean): void {
    const full = this.full!;
    const ft = full.freeThrows!;
    const hoop = this.attackHoop(ft.team);
    if (first) this.placeAll(freeThrowPositions(this.court, hoop, ft.shooter, ft.team, this.lineup));
    for (const body of this.players) body.facing = hoop.rim.x >= body.pos.x ? 1 : -1;
    full.phase = 'lancers';
    ft.aim = null;
    ft.flying = false;
    ft.pause = 0;
    this.play = null;
    this.pass = null;
    this.holder = ft.shooter;
    this.dribbleTime = 0;
    this.cooldown = 0;
    this.ball = { pos: this.handPosition(this.players[ft.shooter]), vel: { x: 0, y: 0, z: 0 } };
    full.lastTouch = { player: ft.shooter, team: ft.team };
    if (this.possession?.team !== ft.team) this.possession = { team: ft.team, since: this.clock };
    this.followPossession(ft.shooter);
  }

  /**
   * Lancers francs : appui sur Tir (sans saut), la jauge se remplit ; relâche au sommet. Tenu trop
   * longtemps, le lancer part tout seul. Entre deux lancers, une courte pause, puis le ballon revient.
   */
  private stepFreeThrow(dt: number, input: WorldInput): void {
    const full = this.full!;
    const ft = full.freeThrows!;
    if (ft.flying) {
      const shot = this.lastShot;
      // Issue connue : réussi, ou raté (au sol, ou dès le cercle quand le résultat tiré est un raté).
      if (shot && (shot.scored || shot.live !== null || (this.rimTouched && !shot.wanted))) {
        ft.flying = false;
        ft.pause = FULL_COURT.freeThrowPause;
      }
      return;
    }
    if (ft.pause > 0) {
      ft.pause -= dt;
      if (ft.pause <= 0) this.setupFreeThrows(false);
      return;
    }
    if (this.holder !== ft.shooter) return;
    if (ft.aim === null) {
      if (!input.jump) return;
      ft.aim = 0;
    } else {
      ft.aim += dt;
    }
    const gauge = this.players[ft.shooter].timeToApex;
    if (input.release || ft.aim >= FULL_COURT.freeThrowForce * gauge) this.releaseFreeThrow(!input.release);
  }

  /** Lâcher d'un lancer : `engine/` tire le résultat, la physique le met en scène depuis la main. */
  private releaseFreeThrow(forced: boolean): void {
    const full = this.full!;
    const ft = full.freeThrows!;
    const body = this.players[ft.shooter];
    const hoop = this.attackHoop(ft.team);
    const timingError = (ft.aim ?? 0) - body.timeToApex;
    const result = resolveFreeThrow({ shooter: body.athlete, mode: this.shotSettings.mode, speed: this.shotSettings.speed, timingError }, this.rng);
    const start = releasePoint(body.pos, body.athlete.heightCm, hoop, WORLD_TUNING.handDepth);
    this.launch(start, result.made, hoop);
    ft.taken++;
    ft.aim = null;
    this.lastShot = {
      demo: false,
      shooter: ft.shooter,
      kind: 'lancer',
      zone: 'mid',
      start,
      distance: distanceToRim(hoop, body.pos.x, body.pos.y),
      three: false,
      hoop: hoop.side,
      contest: null,
      cleared: true,
      wanted: result.made,
      probability: Math.min(result.probability, FREE_THROW_TUNING.max),
      grade: result.grade,
      timingError,
      forced,
      scored: false,
      invalid: false,
      live: null,
      block: null,
      foul: null,
      goaltend: false,
    };
    full.lastTouch = { player: ft.shooter, team: ft.team };
    this.boxAttempt(ft.shooter, 1);
    if (ft.taken < ft.total) {
      ft.flying = true;
      return;
    }
    // Dernier lancer : tout le monde peut bouger ; s'il est raté, le rebond se joue et le chrono
    // (comme le shot clock) attend le premier toucher.
    full.freeThrows = null;
    full.phase = 'jeu';
    full.shotUp = true;
    full.waitTouch = true;
    full.frontcourt = false;
    full.backcourtTime = 0;
  }

  private startRestart(shooter: number): void {
    if (this.full) {
      this.foulInbound(shooter);
      return;
    }
    if (!this.rules || this.rules.restart || this.rules.winner !== null) return;
    this.rules.restart = { shooter, pause: DEFENSE_FLOW.foulPause };
  }

  /** Remise en jeu après une faute : le tireur en haut de la raquette avec le ballon, son équipe autour, l'autre en défense. */
  private restartPlay(shooter: number): void {
    const rules = this.rules!;
    this.placeTeams(shooter);
    rules.mustClear = rules.mustClear.map(() => false);
    rules.lastTeam = this.team[shooter];
    rules.restart = null;
    this.possession = { team: this.team[shooter], since: this.clock };
    this.holder = shooter;
    this.ball = { pos: this.handPosition(this.players[shooter]), vel: { x: 0, y: 0, z: 0 } };
    this.followPossession(shooter);
  }

  /**
   * Place l'équipe de `holder` en attaque (lui en haut, les autres sur les ailes, derrière l'arc)
   * et l'autre en défense, chacun devant son attaquant ; tous immobiles, sans tir ni passe.
   */
  private placeTeams(holder: number): void {
    const attack = this.team[holder];
    const { attackers, defenders } = startPositions(this.court, this.court.hoops.right, this.perTeam);
    const att = [holder, ...this.membersOf(attack).filter((j) => j !== holder)];
    const def = this.membersOf(1 - attack);
    const place = (i: number, pos: Vec3, facing: 1 | -1) => {
      const body = this.players[i];
      body.pos = { ...pos };
      body.vel = { x: 0, y: 0, z: 0 };
      body.airborne = false;
      body.facing = facing;
      this.followThrough[i] = false;
    };
    att.forEach((i, k) => place(i, attackers[k % attackers.length], 1));
    def.forEach((i, k) => place(i, defenders[k % defenders.length], -1));
    this.players.forEach((_, i) => {
      this.reachUntil[i] = 0;
      this.stealCooldown[i] = 0;
      this.offBalance[i] = 0;
    });
    this.endShot();
    this.play = null;
    this.pass = null;
    this.loose = null;
    this.basketPending = false;
    this.dribbleTime = 0;
    this.cooldown = 0;
  }

  /**
   * Le contrôle suit le ballon : un joueur de ton équipe qui prend le ballon devient le joueur
   * contrôlé ; si c'est l'adversaire, tu prends ton défenseur le plus proche du ballon.
   */
  private followPossession(holder: number): void {
    if (this.team[holder] === this.userTeam) this.controlled = holder;
    else this.controlled = this.nearestOf(this.userTeam, this.ball.pos) ?? this.controlled;
  }

  /** En défense (E) : tu passes au défenseur le plus proche du ballon (le suivant si c'est déjà toi). */
  private switchDefender(): void {
    const nearest = this.nearestOf(this.userTeam, this.ball.pos);
    if (nearest === null) return;
    this.controlled = nearest !== this.controlled ? nearest : (this.nearestOf(this.userTeam, this.ball.pos, this.controlled) ?? nearest);
  }

  /**
   * Passe tendue vers le coéquipier visé (direction tenue, sinon l'orientation) : de poitrine à
   * poitrine, en avance sur sa course. Ton équipe : tu prends le receveur dès le lâcher.
   */
  private passBall(passer: number, input: WorldInput): void {
    const body = this.players[passer];
    const mates = this.teammatesOf(passer).map((index) => ({ index, pos: this.players[index].pos }));
    const dir = input.x !== 0 || input.y !== 0 ? { x: input.x, y: input.y } : { x: body.facing, y: 0 };
    const receiver = passTarget(body.pos, dir, mates);
    if (receiver === null) return;
    const target = this.players[receiver];
    const speed = passSpeed(body.athlete.attrs.passing);
    const chest = (p: PlayerBody) => p.pos.z + (p.athlete.heightCm / 100) * PASS_FLOW.chestRatio;
    const aim = leadPoint(body.pos, target, chest(target), speed);
    // Le ballon part devant la poitrine, déjà hors du corps du passeur.
    const dx = aim.x - body.pos.x;
    const dy = aim.y - body.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    const from = { x: body.pos.x + (dx / d) * WORLD_TUNING.bodyRadius, y: body.pos.y + (dy / d) * WORLD_TUNING.bodyRadius, z: chest(body) };
    const { vel, time } = passVelocity(from, aim, speed);
    this.ball = { pos: from, vel };
    this.holder = null;
    this.cooldown = 0;
    this.passCooldown = PASS_FLOW.cooldown;
    body.facing = dx >= 0 ? 1 : -1;
    this.pass = { passer, receiver, team: this.team[passer], target: aim, time, elapsed: 0, checked: [] };
    this.loose = null;
    this.touchBall(passer);
    if (this.team[passer] === this.userTeam) this.controlled = receiver;
  }

  /** Deux joueurs ne se chevauchent jamais : on les écarte à parts égales (le lanceur d'une remise ne bouge pas). */
  private separateBodies(): void {
    const min = 2 * WORLD_TUNING.bodyRadius;
    const m = PLAYER_TUNING.boundsMargin;
    const full = this.full;
    const anchor = full?.phase === 'remise' && this.holder === full.inbound?.thrower ? this.holder : null;
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i].pos;
        const b = this.players[j].pos;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
          // Superposés exactement : on écarte le long du terrain.
        }
        const push = min - Math.hypot(b.x - a.x, b.y - a.y);
        const ux = dx / d;
        const uy = dy / d;
        const ka = i === anchor ? 0 : j === anchor ? 1 : 0.5;
        a.x -= ux * push * ka;
        a.y -= uy * push * ka;
        b.x += ux * push * (1 - ka);
        b.y += uy * push * (1 - ka);
        for (const p of [a, b]) {
          p.x = Math.min(this.court.length + m, Math.max(-m, p.x));
          p.y = Math.min(this.court.width + m, Math.max(-m, p.y));
        }
      }
    }
  }

  /**
   * Début du tir : tourné vers le panier. Un layup file vers un point devant le cercle ; un dunk
   * (résultat tiré dès l'appui) file tout près du cercle et l'atteint au sommet, la main au-dessus.
   */
  private startShot(shooter: number, kind: PlayKind, takeoffSpeed: number, takeoff: Vec3, dunkCtx: DunkContext | null): void {
    const body = this.players[shooter];
    const hoop = this.hoopFor(shooter);
    body.facing = hoop.rim.x >= takeoff.x ? 1 : -1;
    let dunk: ActiveDunk | null = null;
    if (kind === 'dunk' && dunkCtx) {
      const { made, probability } = resolveDunk(dunkCtx, this.rng);
      const T = body.timeToApex;
      // Saut relevé si besoin : la main doit dépasser le cercle au sommet (mise en scène).
      const apex = dunkJumpHeight(body.jumpHeight, reach(body.athlete));
      dunk = { made, probability, slammed: false, hang: 0, apex };
      body.jumpGravity = (2 * apex) / (T * T);
      body.vel.z = body.jumpGravity * T;
      const finish = dunkFinish(takeoff, hoop);
      const vx = (finish.x - takeoff.x) / T;
      const vy = (finish.y - takeoff.y) / T;
      const speed = Math.hypot(vx, vy);
      const k = speed > SHOT_FLOW.dunkMaxSpeed ? SHOT_FLOW.dunkMaxSpeed / speed : 1;
      body.vel.x = vx * k;
      body.vel.y = vy * k;
    }
    if (kind === 'layup') {
      // Le layup garde son propre élan (pas celui, réduit, d'un tir en suspension).
      const finish = layupFinish(takeoff, hoop);
      const airTime = 2 * body.timeToApex;
      const vx = (finish.x - takeoff.x) / airTime;
      const vy = (finish.y - takeoff.y) / airTime;
      const speed = Math.hypot(vx, vy);
      const k = speed > SHOT_FLOW.layupMaxSpeed ? SHOT_FLOW.layupMaxSpeed / speed : 1;
      body.vel.x = vx * k;
      body.vel.y = vy * k;
    }
    const zone: ShotZone = kind === 'jump' ? shotZone(this.court, hoop, takeoff.x, takeoff.y) : 'rim';
    const contest = dunkCtx?.defender ? { distance: dunkCtx.defender.distance, facing: dunkCtx.defender.facing } : null;
    this.shot = { shooter, kind, zone, hoop, airTime: 0, takeoffSpeed, takeoff, contest, dunk };
    this.play = { shooter, record: null, foul: null, watching: true, missed: false, freeThrows: false, assist: null };
  }

  /** L'équipe du tireur avait-elle ressorti le ballon (toujours vrai hors demi-terrain) ? */
  private cleared(shooter: number): boolean {
    return !this.rules?.mustClear[this.team[shooter]];
  }

  /** Dunk : smash au sommet du saut, accroche au cercle s'il est réussi, fin à l'atterrissage. */
  private stepDunk(): void {
    const shot = this.shot!;
    const dunk = shot.dunk!;
    const body = this.players[shot.shooter];
    if (!dunk.slammed && shot.airTime >= body.timeToApex) {
      dunk.slammed = true;
      const plan = solveDunk(dunk.made, shot.hoop, shot.takeoff, this.court, this.rng);
      this.ball = { pos: { ...plan.start }, vel: { ...plan.velocity } };
      this.holder = null;
      this.cooldown = WORLD_TUNING.pickupCooldown;
      body.vel.x = 0;
      body.vel.y = 0;
      if (dunk.made) {
        dunk.hang = SHOT_FLOW.dunkHang;
        body.vel.z = 0;
      }
      this.lastShot = {
        demo: false,
        shooter: shot.shooter,
        kind: 'dunk',
        zone: 'rim',
        start: plan.start,
        distance: distanceToRim(shot.hoop, shot.takeoff.x, shot.takeoff.y),
        three: false,
        hoop: shot.hoop.side,
        contest: shot.contest,
        cleared: this.cleared(shot.shooter),
        wanted: dunk.made,
        probability: dunk.probability,
        grade: null,
        timingError: null,
        forced: false,
        scored: false,
        invalid: false,
        live: null,
        block: null,
        foul: this.play?.foul ?? null,
        goaltend: false,
      };
      if (this.play) this.play.record = this.lastShot;
      this.rimTouched = false;
      this.shotReleased(shot.shooter);
      if (this.play) this.play.assist = this.assistFor(shot.shooter);
      this.boxAttempt(shot.shooter, 2);
    }
    if (!body.airborne) this.endShot();
  }

  /** Fin d'un tir en cours : le saut retrouve sa hauteur normale (un dunk a pu la relever). */
  private endShot(): void {
    this.shot = null;
    for (const body of this.players) setJumpTiming(body, body.timeToApex);
  }

  /** Lâcher : `engine/` tire le résultat, la physique produit une trajectoire qui y aboutit. */
  private releaseShot(forced: boolean): void {
    const shot = this.shot!;
    this.endShot();
    const body = this.players[shot.shooter];
    const { hoop, takeoff, zone } = shot;
    const timingError = shot.airTime - body.timeToApex;
    const defender = this.contestFor(shot.shooter, hoop);
    const contest = defender ? { distance: defender.distance, facing: defender.facing } : null;
    const result = resolveShot(
      {
        shooter: body.athlete,
        zone,
        kind: shot.kind === 'layup' ? 'layup' : 'jump',
        mode: this.shotSettings.mode,
        speed: this.shotSettings.speed,
        timingError,
        contest,
        moveSpeed: shot.takeoffSpeed,
      },
      this.rng,
    );
    const start = releasePoint(body.pos, body.athlete.heightCm, hoop, WORLD_TUNING.handDepth);
    this.launch(start, result.made, hoop);
    this.lastShot = {
      demo: false,
      shooter: shot.shooter,
      kind: shot.kind,
      zone,
      start,
      distance: distanceToRim(hoop, takeoff.x, takeoff.y),
      three: zone === 'three',
      hoop: hoop.side,
      contest,
      cleared: this.cleared(shot.shooter),
      wanted: result.made,
      probability: result.probability,
      grade: result.grade,
      timingError,
      forced,
      scored: false,
      invalid: false,
      live: null,
      block: null,
      foul: this.play?.foul ?? null,
      goaltend: false,
    };
    if (this.play) this.play.record = this.lastShot;
    if (body.airborne) this.followThrough[shot.shooter] = true;
    this.shotReleased(shot.shooter);
    if (this.play) this.play.assist = this.assistFor(shot.shooter);
    this.boxAttempt(shot.shooter, zone === 'three' ? 3 : 2);
  }

  /**
   * Le ballon quitte la main vers `hoop` avec le résultat voulu. Si aucune trajectoire n'existe
   * (cas extrême), il tombe de la main : raté.
   */
  private launch(start: Vec3, made: boolean, hoop: Hoop): void {
    let velocity: Vec3 = { x: 0, y: 0, z: 0 };
    try {
      velocity = solveShot(start, made, this.court, hoop, this.rng).velocity;
    } catch {
      // Position impossible (sous ou derrière la planche) malgré `releasePoint`.
    }
    this.ball = { pos: { ...start }, vel: velocity };
    this.holder = null;
    this.cooldown = WORLD_TUNING.pickupCooldown;
    this.rimTouched = false;
  }

  /** Ballon libre : ramassé par le joueur à portée le plus proche. */
  private tryPickup(): void {
    if (this.cooldown > 0) return;
    const { pos } = this.ball;
    let picker: number | null = null;
    let best = Infinity;
    const pass = this.pass;
    this.players.forEach((body, index) => {
      // Passe en vol : seuls les coéquipiers du passeur (pas lui) peuvent l'attraper.
      if (pass && (this.team[index] !== pass.team || index === pass.passer)) return;
      const dist = Math.hypot(pos.x - body.pos.x, pos.y - body.pos.y);
      const reachable = pos.z <= body.pos.z + reach(body.athlete) + WORLD_TUNING.pickupReachMargin;
      if (dist <= WORLD_TUNING.pickupRadius && reachable && dist < best) {
        best = dist;
        picker = index;
      }
    });
    if (picker === null) return;
    if (pass) {
      // Passe attrapée : la ressortie due ne change pas (une réception derrière l'arc la lève).
      this.pass = null;
      if (!this.fullGain(picker)) return;
      this.holder = picker;
      this.dribbleTime = 0;
      this.lastPass = { passer: pass.passer, receiver: picker, time: this.clock };
      this.passCooldown = PASS_FLOW.cooldown;
      this.followPossession(picker);
      return;
    }
    this.holder = picker;
    this.dribbleTime = 0;
    const shot = this.lastShot;
    // Rattrapé avant de toucher le parquet (rebond pris en l'air, ballon sous le filet) : le tir est
    // jugé là.
    if (shot && shot.live === null) {
      shot.live = shot.scored;
      if (!shot.scored) {
        this.boxMissed(shot);
        this.markMissed(shot);
      }
    }
    // Ballon arraché ou dévié ramassé par la défense : perte de balle.
    if (this.loose) {
      if (this.team[picker] !== this.team[this.loose.from]) {
        this.addTurnover({ kind: this.loose.kind, thief: this.loose.by, loser: this.loose.from, time: this.clock });
      }
      this.loose = null;
    }
    // Après un panier (le ballon n'a pas été repris depuis), celui qui ramasse doit ressortir.
    const afterBasket = this.basketPending;
    this.basketPending = false;
    if (this.rules?.restart) return;
    if (!this.fullGain(picker)) return;
    // Premier à prendre le ballon après un tir raté : rebond.
    const member = this.memberOf(picker);
    if (member) this.box?.gained(this.team[picker], member);
    this.takeBall(picker, afterBasket);
  }

  /**
   * Le joueur `picker` prend le ballon (ramassage ou interception) : ressortie due à son équipe
   * après un panier ou un ballon pris à l'adversaire, possession, contrôle.
   */
  private takeBall(picker: number, afterBasket = false): void {
    const pickerTeam = this.team[picker];
    if (this.rules) {
      const rules = this.rules;
      // Après un panier ou un ballon pris à l'adversaire : l'équipe doit ressortir. Une
      // obligation déjà due le reste (rebond offensif sur un tir qui n'avait pas ressorti).
      if (mustClearAfterPickup(pickerTeam, rules.lastTeam, afterBasket)) rules.mustClear[pickerTeam] = true;
      if (rules.lastTeam !== null && rules.lastTeam !== pickerTeam) rules.mustClear[rules.lastTeam] = false;
      rules.lastTeam = pickerTeam;
    }
    if (this.possession?.team !== pickerTeam) this.possession = { team: pickerTeam, since: this.clock };
    this.followPossession(picker);
  }

  /** Demi-terrain : 0-0, positions de départ, ballon au joueur 0 qui n'a rien à ressortir. */
  private resetGame(): void {
    const rules = this.rules!;
    this.placeTeams(0);
    this.points = [0, 0];
    rules.mustClear = [false, false];
    rules.lastTeam = 0;
    this.controlled = 0;
    this.lastPass = null;
    this.lastSteal = null;
    this.lastIntercept = null;
    this.turnovers.length = 0;
    this.possession = { team: 0, since: this.clock };
    rules.winner = null;
    rules.pause = 0;
    rules.restart = null;
    this.holder = 0;
    this.lastShot = null;
    this.ball = { pos: this.handPosition(this.players[0]), vel: { x: 0, y: 0, z: 0 } };
  }

  /**
   * Tir de démonstration (debug, touches R/M) : depuis le porteur s'il y en a un, sinon depuis un
   * point aléatoire autour du panier de droite. Le résultat est imposé, la physique suit ; il ne
   * compte pas au score.
   */
  demoShot(made: boolean): ShotRecord | null {
    let start: Vec3;
    let hoop: Hoop;
    const shooter = this.holder ?? this.controlled;
    if (this.holder !== null) {
      const body = this.players[this.holder];
      hoop = this.hoopFor(this.holder);
      start = releasePoint(body.pos, body.athlete.heightCm, hoop, WORLD_TUNING.handDepth);
    } else {
      hoop = this.court.hoops.right;
      const dist = this.rng.range(1.2, 8.5);
      const angle = this.rng.range(-1.4, 1.4);
      start = {
        x: hoop.rim.x - Math.cos(angle) * dist,
        y: Math.min(this.court.width - 0.4, Math.max(0.4, hoop.rim.y + Math.sin(angle) * dist)),
        z: this.rng.range(2.2, 2.7),
      };
    }
    let velocity: Vec3;
    try {
      velocity = solveShot(start, made, this.court, hoop, this.rng).velocity;
    } catch {
      return null; // position impossible (sous ou derrière la planche)
    }
    this.endShot();
    this.play = null;
    this.pass = null;
    this.ball = { pos: { ...start }, vel: velocity };
    this.holder = null;
    this.cooldown = WORLD_TUNING.pickupCooldown;
    this.rimTouched = false;
    const zone = shotZone(this.court, hoop, start.x, start.y);
    this.lastShot = {
      demo: true,
      shooter,
      kind: 'jump',
      zone,
      start,
      distance: distanceToRim(hoop, start.x, start.y),
      three: zone === 'three',
      hoop: hoop.side,
      contest: null,
      cleared: true,
      wanted: made,
      probability: null,
      grade: null,
      timingError: null,
      forced: false,
      scored: false,
      invalid: false,
      live: null,
      block: null,
      foul: null,
      goaltend: false,
    };
    return this.lastShot;
  }
}

/** Pas fixe partagé par le monde et la physique du ballon. */
export const WORLD_DT = BALL_PHYSICS.dt;
