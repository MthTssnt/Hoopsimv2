import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNewGame, startNextSeason } from '../index';
import { migrateLeague } from '../migrate';
import { generateMarketPlayers, nextRookieId } from '../generate';
import { Rng } from '../rng';
import { validateGamePlan } from '../gamePlan';
import { budget, commitmentAt, expectedSalary, initialSalaryCap, playerValue, tradeStatus } from './economy';
import { evaluateTrade, executeTrade, extendContract, signFreeAgent } from './transactions';
import { generateFreeAgents } from './state';
import { fillRosters, runFrontOffices } from './aiGm';
import { store } from '../../state/store';
import type { League } from '../types';
import type { TradeOffer } from './types';
function fixture() { const league = createNewGame('bos', 31); return { league, team: league.teams.find(t => t.id === 'bos')! }; }
function acceptedOffer(league: League): TradeOffer {
  const team = league.teams.find(t => t.id === league.userTeamId)!;
  for (const other of league.teams.filter(t => t.id !== team.id)) for (const give of team.roster) for (const take of other.roster) {
    const offer = { fromTeamId: team.id, toTeamId: other.id, outgoingIds: [give], incomingIds: [take] };
    if (evaluateTrade(league, offer).accepted) return offer;
  }
  throw new Error('Fixture sans échange accepté');
}
function assertOwnership(league: League) {
  const ids = league.teams.flatMap(t => t.roster);
  expect(new Set(ids).size).toBe(ids.length);
  for (const p of Object.values(league.players)) {
    expect(ids.filter(id => id === p.id)).toHaveLength(p.teamId ? 1 : 0);
    if (p.teamId) { expect(league.teams.find(t => t.id === p.teamId)!.roster).toContain(p.id); expect(p.contract.years).toBeGreaterThan(0); }
    else expect(p.contract).toEqual({ salary: 0, years: 0 });
  }
}
afterEach(() => { store.league = null; store.liveMatch = null; vi.unstubAllGlobals(); });

describe('économie et import', () => {
  it('calibre le plafond à la masse salariale réelle et ne consomme pas le RNG historique à l’import', () => {
    for (const seed of [31, 8126, 919, 12345]) {
      const l = createNewGame('bos', seed);
      expect(l.management!.salaryCap).toBeGreaterThanOrEqual(initialSalaryCap(l));
      for (const t of l.teams) expect(budget(l, t).space).toBeGreaterThanOrEqual(0);
    }
    const { league } = fixture();
    delete league.management;
    for (const p of Object.values(league.players)) if (p.teamId === null) delete league.players[p.id];
    const oldPlayers = structuredClone(league.players), rng = league.rngState;
    migrateLeague(league);
    for (const id of Object.keys(oldPlayers)) expect(league.players[id]).toEqual(oldPlayers[id]);
    expect(league.rngState).toBe(rng);
    const once = JSON.stringify(league); migrateLeague(league); expect(JSON.stringify(league)).toBe(once);
    assertOwnership(league);
  });
  it('ne réutilise pas un identifiant de joueur retiré encore cité dans l’historique', () => {
    const { league } = fixture();
    const previous = Object.values(league.players).filter(p => p.teamId === null).map(p => p.id);
    for (const id of previous) delete league.players[id];
    const next = generateFreeAgents(league, 5, 'after-retirement');
    expect(next.some(id => previous.includes(id))).toBe(false);
  });
  it('valorise jeunesse, potentiel, contrat et blessure selon des projets différents', () => {
    const { league, team } = fixture(), p = league.players[team.roster[3]];
    const young = { ...p, age: 21, overall: 65, potential: 88, contract: { salary: 5, years: 3 } };
    const veteran = { ...p, age: 33, overall: 80, potential: 80, contract: { salary: 20, years: 1 } };
    expect(playerValue(young, 'rebuild')).toBeGreaterThan(playerValue(veteran, 'rebuild'));
    expect(playerValue(veteran, 'contend')).toBeGreaterThan(playerValue(young, 'contend'));
    expect(playerValue({ ...young, contract: { salary: 60, years: 4 } }, 'rebuild')).toBeLessThan(playerValue(young, 'rebuild'));
    expect(playerValue({ ...young, injuryGames: 30 })).toBeLessThan(playerValue(young));
  });
});

