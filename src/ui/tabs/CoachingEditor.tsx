import { useDraftGuard } from '../useDraftGuard';
import { PlanLibrary } from './PlanLibrary';
import { useState } from 'react';
import { coachingPreset, defaultGamePlan, distributeMinutes, distributeRemaining, eligibleIds, planRotationIds, PLAYER_ROLES, validateGamePlan, type CoachingPreset, type Five, type GamePlan } from '../../engine/gamePlan';
import { POSITIONS, playerName, type League, type Team } from '../../engine/types';
import { store } from '../../state/store';

const ROLES = ['Créateur principal', 'Créateur secondaire', 'Tireur', 'Pénétrateur', 'Intérieur sur pick & roll', 'Scoreur au poste', 'Stoppeur', 'Rebondeur', 'Sixième homme', 'Équipier'];
const PRESETS: [CoachingPreset, string][] = [['auto', 'Auto'], ['development', 'Développement'], ['competitive', 'Compétitif'], ['smallBall', 'Small Ball'], ['defensive', 'Défensif']];

export function CoachingEditor({ league, team }: { league: League; team: Team }) {
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
    <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
      {POSITIONS.map((pos, i) => {
        const player = league.players[draft.rotation.starterIds[i]];
        const gap = player ? Math.abs(POSITIONS.indexOf(player.pos) - i) : 0;
        return <label key={pos} style={{ flex: '1 1 180px' }}>{pos} <select aria-label={`Titulaire ${pos}`} value={draft.rotation.starterIds[i]} onChange={e => selectStarter(i, e.target.value)}>
          {ids.map(id => <option key={id} value={id}>{playerName(league.players[id])} ({league.players[id].pos})</option>)}
        </select><span className="faint small" style={{ display: 'block' }}>{gap ? `Hors poste : écart ${gap}. Le coach automatique pénalise chaque cran de 6,5 points dans son choix ; le cinq explicite est respecté.` : 'Poste naturel'}</span></label>;
      })}
    </div>
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau défilant"><table><thead><tr><th className="left">Joueur</th><th>Actif</th><th>Minutes</th><th>Rôle</th><th>Énergie</th></tr></thead><tbody>
      {team.roster.map(id => league.players[id]).filter(Boolean).map(player => <tr key={player.id}>
        <td className="left">{playerName(player)} <span className="faint small">{player.pos} · {player.overall}{player.injuryGames > 0 ? ` · Blessé ${player.injuryGames} m.` : ''}</span></td>
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
    </details><div className="draft-actions"><span role="status">{dirty ? "Modifications non enregistrées" : "Plan enregistré • prêt pour le prochain match"}</span><button className="btn btn-sm" onClick={()=>{setDraft(structuredClone(team.gamePlan ?? defaultGamePlan(team,league.players)));setLockedIds([]);setMessage('Brouillon annulé.');}}>Annuler les modifications</button></div>
    {errors.length > 0 && <p role="alert">{errors.join(' ')}</p>}
    <button className="btn" disabled={!!errors.length} onClick={() => { const failures = store.setGamePlan(draft); setMessage(failures.length ? failures.join(' ') : 'Plan enregistré.'); }}>Enregistrer le plan</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
