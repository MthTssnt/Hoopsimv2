import type { PlayerAi } from './playerAi';
import { WORLD_DT, type MatchWorld } from '../world/MatchWorld';

/**
 * « Simuler la fin » : le match continue tout seul, les dix joueurs à l'IA, depuis l'état actuel
 * (score, chrono, fatigue, box score), au plus `maxSteps` pas. Renvoie vrai quand le match est fini.
 * Le rendu l'appelle par tranches pour ne pas figer la page.
 */
export function runToEnd(world: MatchWorld, ais: readonly PlayerAi[], maxSteps: number): boolean {
  for (let k = 0; k < maxSteps && !world.matchOver; k++) {
    world.step(WORLD_DT, ais.map((ai) => ai.think(world, WORLD_DT)));
  }
  return world.matchOver;
}