describe('échanges atomiques', () => {
  it('prévisualise sans mutation, applique une seule fois, répare les plans et conserve statistiques/contrats', () => {
    const { league, team } = fixture(), offer = acceptedOffer(league), out = offer.outgoingIds[0], incoming = offer.incomingIds[0];
    league.players[out].stats.pts = 123;
    const contract = structuredClone(league.players[out].contract), before = JSON.stringify(league);
    expect(evaluateTrade(league, offer).accepted).toBe(true); expect(JSON.stringify(league)).toBe(before);
    const events = league.management!.transactions.length;
    expect(executeTrade(league, offer)).toEqual([]);
    expect(league.players[out].teamId).toBe(offer.toTeamId); expect(league.players[incoming].teamId).toBe(team.id);
    expect(team.roster).not.toContain(out); expect(league.players[out].contract).toEqual(contract); expect(league.players[out].stats.pts).toBe(123);
    expect(team.gamePlan!.rotation.starterIds).not.toContain(out);
    expect(Object.keys(team.gamePlan!.rotation.minutesByPlayerId)).not.toContain(out);
    expect(league.management!.transactions).toHaveLength(events + 1);
    for (const id of [offer.fromTeamId, offer.toTeamId]) {
      const t = league.teams.find(t => t.id === id)!;
      expect(validateGamePlan(t.gamePlan, t, league.players)).toEqual([]);
      expect(new Set(t.roster.map(id => league.players[id].number)).size).toBe(t.roster.length);
    }
    assertOwnership(league);
    const after = JSON.stringify(league); expect(executeTrade(league, offer).length).toBeGreaterThan(0); expect(JSON.stringify(league)).toBe(after);
  });
  it('rejette IDs fantômes/dupliqués, noyau dur, offre vide, date limite et budget sans rien écrire', () => {
    for (const change of ['missing', 'duplicate', 'core', 'empty', 'deadline', 'cap', 'prototype'] as const) {
      const { league } = fixture(), offer = acceptedOffer(league);
      if (change === 'missing') offer.incomingIds[0] = 'fantôme';
      if (change === 'prototype') offer.incomingIds[0] = '__proto__';
      if (change === 'duplicate') offer.outgoingIds.push(offer.outgoingIds[0]);
      if (change === 'core') league.players[offer.incomingIds[0]].tradeStatus = 'core';
      if (change === 'empty') offer.incomingIds = [];
      if (change === 'deadline') league.phase = 'playoffs';
      if (change === 'cap') league.management!.salaryCap = 0.8;
      const before = JSON.stringify(league);
      expect(executeTrade(league, offer).length).toBeGreaterThan(0); expect(JSON.stringify(league)).toBe(before);
    }
  });
  it('ne permet pas d’acheter une superstar avec un paquet de joueurs faibles surpayés', () => {
    const { league, team } = fixture(), other = league.teams.find(t => t.id !== team.id)!;
    const give = team.roster.slice(-3), take = other.roster[0];
    for (const id of give) { league.players[id].contract.salary = 60; league.players[id].contract.years = 4; }
    league.players[take].tradeStatus = 'normal';
    const before = JSON.stringify(league);
    expect(executeTrade(league, { fromTeamId: team.id, toTeamId: other.id, outgoingIds: give, incomingIds: [take] }).length).toBeGreaterThan(0);
    expect(JSON.stringify(league)).toBe(before);
  });
});

