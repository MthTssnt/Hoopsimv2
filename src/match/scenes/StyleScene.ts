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
import { ART_VIEW, DEFAULT_VISUAL_SCALE, VISUAL_SCALES } from '../render/artConfig';
import { drawSmallText, normalizeText, SMALL_H, smallTextWidth } from '../render/pixelFont';
import { createControlRing, createNameLabel, drawPlayerCard, drawScoreboard, POSITION_SHORT } from '../render/hud/hud';
import { appearanceFor, appearanceSignature, type Appearance } from '../render/sprites/appearance';
import { bakePlayer, bakeShadow, type BakedPlayer } from '../render/sprites/bake';
import { ANIMATIONS, FRAME, type AnimationName } from '../render/sprites/rig';

const ANIM_ORDER: AnimationName[] = ['idle', 'run', 'dribble', 'dribbleIdle', 'shoot', 'dunk'];
/** Colonnes des joueurs (m le long du terrain) et profondeurs des deux rangées. */
const COLUMNS = [11.2, 13.6, 16, 18.4, 20.8];
const ROWS = { home: 3.2, away: 11.4 };
/** Comparaison des échelles : à la profondeur du cercle, pour juger la taille face au panier. */
const COMPARE = { depth: 7.62, columns: [22.2, 23.6, 25] };

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
 * 10 joueurs variés animés, arbitre, panier, bout de terrain, public, photographes, HUD,
 * palette maîtresse et comparaison des échelles visuelles 1,1 / 1,25 / 1,4.
 */
export class StyleScene extends Phaser.Scene {
  private seed = 0;
  private homeIndex = 0;
  private scaleIndex = VISUAL_SCALES.indexOf(DEFAULT_VISUAL_SCALE);
  private sameAnim: AnimationName | null = null;
  private proj!: ArtProjection;
  private home!: TeamLook;
  private away!: TeamLook;
  private statics: Phaser.GameObjects.GameObject[] = [];
  private actors: Phaser.GameObjects.GameObject[] = [];
  private debug!: Phaser.GameObjects.Text;
  private distinct = 0;

  constructor() {
    super('Style');
  }

  init() {
    const param = new URLSearchParams(window.location.search).get('seed');
    this.seed = param ? Number(param) >>> 0 : randomSeed();
    this.homeIndex = new Rng(this.seed).int(0, TEAM_SEEDS.length - 1);
    this.scaleIndex = VISUAL_SCALES.indexOf(DEFAULT_VISUAL_SCALE);
    this.sameAnim = null;
  }

  create() {
    // Ligne de fond de droite à 352 px, ligne de touche du fond à 33 px.
    this.proj = makeProjection(352 - COURT_LENGTH * 18, 33);
    const g = this.add.graphics();
    drawGrid(g, BALL, 1, 1, (c) => (c === 'b' ? PALETTE.orange : c === 'B' ? PALETTE.orangeDark : null));
    g.generateTexture('style-ball', 7, 7);
    g.destroy();

    this.debug = this.add.text(4, 30, '', { fontFamily: 'monospace', fontSize: '8px', color: '#f6f2ea', backgroundColor: '#18203acc' });
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
    keyboard.on('keydown-S', () => {
      this.scaleIndex = (this.scaleIndex + 1) % VISUAL_SCALES.length;
      this.buildActors();
    });
    keyboard.on('keydown-D', () => this.debug.setVisible(!this.debug.visible));

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

    // Repère de hauteur du cercle au-dessus des joueurs de comparaison.
    const guide = this.add.graphics().setDepth(1);
    const rimScreen = this.proj.project(rim.x, rim.y, rim.z);
    guide.fillStyle(PALETTE.silver, 0.7);
    for (let x = Math.round(this.proj.project(COMPARE.columns[0] - 0.9, 0).x); x < rimScreen.x - 6; x += 3) guide.fillRect(x, Math.round(rimScreen.y), 1, 1);
    this.statics.push(guide);

    // Palette maîtresse en haut à droite.
    const swatches = this.add.graphics().setDepth(1500);
    const colors = Object.values(PALETTE);
    const sx = ART_VIEW.width - 4 - colors.length * 4;
    swatches.fillStyle(PALETTE.outline).fillRect(sx - 1, 2, colors.length * 4 + 2, 6);
    colors.forEach((c, i) => swatches.fillStyle(c).fillRect(sx + i * 4, 3, 4, 4));
    this.statics.push(swatches);
  }

