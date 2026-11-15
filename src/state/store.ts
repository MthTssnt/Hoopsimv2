import { beginOffseason, finishOffseason } from '../engine/offseason';
import { advanceCPUDraft, chooseDraftPlayer } from '../engine/development/draft';
import { setTrainingFocus } from '../engine/development/training';
import type { TrainingFocus } from '../engine/development/types';
import { executeTrade, extendContract, signFreeAgent } from '../engine/management/transactions';
import type { ContractOffer, FrontOfficeDirection, TradeOffer, TradeStatus } from '../engine/management/types';
import { useSyncExternalStore } from 'react';
import {
  advancePlayoffs,
  closeSeason,
  createNewGame,
  defaultRotation,
  migrateLeague,
  nextUserGame,
  playoffsFinished,
  regularSeasonFinished,
  simulateDay,
  startNextSeason,
  startPlayoffs,
  userGameToday,
  type DaySummary,
  type Game,
  type GameResult,
  type League,
  type PlayedGame,
  type PlayoffDaySummary,
} from '../engine';
import { defaultGamePlan, validateGamePlan, planRotationIds, type GamePlan } from '../engine/gamePlan';
import { gmMatchSetup, type MatchMode, type MatchSetup } from '../match/gameResult';

const SAVE_KEY = 'hoopsim.save.v1';

export interface WatchedGame {
  game: Game;
  result: GameResult;
}

/**
 * État global de la partie.
 * Le moteur travaille en mutant la ligue en place ; le store se contente
 * d'incrémenter un compteur de version pour prévenir React.
 */