describe('signatures, prolongations et expiration', () => {
  it('exige le salaire, les bornes et un rôle crédible ; signe sans réinitialiser une carrière', () => {
    const { league, team } = fixture(), p = Object.values(league.players).find(p => p.teamId === null)!;
    p.career.pts = 777;
    const offer = { salary: expectedSalary(p), years: 2, promisedRole: 'rolePlayer' as const };
    for (const bad of [{ ...offer, salary: NaN }, { ...offer, salary: 0.5 }, { ...offer, years: 5 }, { ...offer, salary: 0.81 }, { ...offer, promisedRole: 'primaryCreator' as const }]) {
      const before = JSON.stringify(league); expect(signFreeAgent(league, team.id, p.id, bad).length).toBeGreaterThan(0); expect(JSON.stringify(league)).toBe(before);
    }
    expect(signFreeAgent(league, team.id, p.id, offer)).toEqual([]);
    expect(p.teamId).toBe(team.id); expect(p.career.pts).toBe(777); expect(p.promisedRole).toBe('rolePlayer');
    const after = JSON.stringify(league); expect(signFreeAgent(league, team.id, p.id, offer).length).toBeGreaterThan(0); expect(JSON.stringify(league)).toBe(after);
    assertOwnership(league);
  });
  it('signe une prolongation pour la saison suivante et interdit le double passage d’intersaison', () => {
    const { league, team } = fixture(), p = team.roster.map(id => league.players[id]).find(p => p.age < 28)!;
    p.contract.years = 1;
    const old = p.contract.salary, offer = { salary: expectedSalary(p), years: 3, promisedRole: 'rolePlayer' as const };
    expect(extendContract(league, team.id, p.id, offer)).toEqual([]); expect(p.contract.salary).toBe(old);
    expect(commitmentAt(p, 1)).toBe(offer.salary);
    expect(extendContract(league, team.id, p.id, offer).length).toBeGreaterThan(0);
    league.phase = 'offseason'; startNextSeason(league);
    expect(p.contract).toEqual({ salary: offer.salary, years: 3 }); expect(p.extension).toBeUndefined(); expect(p.teamId).toBe(team.id);
    const before = JSON.stringify(league); expect(() => startNextSeason(league)).toThrow(); expect(JSON.stringify(league)).toBe(before);
  });
  it('libère réellement un contrat non prolongé, garde les effectifs jouables et trace les secours', () => {
    const { league, team } = fixture(), p = team.roster.map(id => league.players[id]).find(p => p.age < 28)!;
    p.contract.years = 1;
    league.phase = 'offseason'; startNextSeason(league);
    expect(p.teamId).not.toBe(team.id);
    expect(league.management!.transactions.some(e => e.type === 'expire' && e.playerIds.includes(p.id))).toBe(true);
    for (const t of league.teams) { expect(t.roster.length).toBeGreaterThanOrEqual(13); expect(t.roster.length).toBeLessThanOrEqual(15); }
    assertOwnership(league);
  });
  it('réserve l’exception au minimum à un renfort faible pour compléter 13, jamais un 14e joueur', () => {
    const { league, team } = fixture();
    for (let n = 0; n < 2; n++) { const id = team.roster.pop()!, p = league.players[id]; p.teamId = null; p.contract = { salary: 0, years: 0 }; }
    league.management!.salaryCap = budget(league, team).payroll;
    const [p, q] = generateMarketPlayers(new Rng(5), 2, nextRookieId(league.players), Object.values(league.players).map(p => p.lastName), 'PG');
    league.players[p.id] = p; league.players[q.id] = q;
    expect(signFreeAgent(league, team.id, p.id, { salary: 0.8, years: 1, promisedRole: 'rolePlayer' })).toEqual([]);
    expect(p.minimumException).toBe(true); expect(team.roster).toHaveLength(13);
    const before = JSON.stringify(league); expect(signFreeAgent(league, team.id, q.id, { salary: 0.8, years: 1, promisedRole: 'rolePlayer' }).length).toBeGreaterThan(0); expect(JSON.stringify(league)).toBe(before);
  });
});

