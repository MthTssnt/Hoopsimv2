import type { PlayerAi } from './playerAi';
import { WORLD_DT, type MatchWorld, type WorldInput } from '../world/MatchWorld';

/**
 * « Simuler la fin » : le match continue tout seul, les dix joueurs à l'IA, depuis l'état actuel
 * (score, chrono, fatigue, box score), au plus `maxSteps` pas. Renvoie vrai quand le match est fini.
 * Le rendu l'appelle par tranches pour ne pas figer la page.
 */
export function runToEnd(world: MatchWorld, ais: readonly PlayerAi[], maxSteps: number, afterStep?: (inputs: readonly WorldInput[]) => void): boolean {
  for (let k = 0; k < maxSteps && !world.matchOver; k++) {
    const inputs = ais.map((ai) => ai.think(world, WORLD_DT));
    world.step(WORLD_DT, inputs);
    afterStep?.(inputs);
  }
  return world.matchOver;
}
