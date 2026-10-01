import { useMemo, useState } from 'react';
import {
  ROUND_NAMES,
  daysUntilNextUserGame,
  nextUserGame,
  seasonDays,
  type League,
  type Team,
} from '../engine';
import { store, useStore } from '../state/store';
import { GameViewer } from './GameViewer';
import { NewGameScreen } from './NewGameScreen';
import { PlayerModal } from './PlayerModal';
import { TeamModal } from './TeamModal';
import { TeamLogo, teamFullName } from './common';
import { Dashboard } from './tabs/Dashboard';
import { HistoryTab } from './tabs/HistoryTab';
import { PlayoffsTab } from './tabs/PlayoffsTab';
import { RosterTab } from './tabs/RosterTab';
import { ScheduleTab } from './tabs/ScheduleTab';
import { StandingsTab } from './tabs/StandingsTab';
import { StatsTab } from './tabs/StatsTab';
import { UiContext } from './uiContext';

const TABS = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'effectif', label: 'Effectif' },
  { id: 'calendrier', label: 'Calendrier' },
  { id: 'classement', label: 'Classement' },
  { id: 'stats', label: 'Statistiques' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'ligue', label: 'Ligue' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const state = useStore();
  const [tab, setTab] = useState<TabId>('accueil');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const ui = useMemo(
    () => ({ openPlayer: (id: string) => setPlayerId(id), openTeam: (id: string) => setTeamId(id) }),
    [],
  );

  if (!state.league) {
    return <NewGameScreen hasSave={state.hasSave()} onLoad={() => store.load()} />;
  }

  const league = state.league;
  const userTeam = league.teams.find((t) => t.id === league.userTeamId)!;

  return (
    <UiContext.Provider value={ui}>
      <div className="app">
        <TopBar league={league} userTeam={userTeam} />
        <nav className="nav">
          <div className="nav-inner">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="app-main">
          {tab === 'accueil' && <Dashboard league={league} team={userTeam} onNavigate={setTab} />}
          {tab === 'effectif' && <RosterTab league={league} team={userTeam} />}
          {tab === 'calendrier' && <ScheduleTab league={league} team={userTeam} />}
          {tab === 'classement' && <StandingsTab league={league} />}
          {tab === 'stats' && <StatsTab league={league} />}
          {tab === 'playoffs' && <PlayoffsTab league={league} />}
          {tab === 'ligue' && <HistoryTab league={league} />}
        </main>

        {state.watched && <GameViewer league={league} watched={state.watched} onClose={() => store.clearWatched()} />}
        {playerId && league.players[playerId] && (
          <PlayerModal league={league} player={league.players[playerId]} onClose={() => setPlayerId(null)} />
        )}
        {teamId && <TeamModal league={league} teamId={teamId} onClose={() => setTeamId(null)} />}
      </div>
    </UiContext.Provider>
  );
}

function TopBar({ league, userTeam }: { league: League; userTeam: Team }) {
  const [confirmNew, setConfirmNew] = useState(false);
  const upcoming = nextUserGame(league);
  const isGameDay = upcoming?.day === league.day;
  const daysOff = daysUntilNextUserGame(league);
  const totalDays = seasonDays(league);

  const phaseLabel = (() => {
    if (league.phase === 'offseason') return 'Intersaison';
    if (league.phase === 'playoffs') {
      const round = league.playoffs?.round ?? 0;
      return `Playoffs · ${ROUND_NAMES[round]}`;
    }
    return `Journée ${league.day + 1} / ${totalDays}`;
  })();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-team">
          <TeamLogo team={userTeam} size={38} />
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title">{teamFullName(userTeam)}</div>
            <div className="topbar-sub">
              Saison {league.season} · {userTeam.wins}-{userTeam.losses} · {phaseLabel}
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          {league.phase === 'regular' && (
            <>
              {isGameDay ? (
                <button className="btn btn-primary" onClick={() => store.advanceOneDay(true)}>
                  Jouer le match
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => store.simulateToNextUserGame()}>
                  {daysOff <= 1 ? 'Passer au match suivant' : `Avancer de ${daysOff} jours`}
                </button>
              )}
              <button className="btn" onClick={() => store.advanceOneDay(false)}>
                Journée suivante
              </button>
              <button className="btn" onClick={() => store.simulateDays(7)}>
                +7 jours
              </button>
              <button className="btn" onClick={() => store.simulateRestOfSeason()}>
                Fin de saison
              </button>
            </>
          )}

          {league.phase === 'playoffs' && (
            <>
              <button className="btn btn-primary" onClick={() => store.advanceOneDay(true)}>
                {isGameDay ? 'Jouer le match' : 'Soirée suivante'}
              </button>
              <button className="btn" onClick={() => store.simulateRestOfSeason()}>
                Simuler les playoffs
              </button>
            </>
          )}

          {league.phase === 'offseason' && (
            <button className="btn btn-primary" onClick={() => store.nextSeason()}>
              Lancer la saison {league.season + 1}
            </button>
          )}

          <button className="btn" onClick={() => setConfirmNew(true)} title="Nouvelle partie">
            Menu
          </button>
        </div>
      </div>

      {confirmNew && (
        <div className="modal-backdrop" onClick={() => setConfirmNew(false)} role="presentation">
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong>Menu</strong>
            </div>
            <div className="modal-body">
              <p className="muted small" style={{ marginTop: 0 }}>
                La partie est sauvegardée automatiquement dans ce navigateur après chaque action.
              </p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => { store.save(); setConfirmNew(false); }}>
                  Sauvegarder maintenant
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    if (confirm('Abandonner la partie en cours et en démarrer une nouvelle ?')) {
                      store.deleteSave();
                      setConfirmNew(false);
                    }
                  }}
                >
                  Nouvelle partie
                </button>
                <button className="btn" onClick={() => setConfirmNew(false)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
