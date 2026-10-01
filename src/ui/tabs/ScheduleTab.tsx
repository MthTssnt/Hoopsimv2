import { useState } from 'react';
import type { Game, League, Team } from '../../engine';
import { store } from '../../state/store';
import { TeamLogo } from '../common';

export function ScheduleTab({ league, team }: { league: League; team: Team }) {
  const [scope, setScope] = useState<'team' | 'league'>('team');

  const teamGames = league.schedule.filter((g) => g.homeId === team.id || g.awayId === team.id);
  const lastPlayedDay = league.schedule.reduce((max, g) => (g.played ? Math.max(max, g.day) : max), -1);
  const [day, setDay] = useState(Math.max(0, lastPlayedDay));
  const dayGames = league.schedule.filter((g) => g.day === day);
  const maxDay = league.schedule.reduce((max, g) => Math.max(max, g.day), 0);

  return (
    <div className="panel">
      <div className="toolbar">
        <button className={`btn btn-sm${scope === 'team' ? ' btn-primary' : ''}`} onClick={() => setScope('team')}>
          Mon calendrier
        </button>
        <button className={`btn btn-sm${scope === 'league' ? ' btn-primary' : ''}`} onClick={() => setScope('league')}>
          Toute la ligue
        </button>
        {scope === 'league' && (
          <>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => setDay((d) => Math.max(0, d - 1))} disabled={day === 0}>
              ←
            </button>
            <span className="mono small">Journée {day + 1}</span>
            <button
              className="btn btn-sm"
              onClick={() => setDay((d) => Math.min(maxDay, d + 1))}
              disabled={day >= maxDay}
            >
              →
            </button>
          </>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">J</th>
              <th className="left">{scope === 'team' ? 'Adversaire' : 'Rencontre'}</th>
              <th>Score</th>
              <th className="left">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {(scope === 'team' ? teamGames : dayGames).map((g) => (
              <GameRow key={g.id} league={league} game={g} perspective={scope === 'team' ? team : null} />
            ))}
          </tbody>
        </table>
      </div>
      {scope === 'league' && dayGames.length === 0 && (
        <p className="muted small">Aucun match programmé ce jour-là.</p>
      )}
    </div>
  );
}

function GameRow({ league, game, perspective }: { league: League; game: Game; perspective: Team | null }) {
  const home = league.teams.find((t) => t.id === game.homeId)!;
  const away = league.teams.find((t) => t.id === game.awayId)!;
  const hasBox = Boolean(league.boxScores[game.id]);

  if (perspective) {
    const isHome = game.homeId === perspective.id;
    const opponent = isHome ? away : home;
    const own = (isHome ? game.homeScore : game.awayScore) ?? null;
    const other = (isHome ? game.awayScore : game.homeScore) ?? null;
    const won = own !== null && other !== null && own > other;

    return (
      <tr className={hasBox ? 'clickable' : ''} onClick={() => hasBox && store.showBoxScore(game)}>
        <td className="left faint mono">{game.day + 1}</td>
        <td className="left">
          <span className="row" style={{ gap: 8 }}>
            <span className="faint small" style={{ width: 26 }}>
              {isHome ? 'dom.' : '@'}
            </span>
            <TeamLogo team={opponent} size={22} />
            <span>{opponent.city} {opponent.name}</span>
            {game.seriesId && <span className="pill">playoffs</span>}
          </span>
        </td>
        <td className="mono">{game.played ? `${own}-${other}` : '—'}</td>
        <td className="left">
          {game.played ? (
            <span className={won ? 'win' : 'loss'} style={{ fontWeight: 700 }}>
              {won ? 'Victoire' : 'Défaite'}
            </span>
          ) : (
            <span className="faint">à venir</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className={hasBox ? 'clickable' : ''} onClick={() => hasBox && store.showBoxScore(game)}>
      <td className="left faint mono">{game.day + 1}</td>
      <td className="left">
        <span className="row" style={{ gap: 8 }}>
          <TeamLogo team={away} size={20} />
          <span>{away.abbr}</span>
          <span className="faint">@</span>
          <TeamLogo team={home} size={20} />
          <span>{home.abbr}</span>
        </span>
      </td>
      <td className="mono">{game.played ? `${game.awayScore}-${game.homeScore}` : '—'}</td>
      <td className="left faint">
        {game.played
          ? `${(game.awayScore ?? 0) > (game.homeScore ?? 0) ? away.abbr : home.abbr} l'emporte`
          : 'à venir'}
      </td>
    </tr>
  );
}
