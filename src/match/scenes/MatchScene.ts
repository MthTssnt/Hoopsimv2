import Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { createNewGame, TEAM_SEEDS, type Player } from '../../engine';
import { DUNK_TUNING, dunkScore, greenWindow, shotSkill, type ShotZone, type TimingGrade } from '../../engine/shot';
import { randomSeed, Rng } from '../../engine/rng';
import { ARENA_APRON, VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { KeyboardInput, NO_INPUT } from '../input/keyboard';
import { BALL_RADIUS, makeCourt, RIM_HEIGHT, type CourtLevel } from '../physics/court';
import { createArena } from '../render/arena/arena';
import { BALL_SHADOW_TEXTURE, BALL_TEXTURE, createBallTextures } from '../render/arena/ball';
import { contrastingTeam, drawGrid, teamLook, type TeamLook } from '../render/arena/draw';
import { drawHoopArt } from '../render/arena/hoopArt';
import { CAMERA_TUNING, targetFraming } from '../render/camera';
import { drawGauge, GAUGE, gaugeView, GRADE_TAGS } from '../render/hud/gauge';
import { createControlRing, createNameLabel, createTag, POSITION_SHORT, type PlayerCardData, type ScoreboardData } from '../render/hud/hud';
import type { Point } from '../render/pixelDraw';
import { normalizeText } from '../render/pixelFont';
import { animTimeScale, blendBall, dunkLift, frameIndex, heldBallPoint, nextHeading, PLAYER_VIEW_TUNING, spriteStateFor, type SpriteState } from '../render/playerView';
import { depthOf, MATCH_PROJECTION, project } from '../render/projection';
import { appearanceFor, type Appearance } from '../render/sprites/appearance';
import { animationKey, bakePlayer, bakeShadow, type BakedPlayer } from '../render/sprites/bake';
import type { Heading } from '../render/sprites/compose';
import { bodyLayout, FRAME } from '../render/sprites/rig';
import { loadSettings, type MatchSettings } from '../settings';
import { MatchWorld, WORLD_DT, type ShotRecord } from '../world/MatchWorld';
import { HUD_KEYS, type HudDebug } from './HudScene';

/** Joueurs de test, tirés d'une ligue générée : meneur, ailier, pivot lourd. */
function pickTestAthletes(seed: number): Player[] {
  const players = Object.values(createNewGame('bos', seed).players);
  const best = (pos: Player['pos']) => players.filter((p) => p.pos === pos).sort((a, b) => b.overall - a.overall)[0];
  const heaviestCenter = players.filter((p) => p.pos === 'C').sort((a, b) => b.weightKg - a.weightKg)[0];
  return [best('PG'), best('SF'), heaviestCenter];
}

/** Lissage indépendant de la fréquence d'affichage (`rate` donné pour 60 i/s). */
function smooth(current: number, target: number, rate: number, deltaMs: number): number {
  return current + (target - current) * (1 - Math.pow(1 - rate, deltaMs / (1000 / 60)));
}

const SPEED_LABELS = { slow: 'lente', normal: 'normale', fast: 'rapide' } as const;
const ZONE_LABELS: Record<ShotZone, string> = { rim: 'près du cercle', mid: 'mi-distance', three: '3 pts' };
const GRADE_LABELS: Record<TimingGrade, string> = { perfect: 'parfait', green: 'vert', early: 'tôt', late: 'tard' };
/** Annonce du lâcher au-dessus de la tête : durée (ms) et montée (px). */
const TAG_MS = 900;
const TAG_RISE = 4;
/** Dunk réussi : secousse de caméra en pixels entiers (le pixel-art reste net). */
const SHAKE = { ms: 150, px: 2 } as const;
/** Cadrage validé dans `?style` : ligne de touche du fond à 41 px du haut de l'écran (la ligne proche tombe vers 267). */
const FAR_LINE_ON_SCREEN = 41;
const LEVELS: readonly CourtLevel[] = ['pro', 'college'];

function teamOf(player: Player) {
  return TEAM_SEEDS.find((t) => t.id === player.teamId) ?? TEAM_SEEDS[0];
}

const decimal = (value: number) => value.toFixed(2).replace('.', ',');
const rounded = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Un joueur de test cuit : sprites aux couleurs de son équipe, ombre, étiquette. */
interface CastMember {
  player: Player;
  team: TeamLook;
  look: Appearance;
  baked: BakedPlayer;
  shadow: string;
  label: string;
  /** Hauteur du sprite au-dessus des pieds (px), du sommet de la tête aux semelles. */
  height: number;
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
 * Scène du match. Un joueur contrôlable (déplacement, saut, dribble, ramassage) dans la vue de
 * 3/4 validée dans `?style` : arène du terrain entier aux couleurs de son équipe, deux paniers,
 * sprites cuits du rig, ballon tenu dessiné dans la main ; caméra qui le suit et garde le
 * ballon visible ; HUD dans une scène à part ; réglages venus du panneau React.
 */
export class MatchScene extends Phaser.Scene {
  private settings!: MatchSettings;
  private seed = 0;
  private rng!: Rng;
  private athletes: Player[] = [];
  private athleteIndex = 0;
  private cast: CastMember[] = [];
  private world!: MatchWorld;
  private controls!: KeyboardInput;
  private blocked = false;
  private pendingJump = false;
  private pendingRelease = false;
  private accumulator = 0;
  private cam = { x: 0, y: 0, zoom: 1 };
  private debugKey = '';
  private debugVisible = false;
  /** Centre vertical préféré de la caméra : toute la profondeur du terrain visible. */
  private anchorY = 0;
  /** Ballon dessiné : dans la main ou à sa position physique, avec un raccord au changement. */
  private ballHeld = true;
  private ballDrawn: Point = { x: 0, y: 0 };
  private blendFrom: Point | null = null;
  private blendClock = 0;
  /** Vue du joueur : de dos quand il monte, de profil sinon ; gardée à l'arrêt. */
  private heading: Heading = 'side';
  /** Jauge du tir en cours ou du dernier tir (affichée encore un instant après le lâcher). */
  private gaugeShot: { window: number; timeToApex: number; release: number | null; side: number; linger: number } | null = null;
  /** Dernier tir déjà annoncé, et temps écoulé depuis l'annonce (ms). */
  private seenShot: ShotRecord | null = null;
  private tagClock = TAG_MS;
  private shakeMs = 0;
  private points = 0;
  private score!: ScoreboardData;

  private arena!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private ballImage!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private label!: Phaser.GameObjects.Image;
  private gauge!: Phaser.GameObjects.Graphics;
  private tag!: Phaser.GameObjects.Image;

  constructor() {
    super('Match');
  }

  init() {
    const param = new URLSearchParams(window.location.search).get('seed');
    this.seed = param ? Number(param) >>> 0 : randomSeed();
    this.rng = new Rng(this.seed);
    this.settings = (this.registry.get('settings') as MatchSettings | undefined) ?? loadSettings();
    this.athletes = pickTestAthletes(this.seed);
    this.athleteIndex = 0;
    this.cast = [];
    this.blocked = false;
    this.pendingJump = false;
    this.pendingRelease = false;
    this.accumulator = 0;
    this.debugKey = '';
    this.debugVisible = false;
    this.ballHeld = true;
    this.blendFrom = null;
    this.blendClock = 0;
    this.heading = 'side';
    this.gaugeShot = null;
    this.seenShot = null;
    this.tagClock = TAG_MS;
    this.shakeMs = 0;
    this.points = 0;
  }

  create() {
    // Arène aux couleurs de l'équipe du premier joueur ; adversaire lisible pour le tableau de score.
    const homeSeed = teamOf(this.athletes[0]);
    const home = teamLook(homeSeed);
    const away = teamLook(contrastingTeam(homeSeed, TEAM_SEEDS, 7));
    for (const level of LEVELS) {
      createArena(this, `arena-${level}`, MATCH_PROJECTION, makeCourt(level), home, {
        size: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
        apron: ARENA_APRON,
      });
    }
    createBallTextures(this);
    createControlRing(this, 'control-ring', 22, 7);
    createShotMarker(this, 'shot-marker');
    for (const [grade, tag] of Object.entries(GRADE_TAGS)) createTag(this, `grade-${grade}`, tag.text, tag.color);
    createTag(this, 'tag-dunk', 'DUNK', PALETTE.yellow);
    this.cast = this.athletes.map((player, i) => this.bakeCastMember(player, i));

    const court = makeCourt(this.settings.level);
    this.arena = this.add.image(0, 0, `arena-${this.settings.level}`).setOrigin(0).setDepth(0);
    for (const hoop of [court.hoops.left, court.hoops.right]) {
      const art = drawHoopArt(this, MATCH_PROJECTION, hoop, home);
      art.back.setDepth(depthOf(hoop.rim.y) - 0.2);
      art.front.setDepth(depthOf(hoop.rim.y) + 0.2);
    }
    const first = this.cast[0];
    this.marker = this.add.image(0, 0, 'shot-marker').setDepth(1).setVisible(false);
    this.playerShadow = this.add.image(0, 0, first.shadow).setDepth(1);
    this.ballShadow = this.add.image(0, 0, BALL_SHADOW_TEXTURE).setDepth(1);
    this.ring = this.add.image(0, 0, 'control-ring').setDepth(2);
    // Tourné vers la gauche : images dédiées (numéro à l'endroit), jamais de retournement du sprite.
    this.playerSprite = this.add.sprite(0, 0, first.baked.key, 0).setOrigin(0.5, 1);
    this.ballImage = this.add.image(0, 0, BALL_TEXTURE);
    this.label = this.add.image(0, 0, first.label).setOrigin(0.5, 0).setDepth(900);
    this.gauge = this.add.graphics().setDepth(950);
    this.tag = this.add.image(0, 0, 'grade-perfect').setOrigin(0.5, 1).setDepth(960).setVisible(false);

    const rim = court.hoops.right.rim;
    const start = { x: rim.x - 7, y: rim.y + 1.5, z: 0 };
    this.world = new MatchWorld(court, this.athletes[0], start, { mode: this.settings.shotMode, speed: this.settings.shotSpeed }, this.rng);

    const keyboard = this.input.keyboard!;
    this.controls = new KeyboardInput(keyboard, this.settings.bindings);
    keyboard.on('keydown', (event: KeyboardEvent) => this.onDebugKey(event));

    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const feet = project(start.x, start.y);
    this.anchorY = project(0, 0).y - FAR_LINE_ON_SCREEN + VIEW_HEIGHT / 2;
    this.cam = { x: feet.x, y: this.anchorY, zoom: 1 };
    camera.centerOn(this.cam.x, this.cam.y);

    const onSettings = (_parent: unknown, value: MatchSettings) => this.applySettings(value);
    const onBlocked = (_parent: unknown, value: boolean) => this.setBlocked(value);
    this.registry.events.on('changedata-settings', onSettings);
    this.registry.events.on('changedata-inputBlocked', onBlocked);
    this.events.once('shutdown', () => {
      this.registry.events.off('changedata-settings', onSettings);
      this.registry.events.off('changedata-inputBlocked', onBlocked);
      this.controls.destroy();
    });
    if (this.registry.get('inputBlocked')) this.setBlocked(true);

    // Le HUD lit ces clés à son lancement, puis suit leurs changements.
    this.score = { home, away, homeScore: 0, awayScore: 0, period: 1, clock: '12:00', shotClock: 24 };
    this.registry.set(HUD_KEYS.score, this.score);
    this.registry.set(HUD_KEYS.card, this.cardFor(0));
    this.registry.set(HUD_KEYS.debugVisible, false);
    this.renderWorld(0);
    this.scene.launch('Hud');
  }

  update(_time: number, deltaMs: number) {
    const input = this.blocked ? NO_INPUT : this.controls.read();
    // Appui et relâche sont gardés jusqu'au prochain pas de simulation (rien de perdu à haute
    // fréquence) ; un appui bref passe donc par un saut puis un lâcher immédiat.
    if (input.shootPressed) this.pendingJump = true;
    if (input.shootReleased) this.pendingRelease = true;
    this.accumulator += Math.min(deltaMs, 100) / 1000;
    while (this.accumulator >= WORLD_DT) {
      this.accumulator -= WORLD_DT;
      this.world.step(WORLD_DT, { x: input.moveX, y: input.moveY, jump: this.pendingJump, release: this.pendingRelease });
      this.pendingJump = false;
      this.pendingRelease = false;
    }
    this.renderWorld(deltaMs);
  }

  private bakeCastMember(player: Player, index: number): CastMember {
    const team = teamLook(teamOf(player));
    const look = appearanceFor(player);
    const baked = bakePlayer(this, `player-${index}`, look, { primary: team.primary, secondary: team.secondary });
    const shadowWidth = look.heavy ? 20 : 16;
    const shadow = `player-shadow-${shadowWidth}`;
    bakeShadow(this, shadow, shadowWidth, 4);
    const label = `label-${index}`;
    // Nom de famille seul, en entier : l'étiquette prend la largeur du nom.
    createNameLabel(this, label, normalizeText(player.lastName), true);
    return { player, team, look, baked, shadow, label, height: FRAME.groundY - bodyLayout(baked.dims).headTop };
  }

  /** Carte du joueur contrôlé : taille réelle et hauteur de saut calculée par le monde. */
  private cardFor(index: number): PlayerCardData {
    const { player, team, look } = this.cast[index];
    const jump = this.world.player.jumpHeight;
    return {
      look,
      team,
      name: `${player.firstName.charAt(0)}. ${player.lastName}`,
      position: POSITION_SHORT[player.pos] ?? player.pos,
      energy: 1,
      stats: `${decimal(player.heightCm / 100)} M  SAUT ${decimal(jump)}`,
    };
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
  }

  private setBlocked(blocked: boolean) {
    this.blocked = blocked;
    // Panneau ouvert : Phaser ne lit plus le clavier (ni n'empêche la frappe dans le panneau).
    this.game.input.keyboard!.enabled = !blocked;
    if (!blocked) this.controls.reset();
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
        this.selectAthlete(event.keyCode - K.ONE);
        break;
      case K.H:
        this.debugVisible = !this.debugVisible;
        this.registry.set(HUD_KEYS.debugVisible, this.debugVisible);
        break;
    }
  }

  private selectAthlete(index: number) {
    const member = this.cast[index];
    if (!member) return;
    this.world.setAthlete(member.player);
    this.athleteIndex = index;
    this.playerShadow.setTexture(member.shadow);
    this.label.setTexture(member.label);
    this.registry.set(HUD_KEYS.card, this.cardFor(index));
  }

  // --- Affichage ---

  /** Anime le sprite selon l'état choisi, sans relancer une animation déjà en cours. */
  private applySprite(baked: BakedPlayer, state: SpriteState) {
    const sprite = this.playerSprite;
    if (state.kind === 'anim') {
      sprite.play(animationKey(baked.key, state.name, state.facing, state.heading), true);
      return;
    }
    const index = frameIndex(state);
    if (sprite.anims.isPlaying) sprite.anims.stop();
    if (sprite.texture.key !== baked.key || Number(sprite.frame.name) !== index) sprite.setTexture(baked.key, index);
  }

  private renderWorld(deltaMs: number) {
    const body = this.world.player;
    const member = this.cast[this.athleteIndex];
    const { pos } = body;
    // Pendant un dunk, le sprite est monté pour que ses mains (bras levés) touchent le cercle.
    const lifted = rounded(project(pos.x, pos.y, pos.z));
    const dunk = this.world.shot?.dunk;
    let lift = 0;
    if (dunk) {
      const handY = lifted.y + 1 - FRAME.height + bodyLayout(member.baked.dims).torsoTop - 9;
      lift = dunkLift(handY, project(pos.x, pos.y, RIM_HEIGHT).y, pos.z / dunk.apex);
    }
    const feet = { x: lifted.x, y: lifted.y - lift };
    const ground = rounded(project(pos.x, pos.y));
    const holding = this.world.holder !== null && this.world.holder === this.world.controlled;
    const speed = Math.hypot(body.vel.x, body.vel.y);
    const shot = this.world.shot;
    this.heading = nextHeading(this.heading, body.vel, body.airborne, shot !== null);
    const state = spriteStateFor({ airborne: body.airborne, speed, holding, facing: body.facing, heading: this.heading, shot: shot?.kind ?? null });
    this.applySprite(member.baked, state);
    // Les pas suivent la vitesse au sol : les pieds accrochent le parquet au lieu de glisser.
    this.playerSprite.anims.timeScale = animTimeScale(state, speed);
    this.playerSprite.setPosition(feet.x, feet.y + 1).setDepth(depthOf(pos.y));
    this.playerShadow.setPosition(ground.x, ground.y - 1).setAlpha(Math.max(0.4, 1 - pos.z));
    this.ring.setPosition(ground.x, ground.y - 1);
    this.label.setPosition(ground.x, ground.y + 3);

    // Ballon tenu : dans la main de l'image courante. Libre : à sa position physique. Raccord de
    // ~80 ms quand il change de mode (lâcher, ramassage).
    const ball = this.world.ball.pos;
    const anchor = holding ? member.baked.anchors[Number(this.playerSprite.frame.name)] : null;
    const target = anchor ? heldBallPoint(feet, anchor) : project(ball.x, ball.y, ball.z);
    if (holding !== this.ballHeld) {
      this.ballHeld = holding;
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
    // De dos, le ballon tenu passe derrière le joueur (ballon levé derrière la tête).
    const heldDepth = depthOf(pos.y) + (this.heading === 'back' ? -0.05 : 0.05);
    this.ballImage.setPosition(Math.round(drawn.x), Math.round(drawn.y)).setDepth(holding ? heldDepth : depthOf(ball.y));
    const shadow = rounded(project(ball.x, ball.y));
    this.ballShadow.setPosition(shadow.x, shadow.y + 1).setAlpha(Phaser.Math.Clamp(1 - (ball.z - BALL_RADIUS) / 6, 0.35, 1));

    this.updateShotFeedback(feet, ground, member.height, deltaMs);
    this.updateCamera(feet, ground, member.height, rounded(drawn), deltaMs);
    this.updateDebug();
  }

  /**
   * Jauge à côté du tireur (du côté opposé au panier, posée au sol pour rester stable), annonce
   * du lâcher au-dessus de la tête, et score des paniers marqués.
   */
  private updateShotFeedback(feet: Point, ground: Point, height: number, deltaMs: number) {
    const body = this.world.player;
    const shot = this.world.shot;
    // Pas de jauge pour un dunk : il part sur un simple appui.
    if (shot && shot.kind !== 'dunk') {
      const { mode, speed } = this.world.shotSettings;
      const window = greenWindow(mode, shotSkill({ shooter: body.athlete, zone: shot.zone }), speed);
      this.gaugeShot = { window, timeToApex: body.timeToApex, release: null, side: -body.facing, linger: 0 };
    }
    const last = this.world.lastShot;
    if (last && last !== this.seenShot) {
      this.seenShot = last;
      if (!last.demo && last.grade) {
        this.tag.setTexture(`grade-${last.grade}`);
        this.tagClock = 0;
        if (this.gaugeShot) this.gaugeShot.release = last.timingError! + this.gaugeShot.timeToApex;
      }
      // Dunk réussi : annonce et secousse au smash (raté : rien).
      if (last.kind === 'dunk' && last.wanted) {
        this.tag.setTexture('tag-dunk');
        this.tagClock = 0;
        this.shakeMs = SHAKE.ms;
      }
    }

    this.gauge.clear();
    const g = this.gaugeShot;
    if (g) {
      if (!shot || shot.kind === 'dunk') g.linger += deltaMs;
      if (g.linger > GAUGE.lingerMs) {
        this.gaugeShot = null;
      } else {
        const elapsed = shot && shot.kind !== 'dunk' ? shot.airTime : (g.release ?? 0);
        const view = gaugeView(elapsed, g.timeToApex, g.window);
        const release = g.release === null ? null : gaugeView(g.release, g.timeToApex, g.window).fill;
        const left = g.side > 0 ? ground.x + 10 : ground.x - 10 - (GAUGE.width + 2);
        drawGauge(this.gauge, left, ground.y - 30, view, release);
      }
    }

    this.tagClock += deltaMs;
    const showTag = this.tagClock < TAG_MS;
    this.tag.setVisible(showTag);
    if (showTag) {
      const rise = Math.round((TAG_RISE * this.tagClock) / TAG_MS);
      const fade = Math.min(1, (TAG_MS - this.tagClock) / 300);
      this.tag.setPosition(ground.x, feet.y - height - 3 - rise).setAlpha(fade);
    }

    if (this.world.points !== this.points) {
      this.points = this.world.points;
      this.score = { ...this.score, homeScore: this.points };
      this.registry.set(HUD_KEYS.score, this.score);
    }
  }

  private updateCamera(feet: Point, ground: Point, height: number, ball: Point, deltaMs: number) {
    // Boîte du joueur : du sommet de la tête à l'étiquette sous ses pieds.
    const playerBox = { left: feet.x - 10, right: feet.x + 10, top: feet.y - height, bottom: ground.y + 12 };
    const target = targetFraming(playerBox, ball, this.anchorY, this.settings.camera, this.cam.zoom, VIEW_WIDTH, VIEW_HEIGHT);
    this.cam.zoom =
      this.settings.camera === 'steps' ? target.zoom : smooth(this.cam.zoom, target.zoom, CAMERA_TUNING.zoomLerp, deltaMs);
    this.cam.x = smooth(this.cam.x, target.centerX, CAMERA_TUNING.followLerp, deltaMs);
    this.cam.y = smooth(this.cam.y, target.centerY, CAMERA_TUNING.followLerp, deltaMs);
    // Secousse d'un dunk : décalage de ±2 px entiers, une image sur deux.
    this.shakeMs = Math.max(0, this.shakeMs - deltaMs);
    const flip = Math.floor(this.time.now / 33) % 2 === 0 ? 1 : -1;
    const shake = this.shakeMs > 0 ? SHAKE.px * flip : 0;
    const camera = this.cameras.main;
    camera.setZoom(this.cam.zoom);
    camera.centerOn(Math.round(this.cam.x) + shake, Math.round(this.cam.y) - shake / 2);
  }

  /** Aptitude au dunk, là où est le joueur : zone, score (seuil), stat utilisée. */
  private dunkLine(): string {
    const ctx = this.world.dunkContext();
    if (!ctx.inDunkZone) return 'Dunk : hors zone (moitié de la raquette)';
    const score = Math.round(dunkScore(ctx));
    const how = ctx.moveSpeed >= DUNK_TUNING.movingSpeed ? 'en mouvement' : 'à l’arrêt';
    return score >= DUNK_TUNING.threshold
      ? `Dunk possible (score ${score} ≥ ${DUNK_TUNING.threshold}, ${how})`
      : `Dunk impossible (score ${score} < ${DUNK_TUNING.threshold}, ${how})`;
  }

  /** Dernier tir en une ligne : zone, écart au sommet, note, proba tirée, résultat voulu et observé. */
  private shotLine(shot: ShotRecord): string {
    const result = (v: boolean) => (v ? 'RÉUSSI' : 'RATÉ');
    if (shot.kind === 'dunk') {
      const p = shot.probability === null ? '' : ` · proba ${Math.round(shot.probability * 100)} %`;
      return `Dunk${p} · voulu ${result(shot.wanted)} · obtenu ${shot.live === null ? '…' : result(shot.live)}`;
    }
    const head = shot.demo ? 'Tir démo' : shot.kind === 'layup' ? 'Layup' : 'Tir';
    let line = `${head} ${shot.distance.toFixed(1)} m (${ZONE_LABELS[shot.zone]})`;
    if (!shot.demo && shot.timingError !== null && shot.grade && shot.probability !== null) {
      const error = `${shot.timingError >= 0 ? '+' : ''}${shot.timingError.toFixed(2)} s`;
      line += ` · écart ${error} (${GRADE_LABELS[shot.grade]}${shot.forced ? ', forcé' : ''}) · proba ${Math.round(shot.probability * 100)} %`;
    }
    return `${line} · voulu ${result(shot.wanted)} · obtenu ${shot.live === null ? '…' : result(shot.live)}`;
  }

  /** Texte de debug (affiché avec H) : publié seulement quand il change. */
  private updateDebug() {
    const body = this.world.player;
    const a = body.athlete;
    const s = this.settings;
    const k = s.bindings;
    const top = [
      `${a.firstName} ${a.lastName} · ${a.pos} · ${(a.heightCm / 100).toFixed(2)} m · ${a.weightKg} kg · graine ${this.seed}`,
      `course ${body.runSpeed.toFixed(1)} m/s · saut ${body.jumpHeight.toFixed(2)} m · détente ${a.attrs.vertical} · vue ${this.heading === 'back' ? 'de dos' : 'de profil'}`,
      `${s.level.toUpperCase()} · tir ${s.shotMode === 'timing' ? 'Timing' : 'Real Player %'} ${SPEED_LABELS[s.shotSpeed]}` +
        ` · caméra ${s.camera === 'free' ? 'libre' : 'paliers'} x${this.cam.zoom.toFixed(2)}`,
    ];
    const bottom = [
      `${k.up.label}${k.left.label}${k.down.label}${k.right.label} bouger · ${k.shoot.label} tir (maintenir, relâcher au sommet) · R/M tir démo · 1-3 joueur · C caméra · F plein écran · H aide`,
    ];
    const shot = this.world.lastShot;
    if (shot) bottom.unshift(this.shotLine(shot));
    const active = this.world.shot;
    if (active) {
      const what = active.kind === 'dunk' ? 'dunk' : active.kind === 'layup' ? 'layup' : 'tir';
      bottom.unshift(`En l'air : ${what} ${ZONE_LABELS[active.zone]} · ${active.airTime.toFixed(2)} s`);
    } else if (this.world.holder === this.world.controlled) {
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
