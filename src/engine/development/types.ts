import type { AttributeKey, Player, Position } from '../types';
import type { FrontOfficeDirection } from '../management/types';
export const TRAINING_FOCI = ['balanced', 'shooting', 'finishing', 'playmaking', 'defense', 'physical'] as const;
export type TrainingFocus = typeof TRAINING_FOCI[number];
export interface TrainingPlan { focus: TrainingFocus; days: Partial<Record<TrainingFocus, number>> }
export interface PlayerIdentity { id: string; name: string; pos: Position; age: number; overall: number }
export interface DevelopmentRecord extends PlayerIdentity {
  before: number; after: number; focus: TrainingFocus; trainingDays: number; minutes: number;
  changes: Partial<Record<AttributeKey, number>>;
}
export interface TeamSeasonReview {
  teamId: string; wins: number; losses: number; payroll: number; averageAge: number; averageOverall: number;
  direction: FrontOfficeDirection; scorer?: PlayerIdentity & { pointsPerGame: number };
}
export interface DraftProspect { player: Player; estimatedPotential: number; uncertainty: number }
export interface DraftPick {
  id: string; round: number; number: number; originalTeamId: string; ownerTeamId: string;
  player?: PlayerIdentity; estimatedPotential?: number; salary?: number; reason?: string;
}
export interface OffseasonState {
  version: 1; season: number; stage: 'draft' | 'ready'; cursor: number; picks: DraftPick[];
  prospects: Record<string, DraftProspect>; retired: Player[];
}
export interface SeasonReview {
  season: number; teams: TeamSeasonReview[]; development: DevelopmentRecord[];
  draft: DraftPick[]; retiredCount: number;
}
