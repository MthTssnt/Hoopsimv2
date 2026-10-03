import type { CSSProperties } from 'react';
import type { BoxRowView, BoxTeamView, BoxView } from '../boxView';

interface Props {
  /** Box score au moment de la pause (null hors 5 contre 5). */
  box: BoxView | null;
  onResume: () => void;
}

const backdrop: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(8, 11, 18, 0.55)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '56px 16px 16px',
  overflowY: 'auto',
};

const panel: CSSProperties = {
  width: 'min(980px, 100%)',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow)',
  padding: 16,
  color: 'var(--text)',
  fontSize: 13,
};

const swatch = (color: string): CSSProperties => ({
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: 2,
  background: color,
  marginRight: 6,
  verticalAlign: 'middle',
});

/** Score par période et fautes d'équipe de la période en cours. */
function ScoreTable({ box }: { box: BoxView }) {
  return (
    <div className="table-wrap" style={{ marginBottom: 14 }}>
      <table>
        <thead>
          <tr>
            <th className="left">Équipe</th>
            {box.periodLabels.map((label) => (
              <th key={label}>{label}</th>
            ))}
            <th>Total</th>
            <th>Fautes ({box.period})</th>
          </tr>
        </thead>
        <tbody>
          {box.teams.map((team) => (
            <tr key={team.abbr}>
              <td className="left">
                <span style={swatch(team.color)} />
                <strong>{team.name}</strong>
              </td>
              {team.periods.map((points, k) => (
                <td key={k}>{points}</td>
              ))}
              <td>
                <strong>{team.score}</strong>
              </td>
              <td>
                {team.fouls}
                {team.bonus && (
                  <span className="pill pill-accent" style={{ marginLeft: 6 }}>
                    bonus
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnergyBar({ value }: { value: number }) {
  const color = value >= 60 ? 'var(--win)' : value >= 35 ? '#f2b84b' : 'var(--loss)';
  return (
    <span title={`${value} %`} style={{ display: 'inline-block', width: 40, height: 6, background: 'var(--border)', borderRadius: 3, verticalAlign: 'middle' }}>
      <span style={{ display: 'block', width: `${value}%`, height: '100%', background: color, borderRadius: 3 }} />
    </span>
  );
}

function PlayerRow({ row }: { row: BoxRowView }) {
  const style: CSSProperties = row.fouledOut ? { opacity: 0.45 } : {};
  return (
    <tr style={style}>
      <td className="left">
        <span style={{ display: 'inline-block', width: 10, color: 'var(--accent)' }} title={row.onCourt ? 'Sur le terrain' : undefined}>
          {row.onCourt ? '●' : ''}
        </span>
        <span style={{ fontWeight: row.starter ? 650 : 400 }}>{row.name}</span>
        <span className="faint small" style={{ marginLeft: 6 }}>
          {row.position}
          {row.fouledOut ? ' · éliminé' : ''}
        </span>
      </td>
      <td>{row.minutes}</td>
      <td>
        <strong>{row.pts}</strong>
      </td>
      <td>{row.reb}</td>
      <td className="faint">
        {row.oreb}/{row.dreb}
      </td>
      <td>{row.ast}</td>
      <td>{row.stl}</td>
      <td>{row.blk}</td>
      <td>{row.tov}</td>
      <td>{row.pf}</td>
      <td>{row.fg}</td>
      <td>{row.three}</td>
      <td>{row.ft}</td>
      <td className={row.plusMinus.startsWith('-') ? 'loss' : row.plusMinus === '0' ? '' : 'win'}>{row.plusMinus}</td>
      <td>
        <EnergyBar value={row.energy} />
      </td>
    </tr>
  );
}

function TeamTable({ team }: { team: BoxTeamView }) {
  const t = team.totals;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 650, marginBottom: 6 }}>
        <span style={swatch(team.color)} />
        {team.name} <span className="faint">{team.score}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Joueur</th>
              <th>Min</th>
              <th>Pts</th>
              <th>Reb</th>
              <th title="Rebonds offensifs / défensifs">Off/Déf</th>
              <th>Pd</th>
              <th>Int</th>
              <th>Ctr</th>
              <th>BP</th>
              <th>F</th>
              <th>Tirs</th>
              <th>3 pts</th>
              <th>LF</th>
              <th>+/-</th>
              <th>Énergie</th>
            </tr>
          </thead>
          <tbody>
            {team.rows.map((row) => (
              <PlayerRow key={row.id} row={row} />
            ))}
            <tr>
              <td className="left">
                <strong>Total</strong>
              </td>
              <td />
              <td>
                <strong>{t.pts}</strong>
              </td>
              <td>{t.reb}</td>
              <td className="faint">
                {t.oreb}/{t.dreb}
              </td>
              <td>{t.ast}</td>
              <td>{t.stl}</td>
              <td>{t.blk}</td>
              <td>{t.tov}</td>
              <td>{t.pf}</td>
              <td>{t.fg}</td>
              <td>{t.three}</td>
              <td>{t.ft}</td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Menu pause, superposé au match comme le panneau des réglages : score par période, fautes
 * d'équipe, box score des deux équipes (titulaires en tête, ● sur le terrain, éliminés grisés).
 * Il ne fait qu'afficher la photo publiée par le match ; aucune logique de jeu ici.
 */
export function MatchPause({ box, onResume }: Props) {
  return (
    <div style={backdrop} onClick={onResume}>
      <div style={panel} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Pause</div>
          {box && (
            <div className="faint">
              {box.period} · {box.clock}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={onResume} autoFocus>
            Reprendre
          </button>
        </div>
        {box ? (
          <>
            <ScoreTable box={box} />
            {box.teams.map((team) => (
              <TeamTable key={team.abbr} team={team} />
            ))}
          </>
        ) : (
          <div className="faint">Le box score est tenu sur le match en 5 contre 5.</div>
        )}
        <div className="faint small" style={{ marginTop: 8 }}>
          Échap ou P pour reprendre.
        </div>
      </div>
    </div>
  );
}
