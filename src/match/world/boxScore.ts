import type { StatLine } from '../../engine/types';

/**
 * Box score en direct d'un match joué : une `StatLine` du moteur par joueur de la rotation, plus
 * les points par période. Le monde signale les faits (tir lâché, panier, rebond, perte…), ces
 * règles d'attribution les comptent comme la simulation compte les siens (`simGame`).
 */

export const BOX_RULES = {
  /** Passe décisive : le receveur tire moins de (s) après avoir reçu le ballon. */
  assistWindow: 4,
} as const;

/** Un joueur vu par le box score : sa ligne, et s'il est sur le terrain. */
export interface BoxMember {
  line: StatLine;
  body: number | null;
}

/** Valeur d'un tir : 1 (lancer franc), 2 ou 3 points. */
export type ShotValue = 1 | 2 | 3;

export class LiveBox {
  /** Points de chaque équipe, période par période. */
  readonly periods: number[][] = [[], []];
  /** Tir raté en attente de rebond : équipe du tireur, ou null. */
  private reboundFor: number | null = null;

  /** `squads[team]` : les joueurs de chaque équipe (lignes partagées avec la rotation). */
  private readonly squads: readonly (readonly BoxMember[])[];

  constructor(squads: readonly (readonly BoxMember[])[]) {
    this.squads = squads;
  }

  /** Nouvelle période : une case de points de plus pour chaque équipe. */
  startPeriod(): void {
    for (const p of this.periods) p.push(0);
  }

  /** Tir lâché : tentative (un lancer franc compte à part). */
  attempt(shooter: BoxMember, value: ShotValue): void {
    const line = shooter.line;
    if (value === 1) {
      line.fta += 1;
      return;
    }
    line.fga += 1;
    if (value === 3) line.tpa += 1;
  }

  /** Tir raté sur lequel une faute donne des lancers : il ne compte pas comme tenté (règle des stats, comme la simulation). */
  cancelAttempt(shooter: BoxMember, value: 2 | 3): void {
    const line = shooter.line;
    line.fga = Math.max(0, line.fga - 1);
    if (value === 3) line.tpa = Math.max(0, line.tpa - 1);
  }

  /**
   * Panier valable de l'équipe `team` : points et réussite au tireur, passe décisive au passeur,
   * +/- des dix joueurs sur le terrain, points de la période.
   */
  scored(team: number, shooter: BoxMember, value: ShotValue, passer: BoxMember | null = null): void {
    const line = shooter.line;
    line.pts += value;
    if (value === 1) line.ftm += 1;
    else {
      line.fgm += 1;
      if (value === 3) line.tpm += 1;
      if (passer && passer !== shooter) passer.line.ast += 1;
    }
    this.squads.forEach((members, t) => {
      for (const m of members) if (m.body !== null) m.line.plusMinus += t === team ? value : -value;
    });
    const periods = this.periods[team];
    if (periods.length === 0) this.startPeriod();
    periods[periods.length - 1] += value;
    this.reboundFor = null;
  }

  /** Tir raté (ou contré) de l'équipe `team` : le prochain qui prend le ballon a le rebond. */
  missed(team: number): void {
    this.reboundFor = team;
  }

  /** Un rebond est-il en jeu ? */
  get reboundPending(): boolean {
    return this.reboundFor !== null;
  }

  /** Ballon pris par `member` de l'équipe `team` : rebond offensif ou défensif s'il y a un tir raté en jeu. */
  gained(team: number, member: BoxMember): void {
    if (this.reboundFor === null) return;
    if (team === this.reboundFor) member.line.oreb += 1;
    else member.line.dreb += 1;
    this.reboundFor = null;
  }

  /** Ballon mort (sortie, faute, violation, fin de période) : plus de rebond à prendre. */
  dead(): void {
    this.reboundFor = null;
  }

  block(blocker: BoxMember): void {
    blocker.line.blk += 1;
  }

  /** Perte de balle de `loser`, et interception (vol) pour `thief` s'il y en a un. */
  turnover(loser: BoxMember, thief: BoxMember | null): void {
    loser.line.tov += 1;
    if (thief) thief.line.stl += 1;
  }

  foul(fouler: BoxMember): void {
    fouler.line.pf += 1;
  }

  /** Points d'une équipe d'après les lignes (doit égaler le score). */
  teamPoints(team: number): number {
    return this.squads[team].reduce((s, m) => s + m.line.pts, 0);
  }
}
