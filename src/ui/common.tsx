import type { ReactNode } from 'react';
import type { Player, Team } from '../engine';

export function TeamLogo({ team, size = 30 }: { team: { abbr: string; colors: { primary: string; secondary: string } }; size?: number }) {
  return (
    <span
      className="logo"
      style={{
        width: size,
        height: size,
        background: team.colors.primary,
        color: team.colors.secondary,
        fontSize: size * 0.36,
      }}
    >
      {team.abbr}
    </span>
  );
}

export function teamFullName(team: Team): string {
  return `${team.city} ${team.name}`;
}

export function fmt1(value: number): string {
  return value.toFixed(1);
}

/** Pourcentage à la française : « 47,3 % ». */
export function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')} %`;
}

/** Pourcentage court sans le signe, pour les tableaux denses. */
export function pctShort(value: number): string {
  return (value * 100).toFixed(1);
}

export function num(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function ratingColor(rating: number): string {
  if (rating >= 88) return '#facc15';
  if (rating >= 80) return '#34d399';
  if (rating >= 72) return '#60a5fa';
  if (rating >= 63) return '#a3adbd';
  return '#6a788c';
}

export function Rating({ value }: { value: number }) {
  return (
    <span className="mono" style={{ color: ratingColor(value), fontWeight: 700 }}>
      {value}
    </span>
  );
}

export function playerLabel(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={wide ? { maxWidth: 1040 } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>{title}</div>
          <button className="close-btn" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function StatTile({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-value" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

/** Barre de progression 0-99 utilisée pour les attributs. */
export function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="attr">
      <div>
        <div className="faint" style={{ fontSize: 11, marginBottom: 2 }}>
          {label}
        </div>
        <div className="bar">
          <div style={{ width: `${Math.min(100, value)}%`, background: ratingColor(value) }} />
        </div>
      </div>
      <div className="mono" style={{ textAlign: 'right', color: ratingColor(value), fontWeight: 650 }}>
        {value}
      </div>
    </div>
  );
}
