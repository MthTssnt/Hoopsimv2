import {PlayerPortrait} from '../clubhouse/PlayerPortrait';
import {useUi} from '../uiContext';
import { ActionFeedback } from '../ActionFeedback';
import { useDraftGuard } from '../useDraftGuard';
import { PlanLibrary } from './PlanLibrary';
import { useState } from 'react';
import { coachingPreset, defaultGamePlan, distributeMinutes, distributeRemaining, eligibleIds, planRotationIds, PLAYER_ROLES, validateGamePlan, type CoachingPreset, type Five, type GamePlan } from '../../engine/gamePlan';
import { POSITIONS, playerName, type League, type Team } from '../../engine/types';
import { store } from '../../state/store';

const ROLES = ['Créateur principal', 'Créateur secondaire', 'Tireur', 'Pénétrateur', 'Intérieur sur pick & roll', 'Scoreur au poste', 'Stoppeur', 'Rebondeur', 'Sixième homme', 'Équipier'];
const PRESETS: [CoachingPreset, string][] = [['auto', 'Auto'], ['development', 'Développement'], ['competitive', 'Compétitif'], ['smallBall', 'Small Ball'], ['defensive', 'Défensif']];

export function CoachingEditor({ league, team }: { league: League; team: Team }) {
  const ui=useUi();
  const [allPlayers,setAllPlayers]=useState(false);
  const [draft, setDraft] = useState<GamePlan>(() => structuredClone(team.gamePlan ?? defaultGamePlan(team, league.players)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(team.gamePlan);
  useDraftGuard(dirty);
  const [message, setMessage] = useState('');
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const ids = planRotationIds(draft);
  const available = eligibleIds(team, league.players);
  const errors = validateGamePlan(draft, team, league.players);
  const total = Object.values(draft.rotation.minutesByPlayerId).reduce((a, b) => a + b, 0);
  const change = (fn: (p: GamePlan) => void) => {
    const p = structuredClone(draft); fn(p); setDraft(p); setMessage('');
  };
  const selectStarter = (slot: number, id: string, closing = false) => change(p => {
    const five = closing ? p.rotation.closingFiveIds! : p.rotation.starterIds;
    const other = five.indexOf(id);
    if (other >= 0) five[other] = five[slot];
    five[slot] = id;
  });
  const toggleActive = (id: string) => change(p => {
    const minutes = p.rotation.minutesByPlayerId;
    if (id in minutes) {
      if (Object.keys(minutes).length <= 5) return;
      delete minutes[id]; delete p.rolesByPlayerId[id];
      const remaining = Object.keys(minutes);
      p.rotation.starterIds = [...new Set([...p.rotation.starterIds.filter(x => x !== id), ...remaining])].slice(0, 5) as Five;
      if (p.rotation.closingFiveIds?.includes(id)) delete p.rotation.closingFiveIds;
    } else {
      if (Object.keys(minutes).length >= 10) return;
      minutes[id] = 12; p.rolesByPlayerId[id] = 'rolePlayer';
    }
    p.rotation.minutesByPlayerId = distributeMinutes(Object.keys(minutes), minutes);
  });
  return <section className="panel" aria-label="Éditeur de coaching">
    <h2 className="panel-title rotation-total">Plan de rotation — <span aria-live="polite">{Number.isFinite(total) ? Number.isInteger(total) ? total.toFixed(0) : total.toFixed(1) : '—'}/240 min</span></h2>
    <p className="faint small">Minutes équivalentes à un match de 48 min, communes à Simuler, Regarder et Jouer. La fatigue, les fautes et la fin de match peuvent modifier le temps réel.</p>
    <details><summary>Profils du coach et bibliothèque de plans</summary><div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
      {PRESETS.map(([preset, label]) => <button key={preset} className="btn btn-sm" onClick={() => { setLockedIds([]); setDraft(coachingPreset(team, league.players, preset)); setMessage('Proposition chargée : vérifiez le cinq et les minutes avant d’enregistrer.'); }}>{label}</button>)}
      <button className="btn btn-sm" onClick={() => { setLockedIds([]); setDraft(coachingPreset(team, league.players, 'auto')); setMessage('Conseil : les joueurs les mieux notés sont prioritaires. Vérifiez les postes ci-dessous ; cette proposition reste modifiable.'); }}>Recommandation du coach</button>
    </div>
    <label>Nom du plan <input aria-label="Nom du plan" value={draft.name} maxLength={80} onChange={e => change(p => { p.name = e.target.value; })} /></label>
    <PlanLibrary league={league} team={team} draft={draft} onLoad={plan => { setDraft(plan); setLockedIds([]); }} />
    </details><h3>Cinq majeur</h3>
    <div className="rotation-court" aria-label="Demi-terrain du cinq majeur">
      <svg viewBox="0 0 640 420" preserveAspectRatio="none" aria-hidden="true"><rect width="640" height="420" fill="#d4ad70"/><path d="M0 0H640M0 418H640M1 0V420M639 0V420"/><path d="M240 0V190H400V0" fill="#285640"/><path d="M240 190H400M240 190A80 80 0 0 0 400 190M240 190A80 80 0 0 1 400 190" strokeDasharray="8 7"/><path d="M278 0V72A42 42 0 0 0 362 72V0M70 0V70A260 260 0 0 0 570 70V0"/><path d="M295 25H345M320 25V40"/><circle cx="320" cy="49" r="10"/></svg>
      {POSITIONS.map((pos,i)=>{const player=league.players[draft.rotation.starterIds[i]],gap=player?Math.abs(POSITIONS.indexOf(player.pos)-i):0;const point=[[50,67],[82,52],[18,52],[30,17],[68,17]][i];
       return <article className="court-starter" key={pos} style={{left:point[0]+'%',top:point[1]+'%'}}><button className="portrait-link" aria-label={`Fiche de ${playerName(player)}`} onClick={()=>ui.openPlayer(player.id)}><PlayerPortrait player={player} size={52}/></button><strong>{pos} · #{player.number}</strong><label><span className="sr-only">Titulaire {pos}</span><select aria-label={`Titulaire ${pos}`} value={player.id} onChange={e=>selectStarter(i,e.target.value)}>{ids.map(id=><option key={id} value={id}>{playerName(league.players[id])} ({league.players[id].pos})</option>)}</select></label><label className="small">Minutes <input aria-label={`Minutes titulaire ${pos}`} type="number" min={0} max={48} value={Number.isFinite(draft.rotation.minutesByPlayerId[player.id])?draft.rotation.minutesByPlayerId[player.id]:''} onChange={e=>{setLockedIds(current=>[...new Set([...current,player.id])]);change(p=>{p.rotation.minutesByPlayerId[player.id]=e.target.value===''?NaN:Number(e.target.value);});}}/></label>{gap>0 && <small>Hors poste : écart {gap}</small>}</article>;
      })}
    </div>
    <h3>Banc et temps de jeu</h3><p className="faint small">Choisissez un titulaire sur le terrain pour le remplacer par un joueur actif. Les minutes et les rôles restent ajustables ci-dessous.</p>
    <button className="btn btn-sm" onClick={()=>setAllPlayers(!allPlayers)} aria-expanded={allPlayers}>{allPlayers?'Afficher seulement le banc actif':'Voir tous les rôles et les joueurs hors rotation'}</button>
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau défilant"><table><thead><tr><th className="left">Joueur</th><th>Actif</th><th>Minutes</th><th>Rôle</th><th>Énergie</th></tr></thead><tbody>
      {team.roster.map(id => league.players[id]).filter(player=>player && (allPlayers || ids.includes(player.id) && !draft.rotation.starterIds.includes(player.id))).map(player => <tr key={player.id}>
        <td className="left"><button className="player-link" onClick={()=>ui.openPlayer(player.id)}>{playerName(player)}</button> <span className="faint small">{player.pos} · {player.overall}{player.injuryGames > 0 ? ` · Blessé ${player.injuryGames} m.` : ''}</span></td>
        <td><input type="checkbox" aria-label={`Actif ${playerName(player)}`} checked={ids.includes(player.id)} disabled={!available.includes(player.id) || (ids.includes(player.id) ? ids.length <= 5 : ids.length >= 10)} onChange={() => toggleActive(player.id)} /></td>
        <td>{ids.includes(player.id) && <input style={{ width: 65 }} aria-label={`Minutes ${playerName(player)}`} type="number" min={0} max={48} step={1} value={Number.isFinite(draft.rotation.minutesByPlayerId[player.id]) ? draft.rotation.minutesByPlayerId[player.id] : ''} onChange={e => { const n = e.target.value === '' ? NaN : Number(e.target.value); setLockedIds(current => [...new Set([...current, player.id])]); change(p => { p.rotation.minutesByPlayerId[player.id] = n; }); }} />}</td>
        <td>{ids.includes(player.id) && <select aria-label={`Rôle ${playerName(player)}`} value={draft.rolesByPlayerId[player.id] ?? 'rolePlayer'} onChange={e => change(p => { p.rolesByPlayerId[player.id] = e.target.value as typeof PLAYER_ROLES[number]; })}>{PLAYER_ROLES.map((r, i) => <option key={r} value={r}>{ROLES[i]}</option>)}</select>}</td>
        <td>{Math.round(player.energy)} %</td>
      </tr>)}
    </tbody></table></div>
    <details><summary>Réglages avancés • rôles, remplacements et cinq de fin</summary><p className="faint small">Les créateurs et le sixième homme ont davantage d’initiative ; tireur, pénétrateur et intérieurs orientent les zones de tir. Stoppeur et rebondeur réduisent leur usage offensif. Ces rôles ne modifient pas la note globale et n’ajoutent pas encore de systèmes collectifs.</p>
    <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
      <button className="btn btn-sm" onClick={() => {
        try { const minutes = distributeRemaining(draft.rotation.minutesByPlayerId, lockedIds.filter(id => ids.includes(id))); change(p => { p.rotation.minutesByPlayerId = minutes; }); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Répartition impossible.'); }
      }}>Répartir le reste automatiquement</button>
      <button className="btn btn-sm" onClick={() => { setLockedIds([]); change(p => { p.rotation.minutesByPlayerId = distributeMinutes(ids, p.rotation.minutesByPlayerId); }); }}>Normaliser tout à 240 minutes</button>
      {(['autoSubstitutions', 'preserveStartersInClutch', 'foulTroubleProtection'] as const).map((key, i) => <label key={key}><input type="checkbox" checked={draft.rotation[key]} onChange={e => change(p => { p.rotation[key] = e.target.checked; })} /> {['Remplacements automatiques', 'Privilégier les titulaires en fin serrée', 'Protéger les joueurs en difficulté de fautes'][i]}</label>)}
    </div>
    <p><label>Fréquence des changements <input aria-label="Fréquence des changements" type="range" min={0} max={100} value={draft.substitutionAggression} onChange={e => change(p => { p.substitutionAggression = Number(e.target.value); })} /> {draft.substitutionAggression < 34 ? 'Patiente' : draft.substitutionAggression > 66 ? 'Fréquente' : 'Équilibrée'}</label></p>
    <p><label><input type="checkbox" checked={!!draft.rotation.closingFiveIds} onChange={e => change(p => { if (e.target.checked) p.rotation.closingFiveIds = [...p.rotation.starterIds]; else delete p.rotation.closingFiveIds; })} /> Choisir un cinq de fin de match</label></p>
    {draft.rotation.closingFiveIds && <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{POSITIONS.map((pos, i) => <label key={pos}>{pos} <select aria-label={`Fin de match ${pos}`} value={draft.rotation.closingFiveIds![i]} onChange={e => selectStarter(i, e.target.value, true)}>{ids.map(id => <option key={id} value={id}>{playerName(league.players[id])}</option>)}</select></label>)}</div>}
    </details><div className="draft-actions"><ActionFeedback state={dirty?"draft":"saved"}>{dirty ? "Modifications non enregistrées : enregistrez pour utiliser ce cinq." : `Plan « ${draft.name} » utilisé au prochain match.`}</ActionFeedback><button className="btn btn-sm" onClick={()=>{setDraft(structuredClone(team.gamePlan ?? defaultGamePlan(team,league.players)));setLockedIds([]);setMessage('Brouillon annulé.');}}>Annuler les modifications</button></div>
    {errors.length > 0 && <p role="alert">{errors.join(' ')}</p>}
    <button className="btn" disabled={!!errors.length} onClick={() => { const failures = store.setGamePlan(draft); setMessage(failures.length ? failures.join(' ') : 'Plan enregistré.'); }}>Enregistrer le plan</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
