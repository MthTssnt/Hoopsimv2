import {
  formatMinutes,
  offenseRating,
  defenseRating,
  playerName,
  shootingPct,
  totalReb,
  type League,
  type Player,
  type StatLine,
} from '../engine';
import { AttrBar, Modal, Rating, TeamLogo, num, pctShort } from './common';

const ATTRIBUTE_GROUPS: { title: string; keys: [keyof Player['attrs'], string][] }[] = [
  {
    title: 'Attaque',
    keys: [
      ['inside', 'Près du cercle'],
      ['midRange', 'Mi-distance'],
      ['three', '3 points'],
      ['freeThrow', 'Lancers francs'],
      ['passing', 'Passe'],
      ['handling', 'Dribble'],
      ['standingDunk', 'Dunk arrêté'],
      ['drivingDunk', 'Dunk en mouvement'],
    ],
  },
  {
    title: 'Défense et rebond',
    keys: [
      ['interiorDef', 'Défense intérieure'],
      ['perimeterDef', 'Défense extérieure'],
      ['steal', 'Interception'],
      ['block', 'Contre'],
      ['defReb', 'Rebond défensif'],
      ['offReb', 'Rebond offensif'],
    ],
  },
  {
    title: 'Physique et mental',
    keys: [
      ['speed', 'Vitesse'],
      ['vertical', 'Détente'],
      ['strength', 'Force'],
      ['stamina', 'Endurance'],
      ['iq', 'QI basket'],
    ],
  },
];

export function PlayerModal({ league, player, onClose }: { league: League; player: Player; onClose: () => void }) {
  const team = league.teams.find((t) => t.id === player.teamId);

  const title = (
    <div className="row">
      {team && <TeamLogo team={team} size={38} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          #{player.number} {playerName(player)}
        </div>
        <div className="faint small">
          {player.pos} · {player.age} ans · {Math.floor(player.heightCm / 100)},{String(player.heightCm % 100).padStart(2, '0')} m ·{' '}
          {player.weightKg} kg · {player.archetype}
        </div>
      </div>
      <div className="spacer" />
      <div style={{ textAlign: 'right' }}>
        <Rating value={player.overall} />
        <div className="faint small">potentiel {player.potential}</div>
      </div>
    </div>
  );

  return (
    <Modal title={title} onClose={onClose} wide>
      {player.injuryGames > 0 && (
        <p className="pill pill-injury" style={{ marginTop: 0 }}>
          Blessure : {player.injuryLabel} — absent {player.injuryGames} match(s)
        </p>
      )}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="stat-tile">
          <div className="stat-tile-value">{offenseRating(player)}</div>
          <div className="stat-tile-label">Attaque</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{defenseRating(player)}</div>
          <div className="stat-tile-label">Défense</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{num(player.contract.salary)} M€</div>
          <div className="stat-tile-label">Contrat · {player.contract.years} an(s)</div>
        </div>
      </div>

      <div className="panel-title">Statistiques</div>
      <div className="table-wrap" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th className="left">Période</th>
              <th>MJ</th>
              <th>Titu.</th>
              <th>Min</th>
              <th>Pts</th>
              <th>Rbds</th>
              <th>Pd</th>
              <th>Int</th>
              <th>Ctr</th>
              <th>BP</th>
              <th>%T</th>
              <th>%3</th>
              <th>%LF</th>
            </tr>
          </thead>
          <tbody>
            <StatRow label={`Saison ${league.season}`} line={player.stats} />
            {player.playoffStats.gp > 0 && <StatRow label="Playoffs" line={player.playoffStats} />}
            {player.career.gp > player.stats.gp && <StatRow label="Carrière" line={player.career} />}
          </tbody>
        </table>
      </div>

      {player.career.titles > 0 && (
        <p className="small">
          🏆 {player.career.titles} titre{player.career.titles > 1 ? 's' : ''} de champion
        </p>
      )}

      <div className="panel-title">Attributs</div>
      <div className="grid grid-3">
        {ATTRIBUTE_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="faint small" style={{ fontWeight: 650, marginBottom: 6 }}>
              {group.title}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {group.keys.map(([key, label]) => (
                <AttrBar key={key} label={label} value={player.attrs[key]} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-title" style={{ marginTop: 18 }}>
        Répartition des tirs
      </div>
      <div className="row small" style={{ gap: 18 }}>
        <span>Près du cercle : {pctShort(player.tendencies.rim)} %</span>
        <span>Mi-distance : {pctShort(player.tendencies.mid)} %</span>
        <span>3 points : {pctShort(player.tendencies.three)} %</span>
      </div>
    </Modal>
  );
}

function StatRow({ label, line }: { label: string; line: StatLine }) {
  const gp = Math.max(1, line.gp);
  return (
    <tr>
      <td className="left">{label}</td>
      <td>{line.gp}</td>
      <td>{line.gs}</td>
      <td>{formatMinutes(line.secs, line.gp)}</td>
      <td>
        <strong>{num(line.pts / gp)}</strong>
      </td>
      <td>{num(totalReb(line) / gp)}</td>
      <td>{num(line.ast / gp)}</td>
      <td>{num(line.stl / gp)}</td>
      <td>{num(line.blk / gp)}</td>
      <td>{num(line.tov / gp)}</td>
      <td>{line.fga ? pctShort(shootingPct(line.fgm, line.fga)) : '—'}</td>
      <td>{line.tpa ? pctShort(shootingPct(line.tpm, line.tpa)) : '—'}</td>
      <td>{line.fta ? pctShort(shootingPct(line.ftm, line.fta)) : '—'}</td>
    </tr>
  );
}
