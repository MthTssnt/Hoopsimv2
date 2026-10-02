import type Phaser from 'phaser';
import { ACTIONS, type Action, type Bindings } from './bindings';

export interface InputState {
  /** Direction voulue : x vers la droite, y vers le spectateur, dans [-1, 1]. */
  moveX: number;
  moveY: number;
  shootHeld: boolean;
  /** Appui / relâche survenus depuis la dernière lecture. */
  shootPressed: boolean;
  shootReleased: boolean;
  /** Passe (ou changement de défenseur) et interception appuyées depuis la dernière lecture. */
  passPressed: boolean;
  stealPressed: boolean;
}

export const NO_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  shootHeld: false,
  shootPressed: false,
  shootReleased: false,
  passPressed: false,
  stealPressed: false,
};

/**
 * Lit le clavier selon les touches configurées. Les appuis et relâches sont captés par
 * événement, pour ne perdre aucun appui bref entre deux images.
 */
export class KeyboardInput {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  private keys: Partial<Record<Action, Phaser.Input.Keyboard.Key>> = {};
  private pressed = false;
  private released = false;
  private passed = false;
  private stole = false;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, bindings: Bindings) {
    this.keyboard = keyboard;
    this.bind(bindings);
  }

  /** Change les touches à chaud. */
  bind(bindings: Bindings): void {
    for (const key of Object.values(this.keys)) {
      if (key) this.keyboard.removeKey(key, true, true);
    }
    this.keys = {};
    for (const action of ACTIONS) this.keys[action] = this.keyboard.addKey(bindings[action].code, true);
    this.keys.shoot?.on('down', () => (this.pressed = true));
    this.keys.shoot?.on('up', () => (this.released = true));
    this.keys.pass?.on('down', () => (this.passed = true));
    this.keys.steal?.on('down', () => (this.stole = true));
    this.pressed = false;
    this.released = false;
    this.passed = false;
    this.stole = false;
  }

  read(): InputState {
    const down = (action: Action) => (this.keys[action]?.isDown ? 1 : 0);
    const state: InputState = {
      moveX: down('right') - down('left'),
      moveY: down('down') - down('up'),
      shootHeld: down('shoot') === 1,
      shootPressed: this.pressed,
      shootReleased: this.released,
      passPressed: this.passed,
      stealPressed: this.stole,
    };
    this.pressed = false;
    this.released = false;
    this.passed = false;
    this.stole = false;
    return state;
  }

  /** Oublie les touches enfoncées (au retour d'un panneau qui avait bloqué le clavier). */
  reset(): void {
    this.keyboard.resetKeys();
    this.pressed = false;
    this.released = false;
    this.passed = false;
    this.stole = false;
  }

  destroy(): void {
    for (const key of Object.values(this.keys)) {
      if (key) this.keyboard.removeKey(key, true, true);
    }
    this.keys = {};
  }
}
