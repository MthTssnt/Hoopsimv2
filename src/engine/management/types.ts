import type { PlayerRole } from '../gamePlan';
export type FrontOfficeDirection = 'contend' | 'compete' | 'retool' | 'rebuild';
export interface FrontOfficePlan { direction: FrontOfficeDirection; budgetDiscipline: number; priorities: ('youth' | 'shooting' | 'defense' | 'depth')[] }
export type TradeStatus = 'normal' | 'listed' | 'core' | 'unavailable';
export interface ContractOffer { salary: number; years: number; promisedRole: PlayerRole }
export interface TradeOffer { fromTeamId: string; toTeamId: string; outgoingIds: string[]; incomingIds: string[] }
export interface MarketEvent { id: number; season: number; day: number; type: 'trade' | 'sign' | 'extend' | 'expire' | 'draft' | 'pool'; teamIds: string[]; playerIds: string[]; description: string }
export interface TradeProposal { id: string; season: number; day: number; offer: TradeOffer }
export interface ManagementState {
  version: 1; salaryCap: number; nextEventId: number; nextPlayerId: number; transactions: MarketEvent[];
  proposals: TradeProposal[]; lastAIWindow?: string;
}
export interface Decision { accepted: boolean; reasons: string[] }
