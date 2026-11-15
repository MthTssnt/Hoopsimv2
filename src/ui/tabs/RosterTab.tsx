import { useState } from 'react';
import {
  payroll,
  perGame,
  playerName,
  shootingPct,
  totalReb,
  type League,
  type Player,
  type Team,
} from '../../engine';
import { eligibleIds } from '../../engine/gamePlan';
import { CoachingEditor } from './CoachingEditor';
import { Rating, num, pctShort } from '../common';
import { useUi } from '../uiContext';

type SortKey = 'overall' | 'pts' | 'reb' | 'ast' | 'min' | 'age' | 'pos';

export function RosterTab({ league, team }: { league: League; team: Team }) {
  const ui = useUi();
  const [sort, setSort] = useState<SortKey>('overall');

  const roster = team.roster.map((id) => league.players[id]).filter(Boolean);
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
      {team.coachingWarnings?.map(warning => <p role="status" key={warning}>{warning}</p>)}
      {eligibleIds(team, league.players).length >= 5 ? <CoachingEditor key={JSON.stringify(team.gamePlan)} league={league} team={team} /> : <p role="alert">Moins de cinq joueurs aptes : le plan est conservé. Attendez leur retour pour modifier le coaching ou lancer un match GM.</p>}

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
