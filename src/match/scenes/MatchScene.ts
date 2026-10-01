import Phaser from 'phaser';
import { randomSeed, Rng } from '../../engine/rng';
import { VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { BALL_PHYSICS, isAtRest, stepBall, type BallState } from '../physics/ball';
import { BALL_RADIUS, distanceToRim, isThreePoint, makeCourt, type Court, type CourtLevel, type Vec3 } from '../physics/court';
import { solveShot } from '../physics/shotSolver';
import { createBallTextures, createCourtTexture, drawHoop } from '../render/courtArt';
import { depthOf, project } from '../render/projection';

interface DemoShot {
  wanted: boolean;
  distance: number;
  three: boolean;
  tries: number;
  /** Résultat observé en direct : panier avant le premier contact avec le parquet. */
  live: boolean | null;
  scored: boolean;
}

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '8px', color: '#f4efe6' };

/**
 * Scène du match. Incrément 3 : terrain à l'échelle et démo de la physique du ballon
 * (tirs aléatoires dont le résultat est tiré d'abord, puis mis en scène par le solveur).
 */
export class MatchScene extends Phaser.Scene {
  private courts!: Record<CourtLevel, Court>;
  private level: CourtLevel = 'pro';
  private rng!: Rng;
  private seed = 0;
  private ball!: BallState;
  private accumulator = 0;
  private waitTime = 0;
  private auto = false;
  private shot: DemoShot | null = null;
  private stats = { shots: 0, made: 0, mismatches: 0 };

