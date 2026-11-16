import {appearanceIdentity,type PlayerAppearance} from '../../../engine/appearance';
import {TEAM_SEEDS} from '../../../engine/teamsData';
import { hashSeed, Rng } from '../../../engine/rng';

/** Identité visuelle officielle, indépendante des notes et des résultats de simulation. */
export interface Appearance {
  cosmetics?: PlayerAppearance;
  colors?:{primary:string;secondary:string};
  heightCm: number;
  heavy: boolean;
  number: number;
  variant: number;
  dominantHand: 'droite' | 'gauche';
}
export interface AppearanceSource { id: string; heightCm: number; weightKg: number; number: number; teamId?:string|null; appearance?:PlayerAppearance }
export const isHeavy = (heightCm: number, weightKg: number): boolean => weightKg - ((heightCm - 100) * 1.02 + 8) >= 3;

export function appearanceFor(player: AppearanceSource, variant?: number): Appearance {
  const rng = new Rng(hashSeed(`${player.id}|design-officiel`));
  const drawn = rng.int(0, 4);
  const cosmetics=appearanceIdentity(player),colors=TEAM_SEEDS.find(t=>t.id===player.teamId)?.colors ?? {primary:'#174630',secondary:'#fff2d3'};
  return { cosmetics,colors,heightCm: player.heightCm, heavy: isHeavy(player.heightCm, player.weightKg), number: player.number,
    variant: variant ?? (player.appearance ? cosmetics.hair : drawn), dominantHand: rng.chance(0.12) ? 'gauche' : 'droite' };
}