  private placeActor(look: Appearance, key: string, x: number, depth: number, opts: { team: TeamLook; anim: AnimationName; flip: boolean; scale: number; referee?: boolean; startFrame?: number }): Actor {
    const baked = bakePlayer(this, key, look, {
      scale: opts.scale,
      primary: opts.team.primary,
      secondary: opts.team.secondary,
      kit: opts.referee ? 'referee' : 'team',
      loopAll: true,
    });
    const feet = this.proj.project(x, depth);
    const fx = Math.round(feet.x);
    const fy = Math.round(feet.y);
    const shadowW = look.heavy ? 18 : 14;
    bakeShadow(this, `style-shadow-${shadowW}`, shadowW);
    this.actors.push(this.add.image(fx, fy - 1, `style-shadow-${shadowW}`).setDepth(fy - 0.4));
    const sprite = this.add.sprite(fx, fy + 1, key, 0).setOrigin(0.5, 1).setFlipX(opts.flip).setDepth(fy);
    const ball = this.add.image(0, 0, 'style-ball').setDepth(fy + 0.1).setVisible(false);
    const actor = { sprite, ball, baked };
    const place = (frameName: string | number) => {
      const anchor = baked.anchors[Number(frameName)];
      ball.setVisible(anchor !== null);
      if (!anchor) return;
      const ax = opts.flip ? FRAME.width - 1 - anchor.x : anchor.x;
      ball.setPosition(fx - FRAME.width / 2 + ax, fy + 1 - FRAME.height + anchor.y);
    };
    sprite.on('animationupdate', (_a: unknown, frame: Phaser.Animations.AnimationFrame) => place(frame.textureFrame));
    sprite.on('animationstart', (_a: unknown, frame: Phaser.Animations.AnimationFrame) => place(frame.textureFrame));
    const frames = ANIMATIONS[opts.anim].frames.length;
    sprite.play({ key: `${key}:${opts.anim}`, startFrame: (opts.startFrame ?? 0) % frames });
    this.actors.push(sprite, ball);
    return actor;
  }

  private buildActors() {
    this.actors.forEach((o) => o.destroy());
    this.actors = [];
    const scale = VISUAL_SCALES[this.scaleIndex];
    const players = pickVaried(Object.values(createNewGame('bos', this.seed).players), 10, new Rng(hashSeed(`style-${this.seed}`)));
    const looks = players.map((p) => appearanceFor(p));
    this.distinct = new Set(looks.map(appearanceSignature)).size;

    players.forEach((p, i) => {
      const home = i < 5;
      const team = home ? this.home : this.away;
      const anim = this.sameAnim ?? ANIM_ORDER[i % ANIM_ORDER.length];
      const x = COLUMNS[i % 5];
      const depth = home ? ROWS.home : ROWS.away;
      this.placeActor(looks[i], `style-p${i}`, x, depth, { team, anim, flip: i % 3 === 2, scale, startFrame: i });
      const feet = this.proj.project(x, depth);
      const controlled = i === 0;
      if (controlled) {
        createControlRing(this, 'style-ring', 18);
        this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) - 1, 'style-ring').setDepth(feet.y - 0.3));
      }
      // Nom de famille seul, 8 lettres au plus : les étiquettes voisines ne se chevauchent pas.
      createNameLabel(this, `style-label-${i}`, normalizeText(p.lastName).slice(0, 8), controlled);
      this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) + 3, `style-label-${i}`).setOrigin(0.5, 0).setDepth(900));
    });

    // Arbitre (maillot rayé générique), entre les deux rangées.
    const refLook = appearanceFor({ id: `arbitre-${this.seed}`, heightCm: 190, weightKg: 88, number: 0 });
    this.placeActor(refLook, 'style-ref', 10.4, 7.3, { team: this.home, anim: 'idle', flip: false, scale, referee: true });

    // Même joueur aux trois échelles, à la profondeur du cercle.
    const model = looks.find((l) => l.heightClass === 'moyen' && !l.heavy) ?? looks[0];
    VISUAL_SCALES.forEach((s, j) => {
      const x = COMPARE.columns[j];
      this.placeActor({ ...model, heightCm: 200 }, `style-cmp${j}`, x, COMPARE.depth, { team: this.home, anim: 'idle', flip: false, scale: s });
      const feet = this.proj.project(x, COMPARE.depth);
      const label = String(s).replace('.', ',');
      createNameLabel(this, `style-cmp-label-${j}`, label, s === scale);
      this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) + 3, `style-cmp-label-${j}`).setOrigin(0.5, 0).setDepth(900));
    });

    // HUD.
    const hud = this.add.graphics().setDepth(1500);
    drawScoreboard(hud, 4, 3, { home: this.home, away: this.away, homeScore: 48, awayScore: 37, period: 3, clock: '1:35', shotClock: 14 });
    const lead = players[0];
    drawPlayerCard(hud, 4, ART_VIEW.height - 28, {
      look: looks[0],
      team: this.home,
      name: `${lead.firstName.charAt(0)}. ${lead.lastName}`,
      position: POSITION_SHORT[lead.pos] ?? lead.pos,
      energy: 0.8,
      stats: '14 PTS 6 PD 3 RB',
    });
    this.actors.push(hud);
    this.refreshDebug(players, scale);
  }

  private refreshDebug(players: Player[], scale: number) {
    this.debug.setText([
      `graine ${this.seed}  échelle ${String(scale).replace('.', ',')}x`,
      `${this.home.city} ${this.home.name} / ${this.away.city} ${this.away.name}`,
      `animation : ${this.sameAnim ?? 'variée'}`,
      `${this.distinct}/${players.length} apparences distinctes`,
      `${players.map((p) => playerName(p).split(' ').pop()).join(', ')}`,
      'R joueurs  T équipe  A animation  S échelle  D aide',
    ]);
  }
}
