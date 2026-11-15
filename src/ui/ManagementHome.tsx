import { nextUserGame, userGameToday, buildStandings, playerName, type League, type Team } from '../engine';
import { validateGamePlan } from '../engine/gamePlan';
import { OFFENSE_LABELS, DEFENSE_LABELS, scoutLineup } from '../engine/coaching/tactics';
import { budget } from '../engine/management/economy';
import { MatchButtons } from './MatchButtons';
import { TeamLogo, teamFullName } from './common';
import { Dashboard } from './tabs/Dashboard';
import { store } from '../state/store';

type Destination = 'preparation' | 'effectif' | 'rotation' | 'tactiques' | 'developpement' | 'marche' | 'calendrier' | 'classement' | 'stats' | 'playoffs';
export function ManagementHome({ league, team, onNavigate, preparing = false }: { league: League; team: Team; onNavigate: (id: Destination) => void; preparing?: boolean }) {
 const game = userGameToday(league) ?? nextUserGame(league);
 const opponent = league.teams.find(t => t.id === (game?.homeId === team.id ? game.awayId : game?.homeId));
 const errors = team.gamePlan ? validateGamePlan(team.gamePlan, team, league.players) : ['Préparez un plan de rotation avec cinq joueurs aptes.'];
 const injuries = team.roster.map(id => league.players[id]).filter(p => p.injuryGames > 0);
 const expiring = budget(league, team).expiringIds.length;
 const rank = buildStandings(league,team.conference).find(r => r.team.id === team.id)?.rank;
 const scouts = scoutLineup(opponent?.gamePlan?.rotation.starterIds.map(id => league.players[id]).filter(Boolean) ?? []);
 const ready = game && game.day <= league.day;
 return <div className="grid" style={{ gap:24 }}>
  <section className="fixture-poster">
   <div className="eyebrow">{preparing ? 'Préparation du match' : 'Votre prochain rendez-vous'} · Saison {league.season}</div>
   {opponent ? <><div className="fixture-teams"><div><TeamLogo team={team} size={96}/><h2>{team.name}</h2><span>{team.city}</span></div><div className="versus">VS<small>J{game!.day+1}<br/>{game!.homeId === team.id ? 'À domicile' : 'À l’extérieur'}</small></div><div><TeamLogo team={opponent} size={96}/><h2>{opponent.name}</h2><span>{opponent.city}</span></div></div>
    {!preparing && <button className="btn btn-primary" onClick={() => onNavigate('preparation')}>Préparer le match →</button>}
    {preparing && (ready ? <><p>Jouer : commandes au clavier. Regarder : CPU contre CPU avec coaching en pause. Simuler : résultat immédiat.</p><div className="row" style={{flexWrap:'wrap'}}><MatchButtons /></div></> : <><p>Le match aura lieu dans {Math.max(0,game!.day-league.day)} jour(s). Avancer simule les journées intermédiaires.</p><button className="btn btn-primary" onClick={() => store.simulateToNextUserGame()}>Avancer jusqu’au match</button></>)}
   </> : <><h2>{league.phase === 'offseason' ? 'La prochaine saison commence ici.' : 'La suite se joue dans la ligue.'}</h2><p>{league.phase === 'offseason' ? 'Prolongez vos joueurs, préparez la draft, puis complétez votre équipe.' : 'Consultez le tableau des playoffs et les résultats.'}</p><button className="btn btn-primary" onClick={() => onNavigate(league.phase === 'offseason' ? 'developpement' : 'playoffs')}>{league.phase === 'offseason' ? 'Reprendre l’intersaison' : 'Voir les playoffs'}</button></>}
  </section>
  <div className="grid grid-2"><section className="panel"><h2 className="panel-title">À vous de décider</h2>
   {errors.length > 0 ? <><p role="alert">{errors.join(' ')}</p><button className="btn" onClick={() => onNavigate('rotation')}>Corriger la rotation</button></> : <p>✓ Votre plan est valide.</p>}
   {injuries.length > 0 && <p>{injuries.length} joueur(s) blessé(s) : {injuries.map(playerName).join(', ')}.</p>}
   {expiring > 0 && <p><button className="btn btn-sm" onClick={() => onNavigate('marche')}>{expiring} contrat(s) à échéance · Voir les contrats</button></p>}
   {(league.management?.proposals.length ?? 0)>0 && <p>{league.management!.proposals.length} offre(s) reçue(s) à consulter dans Marché / Transferts.</p>}
   <button className="btn btn-sm" onClick={() => onNavigate('effectif')}>Voir mon effectif</button>
  </section><section className="panel"><h2 className="panel-title">État de l’équipe</h2><div className="club-record">{team.wins}<span> V — </span>{team.losses}<span> D</span></div><p>{rank ? `${rank}${rank===1?'er':'e'} de la conférence ${team.conference}` : 'Classement à venir'} · {team.roster.length} joueurs</p><p>Plan actif : {team.gamePlan?.name ?? 'Non défini'}</p><button className="btn btn-sm" onClick={() => onNavigate('tactiques')}>Revoir les tactiques</button></section></div>
  {preparing && <div className="grid grid-2"><section className="panel"><h2 className="panel-title">Mon cinq • plan enregistré</h2>{team.gamePlan?.rotation.starterIds.map(id => <p key={id}>{league.players[id]?.pos} · {league.players[id] ? playerName(league.players[id]) : 'Joueur indisponible'} · {team.gamePlan!.rotation.minutesByPlayerId[id]} min prévues</p>)}<p>{team.gamePlan && `${OFFENSE_LABELS[team.gamePlan.offense]} / ${DEFENSE_LABELS[team.gamePlan.defense]} · rythme ${team.gamePlan.pace}/100`}</p><button className="btn" onClick={() => onNavigate('rotation')}>Modifier la rotation</button></section><section className="panel"><h2 className="panel-title">Observer {opponent ? teamFullName(opponent) : 'l’adversaire'}</h2><p>Notes actuelles du cinq configuré, sans prédiction du résultat.</p><h3>Forces relatives</h3><ul>{scouts.strengths.map(s => <li key={s}>{s}</li>)}</ul><h3>Points à examiner</h3><ul>{scouts.weaknesses.map(s => <li key={s}>{s}</li>)}</ul></section></div>}
  {!preparing && <details className="panel"><summary>Résultats, leaders et actualités de la ligue</summary><Dashboard league={league} team={team} onNavigate={onNavigate}/></details>}
 </div>;
}
