import { describe, expect, it } from 'vitest';
import { createNewGame } from './index';
import { defaultGamePlan, distributeMinutes, repairGamePlan, validateGamePlan } from './gamePlan';
import { migrateLeague } from './migrate';

function legacy() {
  const league = createNewGame('bos', 8126);
  delete league.schemaVersion;
  for (const team of league.teams) delete team.gamePlan;
  return JSON.parse(JSON.stringify(league)) as typeof league;
}

describe('migration v2 des carrières', () => {
  it('préserve les données historiques et le RNG, avec plans des 30 équipes, sans changer la clé v1', () => {
    const league = legacy();
    league.day = 23;
    const snapshot = JSON.parse(JSON.stringify(league));
    migrateLeague(league);
    expect(league.schemaVersion).toBe(2);
    expect(league.day).toBe(23);
    expect(league.players).toEqual(snapshot.players);
    expect(league.rngState).toBe(snapshot.rngState);
    expect(league.schedule).toEqual(snapshot.schedule);
    for (const t of league.teams) expect(validateGamePlan(t.gamePlan, t, league.players)).toEqual([]);
    const once = JSON.stringify(league);
    migrateLeague(league);
    expect(JSON.stringify(league)).toBe(once);
  });
  it('remplace les blessés et joueurs transférés sans changer leurs fiches', () => {
    const league = legacy();
    const team = league.teams[0], other = league.teams[1];
    league.players[team.rotation[0]].injuryGames = 4;
    const transferred = league.players[team.rotation[1]];
    transferred.teamId = other.id;
    migrateLeague(league);
    expect(team.gamePlan!.rotation.starterIds).not.toContain(transferred.id);
    expect(validateGamePlan(team.gamePlan, team, league.players)).toEqual([]);
    expect(other.roster).toContain(transferred.id);
    expect(league.players[team.rotation[0]].injuryGames).toBe(0);
  });
  it('répare les effectifs imparfaits et ne supprime pas une carrière décimée', () => {
    const league = legacy(), team = league.teams[0];
    team.roster.push(team.roster[0], 'fantôme');
    team.rotation.push(team.rotation[0], 'fantôme');
    migrateLeague(league);
    expect(new Set(team.roster).size).toBe(team.roster.length);
    expect(validateGamePlan(team.gamePlan, team, league.players)).toEqual([]);
    for (const id of team.roster) league.players[id].injuryGames = 3;
    expect(() => migrateLeague(league)).not.toThrow();
    expect(repairGamePlan(team, league.players)[0]).toContain('Moins de cinq');
  });
});

describe('contrat de plan', () => {
  it('refuse doublons, étrangers, blessures, NaN, minutes et stratégies invalides', () => {
    const league = createNewGame('bos', 8), team = league.teams[0];
    const valid = defaultGamePlan(team, league.players);
    const bad = [
      (p: typeof valid) => { p.rotation.starterIds[1] = p.rotation.starterIds[0]; },
      (p: typeof valid) => { p.rotation.minutesByPlayerId[team.roster[0]] = NaN; },
      (p: typeof valid) => { p.rotation.minutesByPlayerId[team.roster[0]] = 49; },
      (p: typeof valid) => { p.pace = Infinity; },
      (p: typeof valid) => { p.offense = 'fake' as typeof p.offense; },
      (p: typeof valid) => { p.playbook[0].weight = -1; },
      (p: typeof valid) => { p.rotation.starterIds[0] = league.teams[1].roster[0]; },
    ];
    for (const mutate of bad) {
      const p = structuredClone(valid); mutate(p);
      expect(validateGamePlan(p, team, league.players).length).toBeGreaterThan(0);
    }
    expect(validateGamePlan(null, team, league.players).length).toBeGreaterThan(0);
    expect(validateGamePlan({ rotation: {} }, team, league.players).length).toBeGreaterThan(0);
  });
  it('répartit exactement 240 minutes, sans dépasser 48, même avec cinq joueurs', () => {
    for (const count of [5, 6, 10]) {
      const ids = Array.from({ length: count }, (_, i) => String(i));
      const minutes = distributeMinutes(ids, { '0': 1000, '1': NaN });
      expect(Object.values(minutes).reduce((a, b) => a + b)).toBe(240);
      expect(Object.values(minutes).every(m => m >= 0 && m <= 48)).toBe(true);
    }
  });
});