class GameStore {
  league: League | null = null;
  /** Dernier match de l'utilisateur, conservé pour l'écran de match (non sauvegardé). */
  watched: WatchedGame | null = null;
  /** Match de ton équipe en cours dans le navigateur (jouer ou regarder), non sauvegardé. */
  liveMatch: MatchSetup | null = null;
  busy = false;
  actionError: string | null = null;
  saveError: string | null = null;
  loadError: string | null = null;

  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): number => this.version;

  private emit(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  // --- Sauvegarde ---

  hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  save(): boolean {
    if (!this.league) return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.league));
      this.saveError = null;
      return true;
    } catch (err) {
      this.saveError = 'Sauvegarde impossible. La partie en cours reste en mémoire ; exportez une copie avant de fermer cette page, puis réessayez.';
      console.warn('Sauvegarde impossible', err);
      return false;
    }
  }

  retrySave(): boolean { const saved = this.save(); this.emit(); return saved; }

  load(): boolean {
    if (this.liveMatch || this.busy) return false;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      this.league = migrateLeague(JSON.parse(raw) as League);
      this.watched = null;
      this.loadError = null;
      this.saveError = null;
      this.emit();
      return true;
    } catch (err) {
      this.loadError = `Chargement impossible : ${err instanceof Error ? err.message : 'sauvegarde illisible'}. La sauvegarde conservée dans ce navigateur n’a pas été effacée.`;
      console.warn('Chargement impossible', err);
      this.emit();
      return false;
    }
  }

  deleteSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignoré */
    }
    this.league = null;
    this.watched = null;
    this.emit();
  }

  // --- Cycle de vie de la partie ---

  newGame(teamId: string, seed?: number): void {
    this.league = seed === undefined ? createNewGame(teamId) : createNewGame(teamId, seed);
    this.watched = null;
    this.loadError = null;
    this.save();
    this.emit();
  }

  private league_(): League {
    if (!this.league) throw new Error('Aucune partie en cours');
    return this.league;
  }

  // --- Progression ---

  /**
   * Joue une journée (ou une soirée de playoffs) et renvoie le match de l'utilisateur. `played` :
   * son match, joué dans le navigateur, enregistré tel quel (les autres matchs sont simulés).
   */
  advanceOneDay(watchUserGame = true, played?: PlayedGame): WatchedGame | null {
    const league = this.league_();
    let userGame: WatchedGame | null = null;

    if (league.phase === 'regular') {
      const summary: DaySummary = simulateDay(league, { watchUserGame, played });
      userGame = summary.userGame;
      if (regularSeasonFinished(league)) startPlayoffs(league);
    } else if (league.phase === 'playoffs') {
      const summary: PlayoffDaySummary = advancePlayoffs(league, { watchUserGame, played });
      userGame = summary.userGame;
      if (playoffsFinished(league.playoffs)) closeSeason(league);
    }

    if (userGame && watchUserGame) this.watched = userGame;
    this.save();
    this.emit();
    return userGame;
  }

  // --- Match joué ---

  /** Lance le match de ton équipe du jour dans le navigateur : à jouer, ou à regarder (CPU contre CPU). */
  startLiveMatch(mode: MatchMode): void {
    const league = this.league_();
    const game = userGameToday(league);
    if (!game) return;
    this.actionError = null;
    try {
      this.liveMatch = gmMatchSetup(league, game, mode);
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : 'Impossible de préparer ce match.';
      this.emit();
      return;
    }
    this.watched = null;
    this.emit();
  }

  /** Fin du match joué : il est enregistré avec la journée (ou la soirée), puis sa feuille s'affiche. */
  finishLiveMatch(played: PlayedGame): void {
    if (!this.liveMatch) return;
    this.liveMatch = null;
    this.advanceOneDay(true, played);
  }

  /** Avance jusqu'à la veille du prochain match de l'utilisateur (sans le jouer). */
  simulateToNextUserGame(): void {
    const league = this.league_();
    let guard = 0;
    while (guard++ < 400) {
      if (league.phase !== 'regular') break;
      const next = nextUserGame(league);
      if (!next || next.day === league.day) break;
      simulateDay(league, { watchUserGame: false });
      if (regularSeasonFinished(league)) {
        startPlayoffs(league);
        break;
      }
    }
    this.save();
    this.emit();
  }

  /** Simule plusieurs journées d'affilée, sans s'arrêter sur les matchs de l'utilisateur. */
  simulateDays(count: number): void {
    const league = this.league_();
    for (let i = 0; i < count; i++) {
      if (league.phase === 'offseason') break;
      if (league.phase === 'regular') {
        simulateDay(league, { watchUserGame: false });
        if (regularSeasonFinished(league)) {
          startPlayoffs(league);
          break;
        }
      } else if (league.phase === 'playoffs') {
        advancePlayoffs(league, { watchUserGame: false });
        if (playoffsFinished(league.playoffs)) {
          closeSeason(league);
          break;
        }
      }
    }
    this.save();
    this.emit();
  }

  /** Termine la saison régulière d'un bloc. */
  simulateRestOfSeason(): void {
    this.simulateDays(500);
  }

  nextSeason(): void {
    const league = this.league_();
    if (this.liveMatch || this.busy || league.offseason?.stage === 'draft') return;
    startNextSeason(league);
    this.watched = null;
    this.save();
    this.emit();
  }

  private developmentAction(action: (league: League) => string[]): string[] {
    if (this.liveMatch || this.busy) return ['Terminez le match ou la simulation avant cette action.'];
    try {
      const errors = action(this.league_());
      if (!errors.length) { this.actionError = null; this.save(); this.emit(); }
      return errors;
    } catch (error) { return [error instanceof Error ? error.message : 'Action impossible.']; }
  }
  setTraining(playerId: string, focus: TrainingFocus): string[] {
    return this.developmentAction(league => setTrainingFocus(league, playerId, focus));
  }
  prepareDraft(): string[] {
    return this.developmentAction(league => {
      beginOffseason(league); this.watched = null; return [];
    });
  }
  advanceDraft(pickId: string): string[] {
    return this.developmentAction(league => {
      const d = league.offseason, pick = d?.picks[d.cursor];
      if (d?.stage !== 'draft' || !pick || pick.id !== pickId) return ['Ce choix n’est plus courant.'];
      if (pick.ownerTeamId === league.userTeamId) return ['Choisissez un prospect ou passez votre choix.'];
      advanceCPUDraft(league); return [];
    });
  }
  selectRookie(pickId: string, playerId: string | null): string[] {
    return this.developmentAction(league => {
      const d = league.offseason, pick = d?.picks[d.cursor];
      if (!pick || pick.ownerTeamId !== league.userTeamId || pick.id !== pickId) return ['Ce n’est pas votre choix courant.'];
      const errors = chooseDraftPlayer(league, pickId, playerId); if (errors.length) return errors;
      advanceCPUDraft(league); return [];
    });
  }
  delegateDraft(pickId: string): string[] {
    return this.developmentAction(league => {
      const d = league.offseason;
      if (d?.stage !== 'draft' || d.picks[d.cursor]?.id !== pickId) return ['Ce choix n’est plus courant.'];
      advanceCPUDraft(league, true); return [];
    });
  }
  launchSeason(): string[] {
    return this.developmentAction(league => { finishOffseason(league); this.watched = null; return []; });
  }

  // --- Gestion d'effectif ---

  private marketAction(action: (league: League) => string[]): string[] {
    if (this.liveMatch || this.busy) return ['Terminez le match ou la simulation avant de modifier le marché.'];
    if (this.league_().offseason?.stage === 'draft') return ['Terminez la draft avant de modifier le marché.'];
    const errors = action(this.league_());
    if (!errors.length) { this.save(); this.emit(); }
    return errors;
  }
  proposeTrade(offer: TradeOffer): string[] {
    return this.marketAction(league => offer.fromTeamId !== league.userTeamId ? ['Vous ne dirigez pas cette équipe.'] : executeTrade(league, offer));
  }
  offerContract(playerId: string, offer: ContractOffer): string[] {
    return this.marketAction(league => league.players[playerId]?.teamId === league.userTeamId ? extendContract(league, league.userTeamId, playerId, offer) : signFreeAgent(league, league.userTeamId, playerId, offer));
  }
  setTradeStatus(playerId: string, status: TradeStatus): string[] {
    return this.marketAction(league => {
      if (!['normal', 'listed', 'core', 'unavailable'].includes(status) || league.players[playerId]?.teamId !== league.userTeamId) return ['Statut ou propriétaire invalide.'];
      league.players[playerId].tradeStatus = status; return [];
    });
  }
  setFrontOffice(direction: FrontOfficeDirection): string[] {
    return this.marketAction(league => {
      if (!['contend', 'compete', 'retool', 'rebuild'].includes(direction)) return ['Projet inconnu.'];
      const team = league.teams.find(t => t.id === league.userTeamId)!;
      team.frontOffice = { ...team.frontOffice!, direction }; return [];
    });
  }
  respondTradeProposal(id: string, accept: boolean): string[] {
    return this.marketAction(league => {
      const proposal = league.management?.proposals.find(p => p.id === id && p.offer.toTeamId === league.userTeamId);
      if (!proposal) return ['Offre absente.'];
      if (accept) {
        if (proposal.season !== league.season || league.day - proposal.day > 14) return ['Cette offre a expiré.'];
        const errors = executeTrade(league, proposal.offer); if (errors.length) return errors;
      }
      league.management!.proposals = league.management!.proposals.filter(p => p.id !== id); return [];
    });
  }

  setGamePlan(plan: GamePlan): string[] {
    if (this.liveMatch || this.busy) return ['Terminez le match ou la simulation avant de modifier le plan.'];
    const league = this.league_();
    const team = league.teams.find(t => t.id === league.userTeamId)!;
    const errors = validateGamePlan(plan, team, league.players);
    if (errors.length) return errors;
    team.gamePlan = structuredClone(plan);
    delete team.coachingWarnings;
    team.rotation = planRotationIds(plan);
    this.save();
    this.emit();
    return [];
  }

  savePlanVariant(plan: GamePlan): string[] {
    if (this.liveMatch || this.busy) return ['Terminez le match ou la simulation avant de modifier les variantes.'];
    const league = this.league_();
    const team = league.teams.find(t => t.id === league.userTeamId)!;
    const errors = validateGamePlan(plan, team, league.players);
    if (errors.length) return errors;
    const saved = team.savedGamePlans ?? [];
    const index = saved.findIndex(p => p.name === plan.name);
    if (index < 0 && saved.length >= 8) return ['La bibliothèque est limitée à huit variantes.'];
    const next = [...saved];
    if (index < 0) next.push(structuredClone(plan));
    else next[index] = structuredClone(plan);
    team.savedGamePlans = next;
    this.save(); this.emit();
    return [];
  }

  deletePlanVariant(name: string): void {
    if (this.liveMatch || this.busy) return;
    const league = this.league_();
    const team = league.teams.find(t => t.id === league.userTeamId)!;
    team.savedGamePlans = (team.savedGamePlans ?? []).filter(p => p.name !== name);
    this.save(); this.emit();
  }

  setRotation(ids: string[]): string[] {
    const league = this.league_();
    const team = league.teams.find(t => t.id === league.userTeamId)!;
    if (ids.length < 5 || ids.length > 10 || new Set(ids).size !== ids.length || ids.some(id => !team.roster.includes(id) || league.players[id]?.teamId !== team.id || league.players[id].injuryGames > 0)) return ['Rotation invalide : choisissez 5 à 10 joueurs aptes et distincts de votre équipe.'];
    return this.setGamePlan(defaultGamePlan({ ...team, rotation: ids }, league.players));
  }

  resetRotation(): void {
    const league = this.league_();
    const team = league.teams.find(t => t.id === league.userTeamId)!;
    this.setGamePlan(defaultGamePlan({ ...team, rotation: defaultRotation(team, league.players) }, league.players));
  }

  clearWatched(): void {
    this.watched = null;
    this.emit();
  }

  showBoxScore(game: Game): void {
    const league = this.league_();
    const box = league.boxScores[game.id];
    if (!box) return;
    this.watched = { game, result: { homeScore: box.homeScore, awayScore: box.awayScore, periods: box.periods, box, pbp: [] } };
    this.emit();
  }
}

export const store = new GameStore();

/** Abonne un composant aux changements d'état du jeu. */
export function useStore(): GameStore {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return store;
}

export function useLeague(): League {
  const s = useStore();
  if (!s.league) throw new Error('Aucune partie en cours');
  return s.league;
}
