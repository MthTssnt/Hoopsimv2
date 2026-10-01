import { useState } from 'react';
import {
  ROTATION_SIZE,
  minuteTargets,
  payroll,
  perGame,
  playerName,
  shootingPct,
  totalReb,
  type League,
  type Player,
  type Team,
} from '../../engine';
import { store } from '../../state/store';
import { Rating, num, pctShort } from '../common';
import { useUi } from '../uiContext';

type SortKey = 'overall' | 'pts' | 'reb' | 'ast' | 'min' | 'age' | 'pos';

export function RosterTab({ league, team }: { league: League; team: Team }) {
  const ui = useUi();
  const [sort, setSort] = useState<SortKey>('overall');

  const roster = team.roster.map((id) => league.players[id]).filter(Boolean);
  const rotationIds = team.rotation.filter((id) => league.players[id]);
  const rotation = rotationIds.map((id) => league.players[id]);
  const targets = minuteTargets(Math.max(rotation.length, 5)).map((s) => s / 60);
  const bench = roster.filter((p) => !rotationIds.includes(p.id));

  const move = (index: number, direction: -1 | 1) => {
    const next = [...rotationIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    store.setRotation(next);
  };

  const remove = (id: string) => {
    if (rotationIds.length <= 5) return;
    store.setRotation(rotationIds.filter((x) => x !== id));
  };

  const add = (id: string) => {
    if (rotationIds.length >= ROTATION_SIZE) return;
    store.setRotation([...rotationIds, id]);
  };

  const sorted = [...roster].sort((a, b) => {
    switch (sort) {
      case 'pts':
        return perGame(b.stats, 'pts') - perGame(a.stats, 'pts');
      case 'reb':
        return totalReb(b.stats) / Math.max(1, b.stats.gp) - totalReb(a.stats) / Math.max(1, a.stats.gp);
      case 'ast':
        return perGame(b.stats, 'ast') - perGame(a.stats, 'ast');
      case 'min':
        return perGame(b.stats, 'min') - perGame(a.stats, 'min');
      case 'age':
        return a.age - b.age;
      case 'pos':
        return a.pos.localeCompare(b.pos) || b.overall - a.overall;
      default:
        return b.overall - a.overall;
    }
  });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="panel-title" style={{ margin: 0 }}>
            Rotation — {rotation.length} joueurs
          </div>
          <div className="spacer" />
          <button className="btn btn-sm" onClick={() => store.resetRotation()}>
            Rotation automatique
          </button>
        </div>
        <p className="faint small" style={{ marginTop: 0 }}>
          L'ordre fixe le temps de jeu : les cinq premiers sont titulaires, et chaque place plus bas
          signifie moins de minutes. Les blessés sont automatiquement écartés.
        </p>

        <div className="grid grid-2">
          <div>
            {rotation.map((p, i) => (
              <div key={p.id} className={`rotation-slot${i < 5 ? ' starter' : ''}`}>
                <span className="faint mono" style={{ width: 18 }}>
                  {i + 1}
                </span>
                <Rating value={p.overall} />
                <button
                  onClick={() => ui.openPlayer(p.id)}
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', minWidth: 0, flex: 1 }}
                >
                  <span style={{ fontWeight: 600 }}>{playerName(p)}</span>
                  <span className="faint small" style={{ display: 'block' }}>
                    {p.pos} · {i < 5 ? 'titulaire' : 'remplaçant'} · ~{Math.round(targets[i] ?? 6)} min
                  </span>
                </button>
                {p.injuryGames > 0 && <span className="pill pill-injury">{p.injuryGames} m.</span>}
                <button className="btn btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter">
                  ↑
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => move(i, 1)}
                  disabled={i === rotation.length - 1}
                  aria-label="Descendre"
                >
                  ↓
                </button>
                <button className="btn btn-sm" onClick={() => remove(p.id)} disabled={rotation.length <= 5}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <div>
            <div className="panel-title">Hors rotation</div>
            {bench.length === 0 && <p className="faint small">Tout l'effectif est dans la rotation.</p>}
            {bench.map((p) => (
              <div key={p.id} className="rotation-slot">
                <Rating value={p.overall} />
                <button
                  onClick={() => ui.openPlayer(p.id)}
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', minWidth: 0, flex: 1 }}
                >
                  <span style={{ fontWeight: 600 }}>{playerName(p)}</span>
                  <span className="faint small" style={{ display: 'block' }}>
                    {p.pos} · {p.age} ans
                  </span>
                </button>
                {p.injuryGames > 0 ? (
                  <span className="pill pill-injury">{p.injuryLabel}</span>
                ) : (
                  <button className="btn btn-sm" onClick={() => add(p.id)} disabled={rotation.length >= ROTATION_SIZE}>
                    + Ajouter
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 8 }}>
          <div className="panel-title" style={{ margin: 0 }}>
            Effectif — {roster.length} joueurs
          </div>
          <div className="spacer" />
          <span className="faint small mono">masse salariale {num(payroll(league, team.id))} M€</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <Th label="Joueur" k={null} className="left" />
                <Th label="Poste" k="pos" sort={sort} onSort={setSort} />
                <Th label="Âge" k="age" sort={sort} onSort={setSort} />
                <Th label="Note" k="overall" sort={sort} onSort={setSort} />
                <th>Pot.</th>
                <th>MJ</th>
                <Th label="Min" k="min" sort={sort} onSort={setSort} />
                <Th label="Pts" k="pts" sort={sort} onSort={setSort} />
                <Th label="Rbds" k="reb" sort={sort} onSort={setSort} />
                <Th label="Pd" k="ast" sort={sort} onSort={setSort} />
                <th>Int</th>
                <th>Ctr</th>
                <th>%T</th>
                <th>%3</th>
                <th>Salaire</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <PlayerRow key={p.id} player={p} onOpen={() => ui.openPlayer(p.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  label,
  k,
  sort,
  onSort,
  className,
}: {
  label: string;
  k: SortKey | null;
  sort?: SortKey;
  onSort?: (k: SortKey) => void;
  className?: string;
}) {
  if (!k || !onSort) return <th className={className}>{label}</th>;
  return (
    <th
      className={`sortable${className ? ` ${className}` : ''}${sort === k ? ' sorted' : ''}`}
      onClick={() => onSort(k)}
    >
      {label}
    </th>
  );
}

function PlayerRow({ player, onOpen }: { player: Player; onOpen: () => void }) {
  const s = player.stats;
  const gp = Math.max(1, s.gp);
  return (
    <tr className="clickable" onClick={onOpen}>
      <td className="left">
        <span style={{ fontWeight: 600 }}>{playerName(player)}</span>
        {player.injuryGames > 0 && (
          <span className="pill pill-injury" style={{ marginLeft: 6 }}>
            {player.injuryGames} m.
          </span>
        )}
        <span className="faint small" style={{ display: 'block' }}>
          {player.archetype}
        </span>
      </td>
      <td>{player.pos}</td>
      <td>{player.age}</td>
      <td>
        <Rating value={player.overall} />
      </td>
      <td className="faint">{player.potential}</td>
      <td>{s.gp}</td>
      <td>{s.gp ? num(s.secs / 60 / gp) : '—'}</td>
      <td>
        <strong>{s.gp ? num(s.pts / gp) : '—'}</strong>
      </td>
      <td>{s.gp ? num(totalReb(s) / gp) : '—'}</td>
      <td>{s.gp ? num(s.ast / gp) : '—'}</td>
      <td>{s.gp ? num(s.stl / gp) : '—'}</td>
      <td>{s.gp ? num(s.blk / gp) : '—'}</td>
      <td>{s.fga ? pctShort(shootingPct(s.fgm, s.fga)) : '—'}</td>
      <td>{s.tpa ? pctShort(shootingPct(s.tpm, s.tpa)) : '—'}</td>
      <td className="faint">{num(player.contract.salary)} M</td>
    </tr>
  );
}