describe('IA et sauvegarde', () => {
  it('agit seulement aux fenêtres, produit des échanges/offres et ne rejoue pas une fenêtre après recharge', () => {
    const { league } = fixture();
    const before = JSON.stringify(league); runFrontOffices(league); expect(JSON.stringify(league)).toBe(before);
    league.day = 28; runFrontOffices(league);
    expect(league.management!.transactions.some(e => e.type === 'trade')).toBe(true);
    expect(league.management!.proposals.length).toBeGreaterThan(0);
    const reloaded = migrateLeague(JSON.parse(JSON.stringify(league)) as League);
    const once = JSON.stringify(reloaded); runFrontOffices(reloaded); expect(JSON.stringify(reloaded)).toBe(once);
    assertOwnership(league);
  });
  it('enregistre une seule fois un contrat et bloque le marché pendant le match live', () => {
    const memory = new Map<string, string>(), write = vi.fn((k: string, v: string) => { memory.set(k, v); });
    vi.stubGlobal('localStorage', { setItem: write, getItem: (k: string) => memory.get(k) ?? null });
    store.newGame('bos', 31); write.mockClear();
    const free = Object.values(store.league!.players).find(p => p.teamId === null)!;
    const offer = { salary: expectedSalary(free), years: 2, promisedRole: 'rolePlayer' as const };
    expect(store.offerContract(free.id, offer)).toEqual([]); expect(write).toHaveBeenCalledTimes(1);
    expect(store.load()).toBe(true); expect(store.league!.players[free.id].teamId).toBe('bos');
    store.simulateToNextUserGame(); store.startLiveMatch('regarder');
    const snapshot = JSON.stringify(store.league); write.mockClear();
    expect(store.setTradeStatus(free.id, 'listed').length).toBeGreaterThan(0); expect(JSON.stringify(store.league)).toBe(snapshot); expect(write).not.toHaveBeenCalled();
  });
  it('réévalue les offres CPU à l’acceptation et conserve une offre refusée par la validation sans écriture', () => {
    const base = fixture().league;
    base.day = 28; runFrontOffices(base);
    const proposal = base.management!.proposals[0];
    expect(proposal).toBeDefined();
    const write = vi.fn(); vi.stubGlobal('localStorage', { setItem: write });
    for (const mode of ['accept', 'decline', 'expired', 'unavailable'] as const) {
      const league = structuredClone(base); store.league = league; write.mockClear();
      if (mode === 'expired') league.day += 15;
      if (mode === 'unavailable') league.players[proposal.offer.outgoingIds[0]].tradeStatus = 'unavailable';
      const before = JSON.stringify(league), events = league.management!.transactions.length;
      const errors = store.respondTradeProposal(proposal.id, mode !== 'decline');
      if (mode === 'expired' || mode === 'unavailable') {
        expect(errors.length).toBeGreaterThan(0); expect(JSON.stringify(league)).toBe(before); expect(write).not.toHaveBeenCalled();
      } else {
        expect(errors).toEqual([]); expect(write).toHaveBeenCalledTimes(1);
        expect(league.management!.proposals.some(p => p.id === proposal.id)).toBe(false);
        expect(league.management!.transactions).toHaveLength(events + (mode === 'accept' ? 1 : 0));
        if (mode === 'accept') expect(league.players[proposal.offer.outgoingIds[0]].teamId).toBe(league.userTeamId);
        const once = JSON.stringify(league);
        expect(store.respondTradeProposal(proposal.id, true).length).toBeGreaterThan(0); expect(JSON.stringify(league)).toBe(once);
        assertOwnership(league);
      }
    }
  });
  it('garde une évaluation reproductible et un registre borné après plusieurs fenêtres', () => {
    const a = fixture().league, b = fixture().league;
    for (const day of [28, 56, 84]) { a.day = day; b.day = day; runFrontOffices(a); runFrontOffices(b); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.management!.transactions.length).toBeLessThanOrEqual(200);
    expect(a.management!.proposals.length).toBeLessThanOrEqual(5);
    expect(new Set(a.management!.transactions.map(e => e.id)).size).toBe(a.management!.transactions.length);
    expect(Object.values(a.players).filter(p => p.teamId && tradeStatus(a, p) === 'core').length).toBeGreaterThan(0);
    assertOwnership(a);
  });
  it('trace un secours plutôt que laisser une équipe sous le minimum', () => {
    const { league, team } = fixture();
    for (const id of team.roster.slice(10)) { league.players[id].teamId = null; league.players[id].contract = { salary: 0, years: 0 }; }
    team.roster = team.roster.slice(0, 10);
    fillRosters(league); expect(team.roster).toHaveLength(13);
    expect(league.management!.transactions.some(e => e.description.includes('secours'))).toBe(true);
    assertOwnership(league);
  });
});
