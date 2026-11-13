import type { MatchScene } from '../scenes/MatchScene';
import type { WorldInput } from '../world/MatchWorld';
import { WORLD_DT } from '../world/MatchWorld';
import { useState } from 'react';

export interface InspectorApi {
  snapshot: MatchScene['inspect'];
  step: (inputs?: readonly WorldInput[]) => void;
  play: (play: boolean) => void;
  recording: MatchScene['inspectorRecording'];
  advance: MatchScene['inspectorAdvance'];
}
declare global { interface Window { __hoopsim?: InspectorApi } }

export function MatchInspector({ snapshot, scene }: { snapshot: ReturnType<MatchScene['inspect']>; scene: MatchScene }) {
  const [player, setPlayer] = useState(0), [marks, setMarks] = useState(true);
  const save = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(scene.inspectorRecording())], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `hoopsim-${snapshot.seed}-${snapshot.step}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <aside aria-label="Inspecteur de match" style={{ position: 'absolute', bottom: 52, left: 12, maxWidth: 'calc(100vw - 24px)', padding: 10, borderRadius: 6, color: '#fff5e5', background: '#17243bea', fontSize: 11 }}>
    <div>Graine {snapshot.seed} · pas <output data-testid="physics-step">{snapshot.step}</output> · {snapshot.clock.toFixed(3)} s · {snapshot.phase}</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
      <button className="btn btn-sm" onClick={() => scene.inspectorPlay(snapshot.paused)}>{snapshot.paused ? 'Lire le match' : 'Figer le match'}</button>
      <button className="btn btn-sm" onClick={() => scene.inspectorAdvance(Math.round((1 / 60) / WORLD_DT))}>Avancer de 1/60 s</button>
      <button className="btn btn-sm" onClick={save}>Exporter les entrées</button>
      <label>Joueur <select aria-label="Joueur inspecté" value={player} onChange={(e) => { const value = Number(e.target.value); setPlayer(value); scene.inspectorOptions(value, marks); }}>{snapshot.players.map((p, i) => <option key={i} value={i}>{i + 1} · {p.id}</option>)}</select></label>
      <label><input type="checkbox" checked={marks} onChange={(e) => { setMarks(e.target.checked); scene.inspectorOptions(player, e.target.checked); }} /> Repères</label>
    </div>
    <div>Or : centre peint · rose : paume · cyan : ballon physique · vert : pieds. Les entrées exportées sont indexées par pas.</div>
  </aside>;
}
