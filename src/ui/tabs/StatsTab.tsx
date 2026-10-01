import { useMemo, useState } from 'react';
import {
  effectiveFg,
  leaders,
  playerName,
  shootingPct,
  totalReb,
  type League,
  type PerGameKey,
  type Player,
  type StatLine,
} from '../../engine';
import { Rating, TeamLogo, num, pctShort } from '../common';
import { useUi } from '../uiContext';

const CATEGORIES: { key: PerGameKey; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebonds' },
  { key: 'ast', label: 'Passes' },
  { key: 'stl', label: 'Interceptions' },
  { key: 'blk', label: 'Contres' },
  { key: 'tpm', label: '3 pts réussis' },
  { key: 'min', label: 'Minutes' },
];

type SortKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'min' | 'fg' | 'tp' | 'efg' | 'overall';

export function StatsTab({ league }: { league: League }) {
  const ui = useUi();
  const [category, setCategory] = useState<PerGameKey>('pts');
  const [playoffs, setPlayoffs] = useState(false);
  const [sort, setSort] = useState<SortKey>('pts');
  const [search, setSearch] = useState('');

  const hasPlayoffData = Object.values(league.players).some((p) => p.playoffStats.gp > 0);
  const usePlayoffs = playoffs && hasPlayoffData;
  const top = leaders(league, category, 0.4, 10, usePlayoffs);

  const rows = useMemo(() => {
    const line = (p: Player): StatLine => (usePlayoffs ? p.playoffStats : p.stats);
    const query = search.trim().toLowerCase();
    return Object.values(league.players)
      .filter((p) => p.teamId && line(p).gp > 0)
      .filter((p) => !query || playerName(p).toLowerCase().includes(query))
      .map((p) => {
        const s = line(p);
        const gp = Math.max(1, s.gp);
        return {
          player: p,
          team: league.teams.find((t) => t.id === p.teamId),
          s,
          gp: s.gp,
          pts: s.pts / gp,
          reb: totalReb(s) / gp,
          ast: s.ast / gp,
          stl: s.stl / gp,
          blk: s.blk / gp,
          min: s.secs / 60 / gp,
          fg: shootingPct(s.fgm, s.fga),
          tp: shootingPct(s.tpm, s.tpa),
          efg: effectiveFg(s),
        };
      })
      .sort((a, b) => (sort === 'overall' ? b.player.overall - a.player.overall : b[sort] - a[sort]))
      .slice(0, 120);
  }, [league, sort, search, usePlayoffs]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="panel">
        <div className="toolbar">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`btn btn-sm${category === c.key ? ' btn-primary' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
          {hasPlayoffData && (
            <>
              <div className="spacer" />
              <button className={`btn btn-sm${playoffs ? ' btn-primary' : ''}`} onClick={() => setPlayoffs((v) => !v)}>
                {playoffs ? 'Playoffs' : 'Saison régulière'}
              </button>
            </>
          )}
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 4 }}>
          {top.map((row, i) => (
            <div
              key={row.player.id}
              className="row clickable"
              style={{ padding: '5px 0', cursor: 'pointer' }}
              onClick={() => ui.openPlayer(row.player.id)}
            >
              <span className="faint mono" style={{ width: 18 }}>
                {i + 1}
              </span>
              {row.team && <TeamLogo team={row.team} size={20} />}
              <span style={{ fontWeight: 600, minWidth: 0, flex: 1 }}>{playerName(row.player)}</span>
              <span className="mono" style={{ fontWeight: 700 }}>
                {num(row.value)}
              </span>
            </div>
          ))}
          {top.length === 0 && <p className="muted small">Pas encore de statistiques.</p>}
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="panel-title" style={{ margin: 0 }}>
            Tous les joueurs
          </div>
          <div className="spacer" />
          <input
            className="input"
            placeholder="Rechercher un joueur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Joueur</th>
                <th className="left">Éq.</th>
                <Th label="Note" k="overall" sort={sort} onSort={setSort} />
                <th>MJ</th>
                <Th label="Min" k="min" sort={sort} onSort={setSort} />
                <Th label="Pts" k="pts" sort={sort} onSort={setSort} />
                <Th label="Rbds" k="reb" sort={sort} onSort={setSort} />
                <Th label="Pd" k="ast" sort={sort} onSort={setSort} />
                <Th label="Int" k="stl" sort={sort} onSort={setSort} />
                <Th label="Ctr" k="blk" sort={sort} onSort={setSort} />
                <Th label="%T" k="fg" sort={sort} onSort={setSort} />
                <Th label="%3" k="tp" sort={sort} onSort={setSort} />
                <Th label="%eFG" k="efg" sort={sort} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player.id} className="clickable" onClick={() => ui.openPlayer(r.player.id)}>
                  <td className="left" style={{ fontWeight: 600 }}>
                    {playerName(r.player)}
                    <span className="faint small" style={{ marginLeft: 6 }}>
                      {r.player.pos}
                    </span>
                  </td>
                  <td className="left faint">{r.team?.abbr}</td>
                  <td>
                    <Rating value={r.player.overall} />
                  </td>
                  <td>{r.gp}</td>
                  <td>{num(r.min)}</td>
                  <td>
                    <strong>{num(r.pts)}</strong>
                  </td>
                  <td>{num(r.reb)}</td>
                  <td>{num(r.ast)}</td>
                  <td>{num(r.stl)}</td>
                  <td>{num(r.blk)}</td>
                  <td>{r.s.fga ? pctShort(r.fg) : '—'}</td>
                  <td>{r.s.tpa ? pctShort(r.tp) : '—'}</td>
                  <td>{r.s.fga ? pctShort(r.efg) : '—'}</td>
                </tr>
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
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  onSort: (k: SortKey) => void;
}) {
  return (
    <th className={`sortable${sort === k ? ' sorted' : ''}`} onClick={() => onSort(k)}>
      {label}
    </th>
  );
}
