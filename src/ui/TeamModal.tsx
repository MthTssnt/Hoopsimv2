import {
  buildStandings,
  payroll,
  perGame,
  playerName,
  projectedStrength,
  totalReb,
  type League,
} from '../engine';
import { Modal, Rating, TeamLogo, num, signed } from './common';
import { useUi } from './uiContext';

export function TeamModal({ league, teamId, onClose }: { league: League; teamId: string; onClose: () => void }) {
  const ui = useUi();
  const team = league.teams.find((t) => t.id === teamId);
  if (!team) return null;

  const roster = team.roster.map((id) => league.players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
  const rank = buildStandings(league, team.conference).find((r) => r.team.id === team.id)?.rank ?? 0;
  const games = team.wins + team.losses;
  const diff = team.pointsFor - team.pointsAgainst;

  const title = (
    <div className="row">
      <TeamLogo team={team} size={38} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          {team.city} {team.name}
        </div>
        <div className="faint small">
          Conférence {team.conference} · division {team.division} · {rank}
          {rank === 1 ? 'er' : 'e'} de conférence
        </div>
      </div>
      <div className="spacer" />
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700 }}>
          {team.wins}-{team.losses}
        </div>
        <div className="faint small">
          {games ? `${signed(Math.round((diff / games) * 10) / 10)} / match` : 'saison à venir'}
        </div>
      </div>
    </div>
  );

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="grid grid-3" style={{ marginBottom: 14 }}>
        <div className="stat-tile">
          <div className="stat-tile-value">{Math.round(projectedStrength(league, team.id))}</div>
          <div className="stat-tile-label">Force de l'effectif</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{games ? num(team.pointsFor / games) : '—'}</div>
          <div className="stat-tile-label">Points marqués</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{games ? num(team.pointsAgainst / games) : '—'}</div>
          <div className="stat-tile-label">Points encaissés</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Joueur</th>
              <th>Poste</th>
              <th>Âge</th>
              <th>Note</th>
              <th>Pot.</th>
              <th>Min</th>
              <th>Pts</th>
              <th>Rbds</th>
              <th>Pd</th>
              <th>Salaire</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => ui.openPlayer(p.id)}>
                <td className="left" style={{ fontWeight: 600 }}>
                  {playerName(p)}
                  {p.injuryGames > 0 && (
                    <span className="pill pill-injury" style={{ marginLeft: 6 }}>
                      {p.injuryGames} m.
                    </span>
                  )}
                </td>
                <td>{p.pos}</td>
                <td>{p.age}</td>
                <td>
                  <Rating value={p.overall} />
                </td>
                <td className="faint">{p.potential}</td>
                <td>{p.stats.gp ? num(perGame(p.stats, 'min')) : '—'}</td>
                <td>{p.stats.gp ? num(perGame(p.stats, 'pts')) : '—'}</td>
                <td>{p.stats.gp ? num(totalReb(p.stats) / p.stats.gp) : '—'}</td>
                <td>{p.stats.gp ? num(perGame(p.stats, 'ast')) : '—'}</td>
                <td className="faint">{num(p.contract.salary)} M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint small" style={{ marginBottom: 0 }}>
        Masse salariale : {num(payroll(league, team.id))} M€
      </p>
    </Modal>
  );
}
