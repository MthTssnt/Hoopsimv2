import { ROUND_NAMES, buildStandings, playerName, type League, type PlayoffSeries } from '../../engine';
import { TeamLogo } from '../common';
import { useUi } from '../uiContext';

export function PlayoffsTab({ league }: { league: League }) {
  const playoffs = league.playoffs;

  if (!playoffs) {
    const east = buildStandings(league, 'Est').slice(0, 8);
    const west = buildStandings(league, 'Ouest').slice(0, 8);
    return (
      <div className="panel">
        <div className="panel-title">Projection des playoffs</div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Les playoffs démarrent automatiquement à la fin de la saison régulière. Voici le tableau si
          elle s'arrêtait aujourd'hui.
        </p>
        <div className="grid grid-2">
          {[
            { label: 'Est', rows: east },
            { label: 'Ouest', rows: west },
          ].map(({ label, rows }) => (
            <div key={label}>
              <div className="panel-title">Conférence {label}</div>
              {[0, 1, 2, 3].map((i) => {
                const high = rows[i];
                const low = rows[7 - i];
                if (!high || !low) return null;
                return (
                  <div key={i} className="series">
                    <div className="series-team">
                      <span className="seed">{i + 1}</span>
                      <TeamLogo team={high.team} size={20} />
                      <span>{high.team.name}</span>
                      <span className="spacer" />
                      <span className="faint mono small">
                        {high.wins}-{high.losses}
                      </span>
                    </div>
                    <div className="series-team">
                      <span className="seed">{8 - i}</span>
                      <TeamLogo team={low.team} size={20} />
                      <span>{low.team.name}</span>
                      <span className="spacer" />
                      <span className="faint mono small">
                        {low.wins}-{low.losses}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const champion = league.teams.find((t) => t.id === playoffs.championId);
  const finalsMvp = playoffs.finalsMvpId ? league.players[playoffs.finalsMvpId] : null;

  return (
    <div className="grid" style={{ gap: 16 }}>
      {champion && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <h2 style={{ marginTop: 4 }}>
            {champion.city} {champion.name}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Champion {league.season}
            {finalsMvp && ` · MVP des finales : ${playerName(finalsMvp)}`}
          </p>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Tableau final</div>
        <div className="bracket">
          {playoffs.rounds.map((round, i) => (
            <div key={i} className="bracket-round">
              <div className="faint small" style={{ fontWeight: 650 }}>
                {ROUND_NAMES[i]}
              </div>
              {round.map((series) => (
                <SeriesCard key={series.id} league={league} series={series} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeriesCard({ league, series }: { league: League; series: PlayoffSeries }) {
  const ui = useUi();
  const high = league.teams.find((t) => t.id === series.highSeed.teamId)!;
  const low = league.teams.find((t) => t.id === series.lowSeed.teamId)!;
  const done = Boolean(series.winnerId);

  const line = (team: typeof high, seed: number, wins: number, isWinner: boolean) => (
    <div
      className={`series-team${done && isWinner ? ' winner' : ''}${done && !isWinner ? ' eliminated' : ''}`}
      onClick={() => ui.openTeam(team.id)}
      style={{ cursor: 'pointer' }}
    >
      <span className="seed">{seed}</span>
      <TeamLogo team={team} size={20} />
      <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
      <span className="mono" style={{ fontWeight: 700 }}>
        {wins}
      </span>
    </div>
  );

  return (
    <div className="series">
      {line(high, series.highSeed.seed, series.highWins, series.winnerId === high.id)}
      {line(low, series.lowSeed.seed, series.lowWins, series.winnerId === low.id)}
      {series.games.length > 0 && (
        <div className="small mono" style={{ marginTop: 4 }}>
          {/* Scores vus depuis la tête de série : vert si elle gagne, rouge sinon. */}
          {series.games.map((g, i) => {
            const highIsHome = g.homeId === series.highSeed.teamId;
            const highPts = highIsHome ? g.homeScore : g.awayScore;
            const lowPts = highIsHome ? g.awayScore : g.homeScore;
            return (
              <span key={i}>
                {i > 0 && <span className="faint"> · </span>}
                <span className={highPts > lowPts ? 'win' : 'loss'}>
                  {highPts}-{lowPts}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
