import { ActionFeedback } from '../ActionFeedback';
import { useDraftGuard } from '../useDraftGuard';
import { TacticCourt } from '../TacticCourt';
import { useState } from 'react';
import { nextUserGame } from '../../engine/simSeason';
import { defaultGamePlan, OFFENSE_STYLES, validateGamePlan, type GamePlan } from '../../engine/gamePlan';
import { OFFENSE_LABELS, DEFENSE_LABELS, PLAYS, playSuitability, scoutLineup, type PlayId } from '../../engine/coaching/tactics';
import { playerName, type League, type Team } from '../../engine/types';
import { store } from '../../state/store';
import { PlanLibrary } from './PlanLibrary';

const SLIDERS = [
  ['pace', 'Rythme', 'Patient → rapide'], ['threePointFocus', 'Priorité à 3 points', 'Tendances naturelles → davantage de tirs lointains'],
  ['rimPressure', 'Attaque du cercle', 'Peu de pénétrations → priorité au cercle'], ['offensiveReboundAggression', 'Rebond offensif', 'Repli défensif → attaquer le rebond, au risque de la transition adverse'],
  ['defensiveHelp', 'Aide défensive', 'Tenir son joueur → protéger le cercle, au risque du tir extérieur'], ['defensivePressure', 'Pression sur la balle', 'Prudente → agressive, avec plus de fautes et de fatigue'],
] as const;
const IDENTITIES = {
  balanced: 'Suit les tendances individuelles sans priorité collective extrême.',
  paceSpace: 'Joue plus vite, écarte les tirs et réduit la présence au rebond offensif.',
  motion: 'Recherche les tirs assistés et les coupes ; les pertes dépendent de la passe et du QI du cinq.',
  pickRoll: 'Implique un porteur et un finisseur. Switch et drop orientent différemment ses lectures.',
  insideOut: 'Cherche un intérieur fort, ralentit le jeu et ressort après fixation ; la pression augmente le risque de perte.',
  isolation: 'Concentre les initiatives sur le créateur principal, diminue les tirs assistés et augmente sa fatigue.',
};

