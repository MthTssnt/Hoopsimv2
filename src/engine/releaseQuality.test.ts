import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNewGame } from './index';
import { playerValue, expectedSalary } from './management/economy';
import { signFreeAgent, repairManagedTeam, evaluateTrade, executeTrade } from './management/transactions';
import * as plans from './gamePlan';
import { store } from '../state/store';
import { beginOffseason } from './offseason';
import { migrateLeague } from './migrate';
afterEach(() => { store.league = null; store.liveMatch = null; store.busy = false; store.saveError = null; store.loadError = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('qualité de publication — économie', () => {
  it('ne crée jamais de valeur en abaissant la note à potentiel, âge et contrat constants', () => {
    const p = Object.values(createNewGame('bos', 31).players)[0];
    for (const direction of ['contend', 'compete', 'retool', 'rebuild'] as const) for (const age of [19, 23, 28, 32]) for (const potential of [65, 80, 95]) {
      let previous = 0;
      for (let overall = 35; overall <= potential; overall++) {
        const value = playerValue({ ...p, overall, potential, age, injuryGames: 0, contract: { salary: 0.8, years: 3 } }, direction);
        expect(value).toBeGreaterThanOrEqual(previous); previous = value;
      }
    }
  });
  it('supprime les anciens champs d’agent libre lors du commit et conserve l’identité du joueur', () => {
    const l = createNewGame('bos', 31), p = Object.values(l.players).find(p => p.teamId === null)!;
    p.minimumException = true; p.legacyMinimum = true;
    expect(p.freeAgentSince).toBeDefined();
    expect(signFreeAgent(l, 'bos', p.id, { salary: expectedSalary(p), years: 2, promisedRole: 'rolePlayer' })).toEqual([]);
    expect(l.players[p.id]).toBe(p); expect(p.teamId).toBe('bos');
    expect(p.freeAgentSince).toBeUndefined(); expect(p.minimumException).toBeUndefined(); expect(p.legacyMinimum).toBeUndefined();
  });
  it('recommande un style CPU selon son atout relatif et garde équilibré sans spécialité', () => {
    const l = createNewGame('bos', 31), team = l.teams.find(t => t.id !== 'bos')!;
    for (const [axis, style] of [['three', 'paceSpace'], ['passing', 'motion'], ['inside', 'insideOut'], ['none', 'balanced']] as const) {
      for (const id of team.roster) for (const key of ['three', 'passing', 'inside'] as const) l.players[id].attrs[key] = axis === key ? 82 : 75;
      repairManagedTeam(l, team); expect(team.gamePlan!.offense).toBe(style);
    }
  });
  it('annule une transaction déjà préparée si la validation finale échoue, sans toucher le contexte partagé', () => {
    const l = createNewGame('bos', 31), team = l.teams.find(t => t.id === 'bos')!;
    const offers = l.teams.filter(t => t.id !== team.id).flatMap(other => team.roster.flatMap(out => other.roster.map(incoming => ({ fromTeamId: team.id, toTeamId: other.id, outgoingIds: [out], incomingIds: [incoming] }))));
    const offer = offers.find(o => evaluateTrade(l, o).accepted)!; expect(offer).toBeDefined();
    const before = JSON.stringify(l), otherPlayer = l.players[l.teams.find(t => ![offer.fromTeamId, offer.toTeamId].includes(t.id))!.roster[0]];
    vi.spyOn(plans, 'validateGamePlan').mockReturnValue(['Validation finale refusée']);
    expect(executeTrade(l, offer)).toEqual(['Validation finale refusée']);
    expect(JSON.stringify(l)).toBe(before); expect(l.teams.find(t => t.id === team.id)).toBe(team); expect(l.players[otherPlayer.id]).toBe(otherPlayer);
  });
});

describe('sauvegarde et erreurs visibles', () => {
  it('signale le quota sans remplacer l’ancienne sauvegarde et peut réessayer', () => {
    const data = new Map<string, string>(); let full = false;
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, value: string) => { if (full) throw new Error('QuotaExceededError'); data.set(k, value); } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.newGame('bos', 31); const old = data.get('hoopsim.save.v1');
    store.league!.day++; full = true; expect(store.retrySave()).toBe(false); expect(store.saveError).toContain('exportez');
    expect(data.get('hoopsim.save.v1')).toBe(old); expect(store.league!.day).toBe(1);
    full = false; expect(store.retrySave()).toBe(true); expect(store.saveError).toBeNull();
    expect(JSON.parse(data.get('hoopsim.save.v1')!).day).toBe(1);
  });
  it('conserve carrière et sauvegarde en cas d’import invalide, avec erreur lisible', () => {
    const bad = '{invalide'; vi.stubGlobal('localStorage', { getItem: () => bad });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.league = createNewGame('bos', 31); const before = JSON.stringify(store.league);
    expect(store.load()).toBe(false); expect(store.loadError).toContain('pas été effacée'); expect(JSON.stringify(store.league)).toBe(before);
  });
  it('refuse un état de draft corrompu sans relancer l’intersaison', () => {
    const l = createNewGame('bos', 31); l.phase = 'offseason'; beginOffseason(l);
    l.offseason!.picks[0].number = 99;
    expect(() => migrateLeague(l)).toThrow('Draft sauvegardée incohérente');
  });
  it('rejette un JSON lisible dont l’équipe dirigée manque avant de remplacer la carrière', () => {
    const invalid = createNewGame('bos', 31); invalid.userTeamId = 'absente';
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(invalid) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.league = createNewGame('bos', 919); const before = JSON.stringify(store.league);
    expect(store.load()).toBe(false); expect(store.loadError).toContain('équipe dirigée');
    expect(JSON.stringify(store.league)).toBe(before);
  });
});
