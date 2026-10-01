import { useEffect, useState } from 'react';
import { formatClock, playerName, totalReb, type GameBox, type League, type PlayEvent } from '../engine';
import type { WatchedGame } from '../state/store';
import { Modal, TeamLogo, num, signed } from './common';
import { useUi } from './uiContext';

const SPEEDS = [
  { label: 'Lent', ms: 320 },
  { label: 'Normal', ms: 130 },
  { label: 'Rapide', ms: 35 },
];

export function GameViewer({ league, watched, onClose }: { league: League; watched: WatchedGame; onClose: () => void }) {
  const { result } = watched;
  const box = result.box;
  const home = league.teams.find((t) => t.id === box.homeId)!;
  const away = league.teams.find((t) => t.id === box.awayId)!;
  const pbp = result.pbp;

  const [cursor, setCursor] = useState(pbp.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[1].ms);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= pbp.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCursor((c) => Math.min(pbp.length, c + 1)), speed);
    return () => clearTimeout(timer);
  }, [playing, cursor, speed, pbp.length]);

  const live = cursor < pbp.length;
  const current: PlayEvent | undefined = pbp[cursor - 1];
  const homeScore = live && current ? current.homeScore : box.homeScore;
  const awayScore = live && current ? current.awayScore : box.awayScore;
  const visible = pbp.slice(0, cursor);

  const title = (
    <div className="scoreline">
      <div className="scoreline-team">
        <TeamLogo team={away} size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650 }}>{away.name}</div>
          <div className="faint small">{away.city}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 14 }}>
        <span className="scoreline-score">{awayScore}</span>
        <span className="faint">—</span>
        <span className="scoreline-score">{homeScore}</span>
      </div>
      <div className="scoreline-team away">
        <TeamLogo team={home} size={34} />
        <div style={{ minWidth: 0, textAlign: 'right' }}>
          <div style={{ fontWeight: 650 }}>{home.name}</div>
          <div className="faint small">{home.city}</div>
        </div>
      </div>
    </div>
  );

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="table-wrap" style={{ marginBottom: 14 }}>
        <table>
          <thead>
            <tr>
              <th className="left">Score par période</th>
              {box.periods.map((_, i) => (
                <th key={i}>{i < 4 ? `Q${i + 1}` : `P${i - 3}`}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="left">{away.abbr}</td>
              {box.periods.map((p, i) => (
                <td key={i}>{p.away}</td>
              ))}
              <td>
                <strong>{box.awayScore}</strong>
              </td>
            </tr>
            <tr>
              <td className="left">{home.abbr}</td>
              {box.periods.map((p, i) => (
                <td key={i}>{p.home}</td>
              ))}
              <td>
                <strong>{box.homeScore}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {pbp.length > 0 && (
        <>
          <div className="toolbar">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                } else {
                  if (cursor >= pbp.length) setCursor(0);
                  setPlaying(true);
                }
              }}
            >
              {playing ? 'Pause' : cursor >= pbp.length ? 'Revivre le match' : 'Reprendre'}
            </button>
            <button className="btn btn-sm" onClick={() => { setPlaying(false); setCursor(pbp.length); }}>
              Voir le résultat final
            </button>
            <div className="spacer" />
            {SPEEDS.map((s) => (
              <button
                key={s.label}
                className={`btn btn-sm${speed === s.ms ? ' btn-primary' : ''}`}
                onClick={() => setSpeed(s.ms)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="pbp" style={{ marginBottom: 18 }}>
            {[...visible].reverse().slice(0, 200).map((event, i) => {
              const isPeriod = event.teamId === null;
              return (
                <div
                  key={visible.length - i}
                  className={`pbp-row${event.highlight ? ' highlight' : ''}${isPeriod ? ' period' : ''}`}
                >
                  <span className="pbp-clock">
                    {isPeriod ? '' : `Q${event.period} ${formatClock(event.clock)}`}
                  </span>
                  <span>
                    {!isPeriod && (
                      <span className="faint mono small" style={{ marginRight: 6 }}>
                        {league.teams.find((t) => t.id === event.teamId)?.abbr}
                      </span>
                    )}
                    {event.text}
                  </span>
                  <span className="pbp-score">
                    {event.awayScore}-{event.homeScore}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <BoxScoreTable league={league} box={box} teamId={box.awayId} />
      <BoxScoreTable league={league} box={box} teamId={box.homeId} />
    </Modal>
  );
}

function BoxScoreTable({ league, box, teamId }: { league: League; box: GameBox; teamId: string }) {
  const ui = useUi();
  const team = league.teams.find((t) => t.id === teamId)!;
  const rows = box.rows[teamId] ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      for (const key of Object.keys(acc) as (keyof typeof acc)[]) acc[key] += r.line[key];
      return acc;
    },
    { secs: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 },
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <TeamLogo team={team} size={22} />
        <strong>{team.city} {team.name}</strong>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Joueur</th>
              <th>Min</th>
              <th>Pts</th>
              <th>Tirs</th>
              <th>3 pts</th>
              <th>LF</th>
              <th>Rbds</th>
              <th>Pd</th>
              <th>Int</th>
              <th>Ctr</th>
              <th>BP</th>
              <th>F</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = league.players[row.playerId];
              const l = row.line;
              return (
                <tr key={row.playerId} className="clickable" onClick={() => p && ui.openPlayer(p.id)}>
                  <td className="left">
                    <span style={{ fontWeight: row.starter ? 650 : 400 }}>
                      {p ? playerName(p) : row.playerId}
                    </span>
                    <span className="faint small" style={{ marginLeft: 6 }}>
                      {p?.pos}
                      {row.starter ? ' ·' : ''}
                    </span>
                  </td>
                  <td>{num(l.secs / 60, 0)}</td>
                  <td>
                    <strong>{l.pts}</strong>
                  </td>
                  <td>
                    {l.fgm}/{l.fga}
                  </td>
                  <td>
                    {l.tpm}/{l.tpa}
                  </td>
                  <td>
                    {l.ftm}/{l.fta}
                  </td>
                  <td>{totalReb(l)}</td>
                  <td>{l.ast}</td>
                  <td>{l.stl}</td>
                  <td>{l.blk}</td>
                  <td>{l.tov}</td>
                  <td>{l.pf}</td>
                  <td className={l.plusMinus >= 0 ? 'win' : 'loss'}>{signed(l.plusMinus)}</td>
                </tr>
              );
            })}
            <tr>
              <td className="left faint">Total</td>
              <td className="faint">{num(totals.secs / 60, 0)}</td>
              <td>
                <strong>{totals.pts}</strong>
              </td>
              <td className="faint">
                {totals.fgm}/{totals.fga}
              </td>
              <td className="faint">
                {totals.tpm}/{totals.tpa}
              </td>
              <td className="faint">
                {totals.ftm}/{totals.fta}
              </td>
              <td className="faint">{totals.oreb + totals.dreb}</td>
              <td className="faint">{totals.ast}</td>
              <td className="faint">{totals.stl}</td>
              <td className="faint">{totals.blk}</td>
              <td className="faint">{totals.tov}</td>
              <td className="faint">{totals.pf}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
