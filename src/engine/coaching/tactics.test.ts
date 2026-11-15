import { describe, expect, it } from 'vitest';
import { createNewGame } from '../index';
import { simulateGame } from '../simGame';
import { Rng } from '../rng';
import type { GamePlan, OffenseStyle } from '../gamePlan';
import { prepareTactics, pickPlay, resolvePossessionTactics, scoutLineup } from './tactics';
import { boxMetrics } from './analytics';

const league = createNewGame('bos', 31);
const [home, away] = league.teams;
const five = (side = home) => side.gamePlan!.rotation.starterIds.map(id => league.players[id]);
function measure(style: OffenseStyle, change?: (plan: GamePlan, opponent: GamePlan) => void, count = 60) {
  const totals = { possessions: 0, rim: 0, three: 0, mid: 0, fga: 0, fgm: 0, ast: 0, oreb: 0, pf: 0, tov: 0, leaderFga: 0, energy: 0 };
  const leader = [...five()].sort((a, b) => b.tendencies.usage - a.tendencies.usage)[0];
  for (let seed = 1; seed <= count; seed++) {
    const players = structuredClone(league.players);
    const plan = structuredClone(home.gamePlan!), opponent = structuredClone(away.gamePlan!);
    plan.offense = style; change?.(plan, opponent);
    const result = simulateGame(new Rng(seed), `test-${seed}`, { ...home, gamePlan: plan }, { ...away, gamePlan: opponent }, players);
    const report = result.box.tactics!.teams[home.id];
    totals.possessions += report.possessions!;
    totals.rim += report.shots!.rim; totals.three += report.shots!.three; totals.mid += report.shots!.mid;
    for (const row of result.box.rows[home.id]) { totals.fga += row.line.fga; totals.fgm += row.line.fgm; totals.ast += row.line.ast; totals.oreb += row.line.oreb; }
    for (const row of result.box.rows[away.id]) { totals.pf += row.line.pf; }
    totals.tov += result.box.rows[home.id].reduce((s, r) => s + r.line.tov, 0);
    totals.leaderFga += result.box.rows[home.id].find(r => r.playerId === leader.id)?.line.fga ?? 0;
    totals.energy += Object.values(players).filter(p => p.teamId === away.id).reduce((s, p) => s + p.energy, 0);
  }
  return totals;
}

describe('contrats tactiques et intégrité des compteurs', () => {
  it('normalise une seule fois et ne sélectionne jamais les poids nuls', () => {
    const p = prepareTactics({ ...home.gamePlan!, playbook: [{ playId: 'fiveOut', weight: 0 }, { playId: 'horns', weight: 2 }, { playId: 'postEntry', weight: 6 }] });
    expect(p.plays.reduce((s, p) => s + p.weight, 0)).toBe(1);
    const rng = new Rng(8), ids = Array.from({ length: 2000 }, () => pickPlay(p, rng));
    expect(ids).not.toContain('fiveOut');
    expect(ids.filter(x => x === 'postEntry').length / ids.length).toBeGreaterThan(0.7);
    expect(ids.filter(x => x === 'postEntry').length / ids.length).toBeLessThan(0.8);
  });
  it('normalise les grands poids finis et refuse un playbook vide', () => {
    const p = prepareTactics({ ...home.gamePlan!, playbook: [{ playId: 'horns', weight: 1e308 }, { playId: 'fiveOut', weight: 1e308 }] });
    expect(p.plays.map(p => p.weight)).toEqual([0.5, 0.5]);
    expect(() => prepareTactics({ ...home.gamePlan!, playbook: [{ playId: 'horns', weight: 0 }] })).toThrow();
    expect(() => prepareTactics({ ...home.gamePlan!, defense: 'press' })).toThrow();
  });
  it('est déterministe, borné et sans mutation des plans/joueurs', () => {
    const snapshot = JSON.stringify(league);
    for (const offense of ['balanced', 'paceSpace', 'motion', 'pickRoll', 'insideOut', 'isolation'] as const) {
      for (const defense of ['man', 'switch', 'drop'] as const) {
        const off = prepareTactics({ ...home.gamePlan!, offense, threePointFocus: 100, rimPressure: 0 });
        const def = prepareTactics({ ...away.gamePlan!, defense, defensivePressure: 100 });
        const a = resolvePossessionTactics(off, def, five(), five(away), new Rng(919));
        expect(a).toEqual(resolvePossessionTactics(off, def, five(), five(away), new Rng(919)));
        expect(five().some(p => p.id === a.handlerId)).toBe(true);
        expect(Object.values(a.zoneWeights).every(v => Number.isFinite(v) && v >= 0.35 && v <= 2.5)).toBe(true);
        expect(a.turnoverFactor).toBeGreaterThanOrEqual(0.7);
        expect(a.turnoverFactor).toBeLessThanOrEqual(1.4);
      }
    }
    expect(JSON.stringify(league)).toBe(snapshot);
    expect(() => resolvePossessionTactics(prepareTactics(), prepareTactics(), [], five(), new Rng(1))).toThrow();
    expect(scoutLineup([])).toEqual({ strengths: [], weaknesses: [] });
  });
  it('conserve les comptes de tirs, points, possessions et pertes, et le rapport historique', () => {
    const plan = { ...home.gamePlan!, offense: 'pickRoll' as const };
    const a = simulateGame(new Rng(9), 'accounting', { ...home, gamePlan: plan }, away, structuredClone(league.players));
    const b = simulateGame(new Rng(9), 'accounting', { ...home, gamePlan: plan }, away, structuredClone(league.players));
    expect(a).toEqual(b);
    for (const id of [home.id, away.id]) {
      const report = a.box.tactics!.teams[id];
      const rows = a.box.rows[id];
      const total = (key: keyof typeof rows[number]['line']) => rows.reduce((s, r) => s + r.line[key], 0);
      expect(Object.values(report.shots!).reduce((s, n) => s + n)).toBe(total('fga'));
      expect(report.shots!.three).toBe(total('tpa'));
      expect(Object.values(report.plays!).reduce((s, p) => s + p!.points, 0)).toBe(total('pts'));
      expect(Object.values(report.plays!).reduce((s, p) => s + p!.turnovers, 0)).toBe(total('tov'));
      expect(Object.values(report.plays!).reduce((s, p) => s + p!.possessions, 0)).toBe(report.possessions);
      for (const { line: l } of rows) { expect(l.pts).toBe(2 * l.fgm + l.tpm + l.ftm); expect(l.fgm).toBeLessThanOrEqual(l.fga); }
      expect(boxMetrics(a.box, id).estimated).toBe(false);
    }
    plan.rotation.minutesByPlayerId = {};
    expect(Object.keys(a.box.tactics!.teams[home.id].targetMinutes).length).toBeGreaterThan(0);
    const legacy = structuredClone(a.box); delete legacy.tactics;
    expect(boxMetrics(legacy, home.id).estimated).toBe(true);
  });
});

