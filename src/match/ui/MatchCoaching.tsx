import { useState } from 'react';
import type { GamePlan } from '../../engine/gamePlan';
import { DEFENSE_LABELS, OFFENSE_LABELS, PLAYS } from '../../engine/coaching/tactics';
import type { CoachCommand, CoachSnapshot } from '../tactics/coaching';

export function MatchCoaching({ snapshot, variants, onCommand, errors }: { snapshot: CoachSnapshot; variants: GamePlan[]; onCommand: (command: CoachCommand) => void; errors: string[] }) {
  const [plan, setPlan] = useState(() => structuredClone(snapshot.plan));
  const [five, setFive] = useState(() => snapshot.members.filter(m => m.onCourt).map(m => m.id));
  if (!plan) return null;
  const edit = (change: (p: GamePlan) => void) => { const next = structuredClone(plan); change(next); setPlan(next); };
  const options = snapshot.members.filter(m => !m.fouledOut);
  return <section className="panel" aria-label="Coaching du match" style={{ marginBottom: 16 }}>
    <h3 className="panel-title">Coach — {snapshot.phase}</h3>
    <p className="faint small">Ces changements concernent ce match. Les consignes attendent la fin d’un geste en cours ; le cinq attend un arrêt légal hors lancers. Aucun temps mort artificiel n’est ajouté.</p>
    <label>Variante <select aria-label="Variante en match" defaultValue="" onChange={e => {
      const variant = variants[Number(e.target.value)]; if (variant) setPlan(structuredClone(variant));
    }}><option value="" disabled>Charger une variante</option>{variants.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select></label>
    <div className="row" style={{ flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
      <label>Attaque <select aria-label="Attaque en match" value={plan.offense} onChange={e => edit(p => { p.offense = e.target.value as GamePlan['offense']; })}>{Object.entries(OFFENSE_LABELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Défense <select aria-label="Défense en match" value={plan.defense} onChange={e => edit(p => { p.defense = e.target.value as GamePlan['defense']; })}>{Object.entries(DEFENSE_LABELS).map(([id, name]) => <option key={id} value={id} disabled={id === 'zone23' || id === 'press'}>{name}</option>)}</select></label>
      <label>Système <select aria-label="Système en match" value={plan.playbook.length === 1 ? plan.playbook[0].playId : 'mixed'} onChange={e => edit(p => { p.playbook = [{ playId: e.target.value, weight: 1 }]; })}><option value="mixed" disabled>Playbook de la variante</option>{Object.entries(PLAYS).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}</select></label>
    </div>
    <div className="row" style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>{([['pace', 'Rythme en match'], ['threePointFocus', 'Priorité 3 points en match'], ['rimPressure', 'Priorité cercle en match']] as const).map(([key, label]) => <label key={key}>{label} : {plan[key]} <input type="range" aria-label={label} min={0} max={100} value={plan[key]} onChange={e => edit(p => { p[key] = Number(e.target.value); })} /></label>)}</div>
    <p><label>Créateur ciblé <select aria-label="Créateur ciblé en match" value={Object.entries(plan.rolesByPlayerId).find(([, role]) => role === 'primaryCreator')?.[0] ?? ''} onChange={e => edit(p => {
      for (const id of Object.keys(p.rolesByPlayerId)) if (p.rolesByPlayerId[id] === 'primaryCreator') p.rolesByPlayerId[id] = 'secondaryCreator';
      if (e.target.value) p.rolesByPlayerId[e.target.value] = 'primaryCreator';
    })}><option value="">Selon le cinq présent</option>{options.filter(m => m.id in plan.rotation.minutesByPlayerId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></p>
    <button className="btn" onClick={() => onCommand({ kind: 'plan', plan })}>Envoyer les consignes</button>
    <h4>Cinq au prochain arrêt</h4>
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{['PG', 'SG', 'SF', 'PF', 'C'].map((pos, i) => <label key={pos}>{pos} <select aria-label={`Coach ${pos}`} value={five[i] ?? ''} onChange={e => {
      const next = [...five], other = next.indexOf(e.target.value);
      if (other >= 0) next[other] = next[i]; next[i] = e.target.value; setFive(next);
    }}>{options.map(m => <option key={m.id} value={m.id}>{m.name} · {m.energy}% · {m.fouls} fautes</option>)}</select></label>)}</div>
    <button className="btn btn-sm" onClick={() => onCommand({ kind: 'five', ids: five })}>Demander ce cinq</button>
    {errors.length > 0 && <p role="alert">{errors.join(' ')}</p>}
    <ul aria-label="État des consignes">{snapshot.events.map((e, i) => <li key={i}>{e.time.toFixed(1)} s · {e.message}</li>)}</ul>
  </section>;
}
