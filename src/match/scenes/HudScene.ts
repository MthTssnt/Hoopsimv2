import Phaser from 'phaser';
import { VIEW_HEIGHT } from '../config';

export interface HudContent {
  top: string[];
  bottom: string[];
}

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '8px', color: '#f4efe6' };

/**
 * Textes à l'écran, dans une scène à part lancée par-dessus le match : ils ne suivent ni le
 * défilement ni le zoom de la caméra. Le match publie le contenu dans le registre (`hud`).
 */
export class HudScene extends Phaser.Scene {
  private topText!: Phaser.GameObjects.Text;
  private bottomText!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create() {
    this.topText = this.add.text(4, 3, '', TEXT_STYLE);
    this.bottomText = this.add.text(4, VIEW_HEIGHT - 12, '', TEXT_STYLE);
    const onChange = (_parent: unknown, value: HudContent) => this.show(value);
    this.registry.events.on('changedata-hud', onChange);
    this.events.once('shutdown', () => this.registry.events.off('changedata-hud', onChange));
    const current = this.registry.get('hud') as HudContent | undefined;
    if (current) this.show(current);
  }

  private show(content: HudContent) {
    this.topText.setText(content.top);
    this.bottomText.setText(content.bottom);
    this.bottomText.setY(VIEW_HEIGHT - 2 - content.bottom.length * 10);
  }
}
