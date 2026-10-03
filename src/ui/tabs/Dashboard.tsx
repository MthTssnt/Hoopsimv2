import {
  buildStandings,
  mvpRace,
  nextUserGame,
  perGame,
  playerName,
  totalReb,
  userGameToday,
  winPct,
  type Game,
  type League,
  type Team,
} from '../../engine';
import { store } from '../../state/store';
import { Rating, StatTile, TeamLogo, num, signed, teamFullName } from '../common';
import { MatchButtons } from '../MatchButtons';
import { useUi } from '../uiContext';

export function Dashboard({
  league,
  team,
  onNavigate,
}: {
  league: League;
  team: Team;
  onNavigate: (tab: 'effectif' | 'calendrier' | 'classement' | 'stats' | 'playoffs') => void;
}) {
  const ui = useUi();
  const standings = buildStandings(league, team.conference);
  const rank = standings.find((r) => r.team.id === team.id)?.rank ?? 0;
  const diff = team.pointsFor - team.pointsAgainst;
  const games = team.wins + team.losses;

  // En playoffs, le match du soir n'est pas encore au calendrier.
  const upcoming = nextUserGame(league) ?? userGameToday(league);
  const recent = league.schedule
    .filter((g) => g.played && (g.homeId === team.id || g.awayId === team.id))
    .slice(-5)
    .reverse();

  const roster = team.roster.map((id) => league.players[id]).filter(Boolean);
  const scorers = [...roster]
    .filter((p) => p.stats.gp > 0)
    .sort((a, b) => perGame(b.stats, 'pts') - perGame(a.stats, 'pts'))
    .slice(0, 5);

  const race = mvpRace(league, 5);
  const feed = [...league.feed].slice(-12).reverse();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid grid-3">
        <StatTile value={`${team.wins}-${team.losses}`} label="Bilan" />
        <StatTile value={`${rank}${rank === 1 ? 'er' : 'e'}`} label={`Conférence ${team.conference}`} />
        <StatTile
          value={games ? signed(Math.round((diff / games) * 10) / 10) : '—'}
          label="Différentiel / match"
          tone={diff >= 0 ? 'var(--win)' : 'var(--loss)'}
        />
        <StatTile
          value={team.streak === 0 ? '—' : `${Math.abs(team.streak)} ${team.streak > 0 ? 'V' : 'D'}`}
          label="Série en cours"
          tone={team.streak > 0 ? 'var(--win)' : team.streak < 0 ? 'var(--loss)' : undefined}
        />
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-title">Prochain match</div>
          {upcoming ? (
            <NextGameCard league={league} team={team} game={upcoming} />
          ) : league.phase === 'offseason' ? (
            <p className="muted" style={{ margin: 0 }}>
              La saison est terminée. Lancez l'intersaison depuis la barre du haut.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Plus de match programmé pour votre équipe.
            </p>
          )}

          <div className="panel-title" style={{ marginTop: 20 }}>
            Derniers résultats
          </div>
          {recent.length === 0 && <p className="muted small" style={{ margin: 0 }}>Aucun match joué.</p>}
          {recent.map((g) => (
            <ResultRow key={g.id} league={league} team={team} game={g} />
          ))}
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => onNavigate('calendrier')}>
            Voir tout le calendrier
          </button>
        </div>

        <div className="panel">
          <div className="panel-title">Meilleurs joueurs de l'équipe</div>
          {scorers.length === 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              Les statistiques apparaîtront après le premier match.
            </p>
          )}
          {scorers.map((p) => (
            <div
              key={p.id}
              className="row"
              style={{ padding: '7px 0', borderBottom: '1px solid rgba(38,49,65,.5)', cursor: 'pointer' }}
              onClick={() => ui.openPlayer(p.id)}
            >
              <Rating value={p.overall} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{playerName(p)}</div>
                <div className="faint small">
                  {p.pos} · {p.age} ans · {p.archetype}
                </div>
              </div>
              <div className="mono small" style={{ textAlign: 'right' }}>
                <div>
                  <strong>{num(perGame(p.stats, 'pts'))}</strong> pts
                </div>
                <div className="faint">
                  {num(totalReb(p.stats) / p.stats.gp)} rbds · {num(perGame(p.stats, 'ast'))} pd
                </div>
              </div>
            </div>
          ))}

          <div className="panel-title" style={{ marginTop: 20 }}>
            Course au MVP
          </div>
          {race.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              Le classement s'ouvre après une vingtaine de matchs.
            </p>
          ) : (
            race.map((row, i) => (
              <div key={row.player.id} className="row small" style={{ padding: '4px 0' }}>
                <span className="faint mono" style={{ width: 16 }}>
                  {i + 1}
                </span>
                <button
                  className="btn btn-sm"
                  style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600 }}
                  onClick={() => ui.openPlayer(row.player.id)}
                >
                  {playerName(row.player)}
                </button>
                <span className="faint">{row.team?.abbr}</span>
                <div className="spacer" />
                <span className="mono faint">
                  {num(perGame(row.player.stats, 'pts'))} pts · {row.team ? `${row.team.wins}-${row.team.losses}` : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Actualité de la ligue</div>
        {feed.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Rien à signaler pour le moment.
          </p>
        ) : (
          feed.map((item, i) => (
            <div key={i} className="feed-item">
              <span className="faint mono small" style={{ marginRight: 8 }}>
                J{item.day + 1}
              </span>
              {item.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NextGameCard({ league, team, game }: { league: League; team: Team; game: Game }) {
  const isHome = game.homeId === team.id;
  const opponentId = isHome ? game.awayId : game.homeId;
  const opponent = league.teams.find((t) => t.id === opponentId)!;
  const inDays = game.day - league.day;

  return (
    <div>
      <div className="row">
        <TeamLogo team={opponent} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 650 }}>
            {isHome ? 'Reçoit' : 'Se déplace à'} {teamFullName(opponent)}
          </div>
          <div className="faint small">
            {opponent.wins}-{opponent.losses} · {(winPct(opponent.wins, opponent.losses) * 100).toFixed(0)} % de
            victoires
          </div>
        </div>
        <span className="pill pill-accent">{inDays <= 0 ? "Aujourd'hui" : `Dans ${inDays} j`}</span>
      </div>
      {inDays > 0 && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => store.simulateToNextUserGame()}>
          Avancer jusqu'au match
        </button>
      )}
      {inDays <= 0 && (
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <MatchButtons small />
        </div>
      )}
    </div>
  );
}

function ResultRow({ league, team, game }: { league: League; team: Team; game: Game }) {
  const isHome = game.homeId === team.id;
  const opponent = league.teams.find((t) => t.id === (isHome ? game.awayId : game.homeId))!;
  const own = (isHome ? game.homeScore : game.awayScore) ?? 0;
  const other = (isHome ? game.awayScore : game.homeScore) ?? 0;
  const won = own > other;
  const hasBox = Boolean(league.boxScores[game.id]);

  return (
    <div
      className="row"
      style={{ padding: '6px 0', borderBottom: '1px solid rgba(38,49,65,.5)', cursor: hasBox ? 'pointer' : 'default' }}
      onClick={() => hasBox && store.showBoxScore(game)}
    >
      <span className={`pill ${won ? 'win' : 'loss'}`} style={{ width: 24, textAlign: 'center' }}>
        {won ? 'V' : 'D'}
      </span>
      <span className="faint small">{isHome ? 'dom.' : 'ext.'}</span>
      <TeamLogo team={opponent} size={22} />
      <span className="small">{opponent.name}</span>
      <div className="spacer" />
      <span className="mono">
        {own}-{other}
      </span>
    </div>
  );
}
