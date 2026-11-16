import './managementTheme.css';
import { managementTheme } from './managementTheme';
import { GuidedHelp, TaskLauncher, readPreferences, type UiPreferences } from './GuidedHelp';
import { destinationTab, type ManagementDestination, type MarketRequest } from './navigation';
import { ActionFeedback } from './ActionFeedback';
import { downloadSave } from './saveBackup';
import { budget } from '../engine/management/economy';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ROUND_NAMES,
  daysUntilNextUserGame,
  seasonDays,
  userGameToday,
  type League,
  type Team,
} from '../engine';
import { store, useStore } from '../state/store';
import { GameViewer } from './GameViewer';
import { NewGameScreen } from './NewGameScreen';
import { PlayerModal } from './PlayerModal';
import { TeamModal } from './TeamModal';
import { TeamLogo, teamFullName } from './common';
import { DevelopmentTab } from './tabs/DevelopmentTab';
import { ManagementHome } from './ManagementHome';
import { HoopSimLogo } from './branding/HoopSimLogo';
import { Modal } from './common';
import { CoachingEditor } from './tabs/CoachingEditor';
import { HistoryTab } from './tabs/HistoryTab';
import { PlayoffsTab } from './tabs/PlayoffsTab';
import { MarketTab } from './tabs/MarketTab';
import { TacticsTab } from './tabs/TacticsTab';
import { RosterTab } from './tabs/RosterTab';
import { ScheduleTab } from './tabs/ScheduleTab';
import { StandingsTab } from './tabs/StandingsTab';
import { StatsTab } from './tabs/StatsTab';
import { UiContext } from './uiContext';

// Le match jouable (Phaser), chargé à part : seulement quand tu joues ou regardes un match.
const PhaserGame = lazy(() => import('../match/PhaserGame'));
const AnimationLab = lazy(() => import('./AnimationLab'));

