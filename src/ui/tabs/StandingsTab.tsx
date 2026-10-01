import { buildStandings, type Conference, type League } from '../../engine';
import { TeamLogo, num, signed } from '../common';
import { useUi } from '../uiContext';

export function StandingsTab({ league }: { league: League }) {
  return (
    <div className="grid grid-2">
      <ConferenceTable league={league} conference="Est" />
      <ConferenceTable league={league} conference="Ouest" />
    </div>
  );
}

function ConferenceTable({ league, conference }: { league: League; conference: Conference }) {
  const ui = useUi();
  const rows = buildStandings(league, conference);

  return (
    <div className="panel">
      <div className="panel-title">Conférence {conference}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">#</th>
              <th className="left">Équipe</th>
              <th>V</th>
              <th>D</th>
              <th>%</th>
              <th>Écart</th>
              <th>Diff.</th>
              <th>Série</th>
              <th>10 derniers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.team.id}
                className={`clickable${row.team.id === league.userTeamId ? ' highlight' : ''}`}
                onClick={() => ui.openTeam(row.team.id)}
                style={row.rank === 8 ? { borderBottom: '2px solid var(--border)' } : undefined}
              >
                <td className="left faint mono">{row.rank}</td>
                <td className="left">
                  <span className="row" style={{ gap: 8 }}>
                    <TeamLogo team={row.team} size={22} />
                    <span style={{ fontWeight: row.team.id === league.userTeamId ? 700 : 500 }}>
                      {row.team.city} {row.team.name}
                    </span>
                  </span>
                </td>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td className="mono">{row.pct.toFixed(3).replace('0.', ',')}</td>
                <td className="faint">{row.gamesBack === 0 ? '—' : num(row.gamesBack)}</td>
                <td className={row.diff >= 0 ? 'win' : 'loss'}>{signed(row.diff)}</td>
                <td className={row.streak > 0 ? 'win' : row.streak < 0 ? 'loss' : ''}>
                  {row.streak === 0 ? '—' : `${Math.abs(row.streak)}${row.streak > 0 ? 'V' : 'D'}`}
                </td>
                <td className="faint">{row.lastTen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint small" style={{ marginBottom: 0 }}>
        Les huit premiers disputent les playoffs.
      </p>
    </div>
  );
}
