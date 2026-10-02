import Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { BALL } from '../../assets/sprites/arena';
import { createNewGame, playerName, TEAM_SEEDS, type Player } from '../../engine';
import { hashSeed, randomSeed, Rng } from '../../engine/rng';
import { COURT_LENGTH, makeCourt } from '../physics/court';
import { makeProjection, type ArtProjection } from '../render/arena/artProjection';
import { createCourtPiece } from '../render/arena/courtPiece';
import { contrastingTeam, drawGrid, teamLook, type TeamLook } from '../render/arena/draw';
import { drawHoopArt } from '../render/arena/hoopArt';
import { ART_PPM, ART_VIEW, VISUAL_SCALE } from '../render/artConfig';
import { drawSmallText, normalizeText, SMALL_H, smallTextWidth } from '../render/pixelFont';
import { createControlRing, createNameLabel, drawPlayerCard, drawScoreboard, POSITION_SHORT } from '../render/hud/hud';
import { appearanceFor, appearanceSignature, type Appearance } from '../render/sprites/appearance';
import { animationKey, bakePlayer, bakeShadow, type BakedPlayer } from '../render/sprites/bake';
import { ANIMATIONS, FRAME, type AnimationName } from '../render/sprites/rig';

const ANIM_ORDER: AnimationName[] = ['idle', 'run', 'dribble', 'dribbleIdle', 'shoot', 'dunk'];
/** Colonnes des joueurs (m le long du terrain) et profondeurs des deux rangées. */
const COLUMNS = [11.2, 13.6, 16, 18.4, 20.8];
const ROWS = { home: 3.2, away: 11.4 };
/** Comparaison des gabarits : un meneur et un pivot types côte à côte, à la profondeur du cercle. */
const BUILDS = [
  { id: 'style-meneur', label: 'MEN 1,86', heightCm: 186, weightKg: 84, number: 12, x: 22.2 },
  { id: 'style-pivot', label: 'PIV 2,12', heightCm: 212, weightKg: 122, number: 16, x: 24.3 },
] as const;
const BUILDS_DEPTH = 7.62;

interface Actor {
  sprite: Phaser.GameObjects.Sprite;
  ball: Phaser.GameObjects.Image;
  baked: BakedPlayer;
}

/** 10 joueurs variés, dont un de chaque gabarit (petit/moyen/grand × léger/lourd). */
function pickVaried(players: Player[], count: number, rng: Rng): Player[] {
  const shuffled = rng.shuffle([...players]);
  const out: Player[] = [];
  const signatures = new Set<string>();
  const builds = new Set<string>();
  const take = (p: Player, look: Appearance) => {
    out.push(p);
    signatures.add(appearanceSignature(look));
    builds.add(`${look.heightClass}/${look.heavy}`);
  };
  for (const p of shuffled) {
    const look = appearanceFor(p);
    if (!builds.has(`${look.heightClass}/${look.heavy}`)) take(p, look);
  }
  for (const p of shuffled) {
    if (out.length >= count) break;
    const look = appearanceFor(p);
    if (!out.includes(p) && !signatures.has(appearanceSignature(look))) take(p, look);
  }
  return out.slice(0, count);
}

/**
 * Scène `?style` : planche de validation de la direction artistique (docs/ART_DIRECTION.md).
 * 10 joueurs variés animés, arbitre, panier, bout de terrain, public, photographes, HUD et
 * palette maîtresse, en 640×360 à 30 px/m.
 */
export class StyleScene extends Phaser.Scene {
  private seed = 0;
  private homeIndex = 0;
  private sameAnim: AnimationName | null = null;
  private proj!: ArtProjection;
  private home!: TeamLook;
  private away!: TeamLook;
  private statics: Phaser.GameObjects.GameObject[] = [];
  private actors: Phaser.GameObjects.GameObject[] = [];
  private debug!: Phaser.GameObjects.Text;
  private swatches!: Phaser.GameObjects.Graphics;
  private distinct = 0;

  constructor() {
    super('Style');
  }

  init() {
    const param = new URLSearchParams(window.location.search).get('seed');
    this.seed = param ? Number(param) >>> 0 : randomSeed();
    this.homeIndex = new Rng(this.seed).int(0, TEAM_SEEDS.length - 1);
    this.sameAnim = null;
  }

