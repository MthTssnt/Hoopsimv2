import Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { createNewGame, TEAM_SEEDS, type Player } from '../../engine';
import { DUNK_TUNING, dunkScore, greenWindow, shotSkill, type ShotZone, type TimingGrade } from '../../engine/shot';
import { hashSeed, randomSeed, Rng } from '../../engine/rng';
import { matchRotation } from '../../engine/rotation';
import type { TeamSeed } from '../../engine/teamsData';
import { runToEnd } from '../ai/finish';
import { PlayerAi } from '../ai/playerAi';
import { ARENA_APRON, VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { controlledInput, ShotButton } from '../input/control';
import { KeyboardInput, NO_INPUT } from '../input/keyboard';
import { BALL_RADIUS, makeCourt, RIM_HEIGHT, type CourtLevel } from '../physics/court';
import { createArena } from '../render/arena/arena';
import { BALL_SHADOW_TEXTURE, BALL_TEXTURE, createBallTextures } from '../render/arena/ball';
import { awayLook, contrastingTeam, drawGrid, teamLook, type TeamLook } from '../render/arena/draw';
import { drawHoopArt } from '../render/arena/hoopArt';
import { CAMERA_TUNING, targetFraming } from '../render/camera';
import { drawGauge, GAUGE, gaugeView, GRADE_TAGS } from '../render/hud/gauge';
import { createControlRing, createNameLabel, createTag, POSITION_SHORT, type PlayerCardData, type ScoreboardData } from '../render/hud/hud';
import { spreadLabels } from '../render/hud/labels';
import type { Point } from '../render/pixelDraw';
import { normalizeText } from '../render/pixelFont';
import { AIR_FRAMES, animTimeScale, blendBall, dunkLift, frameIndex, heldBallPoint, nextHeading, PLAYER_VIEW_TUNING, spriteStateFor, type SpriteState } from '../render/playerView';
import { depthOf, MATCH_PROJECTION, project } from '../render/projection';
import { appearanceFor, type Appearance } from '../render/sprites/appearance';
import { animationKey, BakeQueue, bakePlayer, bakeShadow, SheetBaker, type BakedPlayer, type Clock } from '../render/sprites/bake';
import type { Heading } from '../render/sprites/compose';
import { bodyLayout, FRAME, raisedHandTop } from '../render/sprites/rig';
import { buildBoxView, type BoxView } from '../boxView';
import { toPlayedGame, worldRotations, type MatchSetup } from '../gameResult';
import { halfCourtRoster } from '../roster';
import { loadSettings, type MatchSettings } from '../settings';
import { MatchWorld, WORLD_DT, type FoulCall, type MatchEvent, type ShotRecord, type WorldInput } from '../world/MatchWorld';
import { attacksRight, formatClock, FULL_COURT, periodLabel } from '../world/fullCourt';
import { defaultTarget } from '../world/halfCourt';
import { HUD_KEYS, type HudBanner, type HudDebug } from './HudScene';

/**
 * Joueurs de test, tirés d'une ligue générée : meneur, ailier, pivot lourd (touches 1-3), et
 * leurs vis-à-vis : le meilleur joueur de l'équipe adverse au même poste (sinon son meilleur
 * joueur). L'équipe à domicile est celle du meneur ; l'adverse tranche avec ses couleurs.
 */
function testRoster(seed: number): { athletes: Player[]; opponents: Player[]; home: TeamSeed; away: TeamSeed } {
  const players = Object.values(createNewGame('bos', seed).players);
  const best = (pos: Player['pos']) => players.filter((p) => p.pos === pos).sort((a, b) => b.overall - a.overall)[0];
  const heaviestCenter = players.filter((p) => p.pos === 'C').sort((a, b) => b.weightKg - a.weightKg)[0];
  const athletes = [best('PG'), best('SF'), heaviestCenter];
  const home = teamOf(athletes[0]);
  const away = contrastingTeam(home, TEAM_SEEDS, 7);
  const rivals = players.filter((p) => p.teamId === away.id && !athletes.includes(p)).sort((a, b) => b.overall - a.overall);
  const opponents = athletes.map((a) => rivals.find((p) => p.pos === a.pos) ?? rivals[0]);
  return { athletes, opponents, home, away };
}

/**
 * Demi-terrain à 2 ou 3 : l'équipe du meilleur meneur de la ligue (l'arène) contre une équipe
 * dont les couleurs tranchent ; un arrière, un ailier et un intérieur de chaque côté.
 */
function teamsRoster(seed: number, perTeam: number): { home: TeamSeed; away: TeamSeed; homePlayers: Player[]; awayPlayers: Player[] } {
  const players = Object.values(createNewGame('bos', seed).players);
  const bestGuard = players.filter((p) => p.pos === 'PG' && p.teamId).sort((a, b) => b.overall - a.overall)[0];
  const home = teamOf(bestGuard);
  const away = contrastingTeam(home, TEAM_SEEDS, 7);
  return { home, away, homePlayers: halfCourtRoster(players, home.id, perTeam), awayPlayers: halfCourtRoster(players, away.id, perTeam) };
}

/**
 * Terrain entier : la rotation de l'équipe du meilleur meneur de la ligue (l'arène) contre celle
 * d'une équipe dont les couleurs tranchent, chacune dans l'ordre du coach (comme la simulation).
 */
function fullRoster(seed: number): { home: TeamSeed; away: TeamSeed; homePlayers: Player[]; awayPlayers: Player[] } {
  const league = createNewGame('bos', seed);
  const players = Object.values(league.players);
  const bestGuard = players.filter((p) => p.pos === 'PG' && p.teamId).sort((a, b) => b.overall - a.overall)[0];
  const home = teamOf(bestGuard);
  const away = contrastingTeam(home, TEAM_SEEDS, 7);
  const team = (id: string) => league.teams.find((t) => t.id === id)!;
  return { home, away, homePlayers: matchRotation(team(home.id), league.players), awayPlayers: matchRotation(team(away.id), league.players) };
}

/** Lissage indépendant de la fréquence d'affichage (`rate` donné pour 60 i/s). */
function smooth(current: number, target: number, rate: number, deltaMs: number): number {
  return current + (target - current) * (1 - Math.pow(1 - rate, deltaMs / (1000 / 60)));
}

const SPEED_LABELS = { slow: 'lente', normal: 'normale', fast: 'rapide' } as const;
const ZONE_LABELS: Record<ShotZone, string> = { rim: 'près du cercle', mid: 'mi-distance', three: '3 pts' };
const GRADE_LABELS: Record<TimingGrade, string> = { perfect: 'parfait', green: 'vert', early: 'tôt', late: 'tard' };
/**
 * Distances à l'écran du rendu du match (px, en 640×360 à 30 px/m) : celles de 480×270 × 4/3,
 * arrondies. Le HUD garde ses propres tailles (repris à l'incrément 18).
 */
const MATCH_PX = {
  /** Étiquette du nom : sous les pieds. */
  labelBelowFeet: 4,
  /** Annonces et messages : au-dessus de la tête. */
  overHead: 4,
  /** Montée d'une annonce (PARFAIT, BON…) pendant son affichage. */
  tagRise: 5,
  /** Jauge du tir : écart au corps et hauteur de son bas au-dessus du sol. */
  gaugeSide: 13,
  gaugeAbove: 40,
  /** Boîte suivie par la caméra : demi-largeur autour du joueur, sous ses pieds (étiquette). */
  followHalfWidth: 13,
  followBelow: 16,
  /** Ballon suivi seul (Regarder, sans porteur) : hauteur gardée au-dessus de lui. */
  ballAbove: 40,
} as const;
/** Annonce au-dessus d'une tête (note du lâcher, DUNK) : durée (ms). */
const TAG_MS = 900;
/** Messages de la défense et des règles (CONTRE, FAUTE, VOL, INTERCEPTION…), plus longs à lire. */
const CALLOUT_MS = 1500;
/** Dunk réussi : secousse de caméra en pixels entiers (le pixel-art reste net). */
const SHAKE = { ms: 150, px: 3 } as const;
/** Cadrage validé dans `?style` : ligne de touche du fond à 55 px du haut de l'écran (la ligne proche tombe vers 357). */
const FAR_LINE_ON_SCREEN = 55;
const LEVELS: readonly CourtLevel[] = ['pro', 'college'];
/** Ton équipe dans le monde (l'autre est l'IA). */
const USER_TEAM = 0;
/** Pose de passe (bras du lâcher) tenue après une passe (ms), et après un lancer franc. */
const PASS_POSE_MS = 150;
const FREE_THROW_POSE_MS = 400;
/**
 * Messages des événements, au-dessus du joueur concerné : vols et passes coupées (au-dessus du
 * défenseur ; la faute de main reprend FAUTE), violations (au-dessus du fautif).
 */
const EVENT_TAGS: Record<MatchEvent['kind'], string> = {
  vol: 'tag-steal',
  interception: 'tag-intercept',
  'déviation': 'tag-deflect',
  'faute-main': 'tag-foul',
  sortie: 'tag-out',
  '8 secondes': 'tag-8s',
  'retour en zone': 'tag-backcourt',
  '24 secondes': 'tag-24s',
  '5 secondes': 'tag-5s',
  'entre-deux': 'tag-tip-violation',
  bonus: 'tag-bonus',
  '6 fautes': 'tag-fouled-out',
  changement: 'tag-sub',
};
/** Textes des violations (petite police, `orange`). */
const VIOLATION_TAGS: [string, string][] = [
  ['tag-out', 'SORTIE'],
  ['tag-8s', '8 SECONDES'],
  ['tag-backcourt', 'RETOUR EN ZONE'],
  ['tag-24s', '24 SECONDES'],
  ['tag-5s', '5 SECONDES'],
  ['tag-tip-violation', 'VIOLATION'],
];
/** Messages de la rotation et des fautes d'équipe. */
const ROTATION_TAGS: [string, string, number][] = [
  ['tag-bonus', 'BONUS', PALETTE.orange],
  ['tag-fouled-out', '6 FAUTES', PALETTE.red],
  ['tag-sub', 'CHANGEMENT', PALETTE.chalk],
];
/** « Simuler la fin » : temps de calcul par image (ms), pas du monde par tranche. */
const FINISH_BUDGET_MS = 25;
const FINISH_CHUNK = 60;
/** Vitesses de « Regarder ». */
export const WATCH_SPEEDS = [1, 2, 4] as const;
/** Clignotement de l'anneau quand le contrôle change de joueur (ms). */
const RING_BLINK_MS = 240;

function teamOf(player: Player): TeamSeed {
  return TEAM_SEEDS.find((t) => t.id === player.teamId) ?? TEAM_SEEDS[0];
}

/** Joueurs par équipe : `&format=1|2|3` pour le demi-terrain ; 5 contre 5 sur terrain entier par défaut. */
function formatFromUrl(): number {
  const value = Number(new URLSearchParams(window.location.search).get('format'));
  return value === 1 || value === 2 || value === 3 ? value : 5;
}

/** Durée d'un quart-temps : `&qt=1` dans l'URL (debug, min, décimales permises), sinon celle des réglages. */
function quarterFromUrl(fallback: number): number {
  const value = Number(new URLSearchParams(window.location.search).get('qt'));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Cible : `&cible=3` dans l'URL (debug, pour atteindre vite la fin), sinon celle du format (11 ou 21). */
function targetFromUrl(perTeam: number): number {
  const value = Number(new URLSearchParams(window.location.search).get('cible'));
  return Number.isInteger(value) && value >= 1 ? value : defaultTarget(perTeam);
}

const decimal = (value: number) => value.toFixed(2).replace('.', ',');
const rounded = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Un joueur de test cuit : sprites aux couleurs de son camp, ombre, étiquette. */
interface CastMember {
  player: Player;
  team: TeamLook;
  look: Appearance;
  baked: BakedPlayer;
  shadow: string;
  /** Étiquette normale, et soulignée quand tu le contrôles. */
  label: string;
  labelOn: string;
  /** Hauteur du sprite au-dessus des pieds (px), du sommet de la tête aux semelles. */
  height: number;
}

/** Remplaçant en file de cuisson (tâche de fond) : sa feuille en cours, et de quoi finir son habillage. */
interface PendingCast {
  sheet: SheetBaker;
  player: Player;
  team: TeamLook;
  step(budgetMs: number, clock?: Clock): boolean;
}

/** Budget de cuisson du banc par image (ms) : la feuille d'un joueur (~110 ms) s'étale sur ~30 images. */
const BENCH_BAKE_MS = 4;
/** Fenêtre de la plus longue image affichée en debug (ms). */
const FRAME_WINDOW_MS = 5000;

/** Message qui monte et s'efface au-dessus d'un joueur ou du panier ; empilé avec ses voisins. */
interface Callout {
  image: Phaser.GameObjects.Image;
  /** Au-dessus d'un joueur, du panier visé ou du rond central. */
  owner: number | 'rim' | 'center';
  clock: number;
}

/** Ce qui dessine un corps du monde, et où il a été dessiné à cette image. */
interface BodySprite {
  member: CastMember;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Image;
  /** Vue : de dos quand il monte, de profil sinon ; gardée à l'arrêt. */
  heading: Heading;
  /** Pieds dessinés (relevés pendant l'accroche d'un dunk) et point au sol. */
  feet: Point;
  ground: Point;
}

/** Repère au sol du dernier tir démo : petite croix cernée. */
function createShotMarker(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  drawGrid(g, ['c...c', '.c.c.', '..c..', '.c.c.', 'c...c'], 1, 1, (c) => (c === 'c' ? PALETTE.chalk : null));
  g.generateTexture(key, 7, 7);
  g.destroy();
}

/**
 * Scène du match : 5 contre 5 sur terrain entier (entre-deux, quart-temps, shot clock, remises,
 * violations), ou demi-terrain sur le panier de droite du 1 contre 1 au 3 contre 3 (`&format=`),
 * ton équipe contre l'IA, dans la vue de 3/4 validée dans `?style`. Arène aux couleurs de ton
 * équipe, deux paniers, sprites cuits du rig (ton équipe en tenue à domicile, l'adversaire en
 * tenue extérieure), ballon tenu dessiné dans la main du porteur. Tu contrôles le porteur en
 * attaque, le défenseur le plus proche du ballon en défense ; les autres sont des IA. Caméra qui
 * suit ton joueur et garde le ballon visible ; HUD dans une scène à part ; réglages venus du
 * panneau React. Toute la logique est dans `MatchWorld` et `PlayerAi`.
 */
export class MatchScene extends Phaser.Scene {
  private settings!: MatchSettings;
  private seed = 0;
  private rng!: Rng;
  private perTeam = 3;
  private target: number = defaultTarget(3);
  /** Joueurs de chaque camp ; en 1 contre 1, les trois joueurs de test (touches 1-3) et leurs vis-à-vis. */
  private athletes: Player[] = [];
  private opponents: Player[] = [];
  /** Ton équipe (équipe 0 du monde, à gauche du tableau de score) et l'adversaire ; club qui reçoit (arène). */
  private homeSeed!: TeamSeed;
  private awaySeed!: TeamSeed;
  private arenaSeed!: TeamSeed;
  /** Match du GM (null : page de test `?court`). */
  private setup: MatchSetup | null = null;
  /** Regarder : les dix joueurs à l'IA, caméra sur le ballon, vitesse ×1, ×2 ou ×4. */
  private watching = false;
  private speed = 1;
  /** « Simuler la fin » en cours, et résultat déjà publié. */
  private finishing = false;
  private reported = false;
  private homeCast: CastMember[] = [];
  private awayCast: CastMember[] = [];
  /**
   * Terrain entier : joueurs déjà cuits. Les dix du départ le sont à la création de la scène, le
   * banc en tâche de fond (`benchQueue`) ; un remplaçant pas encore prêt est fini d'un trait à son
   * entrée (`lastBakeMs`).
   */
  private castCache = new Map<string, CastMember>();
  private benchQueue = new BakeQueue<PendingCast>();
  private lastBakeMs = 0;
  /** Mesures publiques (debug H et captures) : cuisson moyenne d'un titulaire et chargement des dix (ms). */
  bakeStats = { starterMs: 0, startersMs: 0, syncEntries: 0 };
  /** Durées des images récentes, pour la plus longue des 5 dernières secondes. */
  private frameTimes: { at: number; ms: number }[] = [];
  private homeLook!: TeamLook;
  private awayLook!: TeamLook;
  /** Carte du joueur contrôlé déjà publiée (énergie et stats changent pendant le match). */
  private cardKey = '';
  /** Menu pause ouvert : le monde ne fait plus aucun pas. */
  private paused = false;
  private world!: MatchWorld;
  /** Une IA par joueur ; celle du joueur contrôlé tourne aussi, mais ses entrées sont ignorées. */
  private ais: PlayerAi[] = [];
  private controls!: KeyboardInput;
  private blocked = false;
  private pendingJump = false;
  private pendingRelease = false;
  /** Bouton Tir : appui gardé tant qu'il est tenu, si le joueur était en l'air. */
  private shotButton = new ShotButton();
  private pendingPass = false;
  private pendingSteal = false;
  /** Joueur contrôlé à l'image précédente (carte, anneau qui clignote au changement). */
  private shownControlled = -1;
  private ringBlink = 0;
  /** Pose de passe restante (ms) par joueur, et dernière passe déjà vue. */
  private passPose: number[] = [];
  private seenPass: object | null = null;
  /** Pose du lâcher d'un lancer franc restante (ms) par joueur ; dernier lancer annoncé (série, numéro). */
  private freeThrowPose: number[] = [];
  private seenFreeThrow: { series: object; taken: number } | null = null;
  private accumulator = 0;
  private cam = { x: 0, y: 0, zoom: 1 };
  private debugKey = '';
  private debugVisible = false;
  /** Centre vertical préféré de la caméra : toute la profondeur du terrain visible. */
  private anchorY = 0;
  private bodies: BodySprite[] = [];
  /** Ballon dessiné : dans la main du porteur ou à sa position physique, raccord au changement. */
  private ballOwner: number | null = 0;
  private ballDrawn: Point = { x: 0, y: 0 };
  private blendFrom: Point | null = null;
  private blendClock = 0;
  /** Jauge de ton tir en cours ou de ton dernier tir (affichée encore un instant après le lâcher). */
  private gaugeShot: { shooter: number; window: number; timeToApex: number; release: number | null; side: number; linger: number } | null = null;
  /** Dernier tir déjà annoncé ; annonce en cours au-dessus de la tête de `tagOwner`. */
  private seenShot: ShotRecord | null = null;
  private tagOwner = 0;
  private tagClock = TAG_MS;
  /** Événements déjà annoncés : panier non valable, contre, faute, goaltending. */
  private seenInvalid: ShotRecord | null = null;
  private seenBlock: ShotRecord | null = null;
  private seenFoul: FoulCall | null = null;
  private seenGoaltend: ShotRecord | null = null;
  /** Dernier événement du monde déjà annoncé (vol, faute de main, interception, déviation). */
  private seenEvent = 0;
  /** Dernier lancer d'entre-deux annoncé. */
  private seenToss: object | null = null;
  private callouts: Callout[] = [];
  private shakeMs = 0;
  private scoreKey = '';
  private bannerKey = '';
  private score!: ScoreboardData;

  private arena!: Phaser.GameObjects.Image;
  private ballImage!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private gauge!: Phaser.GameObjects.Graphics;
  private tag!: Phaser.GameObjects.Image;
  private clearTag!: Phaser.GameObjects.Image;

  constructor() {
    super('Match');
  }

  init() {
    const param = new URLSearchParams(window.location.search).get('seed');
    this.seed = param ? Number(param) >>> 0 : randomSeed();
    this.rng = new Rng(this.seed);
    this.perTeam = formatFromUrl();
    this.target = targetFromUrl(this.perTeam);
    this.settings = (this.registry.get('settings') as MatchSettings | undefined) ?? loadSettings();
    this.setup = (this.registry.get('matchSetup') as MatchSetup | null | undefined) ?? null;
    this.watching = this.setup?.mode === 'regarder';
    this.speed = 1;
    this.finishing = false;
    this.reported = false;
    if (this.setup) {
      // Match du GM : ton équipe en équipe 0 (tes entrées), dans l'arène du club qui reçoit.
      const setup = this.setup;
      this.seed = setup.seed;
      this.rng = new Rng(this.seed);
      this.perTeam = 5;
      [this.athletes, this.opponents] = worldRotations(setup);
      const user = setup.userSide === 'home' ? setup.home : setup.away;
      this.homeSeed = user;
      this.awaySeed = user === setup.home ? setup.away : setup.home;
      this.arenaSeed = setup.home;
    } else if (this.perTeam === 5) {
      const roster = fullRoster(this.seed);
      this.athletes = roster.homePlayers;
      this.opponents = roster.awayPlayers;
      this.homeSeed = roster.home;
      this.awaySeed = roster.away;
      this.arenaSeed = roster.home;
    } else if (this.perTeam === 1) {
      const roster = testRoster(this.seed);
      this.athletes = roster.athletes;
      this.opponents = roster.opponents;
      this.homeSeed = roster.home;
      this.awaySeed = roster.away;
      this.arenaSeed = roster.home;
    } else {
      const roster = teamsRoster(this.seed, this.perTeam);
      this.athletes = roster.homePlayers;
      this.opponents = roster.awayPlayers;
      this.homeSeed = roster.home;
      this.awaySeed = roster.away;
      this.arenaSeed = roster.home;
    }
    this.ais = [];
    this.pendingPass = false;
    this.pendingSteal = false;
    this.shownControlled = -1;
    this.ringBlink = 0;
    this.passPose = [];
    this.seenPass = null;
    this.freeThrowPose = [];
    this.seenFreeThrow = null;
    this.homeCast = [];
    this.awayCast = [];
    this.castCache = new Map();
    this.benchQueue = new BakeQueue<PendingCast>();
    this.lastBakeMs = 0;
    this.bakeStats = { starterMs: 0, startersMs: 0, syncEntries: 0 };
    this.frameTimes = [];
    this.cardKey = '';
    this.paused = false;
    this.bodies = [];
    this.blocked = false;
    this.pendingJump = false;
    this.pendingRelease = false;
    this.shotButton = new ShotButton();
    this.accumulator = 0;
    this.debugKey = '';
    this.debugVisible = false;
    this.ballOwner = 0;
    this.blendFrom = null;
    this.blendClock = 0;
    this.gaugeShot = null;
    this.seenShot = null;
    this.tagOwner = 0;
    this.tagClock = TAG_MS;
    this.seenInvalid = null;
    this.seenBlock = null;
    this.seenFoul = null;
    this.seenGoaltend = null;
    this.seenEvent = 0;
    this.seenToss = null;
    this.callouts = [];
    this.shakeMs = 0;
    this.scoreKey = '';
    this.bannerKey = '';
  }

  create() {
    // Arène aux couleurs de ton équipe ; l'IA porte la tenue d'une équipe qui tranche avec elle.
    // Page de test : ton équipe chez elle, l'adversaire dans des couleurs qui tranchent. Match du GM :
    // l'arène et le maillot du club qui reçoit ; l'équipe qui se déplace garde ses couleurs si elles
    // tranchent (sinon sa couleur secondaire, ou un maillot clair).
    const setup = this.setup;
    const arena = teamLook(this.arenaSeed);
    const visitors = setup ? awayLook(setup.home, setup.away) : null;
    const home = !setup || this.homeSeed === setup.home ? teamLook(this.homeSeed) : visitors!;
    const away = !setup ? teamLook(this.awaySeed) : this.awaySeed === setup.home ? arena : visitors!;
    for (const level of LEVELS) {
      createArena(this, `arena-${level}`, MATCH_PROJECTION, makeCourt(level), arena, {
        size: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
        apron: ARENA_APRON,
      });
    }
    createBallTextures(this);
    createControlRing(this, 'control-ring', 28, 9);
    createShotMarker(this, 'shot-marker');
    for (const [grade, tag] of Object.entries(GRADE_TAGS)) createTag(this, `grade-${grade}`, tag.text, tag.color);
    createTag(this, 'tag-dunk', 'DUNK', PALETTE.yellow);
    createTag(this, 'tag-clear', 'RESSORS', PALETTE.orange);
    createTag(this, 'tag-invalid', 'NON VALABLE', PALETTE.red);
    createTag(this, 'tag-block', 'CONTRE', PALETTE.yellow);
    createTag(this, 'tag-foul', 'FAUTE', PALETTE.red);
    createTag(this, 'tag-goaltend', 'GOALTENDING', PALETTE.yellow);
    createTag(this, 'tag-steal', 'VOL', PALETTE.yellow);
    createTag(this, 'tag-intercept', 'INTERCEPTION', PALETTE.yellow);
    createTag(this, 'tag-deflect', 'DÉVIÉE', PALETTE.silver);
    for (const [key, text] of VIOLATION_TAGS) createTag(this, key, text, PALETTE.orange);
    for (const [key, text, color] of ROTATION_TAGS) createTag(this, key, text, color);
    createTag(this, 'tag-tipoff', 'ENTRE-DEUX', PALETTE.chalk);
    for (let total = 1; total <= 3; total++) {
      for (let n = 1; n <= total; n++) createTag(this, `tag-ft-${n}-${total}`, `LANCER ${n}/${total}`, PALETTE.chalk);
    }
    this.homeLook = home;
    this.awayLook = away;
    // Demi-terrain : tout le monde est cuit au départ. Terrain entier : les dix sur le terrain, les
    // remplaçants à leur première entrée.
    if (this.perTeam !== 5) {
      this.homeCast = this.athletes.map((player, i) => this.bakeCastMember(player, `player-${i}`, home));
      this.awayCast = this.opponents.map((player, i) => this.bakeCastMember(player, `rival-${i}`, away));
    }

    const court = makeCourt(this.settings.level);
    this.arena = this.add.image(0, 0, `arena-${this.settings.level}`).setOrigin(0).setDepth(0);
    for (const hoop of [court.hoops.left, court.hoops.right]) {
      const art = drawHoopArt(this, MATCH_PROJECTION, hoop, arena);
      art.back.setDepth(depthOf(hoop.rim.y) - 0.2);
      art.front.setDepth(depthOf(hoop.rim.y) + 0.2);
    }
    this.marker = this.add.image(0, 0, 'shot-marker').setDepth(1).setVisible(false);
    this.ring = this.add.image(0, 0, 'control-ring').setDepth(2);
    // Terrain entier : entre-deux pour commencer. Demi-terrain sur le panier de droite : le monde
    // place chacun (ton équipe derrière l'arc, ballon à ton meneur, chaque défenseur devant le sien).
    const n = this.perTeam;
    const settings = { mode: this.settings.shotMode, speed: this.settings.shotSpeed };
    this.world = new MatchWorld(court, this.athletes[0], { x: 0, y: 0, z: 0 }, settings, this.rng);
    this.world.autoRestart = !setup;
    if (n === 5) this.world.startFullCourt(this.athletes, this.opponents, quarterFromUrl(this.settings.quarterMinutes));
    else this.world.startTeams(this.athletes.slice(0, n), this.opponents.slice(0, n), this.target);
    // En 1 contre 1, un seul joueur de chaque côté (les autres servent aux touches 1-3).
    const bakeStart = performance.now();
    const onCourt =
      n === 5
        ? this.world.players.map((_, i) => this.castFor(this.world.team[i], this.world.memberOf(i)!.player))
        : [...this.homeCast.slice(0, n), ...this.awayCast.slice(0, n)];
    if (n === 5) {
      this.bakeStats.startersMs = performance.now() - bakeStart;
      this.bakeStats.starterMs = this.bakeStats.startersMs / onCourt.length;
      this.queueBench();
    }
    this.bodies = onCourt.map((member) => this.createBodySprite(member));
    this.ballShadow = this.add.image(0, 0, BALL_SHADOW_TEXTURE).setDepth(1);
    this.ballImage = this.add.image(0, 0, BALL_TEXTURE);
    this.gauge = this.add.graphics().setDepth(950);
    this.tag = this.add.image(0, 0, 'grade-perfect').setOrigin(0.5, 1).setDepth(960).setVisible(false);
    this.clearTag = this.add.image(0, 0, 'tag-clear').setOrigin(0.5, 1).setDepth(960).setVisible(false);

    this.ais = this.world.players.map((_, i) => new PlayerAi(i, new Rng(hashSeed(`ia-${this.seed}-${i}`))));
    this.passPose = this.world.players.map(() => 0);
    this.freeThrowPose = this.world.players.map(() => 0);

    const keyboard = this.input.keyboard!;
    this.controls = new KeyboardInput(keyboard, this.settings.bindings);
    keyboard.on('keydown', (event: KeyboardEvent) => this.onDebugKey(event));

    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const start = this.world.players[this.world.controlled].pos;
    this.anchorY = project(0, 0).y - FAR_LINE_ON_SCREEN + VIEW_HEIGHT / 2;
    this.cam = { x: project(start.x, start.y).x, y: this.anchorY, zoom: 1 };
    camera.centerOn(this.cam.x, this.cam.y);

    const onSettings = (_parent: unknown, value: MatchSettings) => this.applySettings(value);
    const onBlocked = (_parent: unknown, value: boolean) => this.setBlocked(value);
    const onPause = (value: boolean) => this.setPaused(value);
    const onSpeed = (value: number) => (this.speed = WATCH_SPEEDS.includes(value as 1) ? value : 1);
    const onFinish = () => this.startFinishing();
    this.registry.events.on('changedata-settings', onSettings);
    this.registry.events.on('changedata-inputBlocked', onBlocked);
    this.game.events.on('pause-request', onPause);
    this.game.events.on('watch-speed', onSpeed);
    this.game.events.on('finish-request', onFinish);
    this.events.once('shutdown', () => {
      this.registry.events.off('changedata-settings', onSettings);
      this.registry.events.off('changedata-inputBlocked', onBlocked);
      this.game.events.off('pause-request', onPause);
      this.game.events.off('watch-speed', onSpeed);
      this.game.events.off('finish-request', onFinish);
      this.controls.destroy();
    });
    if (this.registry.get('inputBlocked')) this.setBlocked(true);

    // Le HUD lit ces clés à son lancement, puis suit leurs changements.
    this.score = { home, away, homeScore: 0, awayScore: 0, period: '', clock: '', shotClock: null, note: n === 5 ? undefined : `PREMIER À ${this.target}` };
    this.registry.set(HUD_KEYS.score, this.score);
    this.publishCard(this.world.controlled);
    this.shownControlled = this.world.controlled;
    this.registry.set(HUD_KEYS.banner, null);
    this.registry.set(HUD_KEYS.debugVisible, false);
    this.renderWorld(0);
    this.scene.launch('Hud');
  }

  update(_time: number, deltaMs: number) {
    this.trackFrame(deltaMs);
    this.bakeBench();
    // « Simuler la fin » : le monde avance à l'IA par tranches, sans entrées, jusqu'à la fin.
    if (this.finishing) {
      const start = performance.now();
      let over = false;
      while (!over && performance.now() - start < FINISH_BUDGET_MS) over = runToEnd(this.world, this.ais, FINISH_CHUNK);
      this.renderWorld(deltaMs);
      this.reportMatchOver();
      return;
    }
    const input = this.blocked || this.watching ? NO_INPUT : this.controls.read();
    // Appui et relâche sont gardés jusqu'au prochain pas de simulation (rien de perdu à haute
    // fréquence) ; un appui bref passe donc par un saut puis un lâcher immédiat.
    if (input.shootPressed) this.pendingJump = true;
    if (input.shootReleased) this.pendingRelease = true;
    if (input.passPressed) this.pendingPass = true;
    if (input.stealPressed) this.pendingSteal = true;
    this.accumulator += (Math.min(deltaMs, 100) / 1000) * this.speed;
    while (this.accumulator >= WORLD_DT) {
      this.accumulator -= WORLD_DT;
      const controlled = this.world.controlled;
      const body = this.world.players[controlled];
      // Un appui sur Tir en l'air (retombée d'un rebond) part à l'atterrissage si Tir est tenu.
      const jump = this.shotButton.step(this.pendingJump, input.shootHeld, {
        airborne: body.airborne,
        holding: this.world.holder === controlled,
        shooting: this.world.shot?.shooter === controlled,
      });
      const mine: WorldInput = {
        x: input.moveX,
        y: input.moveY,
        jump,
        release: this.pendingRelease,
        pass: this.pendingPass,
        steal: this.pendingSteal,
      };
      const untouched =
        input.moveX === 0 && input.moveY === 0 && !input.shootHeld && !this.pendingJump && !this.pendingRelease && !this.pendingPass && !this.pendingSteal;
      const defending = this.world.userDefending;
      // Toutes les IA réfléchissent (leurs souvenirs restent à jour) ; le joueur contrôlé suit tes
      // touches, ou son IA en défense quand tu ne touches à rien (déplacement seulement).
      const inputs = this.ais.map((ai, i) => {
        const thought = ai.think(this.world, WORLD_DT);
        return i === controlled && !this.watching ? controlledInput(mine, thought, defending, untouched) : thought;
      });
      this.world.step(WORLD_DT, inputs);
      this.pendingJump = false;
      this.pendingRelease = false;
      this.pendingPass = false;
      this.pendingSteal = false;
    }
    this.renderWorld(deltaMs);
    this.reportMatchOver();
  }

  /** Match du GM fini (après le bandeau) : le résultat part au GM, une seule fois. */
  private reportMatchOver() {
    if (!this.setup || this.reported || !this.world.matchOver) return;
    this.reported = true;
    this.game.events.emit('match-over', toPlayedGame(this.world, this.setup));
  }

  /** « Simuler la fin » : le menu pause se ferme, le match finit tout seul en accéléré. */
  private startFinishing() {
    if (!this.setup || this.finishing) return;
    this.finishing = true;
    if (this.paused) {
      this.paused = false;
      this.scene.resume();
    }
  }

  private bakeCastMember(player: Player, key: string, team: TeamLook, sheet?: SheetBaker): CastMember {
    const look = appearanceFor(player);
    const baked = sheet ? sheet.finish(this) : bakePlayer(this, key, look, { primary: team.primary, secondary: team.secondary });
    const shadowWidth = look.heavy ? 26 : 20;
    const shadow = `player-shadow-${shadowWidth}`;
    bakeShadow(this, shadow, shadowWidth, 5);
    const label = `label-${key}`;
    const labelOn = `label-${key}-on`;
    // Nom de famille seul, en entier : l'étiquette prend la largeur du nom ; soulignée quand tu le contrôles.
    createNameLabel(this, label, normalizeText(player.lastName), false);
    createNameLabel(this, labelOn, normalizeText(player.lastName), true);
    return { player, team, look, baked, shadow, label, labelOn, height: FRAME.groundY - bodyLayout(baked.dims).headTop };
  }

  private createBodySprite(member: CastMember): BodySprite {
    return {
      member,
      shadow: this.add.image(0, 0, member.shadow).setDepth(1),
      // Tourné vers la gauche : images dédiées (numéro à l'endroit), jamais de retournement du sprite.
      sprite: this.add.sprite(0, 0, member.baked.key, 0).setOrigin(0.5, 1),
      label: this.add.image(0, 0, member.label).setOrigin(0.5, 0).setDepth(900),
      heading: 'side',
      feet: { x: 0, y: 0 },
      ground: { x: 0, y: 0 },
    };
  }

  private castKey(team: number, player: Player): string {
    return `${team === USER_TEAM ? 'player' : 'rival'}-${player.id}`;
  }

  /**
   * Terrain entier : joueur cuit (sprites, ombre, étiquettes). Un remplaçant encore en file (ou
   * jamais vu) est fini d'un trait à son entrée : le seul cas d'à-coup, mesuré dans `lastBakeMs`.
   */
  private castFor(team: number, player: Player): CastMember {
    const key = this.castKey(team, player);
    let member = this.castCache.get(key);
    if (!member) {
      const start = performance.now();
      const pending = this.benchQueue.take(key);
      member = this.bakeCastMember(player, key, team === USER_TEAM ? this.homeLook : this.awayLook, pending?.sheet);
      this.lastBakeMs = performance.now() - start;
      if (this.bodies.length > 0) this.bakeStats.syncEntries++;
      this.castCache.set(key, member);
    }
    return member;
  }

  /** Met le banc des deux équipes en file de cuisson (tâche de fond), dans l'ordre des rotations. */
  private queueBench() {
    for (const squad of this.world.squads ?? []) {
      const look = squad.team === USER_TEAM ? this.homeLook : this.awayLook;
      for (const { player } of squad.members) {
        const key = this.castKey(squad.team, player);
        if (this.castCache.has(key)) continue;
        const sheet = new SheetBaker(key, appearanceFor(player), { primary: look.primary, secondary: look.secondary });
        this.benchQueue.add(key, { sheet, player, team: look, step: (budget, clock) => sheet.step(budget, clock) });
      }
    }
  }

  /** Avance la cuisson du banc dans le budget de l'image ; un joueur fini rejoint le cache. */
  private bakeBench() {
    if (this.benchQueue.size === 0) return;
    for (const { id, baker } of this.benchQueue.step(BENCH_BAKE_MS)) {
      this.castCache.set(id, this.bakeCastMember(baker.player, id, baker.team, baker.sheet));
    }
  }

  /** Garde la durée des images des 5 dernières secondes (debug H, mesures). */
  private trackFrame(deltaMs: number) {
    const at = this.time.now;
    this.frameTimes.push({ at, ms: deltaMs });
    while (this.frameTimes.length > 0 && at - this.frameTimes[0].at > FRAME_WINDOW_MS) this.frameTimes.shift();
  }

  /** Plus longue image des 5 dernières secondes (ms). */
  get worstFrameMs(): number {
    return this.frameTimes.reduce((worst, f) => Math.max(worst, f.ms), 0);
  }

  /** Terrain entier : un corps dont le joueur a changé (remplaçant entré) prend ses sprites et son étiquette. */
  private syncCast() {
    if (!this.world.squads) return;
    this.bodies.forEach((view, i) => {
      const member = this.world.memberOf(i);
      if (!member || view.member.player.id === member.player.id) return;
      view.member = this.castFor(this.world.team[i], member.player);
      view.shadow.setTexture(view.member.shadow);
      view.label.setTexture(view.member.label);
    });
  }

  /**
   * Carte du joueur contrôlé. Terrain entier : son énergie et ses stats du match (« 12 PTS 4 REB
   * 3 PD ») ; demi-terrain : taille réelle et hauteur de saut calculée par le monde.
   */
  private cardFor(index: number): PlayerCardData {
    const { player, team, look } = this.bodies[index].member;
    const member = this.world.memberOf(index);
    const line = member?.line;
    const jump = this.world.players[index].jumpHeight;
    return {
      look,
      team,
      name: `${player.firstName.charAt(0)}. ${player.lastName}`,
      position: POSITION_SHORT[player.pos] ?? player.pos,
      energy: member ? member.energy / 100 : 1,
      stats: line ? `${line.pts} PTS ${line.oreb + line.dreb} REB ${line.ast} PD` : `${decimal(player.heightCm / 100)} M  SAUT ${decimal(jump)}`,
    };
  }

  /** Publie la carte du joueur contrôlé si elle a changé (joueur, énergie au %, stats). */
  private publishCard(index: number) {
    const card = this.cardFor(index);
    const key = `${index}|${card.name}|${Math.round(card.energy * 100)}|${card.stats}`;
    if (key === this.cardKey) return;
    this.cardKey = key;
    this.registry.set(HUD_KEYS.card, card);
  }

  /** Box score du menu pause (terrain entier), aux noms et couleurs des deux équipes. */
  private boxView(): BoxView | null {
    const names = [this.homeSeed, this.awaySeed].map((t) => ({ name: `${t.city} ${t.name}`, abbr: t.abbr, color: t.colors.primary }));
    return buildBoxView(this.world, names);
  }

  /** Menu pause : le monde s'arrête et le box score part au panneau React ; à la reprise, les touches repartent de zéro. */
  private setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      this.game.events.emit('pause-box', this.boxView());
      this.scene.pause();
      return;
    }
    this.controls.reset();
    this.shotButton.reset();
    this.pendingJump = false;
    this.pendingRelease = false;
    this.pendingPass = false;
    this.pendingSteal = false;
    this.scene.resume();
  }

  // --- Réglages et clavier ---

  private applySettings(next: MatchSettings) {
    const prev = this.settings;
    this.settings = next;
    if (prev.bindings !== next.bindings) this.controls.bind(next.bindings);
    if (prev.level !== next.level) {
      this.world.court = makeCourt(next.level);
      this.arena.setTexture(`arena-${next.level}`);
    }
    if (prev.shotSpeed !== next.shotSpeed || prev.shotMode !== next.shotMode) {
      this.world.setShotSettings({ mode: next.shotMode, speed: next.shotSpeed });
    }
    if (prev.quarterMinutes !== next.quarterMinutes) this.world.setQuarterMinutes(next.quarterMinutes);
  }

  private setBlocked(blocked: boolean) {
    this.blocked = blocked;
    // Panneau ouvert : Phaser ne lit plus le clavier (ni n'empêche la frappe dans le panneau).
    this.game.input.keyboard!.enabled = !blocked;
    if (!blocked) {
      this.controls.reset();
      this.shotButton.reset();
    }
  }

  /** Touches de test : ignorées si elles servent déjà à une action du joueur. */
  private onDebugKey(event: KeyboardEvent) {
    if (Object.values(this.settings.bindings).some((b) => b.code === event.keyCode)) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    switch (event.keyCode) {
      case K.R:
      case K.M:
        if (this.world.demoShot(event.keyCode === K.R)) {
          const s = this.world.lastShot!.start;
          const spot = rounded(project(s.x, s.y));
          this.marker.setPosition(spot.x, spot.y).setVisible(true);
        }
        break;
      case K.C:
        this.game.events.emit('request-settings', {
          ...this.settings,
          camera: this.settings.camera === 'free' ? 'steps' : 'free',
        } satisfies MatchSettings);
        break;
      case K.ONE:
      case K.TWO:
      case K.THREE:
        if (this.perTeam === 1) this.selectAthlete(event.keyCode - K.ONE);
        break;
      case K.H:
        this.debugVisible = !this.debugVisible;
        this.registry.set(HUD_KEYS.debugVisible, this.debugVisible);
        break;
    }
  }

  /** Change ton joueur et son vis-à-vis (même poste dans l'équipe adverse) ; le score continue. */
  private selectAthlete(index: number) {
    const mine = this.homeCast[index];
    const rival = this.awayCast[index];
    if (!mine || !rival) return;
    this.world.setAthlete(mine.player, 0);
    this.world.setAthlete(rival.player, 1);
    [mine, rival].forEach((member, i) => {
      const body = this.bodies[i];
      body.member = member;
      body.shadow.setTexture(member.shadow);
    });
    this.cardKey = '';
    this.publishCard(this.world.controlled);
  }

  // --- Affichage ---

  /** Anime le sprite selon l'état choisi, sans relancer une animation déjà en cours. */
  private applySprite(sprite: Phaser.GameObjects.Sprite, baked: BakedPlayer, state: SpriteState) {
    if (state.kind === 'anim') {
      sprite.play(animationKey(baked.key, state.name, state.facing, state.heading), true);
      return;
    }
    const index = frameIndex(state);
    if (sprite.anims.isPlaying) sprite.anims.stop();
    if (sprite.texture.key !== baked.key || Number(sprite.frame.name) !== index) sprite.setTexture(baked.key, index);
  }

  private renderWorld(deltaMs: number) {
    // Pose de passe : le passeur garde un instant le bras du lâcher.
    const pass = this.world.pass;
    if (pass && pass !== this.seenPass) {
      this.seenPass = pass;
      this.passPose[pass.passer] = PASS_POSE_MS;
    }
    this.passPose = this.passPose.map((ms) => Math.max(0, ms - deltaMs));
    this.freeThrowPose = this.freeThrowPose.map((ms) => Math.max(0, ms - deltaMs));
    this.syncCast();
    this.world.players.forEach((_, i) => this.renderBody(i));
    this.updateControl(deltaMs);
    const boxes = this.bodies.map((b) => ({ x: b.ground.x, y: b.ground.y + MATCH_PX.labelBelowFeet, width: b.label.width, height: b.label.height }));
    spreadLabels(boxes);
    this.bodies.forEach((b, i) => b.label.setPosition(boxes[i].x, boxes[i].y));
    const me = this.bodies[this.world.controlled];

    // Ballon tenu : dans la main de l'image courante du porteur. Libre : à sa position physique.
    // Raccord de ~80 ms quand il change de main ou de mode (lâcher, ramassage).
    const ball = this.world.ball.pos;
    const owner = this.world.holder;
    const holder = owner === null ? null : this.bodies[owner];
    const anchor = holder ? holder.member.baked.anchors[Number(holder.sprite.frame.name)] : null;
    const target = holder && anchor ? heldBallPoint(holder.feet, anchor) : project(ball.x, ball.y, ball.z);
    if (owner !== this.ballOwner) {
      this.ballOwner = owner;
      this.blendFrom = deltaMs > 0 ? { ...this.ballDrawn } : null;
      this.blendClock = 0;
    }
    let drawn = target;
    if (this.blendFrom) {
      this.blendClock += deltaMs;
      drawn = blendBall(this.blendFrom, target, this.blendClock);
      if (this.blendClock >= PLAYER_VIEW_TUNING.ballBlendMs) this.blendFrom = null;
    }
    this.ballDrawn = drawn;
    // De dos, le ballon tenu passe derrière le porteur (ballon levé derrière la tête).
    let depth = depthOf(ball.y);
    if (owner !== null && holder) depth = depthOf(this.world.players[owner].pos.y) + (holder.heading === 'back' ? -0.05 : 0.05);
    this.ballImage.setPosition(Math.round(drawn.x), Math.round(drawn.y)).setDepth(depth);
    const shadow = rounded(project(ball.x, ball.y));
    this.ballShadow.setPosition(shadow.x, shadow.y + 1).setAlpha(Phaser.Math.Clamp(1 - (ball.z - BALL_RADIUS) / 6, 0.35, 1));

    this.updateShotFeedback(deltaMs);
    this.updateCallouts(deltaMs);
    this.updateScore();
    this.updateCamera(me, rounded(drawn), deltaMs);
    this.updateDebug();
  }

  /** Sprite, ombre et étiquette d'un corps ; vue et image selon son état. */
  private renderBody(index: number) {
    const body = this.world.players[index];
    const view = this.bodies[index];
    const { pos } = body;
    const shot = this.world.shot?.shooter === index ? this.world.shot : null;
    // Pendant un dunk, le sprite est monté pour que ses mains (bras levés) touchent le cercle.
    const lifted = rounded(project(pos.x, pos.y, pos.z));
    let lift = 0;
    if (shot?.dunk) {
      const handY = lifted.y + 1 - FRAME.height + raisedHandTop(view.member.baked.dims);
      lift = dunkLift(handY, project(pos.x, pos.y, RIM_HEIGHT).y, pos.z / shot.dunk.apex);
    }
    view.feet = { x: lifted.x, y: lifted.y - lift };
    view.ground = rounded(project(pos.x, pos.y));
    const speed = Math.hypot(body.vel.x, body.vel.y);
    view.heading = nextHeading(view.heading, body.vel, body.airborne, shot !== null);
    let state = spriteStateFor({
      airborne: body.airborne,
      speed,
      holding: this.world.holder === index,
      facing: body.facing,
      heading: view.heading,
      shot: shot?.kind ?? null,
      followThrough: this.world.followThrough[index] ?? false,
    });
    // Lancer franc (poses provisoires) : ballon levé pendant la visée, puis le bras du lâcher.
    const ft = this.world.full?.phase === 'lancers' ? this.world.full.freeThrows : null;
    const facing = body.facing < 0 ? 'left' : 'right';
    if (ft && ft.shooter === index && ft.aim !== null && this.world.holder === index) {
      view.heading = 'side';
      state = { kind: 'frame', frame: AIR_FRAMES.withBall, facing, heading: 'side' };
    } else if (this.freeThrowPose[index] > 0 && !body.airborne && this.world.holder !== index) {
      view.heading = 'side';
      state = { kind: 'frame', frame: AIR_FRAMES.empty, facing, heading: 'side' };
    }
    // Passe et geste de vol (poses provisoires) : le bras du lâcher, de profil, au sol ; le vol
    // tend le bras vers le ballon.
    const reaching = this.world.clock < (this.world.reachUntil[index] ?? 0);
    if ((this.passPose[index] > 0 || reaching) && !body.airborne && this.world.holder !== index) {
      view.heading = 'side';
      const toward = reaching ? Math.sign(this.world.ball.pos.x - pos.x) || body.facing : body.facing;
      state = { kind: 'frame', frame: AIR_FRAMES.empty, facing: toward < 0 ? 'left' : 'right', heading: 'side' };
    }
    this.applySprite(view.sprite, view.member.baked, state);
    // Les pas suivent la vitesse au sol : les pieds accrochent le parquet au lieu de glisser.
    view.sprite.anims.timeScale = animTimeScale(state, speed);
    view.sprite.setPosition(view.feet.x, view.feet.y + 1).setDepth(depthOf(pos.y));
    view.shadow.setPosition(view.ground.x, view.ground.y - 1).setAlpha(Math.max(0.4, 1 - pos.z));
  }

  /**
   * Joueur contrôlé : anneau au sol (il clignote au changement), étiquette soulignée devant les
   * autres, carte du HUD.
   */
  private updateControl(deltaMs: number) {
    const controlled = this.world.controlled;
    // Regarder : ni anneau, ni étiquette soulignée, ni carte du joueur.
    if (this.watching) {
      this.ring.setVisible(false);
      this.bodies.forEach((b) => {
        if (b.label.texture.key !== b.member.label) b.label.setTexture(b.member.label);
        b.label.setDepth(900);
      });
      if (this.cardKey !== 'regarder') {
        this.cardKey = 'regarder';
        this.registry.set(HUD_KEYS.card, null);
      }
      return;
    }
    if (controlled !== this.shownControlled) {
      this.shownControlled = controlled;
      this.ringBlink = RING_BLINK_MS;
    }
    this.publishCard(controlled);
    this.bodies.forEach((b, i) => {
      const on = i === controlled;
      const key = on ? b.member.labelOn : b.member.label;
      if (b.label.texture.key !== key) b.label.setTexture(key);
      b.label.setDepth(on ? 901 : 900);
    });
    this.ringBlink = Math.max(0, this.ringBlink - deltaMs);
    const me = this.bodies[controlled];
    this.ring.setPosition(me.ground.x, me.ground.y - 1).setVisible(this.ringBlink === 0 || Math.floor(this.ringBlink / 60) % 2 === 0);
  }

  /** Point au-dessus de la tête d'un corps, `gap` px plus haut. */
  private overHead(index: number, gap: number): Point {
    const view = this.bodies[index];
    return { x: view.ground.x, y: view.feet.y - view.member.height - gap };
  }

  /**
   * Jauge de ton tir (à côté de toi, du côté opposé au panier, posée au sol pour rester stable)
   * et annonces au-dessus des têtes : note de ton lâcher, DUNK (toi ou l'IA).
   */
  private updateShotFeedback(deltaMs: number) {
    const shot = this.world.shot;
    // Pas de jauge pour un dunk (simple appui) ni pour les tirs de l'IA (ni quand tu regardes, ni
    // pendant la fin simulée).
    const controlled = this.watching || this.finishing ? -1 : this.world.controlled;
    const mine = shot && shot.shooter === controlled && shot.kind !== 'dunk' ? shot : null;
    // Lancer franc : la même jauge, sans saut (temps depuis l'appui sur Tir).
    const full = this.world.full;
    const ft = full?.phase === 'lancers' ? full.freeThrows : null;
    const aim = ft && ft.shooter === controlled && ft.aim !== null && this.world.holder === controlled ? ft.aim : null;
    if (mine || aim !== null) {
      const body = this.world.players[controlled];
      const { mode, speed } = this.world.shotSettings;
      const skill = mine ? shotSkill({ shooter: body.athlete, zone: mine.zone }) : body.athlete.attrs.freeThrow;
      const window = greenWindow(mode, skill, speed);
      this.gaugeShot = { shooter: controlled, window, timeToApex: body.timeToApex, release: null, side: -body.facing, linger: 0 };
    }
    // « LANCER 1/2 » au-dessus du tireur, à chaque lancer.
    if (ft && this.world.holder === ft.shooter && !ft.flying && ft.pause <= 0) {
      if (this.seenFreeThrow?.series !== ft || this.seenFreeThrow.taken !== ft.taken) {
        this.seenFreeThrow = { series: ft, taken: ft.taken };
        this.addCallout(`tag-ft-${ft.taken + 1}-${ft.total}`, ft.shooter);
      }
    }
    const last = this.world.lastShot;
    if (last && last !== this.seenShot) {
      this.seenShot = last;
      if (last.kind === 'lancer') this.freeThrowPose[last.shooter] = FREE_THROW_POSE_MS;
      if (!last.demo && last.grade && last.shooter === controlled) {
        this.tag.setTexture(`grade-${last.grade}`);
        this.tagOwner = controlled;
        this.tagClock = 0;
        if (this.gaugeShot) this.gaugeShot.release = last.timingError! + this.gaugeShot.timeToApex;
      }
      // Dunk réussi : annonce et secousse au smash (raté : rien).
      if (last.kind === 'dunk' && last.wanted) {
        this.tag.setTexture('tag-dunk');
        this.tagOwner = last.shooter;
        this.tagClock = 0;
        this.shakeMs = SHAKE.ms;
      }
    }

    this.gauge.clear();
    const g = this.gaugeShot;
    if (g) {
      if (!mine && aim === null) g.linger += deltaMs;
      if (g.linger > GAUGE.lingerMs) {
        this.gaugeShot = null;
      } else {
        // À côté du tireur (pas du dernier joueur annoncé : le contrôle a pu changer depuis).
        const ground = this.bodies[g.shooter].ground;
        const elapsed = mine ? mine.airTime : aim !== null ? aim : (g.release ?? 0);
        const view = gaugeView(elapsed, g.timeToApex, g.window);
        const release = g.release === null ? null : gaugeView(g.release, g.timeToApex, g.window).fill;
        const left = g.side > 0 ? ground.x + MATCH_PX.gaugeSide : ground.x - MATCH_PX.gaugeSide - (GAUGE.width + 2);
        drawGauge(this.gauge, left, ground.y - MATCH_PX.gaugeAbove, view, release);
      }
    }

    this.tagClock += deltaMs;
    const showTag = this.tagClock < TAG_MS;
    this.tag.setVisible(showTag);
    if (showTag) {
      const rise = Math.round((MATCH_PX.tagRise * this.tagClock) / TAG_MS);
      const at = this.overHead(this.tagOwner, MATCH_PX.overHead + rise);
      this.tag.setPosition(at.x, at.y).setAlpha(Math.min(1, (TAG_MS - this.tagClock) / 300));
    }
  }

  /**
   * « RESSORS » au-dessus de toi tant que tu dois ressortir. Messages des règles : CONTRE au-dessus
   * du contreur (avec la secousse du dunk), FAUTE au-dessus du défenseur (sur un tir ou une faute
   * de main), VOL, INTERCEPTION et DÉVIÉE au-dessus du défenseur, NON VALABLE et GOALTENDING
   * au-dessus du panier.
   */
  private updateCallouts(deltaMs: number) {
    const rules = this.world.rules;
    const holder = this.world.holder;
    const mustClear =
      !!rules && holder !== null && this.world.team[holder] === USER_TEAM && rules.mustClear[USER_TEAM] && rules.winner === null && !rules.restart;
    this.clearTag.setVisible(mustClear);
    if (mustClear && holder !== null) {
      // Au-dessus de l'annonce du tir si elle est encore là.
      const stacked = this.tag.visible && this.tagOwner === holder ? this.tag.height + 1 : 0;
      const at = this.overHead(holder, MATCH_PX.overHead + stacked);
      this.clearTag.setPosition(at.x, at.y);
    }

    const last = this.world.lastShot;
    if (last?.invalid && last !== this.seenInvalid) {
      this.seenInvalid = last;
      this.addCallout('tag-invalid', 'rim');
    }
    if (last?.block?.success && last !== this.seenBlock) {
      this.seenBlock = last;
      this.addCallout('tag-block', last.block.blocker);
      this.shakeMs = SHAKE.ms;
    }
    if (last?.goaltend && last !== this.seenGoaltend) {
      this.seenGoaltend = last;
      this.addCallout('tag-goaltend', 'rim');
    }
    const foul = this.world.currentFoul;
    if (foul?.called && foul !== this.seenFoul) {
      this.seenFoul = foul;
      this.addCallout('tag-foul', foul.defender);
    }
    // Fin simulée en accéléré : pas de messages (ils défileraient par dizaines).
    if (this.finishing) this.seenEvent = this.world.eventCount;
    // Vols, fautes de main et passes coupées : au-dessus du défenseur ; violations : au-dessus du fautif.
    for (const event of this.world.events) {
      if (event.id <= this.seenEvent) continue;
      this.seenEvent = event.id;
      this.addCallout(EVENT_TAGS[event.kind], event.by);
    }
    // Entre-deux : annonce au-dessus du rond central, au premier lancer.
    const full = this.world.full;
    if (full?.phase === 'entre-deux' && this.seenToss === null) {
      this.seenToss = this.world.ball;
      this.addCallout('tag-tipoff', 'center');
    } else if (full?.phase !== 'entre-deux') {
      this.seenToss = null;
    }

    // Chaque message monte de 4 px et s'efface ; ceux d'un même endroit s'empilent.
    const stack = new Map<number | 'rim' | 'center', number>();
    for (const c of this.callouts) {
      if (!c.image.visible) continue;
      c.clock += deltaMs;
      if (c.clock >= CALLOUT_MS) {
        c.image.setVisible(false);
        continue;
      }
      const below = stack.get(c.owner) ?? 0;
      stack.set(c.owner, below + c.image.height + 1);
      const rise = Math.round((MATCH_PX.tagRise * c.clock) / CALLOUT_MS);
      let at: Point;
      if (c.owner === 'rim' || c.owner === 'center') {
        // Au-dessus du panier du dernier tir, ou du rond central.
        const shot = this.world.lastShot;
        const rim = shot?.hoop === 'left' ? this.world.court.hoops.left.rim : this.world.court.hoops.right.rim;
        const spot = c.owner === 'rim' ? rim : { x: this.world.court.length / 2, y: this.world.court.width / 2 };
        at = rounded(project(spot.x, spot.y, RIM_HEIGHT + 1.4));
        at = { x: at.x, y: at.y - below };
      } else {
        // Au-dessus de la tête, et de l'annonce du tir si elle est sur le même joueur.
        const tag = this.tag.visible && this.tagOwner === c.owner ? this.tag.height + 1 : 0;
        at = this.overHead(c.owner, MATCH_PX.overHead + tag + below);
      }
      c.image.setPosition(at.x, at.y - rise).setAlpha(Math.min(1, (CALLOUT_MS - c.clock) / 300));
    }
  }

  /** Nouveau message (image réutilisée si une est libre). */
  private addCallout(texture: string, owner: number | 'rim' | 'center') {
    let callout = this.callouts.find((c) => !c.image.visible);
    if (!callout) {
      callout = { image: this.add.image(0, 0, texture).setOrigin(0.5, 1).setDepth(960), owner, clock: 0 };
      this.callouts.push(callout);
    }
    callout.image.setTexture(texture).setVisible(true).setAlpha(1);
    callout.owner = owner;
    callout.clock = 0;
    // Le plus récent en bas de la pile : on le replace en tête de liste.
    this.callouts = [callout, ...this.callouts.filter((c) => c !== callout)];
  }

  /** Tableau de score (toi contre l'IA) et bandeau de fin, publiés seulement quand ils changent. */
  /**
   * Tableau de score (et, sur terrain entier, période, chrono et shot clock) et bandeaux : fin de
   * partie au demi-terrain ; fin de période, mi-temps, prolongation et fin de match sur terrain
   * entier. Publiés seulement quand ils changent.
   */
  private updateScore() {
    const [mine, theirs] = this.world.points;
    const full = this.world.full;
    const shotClock = full && full.clock >= full.shotClock && full.phase !== 'entre-deux' ? Math.ceil(full.shotClock - 1e-9) : null;
    const next: ScoreboardData = full
      ? { ...this.score, homeScore: mine, awayScore: theirs, period: periodLabel(full.period), clock: formatClock(full.clock), shotClock }
      : { ...this.score, homeScore: mine, awayScore: theirs };
    const scoreKey = `${next.homeScore}-${next.awayScore}-${next.period}-${next.clock}-${next.shotClock}`;
    if (scoreKey !== this.scoreKey) {
      this.scoreKey = scoreKey;
      this.score = next;
      this.registry.set(HUD_KEYS.score, this.score);
    }
    const banner = this.bannerFor(mine, theirs);
    const bannerKey = banner ? `${banner.title}|${banner.subtitle}` : '';
    if (bannerKey !== this.bannerKey) {
      this.bannerKey = bannerKey;
      this.registry.set(HUD_KEYS.banner, banner);
    }
  }

  private bannerFor(mine: number, theirs: number): HudBanner | null {
    const full = this.world.full;
    if (!full) {
      const winner = this.world.rules?.winner ?? null;
      if (winner === null) return null;
      return { title: `${winner === USER_TEAM ? 'GAGNÉ' : 'PERDU'} ${mine}-${theirs}`, subtitle: 'NOUVELLE PARTIE À 0-0', tone: winner === USER_TEAM ? 'won' : 'lost' };
    }
    if (full.phase === 'fin-match' && full.winner !== null) {
      // Regarder : le vainqueur et le score ; jouer : gagné ou perdu.
      if (this.watching) {
        const abbr = [this.homeSeed.abbr, this.awaySeed.abbr];
        const w = full.winner;
        return { title: `${abbr[w]} ${this.world.points[w]}-${this.world.points[1 - w]}`, subtitle: 'FIN DU MATCH', tone: 'info' };
      }
      const subtitle = this.setup ? 'FIN DU MATCH' : 'NOUVEAU MATCH';
      return { title: `${full.winner === USER_TEAM ? 'GAGNÉ' : 'PERDU'} ${mine}-${theirs}`, subtitle, tone: full.winner === USER_TEAM ? 'won' : 'lost' };
    }
    if (this.finishing) return { title: 'SIMULATION DE LA FIN', subtitle: `${periodLabel(full.period)} ${formatClock(full.clock)}`, tone: 'info' };
    if (full.phase !== 'fin-periode') return null;
    const score = `${mine}-${theirs}`;
    if (full.period === 2) return { title: 'MI-TEMPS', subtitle: `${score} - CHANGEMENT DE PANIER`, tone: 'info' };
    if (full.period >= FULL_COURT.periods && mine === theirs) return { title: 'PROLONGATION', subtitle: `ÉGALITÉ ${score}`, tone: 'info' };
    const ended = full.period > FULL_COURT.periods ? `FIN DE LA PROLONGATION ${full.period - FULL_COURT.periods}` : `FIN DU ${full.period}${full.period === 1 ? 'ER' : 'E'} QT`;
    return { title: ended, subtitle: score, tone: 'info' };
  }

  private updateCamera(me: BodySprite, ball: Point, deltaMs: number) {
    // Boîte du joueur suivi (toi ; le porteur quand tu regardes, sinon le ballon) : du sommet de la
    // tête à l'étiquette sous ses pieds.
    const holder = this.world.holder;
    const followed = this.watching ? (holder !== null ? this.bodies[holder] : null) : me;
    const playerBox = followed
      ? {
          left: followed.feet.x - MATCH_PX.followHalfWidth,
          right: followed.feet.x + MATCH_PX.followHalfWidth,
          top: followed.feet.y - followed.member.height,
          bottom: followed.ground.y + MATCH_PX.followBelow,
        }
      : {
          left: ball.x - MATCH_PX.followHalfWidth,
          right: ball.x + MATCH_PX.followHalfWidth,
          top: ball.y - MATCH_PX.ballAbove,
          bottom: ball.y + MATCH_PX.followBelow,
        };
    const target = targetFraming(playerBox, ball, this.anchorY, this.settings.camera, this.cam.zoom, VIEW_WIDTH, VIEW_HEIGHT);
    this.cam.zoom =
      this.settings.camera === 'steps' ? target.zoom : smooth(this.cam.zoom, target.zoom, CAMERA_TUNING.zoomLerp, deltaMs);
    this.cam.x = smooth(this.cam.x, target.centerX, CAMERA_TUNING.followLerp, deltaMs);
    this.cam.y = smooth(this.cam.y, target.centerY, CAMERA_TUNING.followLerp, deltaMs);
    // Secousse d'un dunk : décalage de ±3 px entiers, une image sur deux.
    this.shakeMs = Math.max(0, this.shakeMs - deltaMs);
    const flip = Math.floor(this.time.now / 33) % 2 === 0 ? 1 : -1;
    const shake = this.shakeMs > 0 ? SHAKE.px * flip : 0;
    const camera = this.cameras.main;
    camera.setZoom(this.cam.zoom);
    camera.centerOn(Math.round(this.cam.x) + shake, Math.round(this.cam.y) - shake / 2);
  }

  /** Ton aptitude au dunk, là où tu es : zone, score (seuil, défenseur compris), stat utilisée. */
  private dunkLine(): string {
    const ctx = this.world.dunkContext(this.world.controlled);
    if (!ctx.inDunkZone) return 'Dunk : hors zone (moitié de la raquette)';
    const score = Math.round(dunkScore(ctx));
    const how = ctx.moveSpeed >= DUNK_TUNING.movingSpeed ? 'en mouvement' : 'à l’arrêt';
    const guard = ctx.defender ? `, défenseur à ${ctx.defender.distance.toFixed(1)} m` : '';
    return score >= DUNK_TUNING.threshold
      ? `Dunk possible (score ${score} ≥ ${DUNK_TUNING.threshold}, ${how}${guard})`
      : `Dunk impossible (score ${score} < ${DUNK_TUNING.threshold}, ${how}${guard})`;
  }

  /**
   * Dernier tir en une ligne : tireur, zone, écart au sommet, note, contestation, proba tirée,
   * résultat voulu et observé (et panier non valable).
   */
  private shotLine(shot: ShotRecord): string {
    const result = (v: boolean) => (v ? 'RÉUSSI' : 'RATÉ');
    const who = shot.shooter === this.world.controlled ? '' : `${this.world.team[shot.shooter] === USER_TEAM ? '' : 'IA '}${this.world.players[shot.shooter].athlete.lastName} : `;
    const contest = shot.contest ? ` · contesté à ${shot.contest.distance.toFixed(1)} m, en face ${shot.contest.facing.toFixed(2)}` : '';
    const defense = [
      shot.block ? `contre ${shot.block.success ? 'RÉUSSI' : 'raté'} (contact ${shot.block.contact.toFixed(2)}, proba ${Math.round(shot.block.probability * 100)} %)` : '',
      shot.foul ? `contact : ${shot.foul.called ? 'FAUTE' : 'pas de faute'} (proba ${Math.round(shot.foul.probability * 100)} %)` : '',
      shot.goaltend ? 'GOALTENDING' : '',
    ].filter(Boolean);
    const outcome =
      `voulu ${result(shot.wanted)} · obtenu ${shot.live === null ? '…' : result(shot.live)}${shot.invalid ? ' (NON VALABLE)' : ''}` +
      (defense.length ? ` · ${defense.join(' · ')}` : '');
    if (shot.kind === 'dunk') {
      const p = shot.probability === null ? '' : ` · proba ${Math.round(shot.probability * 100)} %`;
      return `${who}Dunk${contest}${p} · ${outcome}`;
    }
    const head = shot.demo ? 'Tir démo' : shot.kind === 'layup' ? 'Layup' : shot.kind === 'lancer' ? 'Lancer franc' : 'Tir';
    let line = shot.kind === 'lancer' ? `${who}${head}` : `${who}${head} ${shot.distance.toFixed(1)} m (${ZONE_LABELS[shot.zone]})`;
    if (!shot.demo && shot.timingError !== null && shot.grade && shot.probability !== null) {
      const error = `${shot.timingError >= 0 ? '+' : ''}${shot.timingError.toFixed(2)} s`;
      line += ` · écart ${error} (${GRADE_LABELS[shot.grade]}${shot.forced ? ', forcé' : ''})${contest} · proba ${Math.round(shot.probability * 100)} %`;
    }
    return `${line} · ${outcome}`;
  }

  /** État d'une IA : mode, plan en attaque, duel et temps de réaction en défense. */
  private aiState(i: number): string {
    const ai = this.ais[i];
    let state: string = ai.mode;
    if (ai.mode === 'attaque' && ai.plan) state += ` ${ai.plan === 'rim' ? 'cercle' : ai.plan === 'mid' ? 'mi-dist.' : '3 pts'}`;
    if ((ai.mode === 'défense' || ai.mode === 'aide') && ai.mark !== null) {
      state += ` sur ${this.world.players[ai.mark].athlete.lastName} (${Math.round(ai.reaction(this.world) * 1000)} ms)`;
    }
    return `${this.world.players[i].athlete.lastName} ${state}`;
  }

  /** Une ligne par équipe : rôle de chaque IA (le joueur contrôlé est marqué « toi »). */
  private aiLines(): string[] {
    return [USER_TEAM, 1 - USER_TEAM].map((team) => {
      const parts = this.world.membersOf(team).map((i) => (i === this.world.controlled ? `${this.world.players[i].athlete.lastName} (toi)` : this.aiState(i)));
      return `${team === USER_TEAM ? 'Ton équipe' : 'IA'} : ${parts.join(' · ')}`;
    });
  }

  /** Passe en vol ou dernière passe attrapée. */
  private passLine(): string | null {
    const name = (i: number) => this.world.players[i].athlete.lastName;
    const pass = this.world.pass;
    if (pass) {
      const from = this.world.players[pass.passer].pos;
      const d = Math.hypot(pass.target.x - from.x, pass.target.y - from.y);
      return `Passe ${name(pass.passer)} → ${name(pass.receiver)} · ${d.toFixed(1)} m · vol ${pass.time.toFixed(2)} s`;
    }
    const last = this.world.lastPass;
    return last ? `Dernière passe : ${name(last.passer)} → ${name(last.receiver)} (il y a ${(this.world.clock - last.time).toFixed(1)} s)` : null;
  }

  /** Dernier geste de vol et dernière passe passée à portée d'un défenseur. */
  private defenseLines(): string[] {
    const name = (i: number) => this.world.players[i].athlete.lastName;
    const pct = (p: number) => `${Math.round(p * 100)} %`;
    const lines: string[] = [];
    const steal = this.world.lastSteal;
    if (steal) {
      const result = steal.result === 'vol' ? 'VOL' : steal.result === 'faute' ? 'FAUTE' : 'raté';
      lines.push(
        `Vol ${name(steal.thief)} sur ${name(steal.handler)} · main à ${steal.distance.toFixed(2)} m (qualité ${steal.reach.toFixed(2)}) · ` +
          `exposé ${steal.exposed.toFixed(2)} · trop près ${steal.closeness.toFixed(2)} m · faute ${pct(steal.foulProbability)} · vol ${pct(steal.stealProbability)} · ${result}`,
      );
    }
    const lane = this.world.lastIntercept;
    if (lane) {
      const outcome = lane.outcome === 'catch' ? 'INTERCEPTÉE' : lane.outcome === 'deflect' ? 'DÉVIÉE' : 'passe';
      lines.push(
        `Ligne : ${name(lane.defender)} sur la passe de ${name(lane.passer)} · contact ${lane.contact.toFixed(2)} · touche ${pct(lane.touch)} · attrape ${pct(lane.catchShare)} · ${outcome}`,
      );
    }
    return lines;
  }

  /** Terrain entier : phase, chrono, shot clock, 8 s, remise, dernier toucher, sens d'attaque. */
  private gameLine(holder: string): string {
    const full = this.world.full!;
    const name = (i: number) => this.world.players[i].athlete.lastName;
    const team = (t: number) => (t === USER_TEAM ? 'ton équipe' : 'l’IA');
    const parts = [
      `${periodLabel(full.period)} ${formatClock(full.clock)} · tir ${full.shotClock.toFixed(1)}${full.shotUp ? ' (tir en l’air)' : ''} · phase ${full.phase}`,
      `ballon ${holder}`,
    ];
    if (this.world.possession) parts.push(`8 s : ${full.frontcourt ? 'passé' : full.backcourtTime.toFixed(1)}`);
    const inbound = full.inbound;
    if (inbound) parts.push(`remise ${team(inbound.team)}${inbound.thrower !== null ? ` par ${name(inbound.thrower)} (${inbound.timer.toFixed(1)} s)` : ''}`);
    if (full.lastTouch) parts.push(`dernier toucher ${name(full.lastTouch.player)}`);
    const ft = full.freeThrows;
    if (ft) parts.push(`lancers ${name(ft.shooter)} ${ft.taken}/${ft.total} (${ft.made} réussis)${ft.aim !== null ? ` · visée ${ft.aim.toFixed(2)} s` : ''}`);
    if (full.waitTouch) parts.push('chrono en attente du toucher');
    parts.push(`ton équipe attaque à ${attacksRight(USER_TEAM, full.period) ? 'droite' : 'gauche'}`);
    return parts.join(' · ');
  }

  /** Terrain entier : ton énergie, fautes d'équipe, prochain contrôle du coach, banc. */
  private rotationLine(): string | null {
    const squads = this.world.squads;
    if (!squads) return null;
    const me = this.world.memberOf(this.world.controlled);
    const fouls = squads.map((s) => `${s.fouls}${s.fouls > 5 ? ' (bonus adverse)' : ''}`).join(' - ');
    const next = squads.map((s) => `${this.world.nextSubCheck(s.team).toFixed(0)} s`).join(' / ');
    const bench = squads[USER_TEAM].members.filter((m) => m.body === null).map((m) => `${m.player.lastName} ${Math.round(m.energy)}`);
    return (
      `Énergie ${me ? Math.round(me.energy) : '-'} % · notes ×${me ? (this.world.players[this.world.controlled].athlete.attrs.speed / me.player.attrs.speed).toFixed(2) : '1'} · ` +
      `fautes d'équipe ${fouls} · coach dans ${next} · banc : ${bench.join(', ')}`
    );
  }

  /** Terrain entier : cuisson des titulaires, banc encore en file, entrées cuites d'un trait, plus longue image. */
  private bakeLine(): string {
    const sync = this.bakeStats.syncEntries ? ` (dernière ${this.lastBakeMs.toFixed(0)} ms)` : '';
    return (
      `Cuisson : titulaire ${this.bakeStats.starterMs.toFixed(0)} ms (les dix ${this.bakeStats.startersMs.toFixed(0)} ms) · ` +
      `banc en file ${this.benchQueue.size} · entrées cuites d'un trait ${this.bakeStats.syncEntries}${sync} · ` +
      `plus longue image ${this.worstFrameMs.toFixed(0)} ms`
    );
  }

  /** Texte de debug (affiché avec H) : publié seulement quand il change. */
  private updateDebug() {
    const controlled = this.world.controlled;
    const body = this.world.players[controlled];
    const a = body.athlete;
    const s = this.settings;
    const k = s.bindings;
    const rules = this.world.rules;
    const teamName = (team: number) => (team === USER_TEAM ? 'ton équipe' : 'l’IA');
    const holderIndex = this.world.holder;
    const holder = holderIndex === null ? 'libre' : holderIndex === controlled ? 'à toi' : `à ${this.world.players[holderIndex].athlete.lastName} (${teamName(this.world.team[holderIndex])})`;
    const owed = rules ? rules.mustClear.map((v, team) => (v ? teamName(team) : null)).filter(Boolean) : [];
    const top = [
      `${a.firstName} ${a.lastName} · ${a.pos} · ${(a.heightCm / 100).toFixed(2)} m · ${a.weightKg} kg · ${this.perTeam} contre ${this.perTeam} · graine ${this.seed}`,
      `course ${body.runSpeed.toFixed(1)} m/s · saut ${body.jumpHeight.toFixed(2)} m · détente ${a.attrs.vertical} · passe ${a.attrs.passing} · vue ${this.bodies[controlled].heading === 'back' ? 'de dos' : 'de profil'}`,
      ...this.aiLines(),
      ...(this.rotationLine() ? [this.rotationLine()!, this.bakeLine()] : []),
      this.world.full
        ? this.gameLine(holder)
        : `ballon ${holder}${owed.length ? ` · à ressortir : ${owed.join(', ')}` : ''} · premier à ${rules?.target ?? this.target}` +
          (rules?.restart ? ` · ballon mort (faute), remise à ${this.world.players[rules.restart.shooter].athlete.lastName} dans ${rules.restart.pause.toFixed(1)} s` : ''),
      `${s.level.toUpperCase()} · tir ${s.shotMode === 'timing' ? 'Timing' : 'Real Player %'} ${SPEED_LABELS[s.shotSpeed]}` +
        ` · caméra ${s.camera === 'free' ? 'libre' : 'paliers'} x${this.cam.zoom.toFixed(2)}`,
    ];
    const keys = `${this.perTeam === 1 ? '1-3 joueur et vis-à-vis' : `${k.pass.label} passe (défense : changer)`} · ${k.steal.label} interception`;
    const bottom = [
      `${k.up.label}${k.left.label}${k.down.label}${k.right.label} bouger · ${k.shoot.label} tir (maintenir, relâcher au sommet) · ${keys} · R/M tir démo · C caméra · F plein écran · H aide`,
    ];
    const shot = this.world.lastShot;
    if (shot) bottom.unshift(this.shotLine(shot));
    const pass = this.passLine();
    if (pass) bottom.unshift(pass);
    bottom.unshift(...this.defenseLines());
    const active = this.world.shot;
    if (active) {
      const what = active.kind === 'dunk' ? 'dunk' : active.kind === 'layup' ? 'layup' : 'tir';
      const who = active.shooter === controlled ? '' : `${this.world.players[active.shooter].athlete.lastName} : `;
      bottom.unshift(`${who}En l'air : ${what} ${ZONE_LABELS[active.zone]} · ${active.airTime.toFixed(2)} s`);
    } else if (this.world.holder === controlled) {
      bottom.unshift(this.dunkLine());
    }
    const content: HudDebug = { top, bottom };
    const key = JSON.stringify(content);
    if (key !== this.debugKey) {
      this.debugKey = key;
      this.registry.set(HUD_KEYS.debug, content);
    }
  }
}