describe('causalité par graines appariées', () => {
  const balanced = measure('balanced');
  it('Pace & Space accélère et augmente la part des 3 points', () => {
    const fast = measure('paceSpace');
    expect(fast.possessions).toBeGreaterThan(balanced.possessions * 1.07);
    expect(fast.three / fast.fga).toBeGreaterThan(balanced.three / balanced.fga + 0.08);
  });
  it('Motion augmente les tirs assistés ; Inside-Out privilégie le cercle', () => {
    const motion = measure('motion'), inside = measure('insideOut');
    expect(motion.ast / motion.fgm).toBeGreaterThan(balanced.ast / balanced.fgm + 0.03);
    expect(inside.rim / inside.fga).toBeGreaterThan(balanced.rim / balanced.fga + 0.06);
  });
  it('Isolation concentre les tirs et réduit les passes décisives', () => {
    const iso = measure('isolation');
    expect(iso.leaderFga / iso.fga).toBeGreaterThan(balanced.leaderFga / balanced.fga + 0.08);
    expect(iso.ast / iso.fgm).toBeLessThan(balanced.ast / balanced.fgm - 0.08);
  });
  it('Drop déplace les tirs du Pick & Roll vers l’extérieur ; Switch change réellement le défenseur', () => {
    const normal = measure('pickRoll'), drop = measure('pickRoll', (_, d) => { d.defense = 'drop'; });
    expect(drop.rim / drop.fga).toBeLessThan(normal.rim / normal.fga - 0.03);
    const a = resolvePossessionTactics(prepareTactics({ ...home.gamePlan!, offense: 'pickRoll' }), prepareTactics({ ...away.gamePlan!, defense: 'switch' }), five(), five(away), new Rng(1));
    expect(five(away).some(p => p.id === a.switchedDefenderId)).toBe(true);
  });
  it('les curseurs de rythme et de zones changent les possessions et tirs', { timeout: 15000 }, () => {
    const low = measure('balanced', p => { p.threePointFocus = 0; p.rimPressure = 100; p.offensiveReboundAggression = 0; p.pace = 0; });
    const high = measure('balanced', p => { p.threePointFocus = 100; p.rimPressure = 0; p.offensiveReboundAggression = 100; p.pace = 100; });
    expect(high.three / high.fga).toBeGreaterThan(low.three / low.fga + 0.12);
    expect(high.possessions).toBeGreaterThan(low.possessions * 1.2);
  });
  it('aide et pression changent les tirs adverses, pertes, fautes et fatigue', { timeout: 15000 }, () => {
    const helpLow = measure('balanced', (_, d) => { d.defensiveHelp = 0; });
    const helpHigh = measure('balanced', (_, d) => { d.defensiveHelp = 100; });
    expect(helpHigh.rim / helpHigh.fga).toBeLessThan(helpLow.rim / helpLow.fga);
    const pressureLow = measure('balanced', (_, d) => { d.defensivePressure = 0; });
    const pressureHigh = measure('balanced', (_, d) => { d.defensivePressure = 100; });
    expect(pressureHigh.tov / pressureHigh.possessions).toBeGreaterThan(pressureLow.tov / pressureLow.possessions);
    expect(pressureHigh.pf).toBeGreaterThan(pressureLow.pf);
    expect(pressureHigh.energy).toBeLessThan(pressureLow.energy);
  });
  it('attaquer davantage le rebond augmente les secondes chances', { timeout: 15000 }, () => {
    const glassLow = measure('balanced', p => { p.offensiveReboundAggression = 0; });
    const glassHigh = measure('balanced', p => { p.offensiveReboundAggression = 100; });
    expect(glassHigh.oreb / glassHigh.fga).toBeGreaterThan(glassLow.oreb / glassLow.fga);
  });
});