  private courtImage!: Phaser.GameObjects.Image;
  private ballImage!: Phaser.GameObjects.Image;
  private shadowImage!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  private header!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super('Match');
  }

  init() {
    const param = new URLSearchParams(window.location.search).get('seed');
    this.seed = param ? Number(param) >>> 0 : randomSeed();
    this.rng = new Rng(this.seed);
    this.level = 'pro';
    this.courts = { pro: makeCourt('pro'), college: makeCourt('college') };
    const hoop = this.courts.pro.hoops.right;
    this.ball = { pos: { x: hoop.rim.x - 1.5, y: hoop.rim.y + 1.2, z: BALL_RADIUS }, vel: { x: 0, y: 0, z: 0 } };
    this.accumulator = 0;
    this.waitTime = 0;
    this.auto = false;
    this.shot = null;
    this.stats = { shots: 0, made: 0, mismatches: 0 };
  }

  create() {
    createCourtTexture(this, 'court-pro', this.courts.pro);
    createCourtTexture(this, 'court-college', this.courts.college);
    createBallTextures(this);
    this.courtImage = this.add.image(0, 0, 'court-pro').setOrigin(0).setDepth(0);
    drawHoop(this, this.courts.pro.hoops.left);
    drawHoop(this, this.courts.pro.hoops.right);

    this.marker = this.add.image(0, 0, 'marker').setDepth(1).setVisible(false);
    this.shadowImage = this.add.image(0, 0, 'ball-shadow').setDepth(1);
    this.ballImage = this.add.image(0, 0, 'ball');

    // Cadrage fixe sur le demi-terrain de droite (la caméra qui suit arrive à l'incrément 4).
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.setScroll(WORLD_WIDTH - VIEW_WIDTH, WORLD_HEIGHT - VIEW_HEIGHT);

    // Actions ponctuelles de la démo : écoutées par événement, pour ne perdre aucun appui bref.
    const keyboard = this.input.keyboard!;
    keyboard.addCapture('SPACE');
    keyboard.on('keydown-SPACE', () => this.fire());
    keyboard.on('keydown-R', () => this.fire(true));
    keyboard.on('keydown-M', () => this.fire(false));
    keyboard.on('keydown-N', () => this.toggleLevel());
    keyboard.on('keydown-A', () => {
      this.auto = !this.auto;
      this.refreshHeader();
    });

    this.header = this.add.text(4, 3, '', TEXT_STYLE).setScrollFactor(0).setDepth(1000);
    this.info = this.add.text(4, VIEW_HEIGHT - 21, '', TEXT_STYLE).setScrollFactor(0).setDepth(1000);
    this.refreshHeader();
    this.refreshInfo();
    this.render();
  }

  update(_time: number, deltaMs: number) {
    // Pas fixe : la simulation en direct reproduit exactement celle du solveur.
    this.accumulator += Math.min(deltaMs, 100) / 1000;
    while (this.accumulator >= BALL_PHYSICS.dt) {
      this.accumulator -= BALL_PHYSICS.dt;
      this.physicsStep();
    }

    // Mode auto : nouveau tir peu après le premier rebond du précédent.
    const decided = !this.shot || this.shot.live !== null;
    if (this.auto && decided) {
      this.waitTime += deltaMs / 1000;
      if (this.waitTime > 2.5 || (isAtRest(this.ball) && this.waitTime > 0.6)) this.fire();
    } else {
      this.waitTime = 0;
    }
    this.render();
  }

  private physicsStep() {
    for (const event of stepBall(this.ball, this.courts[this.level])) {
      if (!this.shot || this.shot.live !== null) continue;
      if (event.type === 'score' && event.hoop === 'right') this.shot.scored = true;
      if (event.type === 'floor') {
        this.shot.live = this.shot.scored;
        this.stats.shots += 1;
        if (this.shot.live) this.stats.made += 1;
        if (this.shot.live !== this.shot.wanted) this.stats.mismatches += 1;
        this.refreshInfo();
      }
    }
  }

  /** Tir de démo depuis une position aléatoire : le résultat est tiré d'abord, puis mis en scène. */
  private fire(wanted?: boolean) {
    const court = this.courts[this.level];
    const hoop = court.hoops.right;
    const dist = this.rng.range(1.2, 8.5);
    const angle = this.rng.range(-1.4, 1.4);
    const start: Vec3 = {
      x: hoop.rim.x - Math.cos(angle) * dist,
      y: Phaser.Math.Clamp(hoop.rim.y + Math.sin(angle) * dist, 0.4, court.width - 0.4),
      z: this.rng.range(2.2, 2.7),
    };
    const made = wanted ?? this.rng.chance(0.5);
    try {
      const plan = solveShot(start, made, court, hoop, this.rng);
      this.ball = { pos: { ...start }, vel: { ...plan.velocity } };
      this.accumulator = 0;
      this.shot = {
        wanted: made,
        distance: distanceToRim(hoop, start.x, start.y),
        three: isThreePoint(court, hoop, start.x, start.y),
        tries: plan.tries,
        live: null,
        scored: false,
      };
      const spot = project(start.x, start.y);
      this.marker.setPosition(Math.round(spot.x), Math.round(spot.y)).setVisible(true);
    } catch (err) {
      console.warn(err);
    }
    this.refreshInfo();
  }

  private toggleLevel() {
    this.level = this.level === 'pro' ? 'college' : 'pro';
    this.courtImage.setTexture(`court-${this.level}`);
    this.refreshHeader();
  }

  private refreshHeader() {
    this.header.setText([
      `DÉMO PHYSIQUE · niveau ${this.level.toUpperCase()} · graine ${this.seed}${this.auto ? ' · AUTO' : ''}`,
      'ESPACE tir  R réussi  M raté  N niveau  A auto',
    ]);
  }

  private refreshInfo() {
    const { shots, made, mismatches } = this.stats;
    const lines = [`Tirs ${shots}  réussis ${made}  écarts moteur/physique ${mismatches}`];
    if (this.shot) {
      const s = this.shot;
      const result = (v: boolean) => (v ? 'RÉUSSI' : 'RATÉ');
      lines.unshift(
        `Tir ${s.distance.toFixed(1)} m (${s.three ? '3 pts' : '2 pts'}) voulu ${result(s.wanted)}` +
          ` obtenu ${s.live === null ? '...' : result(s.live)} (${s.tries} essai${s.tries > 1 ? 's' : ''})`,
      );
    }
    this.info.setText(lines);
    this.info.setY(VIEW_HEIGHT - 2 - lines.length * 10);
  }

  private render() {
    const { pos } = this.ball;
    const p = project(pos.x, pos.y, pos.z);
    this.ballImage.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(depthOf(pos.y));
    const s = project(pos.x, pos.y);
    this.shadowImage.setPosition(Math.round(s.x), Math.round(s.y) + 1);
    // L'ombre s'efface un peu quand le ballon monte.
    this.shadowImage.setAlpha(Phaser.Math.Clamp(1 - (pos.z - BALL_RADIUS) / 6, 0.35, 1));
  }
}
