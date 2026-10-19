import Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { TEAM_SEEDS } from '../../engine';
import { BALL_TEXTURE, createBallTextures } from '../render/arena/ball';
import { teamLook } from '../render/arena/draw';
import { animsReels, reelAt, type Reel } from '../render/animsReel';
import { ART_VIEW } from '../render/artConfig';
import { drawSmallText, SMALL_H } from '../render/pixelFont';
import { appearance2DFor, type Appearance } from '../render/sprites/appearance';
import { bakePlayer, bakeShadow, SHADOWS, type BakedPlayer } from '../render/sprites/bake';
import { SHEET_VIEWS } from '../render/sprites/compose';
import { sheetIndexIn } from '../render/sprites/layout';
import { FRAME } from '../render/sprites/rig';

/** Agrandissement des joueurs dans la page (×6 à l'écran en plein écran 1080p). */
const SCALE = 2;
const CELL_W = 118;
const LEFT = 8;
const ROWS = [
  { label: 'DROITIER', y: 52 },
  { label: 'GAUCHER', y: 214 },
];
const VIEW_LABELS: Record<string, string> = { 'down-right': 'BAS DROITE', 'down-left': 'BAS GAUCHE', 'up-right': 'HAUT DROITE', 'up-left': 'HAUT GAUCHE' };

interface Actor {
  baked: BakedPlayer;
  facing: 'right' | 'left';
  heading: 'down' | 'up';
  sprite: Phaser.GameObjects.Sprite;
  ball: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  feetX: number;
  feetY: number;
}

/**
 * Page `?anims` : chaque animation et chaque geste du rendu 2D en boucle, à leur vrai rythme, dans
 * les 4 positions, pour un droitier et un gaucher. Aucune logique de jeu : la bobine (`animsReel.ts`)
 * dit quelle image montrer à quel moment.
 * ← → : geste précédent / suivant ; espace : pause ; ↑ ↓ : image par image (en pause).
 */
export class AnimsScene extends Phaser.Scene {
  private reels: Reel[] = [];
  private current = 0;
  private clock = 0;
  private paused = false;
  /** En pause : image montrée (rang dans la bobine). */
  private step = 0;
  private actors: Actor[] = [];
  private title!: Phaser.GameObjects.Graphics;

  constructor() {
    super('anims');
  }

  create() {
    this.reels = animsReels();
    createBallTextures(this);
    bakeShadow(this, 'anims-shadow', 20 * SCALE, 5 * SCALE, SHADOWS.painted);
    const team = teamLook(TEAM_SEEDS[0]);
    const base = appearance2DFor({ id: 'anims-ailier', heightCm: 200, weightKg: 96, number: 23, age: 26 });
    const hand = (dominantHand: 'droite' | 'gauche'): Appearance => ({ ...base, character: { ...base.character!, dominantHand } });
    const looks = [hand('droite'), hand('gauche')];

    const g = this.add.graphics();
    g.fillStyle(0x6f7c99).fillRect(0, 0, ART_VIEW.width, ART_VIEW.height);
    g.fillStyle(0x5d6987).fillRect(0, 0, ART_VIEW.width, 24);
    ROWS.forEach((row, r) => {
      const baked = bakePlayer(this, `anims-${r}`, looks[r], { primary: team.primary, secondary: team.secondary, renderer: '2d' });
      g.fillStyle(PALETTE.chalk);
      drawSmallText(g, row.label, LEFT, row.y - 12);
      SHEET_VIEWS.forEach((view, v) => {
        const feetX = LEFT + v * CELL_W + CELL_W / 2;
        const feetY = row.y + FRAME.height * SCALE;
        g.fillStyle(PALETTE.silver);
        drawSmallText(g, VIEW_LABELS[`${view.heading}-${view.facing}`], LEFT + v * CELL_W + 4, row.y - 4);
        const shadow = this.add.image(feetX, feetY - SCALE, 'anims-shadow').setDepth(1);
        const sprite = this.add.sprite(0, 0, baked.key, 0).setOrigin(0.5, 1).setScale(SCALE).setDepth(2);
        const ball = this.add.image(0, 0, BALL_TEXTURE).setScale(SCALE).setDepth(3);
        this.actors.push({ baked, facing: view.facing, heading: view.heading, sprite, ball, shadow, feetX, feetY });
      });
    });
    g.fillStyle(PALETTE.silver);
    drawSmallText(g, 'GAUCHE DROITE : GESTE   ESPACE : PAUSE   HAUT BAS : IMAGE PAR IMAGE   F : PLEIN ECRAN', LEFT, ART_VIEW.height - SMALL_H - 4);
    this.title = this.add.graphics().setDepth(10);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-RIGHT', () => this.select(this.current + 1));
    keyboard.on('keydown-LEFT', () => this.select(this.current - 1));
    keyboard.on('keydown-SPACE', () => {
      this.paused = !this.paused;
      this.step = reelAt(this.reel, this.clock).index;
    });
    keyboard.on('keydown-UP', () => this.nudge(1));
    keyboard.on('keydown-DOWN', () => this.nudge(-1));
    const wanted = new URLSearchParams(window.location.search).get('geste');
    this.select(Math.max(0, this.reels.findIndex((r) => r.id === wanted)));
  }

  private get reel(): Reel {
    return this.reels[this.current];
  }

  private select(index: number) {
    this.current = (index + this.reels.length) % this.reels.length;
    this.clock = 0;
    this.step = 0;
    this.title.clear();
    this.title.fillStyle(PALETTE.yellow);
    drawSmallText(this.title, `${this.current + 1}/${this.reels.length}  ${this.reel.label}`, LEFT, 9);
  }

  /** En pause : image suivante ou précédente de la bobine. */
  private nudge(delta: number) {
    if (!this.paused) {
      this.paused = true;
      this.step = reelAt(this.reel, this.clock).index;
    }
    const n = this.reel.frames.length;
    this.step = (this.step + delta + n) % n;
  }

  update(_time: number, delta: number) {
    if (!this.paused) this.clock += delta;
    const at = this.paused ? { index: this.step, lift: 0 } : reelAt(this.reel, this.clock);
    const frame = this.reel.frames[at.index].frame;
    for (const a of this.actors) {
      const index = sheetIndexIn(a.baked.layout, frame, a.facing, a.heading);
      const y = a.feetY + SCALE - at.lift * SCALE;
      a.sprite.setFrame(index).setPosition(a.feetX, y);
      a.shadow.setAlpha(Math.max(0.4, 1 - at.lift / 20));
      const anchor = a.baked.anchors[index];
      a.ball.setVisible(anchor !== null);
      if (anchor) {
        const left = a.feetX - (FRAME.width * SCALE) / 2;
        const top = y - FRAME.height * SCALE;
        a.ball.setPosition(left + (anchor.x + 0.5) * SCALE, top + (anchor.y + 0.5) * SCALE).setDepth(anchor.behind ? 1.5 : 3);
      }
    }
  }
}
