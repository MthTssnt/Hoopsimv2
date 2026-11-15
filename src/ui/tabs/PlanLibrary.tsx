import { useState } from 'react';
import { repairGamePlan, type GamePlan } from '../../engine/gamePlan';
import type { League, Team } from '../../engine/types';
import { store } from '../../state/store';

/** Loading only previews a variant; the editor's save action activates it. */
export function PlanLibrary({ league, team, draft, onLoad }: { league: League; team: Team; draft: GamePlan; onLoad: (plan: GamePlan) => void }) {
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const saved = team.savedGamePlans ?? [];
  const variant = saved.find(p => p.name === selected);
  return <div className="panel" aria-label="Bibliothèque de plans">
    <h3 className="panel-title">Mes variantes — {saved.length}/8</h3>
    <p className="faint small">Mémorisez le brouillon sous son nom. Charger une variante propose un aperçu ; « Enregistrer le plan » l’active.</p>
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-sm" onClick={() => {
        const errors = store.savePlanVariant(draft);
        setMessage(errors.length ? errors.join(' ') : `Variante « ${draft.name} » mémorisée.`);
        if (!errors.length) setSelected(draft.name);
      }}>Mémoriser cette variante</button>
      <select aria-label="Variante sauvegardée" value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">Choisir une variante</option>
        {saved.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>
      <button className="btn btn-sm" disabled={!variant} onClick={() => {
        if (!variant) return;
        const copy = { ...team, gamePlan: structuredClone(variant), rotation: [...team.rotation] };
        const warnings = repairGamePlan(copy, league.players);
        onLoad(copy.gamePlan!);
        setMessage(warnings.length ? warnings.join(' ') : 'Variante chargée dans le brouillon.');
      }}>Charger la variante</button>
      <button className="btn btn-sm" disabled={!variant} onClick={() => { store.deletePlanVariant(selected); setSelected(''); setMessage('Variante supprimée ; le plan actif est conservé.'); }}>Supprimer la variante</button>
    </div>
    {message && <p role="status">{message}</p>}
  </div>;
}
