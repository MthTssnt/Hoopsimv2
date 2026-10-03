import Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { drawBanner, drawPlayerCard, drawScoreboard, type PlayerCardData, type ScoreboardData } from '../render/hud/hud';
import { drawSmallText, SMALL_H, smallTextWidth } from '../render/pixelFont';

/** Lignes de debug (masquées par défaut, touche H). */
export interface HudDebug {
  top: string[];
  bottom: string[];
}

/** Bandeau de fin de partie (null : aucun). */
export interface HudBanner {
  title: string;
  subtitle: string;
  /** Gagné (jaune), perdu (rouge), ou annonce neutre (fin de période, mi-temps : gris clair). */
  tone: 'won' | 'lost' | 'info';
}

const BANNER_COLORS = { won: PALETTE.yellow, lost: PALETTE.red, info: PALETTE.silver } as const;

/**
 * Clés du registre lues par le HUD. Le match les écrit avant de lancer cette scène : Phaser
 * n'émet « changedata » qu'à partir de la deuxième écriture d'une clé.
 */
export const HUD_KEYS = {
  score: 'hudScore',
  card: 'hudCard',
  debug: 'hudDebug',
  debugVisible: 'hudDebugVisible',
  banner: 'hudBanner',
} as const;

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '8px', color: '#f6f2ea', backgroundColor: '#18203acc' };
const SCOREBOARD_AT = { x: 4, y: 4 };
const CARD_AT = { x: 4, y: VIEW_HEIGHT - 32 };
/** Haut du bandeau de fin, au-dessus du centre de l'écran (le terrain reste visible dessous). */
const BANNER_Y = 84;

/**
 * HUD par-dessus le match, dans une scène à part : il ne suit ni le défilement ni le zoom de la
 * caméra. Tableau de score en haut à gauche, carte du joueur contrôlé en bas à gauche, bandeau de
 * fin de partie au centre, texte de debug sur demande. Le match publie le contenu dans le registre.
 */
export class HudScene extends Phaser.Scene {
  private board!: Phaser.GameObjects.Graphics;
  private card!: Phaser.GameObjects.Graphics;
  private banner!: Phaser.GameObjects.Graphics;
  private topText!: Phaser.GameObjects.Text;
  private bottomText!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create() {
    this.board = this.add.graphics();
    this.card = this.add.graphics();
    this.banner = this.add.graphics();
    this.topText = this.add.text(SCOREBOARD_AT.x, SCOREBOARD_AT.y + 29, '', TEXT_STYLE).setVisible(false);
    this.bottomText = this.add.text(CARD_AT.x, 0, '', TEXT_STYLE).setVisible(false);

    // Rappel discret de l'aide, en bas à droite.
    const hint = this.add.graphics();
    const hintText = 'H aide';
    const hintW = smallTextWidth(hintText) + 4;
    hint.fillStyle(PALETTE.navy, 0.8).fillRect(VIEW_WIDTH - hintW - 2, VIEW_HEIGHT - SMALL_H - 4, hintW, SMALL_H + 2);
    hint.fillStyle(PALETTE.silver);
    drawSmallText(hint, hintText, VIEW_WIDTH - hintW, VIEW_HEIGHT - SMALL_H - 3);

    const handlers: [string, (value: never) => void][] = [
      [HUD_KEYS.score, (value: ScoreboardData) => this.showScore(value)],
      [HUD_KEYS.card, (value: PlayerCardData | null) => this.showCard(value)],
      [HUD_KEYS.debug, (value: HudDebug) => this.showDebug(value)],
      [HUD_KEYS.debugVisible, (value: boolean) => this.setDebugVisible(value)],
      [HUD_KEYS.banner, (value: HudBanner | null) => this.showBanner(value)],
    ];
    for (const [key, show] of handlers) {
      const onChange = (_parent: unknown, value: never) => show(value);
      this.registry.events.on(`changedata-${key}`, onChange);
      this.events.once('shutdown', () => this.registry.events.off(`changedata-${key}`, onChange));
      const current = this.registry.get(key) as never;
      if (current !== undefined) show(current);
    }
  }

  private showScore(data: ScoreboardData) {
    this.board.clear();
    drawScoreboard(this.board, SCOREBOARD_AT.x, SCOREBOARD_AT.y, data);
  }

  /** Carte du joueur contrôlé (aucune quand tu regardes un match). */
  private showCard(data: PlayerCardData | null) {
    this.card.clear();
    if (data) drawPlayerCard(this.card, CARD_AT.x, CARD_AT.y, data);
  }

  private showBanner(data: HudBanner | null) {
    this.banner.clear();
    if (data) drawBanner(this.banner, VIEW_WIDTH / 2, BANNER_Y, data.title, data.subtitle, BANNER_COLORS[data.tone]);
  }

  private showDebug(content: HudDebug) {
    this.topText.setText(content.top);
    this.bottomText.setText(content.bottom);
    this.bottomText.setY(CARD_AT.y - 2 - this.bottomText.height);
  }

  private setDebugVisible(visible: boolean) {
    this.topText.setVisible(visible);
    this.bottomText.setVisible(visible);
  }
}
