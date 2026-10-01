import { playerName, projectedStrength, topPlayers, type League } from '../../engine';
import { Rating, TeamLogo, num } from '../common';
import { useUi } from '../uiContext';

export function HistoryTab({ league }: { league: League }) {
  const ui = useUi();
  const best = topPlayers(league, 12);
  const powerRanking = [...league.teams]
    .map((t) => ({ team: t, strength: projectedStrength(league, t.id) }))
    .sort((a, b) => b.strength - a.strength);

  return (
    <div className="grid grid-2">
      <div className="panel">
        <div className="panel-title">Palmarès</div>
        {league.history.length === 0 ? (
          <p className="muted small" style={{ marginTop: 0 }}>
            Aucune saison terminée pour l'instant.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="left">Saison</th>
                  <th className="left">Champion</th>
                  <th className="left">Finaliste</th>
                  <th className="left">MVP</th>
                  <th className="left">MVP des finales</th>
                </tr>
              </thead>
              <tbody>
                {[...league.history].reverse().map((entry) => {
                  const champ = league.teams.find((t) => t.id === entry.championId);
                  const runner = league.teams.find((t) => t.id === entry.runnerUpId);
                  const mvp = league.players[entry.mvpId];
                  const fmvp = league.players[entry.finalsMvpId];
                  return (
                    <tr key={entry.season}>
                      <td className="left mono">{entry.season}</td>
                      <td className="left">
                        {champ && (
                          <span className="row" style={{ gap: 6 }}>
                            <TeamLogo team={champ} size={20} />
                            <strong>{champ.name}</strong>
                          </span>
                        )}
                      </td>
                      <td className="left faint">{runner?.name ?? '—'}</td>
                      <td className="left">{mvp ? playerName(mvp) : '—'}</td>
                      <td className="left">{fmvp ? playerName(fmvp) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel-title" style={{ marginTop: 22 }}>
          Hiérarchie des effectifs
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">#</th>
                <th className="left">Équipe</th>
                <th>Force</th>
                <th>Bilan</th>
              </tr>
            </thead>
            <tbody>
              {powerRanking.map((row, i) => (
                <tr
                  key={row.team.id}
                  className={`clickable${row.team.id === league.userTeamId ? ' highlight' : ''}`}
                  onClick={() => ui.openTeam(row.team.id)}
                >
                  <td className="left faint mono">{i + 1}</td>
                  <td className="left">
                    <span className="row" style={{ gap: 8 }}>
                      <TeamLogo team={row.team} size={20} />
                      <span>{row.team.city} {row.team.name}</span>
                    </span>
                  </td>
                  <td>
                    <Rating value={Math.round(row.strength)} />
                  </td>
                  <td className="mono faint">
                    {row.team.wins}-{row.team.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Meilleurs joueurs de la ligue</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Joueur</th>
                <th className="left">Éq.</th>
                <th>Poste</th>
                <th>Âge</th>
                <th>Note</th>
                <th>Pot.</th>
                <th>Titres</th>
              </tr>
            </thead>
            <tbody>
              {best.map((p) => {
                const team = league.teams.find((t) => t.id === p.teamId);
                return (
                  <tr key={p.id} className="clickable" onClick={() => ui.openPlayer(p.id)}>
                    <td className="left" style={{ fontWeight: 600 }}>
                      {playerName(p)}
                      <span className="faint small" style={{ display: 'block' }}>
                        {p.archetype}
                      </span>
                    </td>
                    <td className="left faint">{team?.abbr}</td>
                    <td>{p.pos}</td>
                    <td>{p.age}</td>
                    <td>
                      <Rating value={p.overall} />
                    </td>
                    <td className="faint">{p.potential}</td>
                    <td>{p.career.titles || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel-title" style={{ marginTop: 22 }}>
          Salaires les plus élevés
        </div>
        {Object.values(league.players)
          .sort((a, b) => b.contract.salary - a.contract.salary)
          .slice(0, 8)
          .map((p) => {
            const team = league.teams.find((t) => t.id === p.teamId);
            return (
              <div key={p.id} className="row small" style={{ padding: '4px 0' }}>
                <span style={{ fontWeight: 600 }}>{playerName(p)}</span>
                <span className="faint">{team?.abbr}</span>
                <div className="spacer" />
                <span className="mono">{num(p.contract.salary)} M€ · {p.contract.years} an(s)</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
