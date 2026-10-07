import Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { createNewGame, playerName, TEAM_SEEDS, type Player } from '../../engine';
import { hashSeed, randomSeed, Rng } from '../../engine/rng';
import { COURT_LENGTH, makeCourt } from '../physics/court';
import { makeProjection, type ArtProjection } from '../render/arena/artProjection';
import { createArena, STYLE_APRON } from '../render/arena/arena';
import { BALL_TEXTURE, createBallTextures } from '../render/arena/ball';
import { contrastingTeam, teamLook, type TeamLook } from '../render/arena/draw';
import { drawHoopArt } from '../render/arena/hoopArt';
import { ART_PPM, ART_VIEW, artPx } from '../render/artConfig';
import { drawSmallText, normalizeText, SMALL_H, smallTextWidth } from '../render/pixelFont';
import { createControlRing, createNameLabel, drawPlayerCard, drawScoreboard, POSITION_SHORT } from '../render/hud/hud';
import { appearanceFor, appearanceSignature, type Appearance } from '../render/sprites/appearance';
import type { SlotCanvas } from '../render/sprites/canvas';
import { colorsFor, headLayer, sheetIndex, slotColor, type Heading } from '../render/sprites/compose';
import { animationKey, bakePlayer, bakeShadow, type BakedPlayer } from '../render/sprites/bake';
import { LEGACY_AILIER, LEGACY_LOOK } from '../render/sprites/legacy';
import { ANIMATIONS, bodyDims, bodyLayout, FRAME, FRAMES, SHOE_ROWS, type AnimationName } from '../render/sprites/rig';
import { composeFrame } from '../render/sprites/compose';
import { BALL } from '../../assets/sprites/arena';
import { drawGrid } from '../render/arena/draw';
import { slotOf } from '../render/sprites/canvas';
import type { Expression } from '../../assets/sprites/heads';

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
/** Gros plan et planche des poses : un meneur, un ailier et un pivot types. */
const SPECIMENS = [
  { id: 'specimen-meneur', name: 'MENEUR', heightCm: 186, weightKg: 84, number: 12 },
  { id: 'specimen-ailier', name: 'AILIER', heightCm: 200, weightKg: 95, number: 23 },
  { id: 'specimen-pivot', name: 'PIVOT', heightCm: 212, weightKg: 106, number: 16 },
] as const;
const EXPRESSION_LIST: { expression: Expression; label: string }[] = [
  { expression: 'neutre', label: 'NEUTRE' },
  { expression: 'concentree', label: 'CONCENTREE' },
  { expression: 'joyeuse', label: 'JOYEUSE' },
];
/** Groupes d'images de la planche des poses (indices de la feuille). */
const POSE_GROUPS = [
  { label: 'ARRET', from: 0, to: 1 },
  { label: 'COURSE', from: 2, to: 5 },
  { label: 'DRIBBLE', from: 6, to: 9 },
  { label: 'DR.ARRET', from: 10, to: 11 },
  { label: 'TIR', from: 12, to: 14 },
  { label: 'DUNK', from: 15, to: 17 },
  { label: 'CONTRE', from: 18, to: 18 },
];

/**
 * Vues de la scène : terrain, gros plan des gabarits, avant / après le redesign du 14, planches
 * des poses de profil et de dos (touche V ou `?style&vue=`).
 */
type View = 'terrain' | 'gros-plan' | 'avant-apres' | 'poses' | 'dos';
const VIEWS: View[] = ['terrain', 'gros-plan', 'avant-apres', 'poses', 'dos'];

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
 * Vue terrain : 10 joueurs variés animés, arbitre, panier, bout de terrain, public,
 * photographes, HUD, en 640×360 à 30 px/m. Vue gros plan : meneur, ailier et pivot ×2 avec
 * une règle des proportions et les 3 expressions. Vue avant / après : l'ailier de 480×270 et
 * celui de 640×360 à la même taille à l'écran. Vue poses : toutes les images des gabarits.
 */
