import { useMemo, useState } from 'react';
import { createNewGame, randomSeed, teamStrength, type League } from '../engine';
import { store } from '../state/store';
import { Rating, TeamLogo, playerLabel, teamFullName } from './common';

const CONFERENCES = ['Est', 'Ouest'] as const;

export function NewGameScreen({ onLoad, hasSave }: { onLoad: () => void; hasSave: boolean }) {
  const [seed, setSeed] = useState(() => randomSeed());
  const [selected, setSelected] = useState<string | null>(null);

  // On génère la ligue en avance : la même graine reproduit exactement
  // les mêmes effectifs, l'aperçu est donc fidèle à la partie lancée.
  const preview: League = useMemo(() => createNewGame('bos', seed), [seed]);

  const rows = useMemo(() => {
    return preview.teams.map((team) => {
      const players = team.roster.map((id) => preview.players[id]);
      const best = players.reduce((a, b) => (b.overall > a.overall ? b : a));
      return { team, strength: teamStrength(players), best };
    });
  }, [preview]);

  return (
    <div className="start">
      <div className="start-inner">
        <div className="start-title">
          Hoop<span>Sim</span>
        </div>
        <p className="muted" style={{ marginTop: 0, maxWidth: 640 }}>
          Prenez les commandes d'une franchise : composez votre rotation, simulez la saison match par
          match, suivez les statistiques de vos joueurs et visez le titre.
        </p>

        <div className="toolbar" style={{ marginTop: 18 }}>
          <button className="btn" onClick={() => setSeed(randomSeed())}>
            Générer une autre ligue
          </button>
          <span className="faint small mono">graine {seed}</span>
          <div className="spacer" />
          {hasSave && (
            <button className="btn" onClick={onLoad}>
              Reprendre la partie sauvegardée
            </button>
          )}
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => selected && store.newGame(selected, seed)}
          >
            {selected
              ? `Diriger ${teamFullName(preview.teams.find((t) => t.id === selected)!)}`
              : 'Choisissez une équipe'}
          </button>
        </div>

        {CONFERENCES.map((conference) => (
          <div key={conference}>
            <div className="conf-header">Conférence {conference}</div>
            <div className="team-grid">
              {rows
                .filter((r) => r.team.conference === conference)
                .sort((a, b) => b.strength - a.strength)
                .map(({ team, strength, best }) => (
                  <button
                    key={team.id}
                    className={`team-card${selected === team.id ? ' selected' : ''}`}
                    onClick={() => setSelected(team.id)}
                  >
                    <TeamLogo team={team} size={34} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 650, fontSize: 13 }}>{team.name}</span>
                      <span className="faint" style={{ display: 'block', fontSize: 11 }}>
                        {team.city}
                      </span>
                      <span className="small faint" style={{ display: 'block', marginTop: 2 }}>
                        <Rating value={Math.round(strength)} /> · {playerLabel(best)}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
