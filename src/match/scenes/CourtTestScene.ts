import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';

/**
 * Scène de test de l'environnement : vérifie que Phaser démarre, que le rendu
 * pixel-art et le clavier fonctionnent. Placeholders uniquement, à remplacer en phase 1.
 */
export class CourtTestScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc;
  private vel = new Phaser.Math.Vector2(60, 0);
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super('CourtTest');
  }

  create() {
    const g = this.add.graphics();
    const floorY = VIEW_HEIGHT - 30;
    g.fillStyle(0xc68642).fillRect(0, floorY - 50, VIEW_WIDTH, 80); // parquet
    g.lineStyle(1, 0xffffff).strokeRect(8, floorY - 46, VIEW_WIDTH - 16, 72);
    g.lineBetween(VIEW_WIDTH / 2, floorY - 46, VIEW_WIDTH / 2, floorY + 26);
    // panier droit : poteau, planche, cercle
    g.fillStyle(0x666666).fillRect(VIEW_WIDTH - 14, floorY - 110, 3, 110);
    g.fillStyle(0xffffff).fillRect(VIEW_WIDTH - 20, floorY - 118, 3, 20);
    g.lineStyle(1, 0xff5a1f).lineBetween(VIEW_WIDTH - 36, floorY - 100, VIEW_WIDTH - 20, floorY - 100);

    this.ball = this.add.circle(40, floorY - 40, 3, 0xff8c1a);
    this.keys = this.input.keyboard!.createCursorKeys();

    this.add.text(4, 4, 'Test Phaser OK — flèches pour bouger, espace pour sauter', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffffff',
    });
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    const floorY = VIEW_HEIGHT - 70;
    if (this.keys.left.isDown) this.vel.x = -80;
    else if (this.keys.right.isDown) this.vel.x = 80;
    if (Phaser.Input.Keyboard.JustDown(this.keys.space) && this.ball.y >= floorY - 0.5) this.vel.y = -160;

    this.vel.y += 400 * dt; // gravité
    this.ball.x = Phaser.Math.Wrap(this.ball.x + this.vel.x * dt, 0, VIEW_WIDTH);
    this.ball.y += this.vel.y * dt;
    if (this.ball.y > floorY) {
      this.ball.y = floorY;
      this.vel.y = Math.abs(this.vel.y) > 40 ? -this.vel.y * 0.6 : 0; // rebond amorti
    }
  }
}