export class StyleScene extends Phaser.Scene {
  private seed = 0;
  private homeIndex = 0;
  private sameAnim: AnimationName | null = null;
  private view: View = 'terrain';
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
    const vue = new URLSearchParams(window.location.search).get('vue');
    this.view = VIEWS.includes(vue as View) ? (vue as View) : 'terrain';
  }

  create() {
    // Ligne de fond de droite à 587 px, ligne de touche du fond à 55 px (le cadrage de 480×270, ×4/3).
    this.proj = makeProjection(587 - COURT_LENGTH * ART_PPM, 55);
    createBallTextures(this);

    this.debug = this.add.text(4, 34, '', { fontFamily: 'monospace', fontSize: '8px', color: '#f6f2ea', backgroundColor: '#18203acc' });
    this.debug.setDepth(2000).setVisible(false);
    // Rappel discret de l'aide, en bas à droite.
    const hint = this.add.graphics().setDepth(2000);
    const hintText = 'V vue  D aide';
    const hintW = smallTextWidth(hintText) + 4;
    hint.fillStyle(PALETTE.navy, 0.8).fillRect(ART_VIEW.width - hintW - 2, ART_VIEW.height - SMALL_H - 4, hintW, SMALL_H + 2);
    hint.fillStyle(PALETTE.silver);
    drawSmallText(hint, hintText, ART_VIEW.width - hintW, ART_VIEW.height - SMALL_H - 3);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-R', () => {
      this.seed = (this.seed + 0x9e3779b9) >>> 0;
      this.buildAll();
    });
    keyboard.on('keydown-T', () => {
      this.homeIndex = (this.homeIndex + 1) % TEAM_SEEDS.length;
      this.buildAll();
    });
    keyboard.on('keydown-A', () => {
      const i = this.sameAnim === null ? 0 : ANIM_ORDER.indexOf(this.sameAnim) + 1;
      this.sameAnim = i >= ANIM_ORDER.length ? null : ANIM_ORDER[i];
      this.buildAll();
    });
    keyboard.on('keydown-V', () => {
      this.view = VIEWS[(VIEWS.indexOf(this.view) + 1) % VIEWS.length];
      this.buildAll();
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
    this.statics.forEach((o) => o.destroy());
    this.statics = [];
    this.actors.forEach((o) => o.destroy());
    this.actors = [];
    if (this.view === 'gros-plan') this.buildCloseup();
    else if (this.view === 'avant-apres') this.buildBeforeAfter();
    else if (this.view === 'poses') this.buildPoseSheet('side');
    else if (this.view === 'dos') this.buildPoseSheet('back');
    else {
      this.buildStatics();
      this.buildActors();
    }
  }

  /** Fond uni des vues d'étude, avec un titre. */
  private studyBackground(title: string): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(PALETTE.navy).fillRect(0, 0, ART_VIEW.width, ART_VIEW.height);
    g.fillStyle(PALETTE.silver);
    drawSmallText(g, title, 4, 3);
    this.statics.push(g);
    return g;
  }

  /** Dessine un tampon de sprite agrandi `scale` fois dans un Graphics. */
  private drawCanvas(g: Phaser.GameObjects.Graphics, canvas: SlotCanvas, look: Appearance, x: number, y: number, scale: number) {
    const colors = colorsFor(look, this.home.primary, this.home.secondary);
    canvas.forEach((px, py, slot) => g.fillStyle(slotColor(slot, colors)).fillRect(x + px * scale, y + py * scale, scale, scale));
  }

  private specimenLook(spec: (typeof SPECIMENS)[number]): Appearance {
    return appearanceFor({ id: `${spec.id}-${this.seed}`, heightCm: spec.heightCm, weightKg: spec.weightKg, number: spec.number });
  }

  /**
   * Gros plan : meneur, ailier et pivot à l'arrêt, ×2 (×8 à l'écran en 1080p plein écran), avec
   * une règle graduée par rangée et les bandes de proportions (tête, cou, torse, short, jambes,
   * chaussures), puis les 3 expressions.
   */
  private buildCloseup() {
    const g = this.studyBackground('GROS PLAN X2 (X8 EN 1080P) : PROPORTIONS DES GABARITS');
    const scale = 2;
    const top = 14;
    const bands = [PALETTE.yellow, PALETTE.teal, PALETTE.red, PALETTE.blue, PALETTE.green, PALETTE.pink];
    SPECIMENS.forEach((spec, j) => {
      const look = this.specimenLook(spec);
      const dims = bodyDims(spec.heightCm, look.heavy);
      const baked = bakePlayer(this, `closeup-${j}`, look, { primary: this.home.primary, secondary: this.home.secondary });
      const L = bodyLayout(dims);
      const colX = j * 210;
      const spriteX = colX + 70;
      const sprite = this.add.image(spriteX, top, baked.key, 0).setOrigin(0).setScale(scale).setDepth(2);
      this.statics.push(sprite);
      const headTopRow = L.headTop - 1;
      const parts = [
        { label: 'TETE', from: headTopRow, to: L.neckY - 1 },
        { label: 'COU', from: L.neckY, to: L.neckY },
        { label: 'TORSE', from: L.torsoTop, to: L.shortsTop - 1 },
        { label: 'SHORT', from: L.shortsTop, to: L.shortsBottom },
        { label: 'JAMBES', from: L.shortsBottom + 1, to: L.shoeTop - 1 },
        { label: 'CHAUSS', from: L.shoeTop, to: L.shoeTop + SHOE_ROWS - 1 },
      ];
      // Règle : une graduation par rangée du sprite, bandes colorées par partie, libellés à gauche.
      const rulerX = spriteX - 8;
      // Libellés centrés sur leur bande, poussés vers le bas s'ils chevauchent le précédent.
      let labelBottom = -Infinity;
      parts.forEach((part, k) => {
        const y0 = top + part.from * scale;
        const rows = part.to - part.from + 1;
        g.fillStyle(bands[k]).fillRect(rulerX, y0, 3, rows * scale);
        g.fillStyle(bands[k], 0.18).fillRect(spriteX, y0, FRAME.width * scale, rows * scale);
        const text = `${part.label} ${rows}`;
        const labelY = Math.max(y0 + Math.floor((rows * scale - SMALL_H) / 2), labelBottom + 1);
        labelBottom = labelY + SMALL_H;
        g.fillStyle(bands[k]);
        drawSmallText(g, text, rulerX - 3 - smallTextWidth(text), labelY);
      });
      for (let r = headTopRow; r <= FRAME.groundY; r++) g.fillStyle(PALETTE.outline).fillRect(rulerX + 3, top + r * scale, 2, 1);
      const total = FRAME.groundY - headTopRow + 1;
      const caption = `${spec.name} ${(spec.heightCm / 100).toFixed(2).replace('.', ',')} M : ${total} PX`;
      g.fillStyle(PALETTE.chalk);
      drawSmallText(g, caption, colX + 8, top + FRAME.height * scale + 4);
    });
    // Les 3 expressions, ×3.
    const look = this.specimenLook(SPECIMENS[1]);
    const exprY = top + FRAME.height * scale + 16;
    g.fillStyle(PALETTE.silver);
    drawSmallText(g, 'EXPRESSIONS X3', 4, exprY);
    EXPRESSION_LIST.forEach(({ expression, label }, k) => {
      const x = 40 + k * 200;
      this.drawCanvas(g, headLayer(look, expression, 1, 1, 20, 20), look, x, exprY + 8, 3);
      g.fillStyle(PALETTE.chalk);
      drawSmallText(g, label, x + 66, exprY + 36);
    });
  }

  /**
   * Avant / après : l'ailier de 480×270 (32 px) affiché ×4 et celui de 640×360 (43 px) affiché
   * ×3, comme en 1080p plein écran : même taille à l'écran, plus de pixels et une silhouette plus
   * mince après. À l'arrêt et au dribble, avec le ballon de chaque version.
   */
  private buildBeforeAfter() {
    const g = this.studyBackground('AVANT / APRES : MEME TAILLE A L ECRAN (1080P PLEIN ECRAN)');
    const legacyColors = colorsFor({ ...this.specimenLook(SPECIMENS[1]), skin: LEGACY_LOOK.skin, hairColor: LEGACY_LOOK.hairColor }, this.home.primary, this.home.secondary);
    const look: Appearance = { ...this.specimenLook(SPECIMENS[1]), skin: LEGACY_LOOK.skin, hairColor: LEGACY_LOOK.hairColor, head: 0, hair: 1, number: 23, heightCm: 200, heavy: false };
    const groundY = 300;
    const drawGridScaled = (grid: readonly string[], x: number, y: number, scale: number) => {
      grid.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
          const slot = slotOf(row[gx]);
          if (slot) g.fillStyle(slotColor(slot, legacyColors)).fillRect(x + gx * scale, y + gy * scale, scale, scale);
        }
      });
    };
    // Avant : grilles recopiées de l'ancien rig, ×4.
    const before = [LEGACY_AILIER.idle, LEGACY_AILIER.dribble];
    before.forEach((grid, k) => drawGridScaled(grid, 40 + k * 100, groundY - grid.length * 4, 4));
    // Après : le nouveau rig, ×3.
    const dims = bodyDims(200, false);
    [0, 10].forEach((frame, k) => {
      const composed = composeFrame(look, FRAMES[frame], dims);
      const b = composed.canvas.bounds()!;
      const x = 360 + k * 110 - b.left * 3;
      const y = groundY - (b.bottom + 1) * 3;
      this.drawCanvas(g, composed.canvas, look, x, y, 3);
    });
    // Ballons : l'ancien 6×6 ×4, le nouveau 8×8 ×3.
    const ballColors: Record<string, number> = { b: PALETTE.orange, B: PALETTE.orangeDark, n: PALETTE.ink, l: PALETTE.woodLight };
    const ballLayer = this.add.graphics().setDepth(3);
    ballLayer.setScale(4);
    drawGrid(ballLayer, LEGACY_AILIER.ball, 63, 58, (c) => ballColors[c] ?? null);
    const newBall = this.add.graphics().setDepth(3).setScale(3);
    drawGrid(newBall, BALL, 192, 77, (c) => ballColors[c] ?? null);
    this.statics.push(ballLayer, newBall);
    g.fillStyle(PALETTE.chalk);
    drawSmallText(g, 'AVANT : 480X270, AILIER DE 32 PX, AFFICHE X4', 24, groundY + 14);
    drawSmallText(g, 'APRES : 640X360, AILIER DE 43 PX, AFFICHE X3', 344, groundY + 14);
    g.fillStyle(PALETTE.silver);
    drawSmallText(g, 'BALLON 6X6 X4', 236, 266);
    drawSmallText(g, 'BALLON 8X8 X3', 560, 266);
  }

  /**
   * Planche des poses : les 19 images de chaque gabarit à l'échelle du jeu, plus l'ailier tourné
   * vers la gauche ; de profil, ou de dos (le joueur monte).
   */
  private buildPoseSheet(heading: Heading) {
    const back = heading === 'back';
    const g = this.studyBackground(back ? 'PLANCHE DES POSES DE DOS (ECHELLE DU JEU)' : 'PLANCHE DES POSES (ECHELLE DU JEU)');
    const cell = 32;
    const left = 8;
    POSE_GROUPS.forEach((group) => {
      g.fillStyle(PALETTE.silver);
      drawSmallText(g, group.label, left + group.from * cell, 12);
      g.fillStyle(PALETTE.slate).fillRect(left + group.from * cell, 18, (group.to - group.from + 1) * cell - 3, 1);
    });
    const rows = [...SPECIMENS.map((spec) => ({ spec, facing: 'right' as const })), { spec: SPECIMENS[1], facing: 'left' as const }];
    rows.forEach(({ spec, facing }, r) => {
      const look = this.specimenLook(spec);
      const baked = bakePlayer(this, `poses-${r}`, look, { primary: this.home.primary, secondary: this.home.secondary });
      const y = 22 + r * 82;
      g.fillStyle(PALETTE.chalk);
      drawSmallText(g, `${spec.name}${back ? ' DE DOS' : ''}${facing === 'left' ? ' VERS LA GAUCHE' : ''}`, left, y);
      FRAMES.forEach((_, i) => {
        const index = sheetIndex(i, facing, heading);
        const cx = left + i * cell + cell / 2;
        const baseY = y + 8 + FRAME.height;
        this.statics.push(this.add.image(cx, baseY, baked.key, index).setOrigin(0.5, 1).setDepth(2));
        const anchor = baked.anchors[index];
        // De dos, le ballon tenu passe derrière le joueur.
        if (anchor) this.statics.push(this.add.image(cx - FRAME.width / 2 + anchor.x, baseY - FRAME.height + anchor.y, BALL_TEXTURE).setDepth(back ? 1 : 3));
      });
    });
  }

  private buildStatics() {
    const court = makeCourt('pro');
    createArena(this, 'style-court', this.proj, court, this.home, { size: ART_VIEW, apron: STYLE_APRON, bannerFrom: artPx(196) });
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
    const sw = 4;
    const sx = ART_VIEW.width - 4 - colors.length * sw;
    swatches.fillStyle(PALETTE.outline).fillRect(sx - 1, 3, colors.length * sw + 2, sw + 2);
    colors.forEach((c, i) => swatches.fillStyle(c).fillRect(sx + i * sw, 4, sw, sw));
    this.statics.push(swatches);
  }

  private placeActor(look: Appearance, key: string, x: number, depth: number, opts: { team: TeamLook; anim: AnimationName; flip: boolean; referee?: boolean; startFrame?: number }): Actor {
    const baked = bakePlayer(this, key, look, {
      primary: opts.team.primary,
      secondary: opts.team.secondary,
      kit: opts.referee ? 'referee' : 'team',
      loopAll: true,
    });
    const feet = this.proj.project(x, depth);
    const fx = Math.round(feet.x);
    const fy = Math.round(feet.y);
    const shadowW = look.heavy ? 26 : 20;
    bakeShadow(this, `style-shadow-${shadowW}`, shadowW, 5);
    this.actors.push(this.add.image(fx, fy - 1, `style-shadow-${shadowW}`).setDepth(fy - 0.4));
    // Tourné vers la gauche : images dédiées (numéro à l'endroit), jamais de retournement du sprite.
    const sprite = this.add.sprite(fx, fy + 1, key, 0).setOrigin(0.5, 1).setDepth(fy);
    const ball = this.add.image(0, 0, BALL_TEXTURE).setDepth(fy + 0.1).setVisible(false);
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
        createControlRing(this, 'style-ring', 28, 9);
        this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) - 1, 'style-ring').setDepth(feet.y - 0.3));
      }
      // Nom de famille seul, en entier : l'étiquette prend la largeur du nom.
      createNameLabel(this, `style-label-${i}`, normalizeText(p.lastName), controlled);
      this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) + 3, `style-label-${i}`).setOrigin(0.5, 0).setDepth(900));
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
      this.actors.push(this.add.image(Math.round(feet.x), Math.round(feet.y) + 3, `style-build-label-${j}`).setOrigin(0.5, 0).setDepth(900));
    });

    // HUD.
    const hud = this.add.graphics().setDepth(1500);
    drawScoreboard(hud, 4, 4, { home: this.home, away: this.away, homeScore: 48, awayScore: 37, period: 'QT3', clock: '1:35', shotClock: 14 });
    const lead = players[0];
    drawPlayerCard(hud, 4, ART_VIEW.height - 32, {
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
      `graine ${this.seed}  ${ART_VIEW.width}×${ART_VIEW.height}  ${String(ART_PPM).replace('.', ',')} px/m  vue ${this.view}`,
      `${this.home.city} ${this.home.name} / ${this.away.city} ${this.away.name}`,
      `animation : ${this.sameAnim ?? 'variée'}`,
      `${this.distinct}/${players.length} apparences distinctes`,
      `${players.map((p) => playerName(p).split(' ').pop()).join(', ')}`,
      'R joueurs  T équipe  A animation  V vue  F plein écran  D aide et palette',
    ]);
  }
}
