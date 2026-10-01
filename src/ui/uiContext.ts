import { createContext, useContext } from 'react';

export interface UiActions {
  /** Ouvre la fiche détaillée d'un joueur. */
  openPlayer: (playerId: string) => void;
  /** Ouvre l'effectif d'une équipe. */
  openTeam: (teamId: string) => void;
}

export const UiContext = createContext<UiActions>({ openPlayer: () => {}, openTeam: () => {} });

export function useUi(): UiActions {
  return useContext(UiContext);
}
