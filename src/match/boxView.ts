import type { StatLine } from '../engine/types';
import { inBonus } from '../engine/rotation';
import { POSITION_SHORT } from './render/hud/hud';
import { formatClock, periodLabel } from './world/fullCourt';
import type { MatchWorld } from './world/MatchWorld';

/**
 * Box score du menu pause, prêt à afficher : une photo du match à l'instant de la pause, en
 * valeurs simples (le panneau React ne fait que les poser dans des tableaux, sans logique de jeu).
 */

export interface BoxRowView {
  id: string;
  name: string;
  position: string;
  starter: boolean;
  onCourt: boolean;
  fouledOut: boolean;
  /** Temps de jeu « m:ss ». */
  minutes: string;
  pts: number;
  reb: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  /** Réussis/tentés : tirs, 3 pts, lancers francs. */
  fg: string;
  three: string;
  ft: string;
  plusMinus: string;
  /** Énergie, 0 à 100. */
  energy: number;
}

export interface BoxTeamView {
  name: string;
  abbr: string;
  color: string;
  score: number;
  /** Points par période. */
  periods: number[];
  /** Fautes d'équipe de la période en cours. */
  fouls: number;
  /** En bonus : l'adversaire a plus de 5 fautes d'équipe, cette équipe tire des lancers sur toute faute. */
  bonus: boolean;
  rows: BoxRowView[];
  totals: Omit<BoxRowView, 'id' | 'name' | 'position' | 'starter' | 'onCourt' | 'fouledOut' | 'energy' | 'minutes' | 'plusMinus'>;
}

export interface BoxView {
  /** Période et chrono au moment de la pause. */
  period: string;
  clock: string;
  /** En-têtes des colonnes de périodes : QT1… QT4, P1… */
  periodLabels: string[];
  teams: BoxTeamView[];
}

/** Équipe telle que le rendu la nomme. */
export interface BoxTeamName {
  name: string;
  abbr: string;
  color: string;
}

const made = (m: number, a: number) => `${m}/${a}`;

export function formatMinutes(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function totalsOf(lines: readonly StatLine[]): BoxTeamView['totals'] {
  const sum = (key: keyof StatLine) => lines.reduce((s, l) => s + l[key], 0);
  return {
    pts: sum('pts'),
    reb: sum('oreb') + sum('dreb'),
    oreb: sum('oreb'),
    dreb: sum('dreb'),
    ast: sum('ast'),
    stl: sum('stl'),
    blk: sum('blk'),
    tov: sum('tov'),
    pf: sum('pf'),
    fg: made(sum('fgm'), sum('fga')),
    three: made(sum('tpm'), sum('tpa')),
    ft: made(sum('ftm'), sum('fta')),
  };
}

/**
 * Box score du match sur terrain entier, ou null (demi-terrain). Titulaires en tête (rangés par
 * poste), puis le banc dans l'ordre de la rotation.
 */
export function buildBoxView(world: MatchWorld, names: readonly BoxTeamName[]): BoxView | null {
  const full = world.full;
  const squads = world.squads;
  const box = world.box;
  if (!full || !squads || !box) return null;
  const periodCount = Math.max(...box.periods.map((p) => p.length), 1);
  const teams = squads.map((squad, team): BoxTeamView => {
    const members = [...squad.members].sort((a, b) => Number(b.starter) - Number(a.starter) || (a.starter ? a.posIndex - b.posIndex : 0));
    const rows = members.map(
      (m): BoxRowView => ({
        id: m.id,
        name: `${m.player.firstName.charAt(0)}. ${m.player.lastName}`,
        position: POSITION_SHORT[m.player.pos] ?? m.player.pos,
        starter: m.starter,
        onCourt: m.body !== null,
        fouledOut: m.fouledOut,
        minutes: formatMinutes(m.line.secs),
        pts: m.line.pts,
        reb: m.line.oreb + m.line.dreb,
        oreb: m.line.oreb,
        dreb: m.line.dreb,
        ast: m.line.ast,
        stl: m.line.stl,
        blk: m.line.blk,
        tov: m.line.tov,
        pf: m.line.pf,
        fg: made(m.line.fgm, m.line.fga),
        three: made(m.line.tpm, m.line.tpa),
        ft: made(m.line.ftm, m.line.fta),
        plusMinus: m.line.plusMinus > 0 ? `+${m.line.plusMinus}` : String(m.line.plusMinus),
        energy: Math.round(m.energy),
      }),
    );
    const periods = Array.from({ length: periodCount }, (_, k) => box.periods[team][k] ?? 0);
    return {
      ...names[team],
      score: world.points[team],
      periods,
      fouls: squad.fouls,
      bonus: inBonus(squads[1 - team].fouls),
      rows,
      totals: totalsOf(squad.members.map((m) => m.line)),
    };
  });
  return {
    period: periodLabel(full.period),
    clock: formatClock(full.clock),
    periodLabels: Array.from({ length: periodCount }, (_, k) => periodLabel(k + 1)),
    teams,
  };
}
