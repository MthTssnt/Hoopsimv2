import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ACTION_LABELS, ACTIONS, keyLabel, rebind, type Action } from '../input/bindings';
import { DEFAULT_SETTINGS, QUARTER_MINUTES, type MatchSettings } from '../settings';

interface Props {
  settings: MatchSettings;
  onChange: (next: MatchSettings) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const panel: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  width: 340,
  maxHeight: 'calc(100vh - 24px)',
  overflowY: 'auto',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow)',
  padding: 16,
  color: 'var(--text)',
  fontSize: 13,
};

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' };

function Choice<T extends string>({ value, options, onPick }: { value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(([v, label]) => (
        <button key={v} className={`btn btn-sm${v === value ? ' btn-primary' : ''}`} onClick={() => onPick(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 650, marginBottom: 6 }}>{title}</div>
      {children}
      {hint && <div style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/** Panneau de réglages du match, superposé au canvas. Aucune logique de jeu ici. */
export function MatchSettingsPanel({ settings, onChange, open, onOpenChange }: Props) {
  const [listening, setListening] = useState<Action | null>(null);

  // Attente d'une touche : on la capte avant Phaser, Échap annule.
  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key !== 'Escape') {
        onChange({ ...settings, bindings: rebind(settings.bindings, listening, { code: event.keyCode, label: keyLabel(event.key) }) });
      }
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, settings, onChange]);

  if (!open) {
    return (
      <button className="btn btn-sm" style={{ position: 'absolute', top: 12, right: 12 }} onClick={() => onOpenChange(true)}>
        ⚙ Paramètres
      </button>
    );
  }

  const set = <K extends keyof MatchSettings>(key: K, value: MatchSettings[K]) => onChange({ ...settings, [key]: value });

  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Paramètres du match</div>
        <button className="btn btn-sm" onClick={() => onOpenChange(false)}>
          Fermer
        </button>
      </div>

      <Section title="Touches" hint="Clique sur une touche puis appuie sur la nouvelle. Échap pour annuler.">
        {ACTIONS.map((action) => (
          <div key={action} style={row}>
            <span style={{ flex: 1, color: 'var(--text-dim)' }}>{ACTION_LABELS[action]}</span>
            <button
              className={`btn btn-sm${listening === action ? ' btn-primary' : ''}`}
              style={{ minWidth: 96 }}
              onClick={() => setListening(action)}
            >
              {listening === action ? 'Appuie…' : settings.bindings[action].label}
            </button>
          </div>
        ))}
      </Section>

      <Section title="Mode de tir" hint="Timing : le moment du lâcher compte surtout. Real Player % : la zone verte s'élargit avec la stat de tir.">
        <Choice
          value={settings.shotMode}
          options={[
            ['timing', 'Timing'],
            ['realPct', 'Real Player %'],
          ]}
          onPick={(v) => set('shotMode', v)}
        />
      </Section>

      <Section title="Vitesse de tir" hint="Règle aussi la durée du saut : le sommet tombe à la fin de la jauge.">
        <Choice
          value={settings.shotSpeed}
          options={[
            ['slow', 'Lente'],
            ['normal', 'Normale'],
            ['fast', 'Rapide'],
          ]}
          onPick={(v) => set('shotSpeed', v)}
        />
      </Section>

      <Section title="Durée d'un quart-temps" hint="Chrono réel, en 5 contre 5. S'applique à partir du quart-temps suivant.">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUARTER_MINUTES.map((m) => (
            <button key={m} className={`btn btn-sm${m === settings.quarterMinutes ? ' btn-primary' : ''}`} onClick={() => set('quarterMinutes', m)}>
              {m} min
            </button>
          ))}
        </div>
      </Section>

      <Section title="Niveau" hint="Change la ligne à 3 points et la largeur de la raquette.">
        <Choice
          value={settings.level}
          options={[
            ['pro', 'Pro'],
            ['college', 'College'],
          ]}
          onPick={(v) => set('level', v)}
        />
      </Section>

      <Section title="Caméra (test)" hint="Compare le scintillement du pixel-art quand la caméra dézoome. Touche C en jeu.">
        <Choice
          value={settings.camera}
          options={[
            ['free', 'Zoom libre'],
            ['steps', 'Zoom par paliers'],
          ]}
          onPick={(v) => set('camera', v)}
        />
      </Section>

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-sm" onClick={() => onChange(DEFAULT_SETTINGS)}>
          Réinitialiser
        </button>
      </div>
    </div>
  );
}
