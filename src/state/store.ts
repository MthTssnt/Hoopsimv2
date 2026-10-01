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
  type DaySummary,
  type Game,
  type GameResult,
  type League,
  type PlayoffDaySummary,
} from '../engine';

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
  busy = false;

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

  save(): void {
    if (!this.league) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.league));
    } catch (err) {
      console.warn('Sauvegarde impossible', err);
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      this.league = migrateLeague(JSON.parse(raw) as League);
      this.watched = null;
      this.emit();
      return true;
    } catch (err) {
      console.warn('Chargement impossible', err);
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
    this.save();
    this.emit();
  }

  private league_(): League {
    if (!this.league) throw new Error('Aucune partie en cours');
    return this.league;
  }

  // --- Progression ---

  /** Joue une journée (ou une soirée de playoffs) et renvoie le match de l'utilisateur. */
  advanceOneDay(watchUserGame = true): WatchedGame | null {
    const league = this.league_();
    let userGame: WatchedGame | null = null;

    if (league.phase === 'regular') {
      const summary: DaySummary = simulateDay(league, { watchUserGame });
      userGame = summary.userGame;
      if (regularSeasonFinished(league)) startPlayoffs(league);
    } else if (league.phase === 'playoffs') {
      const summary: PlayoffDaySummary = advancePlayoffs(league, { watchUserGame });
      userGame = summary.userGame;
      if (playoffsFinished(league.playoffs)) closeSeason(league);
    }

    if (userGame && watchUserGame) this.watched = userGame;
    this.save();
    this.emit();
    return userGame;
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
    startNextSeason(league);
    this.watched = null;
    this.save();
    this.emit();
  }

  // --- Gestion d'effectif ---

  setRotation(ids: string[]): void {
    const league = this.league_();
    const team = league.teams.find((t) => t.id === league.userTeamId);
    if (!team) return;
    team.rotation = ids;
    this.save();
    this.emit();
  }

  resetRotation(): void {
    const league = this.league_();
    const team = league.teams.find((t) => t.id === league.userTeamId);
    if (!team) return;
    team.rotation = defaultRotation(team, league.players);
    this.save();
    this.emit();
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