  create() {
    // Ligne de fond de droite à 587 px, ligne de touche du fond à 55 px.
    this.proj = makeProjection(587 - COURT_LENGTH * ART_PPM, 55);
    const g = this.add.graphics();
    drawGrid(g, BALL, 1, 1, (c) => (c === 'b' ? PALETTE.orange : c === 'B' ? PALETTE.orangeDark : null));
    g.generateTexture('style-ball', BALL[0].length + 2, BALL.length + 2);
    g.destroy();

    this.debug = this.add.text(6, 46, '', { fontFamily: 'monospace', fontSize: '10px', color: '#f6f2ea', backgroundColor: '#18203acc' });
    this.debug.setDepth(2000).setVisible(false);
    // Rappel discret de l'aide, en bas à droite.
    const hint = this.add.graphics().setDepth(2000);
    const hintW = smallTextWidth('D aide') + 4;
    hint.fillStyle(PALETTE.navy, 0.8).fillRect(ART_VIEW.width - hintW - 2, ART_VIEW.height - SMALL_H - 4, hintW, SMALL_H + 2);
    hint.fillStyle(PALETTE.silver);
    drawSmallText(hint, 'D aide', ART_VIEW.width - hintW, ART_VIEW.height - SMALL_H - 3);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-R', () => {
      this.seed = (this.seed + 0x9e3779b9) >>> 0;
      this.buildActors();
    });
    keyboard.on('keydown-T', () => {
      this.homeIndex = (this.homeIndex + 1) % TEAM_SEEDS.length;
      this.buildAll();
    });
    keyboard.on('keydown-A', () => {
      const i = this.sameAnim === null ? 0 : ANIM_ORDER.indexOf(this.sameAnim) + 1;
      this.sameAnim = i >= ANIM_ORDER.length ? null : ANIM_ORDER[i];
      this.buildActors();
    });
    keyboard.on('keydown-D', () => {
      const visible = !this.debug.visible;
      this.debug.setVisible(visible);
      this.swatches.setVisible(visible);
    });

    this.buildAll();
  }

  private buildAll() {
    const homeSeed = TEAM_SEEDS[this.homeIndex];
    this.home = teamLook(homeSeed);
    this.away = teamLook(contrastingTeam(homeSeed, TEAM_SEEDS, this.homeIndex + 7));
    this.buildStatics();
    this.buildActors();
  }

  private buildStatics() {
    this.statics.forEach((o) => o.destroy());
    this.statics = [];
    const court = makeCourt('pro');
    createCourtPiece(this, 'style-court', this.proj, court, this.home, ART_VIEW);
    this.statics.push(this.add.image(0, 0, 'style-court').setOrigin(0).setDepth(0));
    const rim = court.hoops.right.rim;
    const hoop = drawHoopArt(this, this.proj, court.hoops.right, this.home);
    const floorY = this.proj.project(rim.x, rim.y).y;
    hoop.back.setDepth(floorY - 0.5);
    hoop.front.setDepth(floorY + 0.5);
    this.statics.push(hoop.back, hoop.front);

    // Palette maîtresse en haut à droite, visible seulement en mode debug (D).
    const swatches = this.add.graphics().setDepth(1500).setVisible(this.debug.visible);
    this.swatches = swatches;
    const colors = Object.values(PALETTE);
    const sw = 6;
    const sx = ART_VIEW.width - 6 - colors.length * sw;
    swatches.fillStyle(PALETTE.outline).fillRect(sx - 1, 3, colors.length * sw + 2, sw + 2);
    colors.forEach((c, i) => swatches.fillStyle(c).fillRect(sx + i * sw, 4, sw, sw));
    this.statics.push(swatches);
  }

  private placeActor(look: Appearance, key: string, x: number, depth: number, opts: { team: TeamLook; anim: AnimationName; flip: boolean; referee?: boolean; startFrame?: number }): Actor {
    const baked = bakePlayer(this, key, look, {
      scale: VISUAL_SCALE,
      primary: opts.team.primary,
      secondary: opts.team.secondary,
      kit: opts.referee ? 'referee' : 'team',
      loopAll: true,
    });
    const feet = this.proj.project(x, depth);
    const fx = Math.round(feet.x);
    const fy = Math.round(feet.y);
    const shadowW = look.heavy ? 28 : 22;
    bakeShadow(this, `style-shadow-${shadowW}`, shadowW);
    this.actors.push(this.add.image(fx, fy - 1, `style-shadow-${shadowW}`).setDepth(fy - 0.4));
    // Tourné vers la gauche : images dédiées (numéro à l'endroit), jamais de retournement du sprite.
    const sprite = this.add.sprite(fx, fy + 1, key, 0).setOrigin(0.5, 1).setDepth(fy);
    const ball = this.add.image(0, 0, 'style-ball').setDepth(fy + 0.1).setVisible(false);
    const actor = { sprite, ball, baked };
    const place = (frameName: string | number) => {
      const anchor = baked.anchors[Number(frameName)];
      ball.setVisible(anchor !== null);
      if (!anchor) return;
      ball.setPosition(fx - FRAME.width / 2 + anchor.x, fy + 1 - FRAME.height + anchor.y);
    };
    sprite.on('animationupdate', (_a: unknown, frame: Phaser.Animations.AnimationFrame) => place(frame.textureFrame));
    sprite.on('animationstart', (_a: unknown, frame: Phaser.Animations.AnimationFrame) => place(frame.textureFrame));
    const frames = ANIMATIONS[opts.anim].frames.length;
    sprite.play({ key: animationKey(key, opts.anim, opts.flip ? 'left' : 'right'), startFrame: (opts.startFrame ?? 0) % frames });
    this.actors.push(sprite, ball);
    return actor;
  }

  private buildActors() {
    this.actors.forEach((o) => o.destroy());
    this.actors = [];
    const players = pickVaried(Object.values(createNewGame('bos', this.seed).players), 10, new Rng(hashSeed(`style-${this.seed}`)));
    const looks = players.map((p) => appearanceFor(p));
    this.distinct = new Set(looks.map(appearanceSignature)).size;

    players.forEach((p, i) => {
      const home = i < 5;
      const team = home ? this.home : this.away;
      const anim = this.sameAnim ?? ANIM_ORDER[i % ANIM_ORDER.length];
      const x = COLUMNS[i % 5];
      const depth = home ? ROWS.home : ROWS.away;
      this.placeActor(looks[i], `style-p${i}`, x, depth, { team, anim, flip: i % 3 === 2, startFrame: i });
      const feet = this.proj.project(x, depth);
      const controlled = i === 0;
      if (controlled) {
        createControlRing(this, 'style-ring', 30, 9);
        this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) - 1, 'style-ring').setDepth(feet.y - 0.3));
      }
      // Nom de famille seul, en entier : l'étiquette prend la largeur du nom.
      createNameLabel(this, `style-label-${i}`, normalizeText(p.lastName), controlled);
      this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) + 5, `style-label-${i}`).setOrigin(0.5, 0).setDepth(900));
    });

    // Arbitre (maillot rayé générique), entre les deux rangées.
    const refLook = appearanceFor({ id: `arbitre-${this.seed}`, heightCm: 190, weightKg: 88, number: 0 });
    this.placeActor(refLook, 'style-ref', 10.4, 7.3, { team: this.home, anim: 'idle', flip: false, referee: true });

    // Gabarits : meneur type (n° 12) et pivot type (n° 16) côte à côte.
    BUILDS.forEach((b, j) => {
      const look = appearanceFor({ id: `${b.id}-${this.seed}`, heightCm: b.heightCm, weightKg: b.weightKg, number: b.number });
      this.placeActor(look, `style-build${j}`, b.x, BUILDS_DEPTH, { team: this.home, anim: 'idle', flip: false });
      const feet = this.proj.project(b.x, BUILDS_DEPTH);
      createNameLabel(this, `style-build-label-${j}`, b.label, false);
      this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) + 5, `style-build-label-${j}`).setOrigin(0.5, 0).setDepth(900));
    });

    // HUD.
    const hud = this.add.graphics().setDepth(1500);
    drawScoreboard(hud, 6, 6, { home: this.home, away: this.away, homeScore: 48, awayScore: 37, period: 3, clock: '1:35', shotClock: 14 });
    const lead = players[0];
    drawPlayerCard(hud, 6, ART_VIEW.height - 42, {
      look: looks[0],
      team: this.home,
      name: `${lead.firstName.charAt(0)}. ${lead.lastName}`,
      position: POSITION_SHORT[lead.pos] ?? lead.pos,
      energy: 0.8,
      stats: '14 PTS 6 PD 3 RB',
    });
    this.actors.push(hud);
    this.refreshDebug(players);
  }

  private refreshDebug(players: Player[]) {
    this.debug.setText([
      `graine ${this.seed}  ${ART_VIEW.width}×${ART_VIEW.height}  ${ART_PPM} px/m  joueurs ×${String(VISUAL_SCALE).replace('.', ',')}`,
      `${this.home.city} ${this.home.name} / ${this.away.city} ${this.away.name}`,
      `animation : ${this.sameAnim ?? 'variée'}`,
      `${this.distinct}/${players.length} apparences distinctes`,
      `${players.map((p) => playerName(p).split(' ').pop()).join(', ')}`,
      'R joueurs  T équipe  A animation  F plein écran  D aide et palette',
    ]);
  }
}
