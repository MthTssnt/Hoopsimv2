import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNewGame } from './index';
import { playGame, recordGame, recordPlayedGame } from './simSeason';
import { migrateLeague } from './migrate';
import { repairGamePlan, validateGamePlan } from './gamePlan';
import { nextLineup, newCoachContext, substitutionInterval } from './rotation';
import { createSquad } from '../match/world/rotation';
import { store } from '../state/store';

afterEach(() => { store.league = null; store.liveMatch = null; vi.unstubAllGlobals(); });
describe('bibliothèque et réglages de rotation', () => {
  it('ne comptabilise pas deux fois un match, y compris son énergie et son RNG', () => {
    const league = createNewGame('bos', 31), game = league.schedule[0];
    const result = playGame(league, game);
    const before = JSON.stringify(league);
    expect(() => recordGame(league, game, result)).toThrow('déjà enregistré');
    expect(() => recordPlayedGame(league, game, { result, energy: { [league.teams[0].roster[0]]: 0 } })).toThrow('déjà enregistré');
    expect(() => playGame(league, game)).toThrow('déjà enregistré');
    expect(JSON.stringify(league)).toBe(before);
  });
  it('préserve les variantes et le nom du plan actif après une saison complète et une migration', { timeout: 30000 }, () => {
    vi.stubGlobal('localStorage', { setItem: vi.fn() });
    store.newGame('bos', 31);
    const team = store.league!.teams.find(t => t.id === 'bos')!;
    const plan = { ...team.gamePlan!, name: 'Plan durable' };
    expect(store.setGamePlan(plan)).toEqual([]);
    expect(store.savePlanVariant(plan)).toEqual([]);
    for (let guard = 0; guard < 10 && store.league!.phase !== 'offseason'; guard++) store.simulateRestOfSeason();
    expect(store.league!.phase).toBe('offseason');
    store.nextSeason();
    migrateLeague(store.league!);
    expect(team.gamePlan!.name).toBe('Plan durable');
    expect(team.savedGamePlans![0]).toEqual(plan);
    expect(validateGamePlan(team.gamePlan, team, store.league!.players)).toEqual([]);
  });

  it('sauve des copies sans activer, remplace par nom, recharge et supprime sans toucher le plan actif', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) });
    store.newGame('bos', 31);
    const team = store.league!.teams.find(t => t.id === 'bos')!;
    const active = structuredClone(team.gamePlan!);
    const variant = structuredClone(active); variant.name = 'Développement';
    expect(store.savePlanVariant(variant)).toEqual([]);
    variant.pace = 72;
    expect(team.savedGamePlans![0].pace).toBe(50);
    expect(team.gamePlan).toEqual(active);
    expect(store.savePlanVariant(variant)).toEqual([]);
    expect(team.savedGamePlans).toHaveLength(1);
    expect(store.load()).toBe(true);
    const reloaded = store.league!.teams.find(t => t.id === 'bos')!;
    expect(reloaded.savedGamePlans![0].pace).toBe(72);
    store.deletePlanVariant(variant.name);
    expect(reloaded.savedGamePlans).toEqual([]);
    expect(reloaded.gamePlan).toEqual(active);
  });
  it('répare une copie ancienne après blessure sans modifier la variante archivée', () => {
    const league = createNewGame('bos', 31), team = league.teams[0];
    const variant = structuredClone(team.gamePlan!); team.savedGamePlans = [variant];
    const unavailable = variant.rotation.starterIds[0]; league.players[unavailable].injuryGames = 4;
    const copy = { ...team, gamePlan: structuredClone(variant), rotation: [...team.rotation] };
    expect(repairGamePlan(copy, league.players)).toHaveLength(1);
    expect(validateGamePlan(copy.gamePlan, team, league.players)).toEqual([]);
    expect(copy.gamePlan!.rotation.starterIds).not.toContain(unavailable);
    expect(variant.rotation.starterIds).toContain(unavailable);
    migrateLeague(league);
    expect(team.savedGamePlans![0]).toEqual(variant);
  });
  it('borne la bibliothèque et rejette un plan invalide sans écriture', () => {
    vi.stubGlobal('localStorage', { setItem: vi.fn() });
    store.newGame('bos', 31);
    const team = store.league!.teams.find(t => t.id === 'bos')!;
    for (let i = 0; i < 8; i++) expect(store.savePlanVariant({ ...team.gamePlan!, name: `Plan ${i}` })).toEqual([]);
    expect(store.savePlanVariant({ ...team.gamePlan!, name: 'Neuvième' }).length).toBeGreaterThan(0);
    expect(store.savePlanVariant({ ...team.gamePlan!, pace: NaN }).length).toBeGreaterThan(0);
    expect(team.savedGamePlans).toHaveLength(8);
  });
  it('garde une même fréquence équivalente et donne la priorité au cinq de fin explicite', () => {
    const league = createNewGame('bos', 31), team = league.teams[0], plan = team.gamePlan!;
    expect(substitutionInterval(plan)).toBe(95);
    expect(substitutionInterval({ ...plan, substitutionAggression: 100 })).toBe(47.5);
    expect(substitutionInterval({ ...plan, substitutionAggression: 0 })).toBe(142.5);
    plan.rotation.preserveStartersInClutch = true;
    plan.rotation.closingFiveIds = team.rotation.slice(5, 10) as typeof plan.rotation.starterIds;
    const squad = createSquad(0, team.rotation.map(id => league.players[id]), plan);
    const ctx = { ...newCoachContext(), closing: true };
    expect(nextLineup(squad.members, ctx).map(m => m.id)).toEqual(plan.rotation.closingFiveIds);
  });
});
