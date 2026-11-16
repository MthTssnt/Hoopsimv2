import type { ManagementDestination } from './navigation';
import { createContext, useContext } from 'react';

export interface UiActions {
  reportFailure:(description:string)=>void;
  reportDecision: (description:string)=>void;
  navigateTo: (destination: ManagementDestination) => void;
  /** Ouvre la fiche détaillée d'un joueur. */
  openPlayer: (playerId: string) => void;
  /** Ouvre l'effectif d'une équipe. */
  openTeam: (teamId: string) => void;
}

export const UiContext = createContext<UiActions>({ reportFailure:()=>{}, reportDecision:()=>{}, navigateTo: () => {}, openPlayer: () => {}, openTeam: () => {} });

export function useUi(): UiActions {
  return useContext(UiContext);
}