const TABS = [
  { id: 'accueil', label: 'Bureau' },
  { id: 'preparation', label: 'Préparer le match' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'effectif', label: 'Effectif' },
  { id: 'tactiques', label: 'Tactiques' },
  { id: 'marche', label: 'Recrutement' },
  { id: 'draft', label: 'Draft et intersaison' },
  { id: 'developpement', label: 'Développement' },
  { id: 'calendrier', label: 'Calendrier' },
  { id: 'classement', label: 'Classement' },
  { id: 'stats', label: 'Statistiques' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'ligue', label: 'Ligue' },
  { id: 'animations', label: 'Animations' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const state = useStore();
  const [preferences,setPreferences]=useState(readPreferences);
  const [launcher,setLauncher]=useState(false);
  const updatePreferences=(next:UiPreferences)=>{setPreferences(next);try{localStorage.setItem('hoopsim.ui.v1',JSON.stringify(next));}catch{/* UI preference failure never changes the career. */}};
  const [decisionError,setDecisionError]=useState(false);
  const [decision,setDecision]=useState('');
  const [tab, setTab] = useState<TabId>('accueil');
  const [marketRequest,setMarketRequest] = useState<MarketRequest>({area:'market',view:'players',sequence:0});
  const [returnTab,setReturnTab] = useState<TabId>('accueil');
  const navigate = (id: TabId) => { if (id === tab && id!=='marche') return; if (window.dispatchEvent(new Event('hoopsim:before-navigate', { cancelable: true }))) {if(id==='marche')setMarketRequest(previous=>({area:'market',view:'players',sequence:previous.sequence+1}));setTab(id);} };
  const navigateTo = useCallback((destination:ManagementDestination) => {
    if (!window.dispatchEvent(new Event('hoopsim:before-navigate',{cancelable:true}))) return;
    if(destination.area==='market') { setReturnTab('accueil'); }
    if(destination.area==='market')setMarketRequest(previous=>({...destination,sequence:previous.sequence+1}));
    setPlayerId(null); setTeamId(null); setTab(destinationTab(destination));
  }, []);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const ui = useMemo(
    () => ({ openPlayer: (id: string) => setPlayerId(id), openTeam: (id: string) => setTeamId(id), navigateTo, reportDecision:(text:string)=>{setDecision(text);setDecisionError(false);}, reportFailure:(text:string)=>{setDecision(text);setDecisionError(true);} }),
    [navigateTo],
  );

  useEffect(()=>{
    setDecision('');setDecisionError(false);setTab('accueil');setPlayerId(null);setTeamId(null);
    setMarketRequest(previous=>({area:'market',view:'players',sequence:previous.sequence+1}));
  },[state.league?.seed,state.league?.userTeamId]);

  if (!state.league) {
    return <NewGameScreen error={state.loadError} hasSave={state.hasSave()} onLoad={() => store.load()} />;
  }

  const league = state.league;
  const userTeam = league.teams.find((t) => t.id === league.userTeamId)!;

  // Match de ton équipe en cours (jouer ou regarder) : plein écran, à la place du GM.
  if (state.liveMatch) {
    return (
      <Suspense fallback={<div className="muted" style={{ padding: 24 }}>Chargement du match…</div>}>
        <PhaserGame coachingVariants={userTeam.savedGamePlans ?? []} match={state.liveMatch} onMatchOver={(played) => store.finishLiveMatch(played)} />
      </Suspense>
    );
  }

  return (
    <UiContext.Provider value={ui}>
      <div className="app" data-management-theme={managementTheme()} style={{'--club-color':userTeam.colors.primary} as React.CSSProperties}>
        {new URLSearchParams(location.search).get('ux-style') === 'almanac' && <div className="preview-banner">APERÇU ARTISTIQUE • {new URLSearchParams(location.search).get('ux-style')==='arcade'?'A / ARCADE TV 1993':'B / ALMANACH 1992'} • comparaison avec le style A provisoire</div>}
        <a className="skip-link" href="#management-content">Aller au contenu</a><TopBar league={league} userTeam={userTeam} onDevelopment={() => navigate('developpement')} onPrepare={() => navigate('preparation')} onTools={() => navigate('animations')} preferences={preferences} onPreferences={updatePreferences} />
        <nav className="nav" aria-label="Espaces de management"><div className="nav-inner">
          {([{label:'Bureau', ids:['accueil','preparation']}, {label:'Équipe',ids:['effectif','rotation','tactiques','developpement']}, {label:'Marché',ids:['marche','draft']}, {label:'Ligue',ids:['calendrier','classement','stats','playoffs','ligue']}] as const).map(group => <button key={group.label} aria-current={(group.ids as readonly string[]).includes(tab) ? 'page' : undefined} className={(group.ids as readonly string[]).includes(tab)?'active':''} onClick={() => navigate(group.ids[0])}>{group.label}</button>)}
        </div></nav>
        <main className="app-main" id="management-content">
          <nav className="subnav" aria-label="Rubriques">{TABS.filter(t => tab === 'animations' ? t.id === 'animations' : ['accueil','preparation'].includes(tab) ? ['accueil','preparation'].includes(t.id) : ['effectif','rotation','tactiques','developpement'].includes(tab) ? ['effectif','rotation','tactiques','developpement'].includes(t.id) : ['marche','draft'].includes(tab) ? ['marche','draft'].includes(t.id) : ['calendrier','classement','stats','playoffs','ligue'].includes(t.id)).map(t => <button className="btn btn-sm" aria-current={tab===t.id?'page':undefined} key={t.id} onClick={() => navigate(t.id)}>{t.label}</button>)}</nav>
          {tab!=='marche' && <div className="page-heading"><div><div className="eyebrow">HoopSim / Club management</div><h1>{TABS.find(t=>t.id===tab)?.label}</h1><p>{tab==='accueil' ? 'Un rendez-vous, une décision. Le reste peut attendre.' : tab==='tactiques' ? 'Choisissez vos intentions de jeu. Affinez seulement ce qui compte.' : 'Votre franchise, vos choix. Les détails restent à portée de main.'}</p></div><span className="pill">Saison {league.season} · {userTeam.abbr}</span></div>}
          <div className="quick-actions"><button className="btn" onClick={()=>setLauncher(true)}>Que voulez-vous faire ?</button><span className="small faint">Accès direct à vos décisions, sans chercher dans les menus.</span></div>
          <GuidedHelp preferences={preferences} onChange={updatePreferences} tab={tab}/>
          {decision && <ActionFeedback state={decisionError?"error":"success"}><span className="small">Dernière décision</span><p>{decision}</p> <button className="btn btn-sm" onClick={()=>setDecision('')}>Masquer cette confirmation</button></ActionFeedback>}
          {state.saveError && <div className="panel" role="alert"><p>{state.saveError}</p><div className="row" style={{ flexWrap: 'wrap' }}><button className="btn" onClick={() => downloadSave(league)}>Exporter la partie</button><button className="btn" onClick={() => store.retrySave()}>Réessayer la sauvegarde</button></div></div>}
          {state.loadError && <p role="alert">{state.loadError}</p>}
          {state.actionError && <p role="alert">{state.actionError}</p>}
          {league.phase === 'offseason' && !league.offseason && <p className="panel" role="status">{budget(league, userTeam).expiringIds.length} contrat(s) sans prolongation arrivent à expiration. <button className="btn btn-sm" onClick={() => navigateTo({area:'market',view:'contracts',intent:'extensions'})}>Négocier avant la draft</button></p>}
          {(tab === 'accueil' || tab === 'preparation') && <ManagementHome league={league} team={userTeam} preparing={tab === 'preparation'} onNavigate={navigate} />}
          {tab === 'rotation' && <CoachingEditor key={JSON.stringify(userTeam.gamePlan)} league={league} team={userTeam} />}
          {league.offseason && <p className="panel" role="status">{league.offseason.stage === 'draft' ? 'Draft en cours : votre prochain choix attend dans Développement.' : 'Draft terminée : complétez votre effectif dans Marché puis lancez la saison.'} <button className="btn btn-sm" onClick={() => navigate('developpement')}>Voir l’intersaison</button></p>}
          {tab === 'developpement' && <DevelopmentTab key={`${league.phase}:${league.offseason?.stage ?? 'none'}`} league={league} team={userTeam} />}
          {tab === 'draft' && <DevelopmentTab initialTab="draft" key={`draft:${league.phase}:${league.offseason?.stage ?? 'none'}`} league={league} team={userTeam} />}
          {tab === 'marche' && <><button className="btn btn-sm" onClick={()=>navigate(returnTab)}>← Retour à mes décisions</button><MarketTab league={league} team={userTeam} request={marketRequest} detailed={preferences.detailed} /></>}
          {tab === 'tactiques' && (userTeam.gamePlan ? <TacticsTab key={JSON.stringify(userTeam.gamePlan)} league={league} team={userTeam} /> : <p role="alert">Au moins cinq joueurs aptes sont nécessaires pour préparer un plan tactique.</p>)}
          {tab === 'effectif' && <RosterTab league={league} team={userTeam} />}
          {tab === 'calendrier' && <ScheduleTab league={league} team={userTeam} />}
          {tab === 'classement' && <StandingsTab league={league} />}
          {tab === 'stats' && <StatsTab league={league} />}
          {tab === 'playoffs' && <PlayoffsTab league={league} />}
          {tab === 'ligue' && <HistoryTab league={league} />}
          {tab === 'animations' && <Suspense fallback={<p>Chargement de l’atelier…</p>}><AnimationLab embedded /></Suspense>}
        </main>

        {launcher && <TaskLauncher league={league} onClose={()=>setLauncher(false)}/>}
        {state.watched && <GameViewer league={league} watched={state.watched} onClose={() => store.clearWatched()} />}
        {playerId && league.players[playerId] && (
          <PlayerModal league={league} player={league.players[playerId]} onClose={() => setPlayerId(null)} />
        )}
        {teamId && <TeamModal league={league} teamId={teamId} onClose={() => setTeamId(null)} />}
      </div>
    </UiContext.Provider>
  );
}

function TopBar({ league, userTeam, onDevelopment, onPrepare, onTools, preferences, onPreferences }: { league: League; userTeam: Team; onDevelopment: () => void; onPrepare: () => void; onTools: () => void; preferences:UiPreferences; onPreferences:(p:UiPreferences)=>void }) {
  const [menu, setMenu] = useState(false);
  const [advance, setAdvance] = useState(false);
  const days = daysUntilNextUserGame(league);
  const today = userGameToday(league);
  const phase = league.phase === 'offseason' ? 'Intersaison' : league.phase === 'playoffs' ? `Playoffs · ${ROUND_NAMES[league.playoffs?.round ?? 0]}` : `Journée ${league.day+1} / ${seasonDays(league)}`;
  const jump = (label: string, run: () => void) => { if (confirm(`${label} : les matchs seront simulés et la progression sera sauvegardée. Cette action ne peut pas être annulée. Continuer ?`)) { run(); setAdvance(false); } };
  return <header className="topbar"><div className="topbar-inner"><HoopSimLogo width={160}/><div className="topbar-team"><TeamLogo team={userTeam} size={48}/><div><div className="topbar-title">{teamFullName(userTeam)}</div><div className="topbar-sub">Saison {league.season} · {userTeam.wins}–{userTeam.losses} · {phase}</div></div></div><div className="topbar-actions">
    <button className="btn btn-primary" onClick={league.phase === 'offseason' ? onDevelopment : onPrepare}>{league.phase==='offseason' ? 'Reprendre l’intersaison' : 'Préparer le match'}</button>
    <button className="btn" onClick={() => setAdvance(true)}>Avancer…</button><button className="btn" onClick={() => setMenu(true)}>Menu</button>
  </div></div>
  {advance && <Modal title="Avancer le calendrier" onClose={() => setAdvance(false)}><p>Les journées jouées sont enregistrées immédiatement. Les grands sauts peuvent passer des fenêtres de négociation.</p><div className="grid">
    {league.phase==='regular' && <><button className="btn" onClick={() => {store.simulateToNextUserGame();setAdvance(false);}}>Passer au match suivant · {days} jour(s)</button><button className="btn" onClick={() => {store.advanceOneDay(false);setAdvance(false);}}>Journée suivante</button><button className="btn" onClick={() => jump('+7 jours',()=>store.simulateDays(7))}>+7 jours</button><button className="btn" onClick={() => jump('Fin de saison',()=>store.simulateRestOfSeason())}>Fin de saison</button></>}
    {league.phase==='playoffs' && <><button className="btn" onClick={() => {setAdvance(false); if(today) onPrepare(); else store.advanceOneDay(true);}}>Soirée suivante</button><button className="btn" onClick={() => jump('Simuler les playoffs',()=>store.simulateRestOfSeason())}>Simuler les playoffs</button></>}
    {league.phase==='offseason' && <button className="btn" onClick={() => {setAdvance(false);onDevelopment();}}>Préparer la draft</button>}
  </div></Modal>}
  {menu && <Modal title="Menu • Votre partie" onClose={() => setMenu(false)}><p>La partie est sauvegardée automatiquement après chaque action.</p><div className="grid"><button className="btn" onClick={() => {if(store.retrySave())setMenu(false);}}>Sauvegarder maintenant</button><button className="btn" onClick={() => downloadSave(league)}>Exporter la partie</button><details><summary>Outils</summary><button className="btn" onClick={() => {setMenu(false);onTools();}}>Animations</button> <a className="btn" href="?style">Designs des joueurs</a> <a className="btn" href="?branding">Galerie des franchises</a></details><details><summary>Aide et préférences</summary><label>Accompagnement <select aria-label="Niveau d’aide" value={preferences.help} onChange={e=>onPreferences({...preferences,help:e.target.value as UiPreferences['help']})}><option value="complete">Complète</option><option value="discreet">Discrète</option><option value="off">Désactivée</option></select></label><p><button className="btn" onClick={()=>{onPreferences({...preferences,help:'complete',tour:0});setMenu(false);}}>Relancer le guide</button></p><label><input type="checkbox" checked={preferences.detailed} onChange={e=>onPreferences({...preferences,detailed:e.target.checked})}/> Préférer les vues détaillées</label></details><details><summary>Comprendre les chiffres</summary><p>Note : synthèse des attributs, pas une garantie de performance. Potentiel : marge de développement. Minutes : cibles sur 48 minutes ; le temps réel dépend du match. Poids : fréquence relative d’un système. M€ : budget fictif en millions d’euros.</p></details><button className="btn" onClick={() => {if(confirm('Abandonner cette carrière et supprimer sa sauvegarde ? Exportez une copie avant de continuer.'))store.deleteSave();}}>Nouvelle partie</button></div></Modal>}
  </header>;
}
