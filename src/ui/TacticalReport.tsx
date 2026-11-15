import { boxMetrics } from '../engine/coaching/analytics';
import { DEFENSE_LABELS, OFFENSE_LABELS, PLAYS } from '../engine/coaching/tactics';
import { playerName, type GameBox, type League } from '../engine/types';

export function TacticalReport({ box, league }: { box: GameBox; league: League }) {
  return <details className="panel" style={{ marginBottom: 16 }}>
    <summary>Analyse tactique</summary>
    <p className="faint small">Les observations décrivent ce match ; elles ne mesurent pas un nombre de points « gagnés grâce à la tactique ».</p>
    {[box.awayId, box.homeId].map(id => {
      const report = box.tactics?.teams[id];
      const metrics = boxMetrics(box, id);
      return <section key={id}>
        <h3>{league.teams.find(t => t.id === id)?.name ?? id}</h3>
        <p>{metrics.possessions.toFixed(1)} possessions {metrics.estimated ? 'estimées (FGA − rebonds offensifs + pertes + 0,44 × FTA)' : 'comptées'} · {metrics.rating.toFixed(1)} points/100 possessions · durée {metrics.durationMinutes.toFixed(1)} min</p>
        <p>{metrics.oreb} rebonds offensifs · {metrics.tov} pertes · {metrics.ast} passes décisives · {metrics.tpa}/{metrics.fga} tentatives à 3 points</p>
        {report && <p>Plan : {report.planName}{` · ${OFFENSE_LABELS[report.offense]} / ${DEFENSE_LABELS[report.defense]}`}{box.tactics?.source === 'physical' ? ' · Dernières consignes appliquées' : ''}</p>}
        {report?.shots ? <p>Tirs tentés : cercle {report.shots.rim}, mi-distance {report.shots.mid}, 3 points {report.shots.three}.</p> : <p className="faint small">Répartition des tirs cercle/mi-distance non mesurée pour ce match.</p>}
        {report?.live && <div><p>Séquences démarrées : {Object.entries(report.live.playsStarted).map(([id, n]) => `${PLAYS[id as keyof typeof PLAYS]?.name ?? id} ${n}`).join(' · ') || 'aucune'}.</p><p>Fenêtres d’écran planté à proximité d’un défenseur : {report.live.screenWindows} · intentions de coupe : {report.live.cutsStarted} · replis : {report.live.fallbacks} · switches : {report.live.switches}.</p><p className="faint small">Ces observations ne prouvent pas qu’une action a réussi ni causé des points.</p>{report.coachingEvents && report.coachingEvents.length > 0 && <details><summary>Consignes en cours de match (plan initial : {report.initialPlanName})</summary><ul>{report.coachingEvents.map((e, i) => <li key={i}>{e.time.toFixed(1)} s : {e.message}</li>)}</ul></details>}</div>}
        {report?.plays && <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau défilant"><table><thead><tr><th className="left">Système</th><th>Poss.</th><th>Pts</th><th>BP</th><th>Tirs</th></tr></thead><tbody>{Object.entries(report.plays).map(([playId, usage]) => <tr key={playId}><td className="left">{PLAYS[playId as keyof typeof PLAYS]?.name ?? playId}</td><td>{usage.possessions}</td><td>{usage.points}</td><td>{usage.turnovers}</td><td>{usage.shots}</td></tr>)}</tbody></table></div>}
        {report && <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau défilant"><table><thead><tr><th className="left">Minutes équivalentes à 48 min</th><th>Cible</th><th>Jouées</th><th>Fautes</th></tr></thead><tbody>{(box.rows[id] ?? []).map(row => <tr key={row.playerId}><td className="left">{league.players[row.playerId] ? playerName(league.players[row.playerId]) : row.playerId}</td><td>{report.targetMinutes[row.playerId]?.toFixed(1) ?? '—'}</td><td>{(row.line.secs / 60 * (box.tactics?.normalizationFactor ?? 1)).toFixed(1)}</td><td>{row.line.pf}</td></tr>)}</tbody></table></div>}
      </section>;
    })}
  </details>;
}