export function TacticsTab({ league, team }: { league: League; team: Team }) {
  const [draft, setDraft] = useState<GamePlan>(() => structuredClone(team.gamePlan ?? defaultGamePlan(team, league.players)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(team.gamePlan);
  useDraftGuard(dirty);
  const [message, setMessage] = useState('');
  const change = (fn: (p: GamePlan) => void) => { const p = structuredClone(draft); fn(p); setDraft(p); setMessage(''); };
  const errors = validateGamePlan(draft, team, league.players);
  const five = draft.rotation.starterIds.map(id => league.players[id]).filter(Boolean);
  const next = nextUserGame(league);
  const opponent = league.teams.find(t => t.id === (next?.homeId === team.id ? next.awayId : next?.homeId));
  const opponentFive = opponent?.gamePlan?.rotation.starterIds.map(id => league.players[id]).filter(Boolean) ?? [];
  const scout = scoutLineup(opponentFive);
  return <div className="grid" style={{ gap: 16 }}>
    <section className="panel">
      <h2 className="panel-title">Tactiques — plans de match</h2>
      <details><summary>Comment ce plan est utilisé dans les trois modes</summary><p role="note">Les plans s’appliquent à Simuler, Regarder et Jouer, avec un résultat propre à chaque mode. Dans Regarder, ajustez les consignes depuis la pause. Les systèmes sur le terrain restent des intentions : un tir ouvert, une interception ou vos commandes peuvent les interrompre.</p>
      </details><label>Nom du plan <input aria-label="Nom du plan tactique" maxLength={80} value={draft.name} onChange={e => change(p => { p.name = e.target.value; })} /></label>
      <div className="row" style={{ flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
        <label>Identité offensive <select aria-label="Identité offensive" value={draft.offense} onChange={e => change(p => { p.offense = e.target.value as GamePlan['offense']; })}>{OFFENSE_STYLES.map(style => <option key={style} value={style}>{OFFENSE_LABELS[style]}</option>)}</select></label>
        <label>Défense <select aria-label="Défense" value={draft.defense} onChange={e => change(p => { p.defense = e.target.value as GamePlan['defense']; })}>{Object.entries(DEFENSE_LABELS).filter(([id]) => id !== 'zone23' && id !== 'press').map(([id, label]) => <option key={id} value={id} disabled={id === 'zone23' || id === 'press'}>{label}</option>)}</select></label>
        <label>Créateur principal <select aria-label="Créateur principal" value={Object.entries(draft.rolesByPlayerId).find(([, r]) => r === 'primaryCreator')?.[0] ?? ''} onChange={e => change(p => {
          for (const id of Object.keys(p.rolesByPlayerId)) if (p.rolesByPlayerId[id] === 'primaryCreator') p.rolesByPlayerId[id] = 'secondaryCreator';
          if (e.target.value) p.rolesByPlayerId[e.target.value] = 'primaryCreator';
        })}><option value="">Selon les tendances du cinq</option>{Object.keys(draft.rotation.minutesByPlayerId).map(id => <option key={id} value={id}>{playerName(league.players[id])}</option>)}</select></label>
      </div>
      <p>{IDENTITIES[draft.offense]}</p>
      <TacticCourt activePlan={team.gamePlan}/><details><summary>Réglages avancés • 6 paramètres de jeu</summary><div className="grid grid-2">{SLIDERS.map(([key, label, help]) => <label key={key} style={{ display: 'block' }}>{label} : {draft[key]}<input style={{ display: 'block', width: '100%' }} type="range" min={0} max={100} aria-label={label} value={draft[key]} onChange={e => change(p => { p[key] = Number(e.target.value); })} /><span className="faint small">{help}</span></label>)}</div></details>
    </section>
    <details className="panel"><summary>Systèmes • playbook et poids relatifs</summary><section>
      <h3 className="panel-title">Playbook — poids relatifs</h3>
      <p className="faint small">Un poids nul exclut le système. Jusqu’à cinq systèmes actifs ; « Lecture libre » suit l’identité choisie. Les schémas illustrent les intentions, sans prévisualiser un match physique.</p>
      <div className="grid grid-2">{(Object.entries(PLAYS) as [PlayId, typeof PLAYS[PlayId]][]).map(([id, play]) => {
        const fit = playSuitability(id, five);
        return <article key={id} className="panel">
          <label>{play.name} <input type="number" min={0} max={100} step={1} style={{ width: 70 }} aria-label={`Poids ${play.name}`} value={Number.isFinite(draft.playbook.find(p => p.playId === id)?.weight ?? 0) ? draft.playbook.find(p => p.playId === id)?.weight ?? 0 : ''} onChange={e => {
            const n = e.target.value === '' ? NaN : Number(e.target.value);
            change(p => { p.playbook = p.playbook.filter(x => x.playId !== id); if (n !== 0) p.playbook.push({ playId: id, weight: n }); });
          }} /></label>
          <p className="small">{play.description}</p><pre style={{ whiteSpace: 'pre-wrap' }}>{play.diagram}</pre>
          <p className="faint small">Adéquation {fit.label.toLowerCase()} — {fit.reasons.join(' ')}</p>
        </article>;
      })}</div>
    </section></details>
    <section className="panel"><div className="draft-actions"><ActionFeedback state={dirty?"draft":"saved"}>{dirty ? "Modifications non enregistrées : votre plan actif reste inchangé." : `Plan « ${draft.name} » utilisé au prochain match.`}</ActionFeedback><button className="btn" onClick={()=>{setDraft(structuredClone(team.gamePlan ?? defaultGamePlan(team,league.players)));setMessage('Brouillon annulé.');}}>Annuler les modifications</button></div>
      {errors.length > 0 && <p role="alert">{errors.join(' ')}</p>}
      <button className="btn btn-primary" disabled={errors.length > 0} onClick={() => { const failures = store.setGamePlan(draft); setMessage(failures.length ? failures.join(' ') : 'Plan tactique enregistré.'); }}>Enregistrer le plan tactique</button>
      {message && <p role="status">{message}</p>}
    </section><details className="panel"><summary>Bibliothèque • mes variantes de plan</summary>
    <PlanLibrary league={league} team={team} draft={draft} onLoad={setDraft} /></details>
    <section className="panel"><h3 className="panel-title">Prochain adversaire : {opponent ? `${opponent.city} ${opponent.name}` : 'aucun match programmé'}</h3>
      {opponentFive.length > 0 && <><p className="faint small">Points forts et axes relativement plus faibles du cinq configuré, selon les notes actuelles ; ils ne prédisent pas le résultat.</p><div className="grid grid-2"><div><h4>Forces relatives</h4><ul>{scout.strengths.map(x => <li key={x}>{x}</li>)}</ul></div><div><h4>Points à examiner</h4><ul>{scout.weaknesses.map(x => <li key={x}>{x}</li>)}</ul></div></div></>}
    </section>
  </div>;
}
