import type { WorldInput } from '../world/MatchWorld';

/** Ce que le bouton Tir doit savoir du joueur contrôlé, au pas courant. */
export interface ShooterState {
  airborne: boolean;
  /** Il tient le ballon. */
  holding: boolean;
  /** Un tir est déjà en cours. */
  shooting: boolean;
}

/**
 * Bouton Tir : un appui qui ne peut rien faire tout de suite (joueur en l'air, par exemple en
 * retombant d'un rebond) reste en attente tant que la touche est tenue. Dès que le joueur
 * contrôlé peut tirer (au sol, ballon en main), le tir part. Un appui qui a servi à sauter n'est
 * pas gardé : pas de tir surprise à la réception d'un rebond.
 */
export class ShotButton {
  private waiting = false;

  /** Un pas de simulation : appui reçu depuis le pas précédent, touche tenue. Renvoie l'appui à transmettre au monde. */
  step(pressed: boolean, held: boolean, player: ShooterState): boolean {
    if (pressed) {
      this.waiting = player.airborne;
      return !player.airborne;
    }
    if (!held) this.waiting = false;
    if (this.waiting && !player.airborne && player.holding && !player.shooting) {
      this.waiting = false;
      return true;
    }
    return false;
  }

  reset(): void {
    this.waiting = false;
  }
}

/**
 * Entrées du joueur contrôlé. En défense, si tu ne touches à rien, il suit son IA (il marque son
 * joueur, aide, revient en défense) : déplacement seulement, sans saut ni geste de vol. Dès que tu
 * touches une commande, tu reprends la main.
 */
export function controlledInput(mine: WorldInput, ai: WorldInput, defending: boolean, untouched: boolean): WorldInput {
  if (!defending || !untouched) return mine;
  return { x: ai.x, y: ai.y, jump: false };
}
