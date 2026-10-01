import Phaser from 'phaser';
import { createNewGame, gaugeTime, playerName, type Player } from '../../engine';
import { randomSeed, Rng } from '../../engine/rng';
import { PIXELS_PER_METER, VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { KeyboardInput, NO_INPUT } from '../input/keyboard';
import { BALL_RADIUS, makeCourt } from '../physics/court';
import { CAMERA_TUNING, targetFraming } from '../render/camera';
import { createBallTextures, createCourtTexture, drawHoop } from '../render/courtArt';
import { createPlayerShadowTexture, createPlayerTexture, KITS } from '../render/playerArt';
import { depthOf, project } from '../render/projection';
import { loadSettings, type MatchSettings } from '../settings';
import { MatchWorld, WORLD_DT } from '../world/MatchWorld';
import type { HudContent } from './HudScene';

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

/**
 * Scène du match. Incrément 4 : un joueur contrôlable (déplacement, saut, dribble, ramassage),
 * caméra qui suit le joueur et garde le ballon visible, réglages venus du panneau React.
 */
export class MatchScene extends Phaser.Scene {
  private settings!: MatchSettings;
  private seed = 0;
  private rng!: Rng;
  private athletes: Player[] = [];
  private world!: MatchWorld;
  private controls!: KeyboardInput;
  private blocked = false;
  private pendingJump = false;
  private accumulator = 0;
  private runClock = 0;
  private cam = { x: 0, y: 0, zoom: 1 };
  private hudKey = '';

  private courtImage!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private ballImage!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;

  constructor() {
    super('Match');
  }

  init() {
    const param = new URLSearchParams(window.location.search).get('seed');
    this.seed = param ? Number(param) >>> 0 : randomSeed();
    this.rng = new Rng(this.seed);
    this.settings = (this.registry.get('settings') as MatchSettings | undefined) ?? loadSettings();
    this.athletes = pickTestAthletes(this.seed);
    this.blocked = false;
    this.pendingJump = false;
    this.accumulator = 0;
    this.runClock = 0;
    this.hudKey = '';
  }

  create() {
    createCourtTexture(this, 'court-pro', makeCourt('pro'));
    createCourtTexture(this, 'court-college', makeCourt('college'));
    createBallTextures(this);
    createPlayerShadowTexture(this);
    this.athletes.forEach((a, i) => createPlayerTexture(this, `player-${i}`, a.heightCm, KITS.home));

    const court = makeCourt(this.settings.level);
    this.courtImage = this.add.image(0, 0, `court-${this.settings.level}`).setOrigin(0).setDepth(0);
    drawHoop(this, court.hoops.left);
    drawHoop(this, court.hoops.right);
    this.marker = this.add.image(0, 0, 'marker').setDepth(1).setVisible(false);
    this.playerShadow = this.add.image(0, 0, 'player-shadow').setDepth(1);
    this.ballShadow = this.add.image(0, 0, 'ball-shadow').setDepth(1);
    this.playerSprite = this.add.image(0, 0, 'player-0').setOrigin(0.5, 1);
    this.ballImage = this.add.image(0, 0, 'ball');

    const rim = court.hoops.right.rim;
    const start = { x: rim.x - 7, y: rim.y + 1.5, z: 0 };
    this.world = new MatchWorld(court, this.athletes[0], start, gaugeTime(this.settings.shotSpeed), this.rng);

    const keyboard = this.input.keyboard!;
    this.controls = new KeyboardInput(keyboard, this.settings.bindings);
    keyboard.on('keydown', (event: KeyboardEvent) => this.onDebugKey(event));

    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const feet = project(start.x, start.y);
    this.cam = { x: feet.x, y: feet.y - 20, zoom: 1 };
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

    this.scene.launch('Hud');
    this.renderWorld(0);
  }

  update(_time: number, deltaMs: number) {
    const input = this.blocked ? NO_INPUT : this.controls.read();
    // Un appui est gardé jusqu'au prochain pas de simulation (aucun appui perdu à haute fréquence).
    if (input.shootPressed) this.pendingJump = true;
    this.accumulator += Math.min(deltaMs, 100) / 1000;
    while (this.accumulator >= WORLD_DT) {
      this.accumulator -= WORLD_DT;
      this.world.step(WORLD_DT, { x: input.moveX, y: input.moveY, jump: this.pendingJump });
      this.pendingJump = false;
    }
    this.renderWorld(deltaMs);
  }

  // --- Réglages et clavier ---

  private applySettings(next: MatchSettings) {
    const prev = this.settings;
    this.settings = next;
    if (prev.bindings !== next.bindings) this.controls.bind(next.bindings);
    if (prev.level !== next.level) {
      this.world.court = makeCourt(next.level);
      this.courtImage.setTexture(`court-${next.level}`);
    }
    if (prev.shotSpeed !== next.shotSpeed) this.world.setJumpTiming(gaugeTime(next.shotSpeed));
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
          const spot = project(s.x, s.y);
          this.marker.setPosition(Math.round(spot.x), Math.round(spot.y)).setVisible(true);
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
    }
  }

  private selectAthlete(index: number) {
    const athlete = this.athletes[index];
    if (!athlete) return;
    this.world.setAthlete(athlete);
    this.playerSprite.setTexture(`player-${index}`);
  }

  // --- Affichage ---

  private renderWorld(deltaMs: number) {
    const body = this.world.player;
    const { pos } = body;
    const feet = project(pos.x, pos.y, pos.z);
    const moving = !body.airborne && Math.hypot(body.vel.x, body.vel.y) > 0.5;
    this.runClock = moving ? this.runClock + deltaMs : 0;
    const bob = moving && Math.floor(this.runClock / 140) % 2 === 1 ? 1 : 0;
    this.playerSprite
      .setPosition(Math.round(feet.x), Math.round(feet.y) - bob)
      .setFlipX(body.facing < 0)
      .setDepth(depthOf(pos.y));
    const ground = project(pos.x, pos.y);
    this.playerShadow.setPosition(Math.round(ground.x), Math.round(ground.y)).setAlpha(Math.max(0.4, 1 - pos.z));

    const ball = this.world.ball.pos;
    const b = project(ball.x, ball.y, ball.z);
    const held = this.world.holder !== null;
    this.ballImage.setPosition(Math.round(b.x), Math.round(b.y)).setDepth(held ? depthOf(pos.y) + 0.05 : depthOf(ball.y));
    const bg = project(ball.x, ball.y);
    this.ballShadow
      .setPosition(Math.round(bg.x), Math.round(bg.y) + 1)
      .setAlpha(Phaser.Math.Clamp(1 - (ball.z - BALL_RADIUS) / 6, 0.35, 1));

    this.updateCamera(feet, b, body.athlete.heightCm, deltaMs);
    this.updateHud();
  }

  private updateCamera(feet: { x: number; y: number }, ball: { x: number; y: number }, heightCm: number, deltaMs: number) {
    const head = feet.y - (heightCm / 100) * PIXELS_PER_METER;
    const playerBox = { left: feet.x - 8, right: feet.x + 8, top: head, bottom: feet.y };
    const target = targetFraming(playerBox, ball, this.settings.camera, this.cam.zoom, VIEW_WIDTH, VIEW_HEIGHT);
    this.cam.zoom =
      this.settings.camera === 'steps' ? target.zoom : smooth(this.cam.zoom, target.zoom, CAMERA_TUNING.zoomLerp, deltaMs);
    this.cam.x = smooth(this.cam.x, target.centerX, CAMERA_TUNING.followLerp, deltaMs);
    this.cam.y = smooth(this.cam.y, target.centerY, CAMERA_TUNING.followLerp, deltaMs);
    const camera = this.cameras.main;
    camera.setZoom(this.cam.zoom);
    camera.centerOn(Math.round(this.cam.x), Math.round(this.cam.y));
  }

  private updateHud() {
    const body = this.world.player;
    const a = body.athlete;
    const s = this.settings;
    const k = s.bindings;
    const top = [
      `${playerName(a)} · ${a.pos} · ${(a.heightCm / 100).toFixed(2)} m · ${a.weightKg} kg`,
      `course ${body.runSpeed.toFixed(1)} m/s · saut ${body.jumpHeight.toFixed(2)} m · détente ${a.attrs.vertical}`,
      `${s.level.toUpperCase()} · tir ${s.shotMode === 'timing' ? 'Timing' : 'Real Player %'} ${SPEED_LABELS[s.shotSpeed]}` +
        ` · caméra ${s.camera === 'free' ? 'libre' : 'paliers'} x${this.cam.zoom.toFixed(2)}`,
    ];
    const bottom = [
      `${k.up.label}${k.left.label}${k.down.label}${k.right.label} bouger · ${k.shoot.label} saut · R/M tir · 1-3 joueur · C caméra`,
    ];
    const shot = this.world.lastShot;
    if (shot) {
      const result = (v: boolean) => (v ? 'RÉUSSI' : 'RATÉ');
      bottom.unshift(
        `Tir démo ${shot.distance.toFixed(1)} m (${shot.three ? '3' : '2'} pts) voulu ${result(shot.wanted)}` +
          ` obtenu ${shot.live === null ? '…' : result(shot.live)}`,
      );
    }
    const content: HudContent = { top, bottom };
    const key = JSON.stringify(content);
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.registry.set('hud', content);
    }
  }
}
