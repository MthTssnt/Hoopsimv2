import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNewGame, simulateDay, startNextSeason, closeSeason } from '../index';
import { beginOffseason, finishOffseason } from '../offseason';
import { advanceCPUDraft, chooseDraftPlayer, draftDecision, prospectScore, recommendedProspect } from './draft';
import { accrueTraining, progressPlayer, setTrainingFocus } from './training';
import { ensureSeasonReview } from './reports';
import { migrateLeague } from '../migrate';
import { validateGamePlan } from '../gamePlan';
import { evaluateContract, evaluateTrade } from '../management/transactions';
import { updateCPUProjects } from '../management/aiGm';
import { Rng } from '../rng';
import { recordGame } from '../simSeason';
import { simulateGame } from '../simGame';
import { store } from '../../state/store';
import type { League } from '../types';
function fixture() { const league = createNewGame('bos', 31); league.phase = 'offseason'; return league; }
function prepared() { const l = fixture(); beginOffseason(l); advanceCPUDraft(l); return l; }
function rosterCheck(l: League) {
  const ids = l.teams.flatMap(t => t.roster); expect(new Set(ids).size).toBe(ids.length);
  for (const t of l.teams) {
    expect(t.roster.length).toBeGreaterThanOrEqual(13); expect(t.roster.length).toBeLessThanOrEqual(15);
    expect(validateGamePlan(t.gamePlan, t, l.players)).toEqual([]);
    expect(new Set(t.roster.map(id => l.players[id].number)).size).toBe(t.roster.length);
    for (const id of t.roster) expect(l.players[id].teamId).toBe(t.id);
  }
  for (const p of Object.values(l.players)) if (p.teamId === null) { expect(ids).not.toContain(p.id); expect(p.contract).toEqual({ salary: 0, years: 0 }); }
}
afterEach(() => { store.league = null; store.liveMatch = null; store.busy = false; vi.unstubAllGlobals(); });

describe('draft sauvegardable', () => {
  it('prépare une seule fois, réserve 60 IDs distincts et garde les deux tours hors de la base active', () => {
    const l = fixture(), original = new Set(Object.keys(l.players)); beginOffseason(l);
    expect(l.offseason!.picks).toHaveLength(60); expect(Object.keys(l.offseason!.prospects)).toHaveLength(60);
    for (const [id, p] of Object.entries(l.offseason!.prospects)) { expect(original.has(id)).toBe(false); expect(l.players[id]).toBeUndefined(); expect(Math.abs(p.estimatedPotential - p.player.potential)).toBeLessThanOrEqual(p.uncertainty); }
    expect(l.offseason!.picks.slice(0, 30).map(p => p.ownerTeamId)).toEqual(l.offseason!.picks.slice(30).map(p => p.ownerTeamId));
    const once = JSON.stringify(l); beginOffseason(l); expect(JSON.stringify(l)).toBe(once);
    const another = fixture(); beginOffseason(another); expect(JSON.stringify(another)).toBe(once);
  });
  it('conserve l’ordre inverse des bilans et limite la loterie aux quatre derniers', () => {
    const l = fixture(); l.teams.forEach((t, i) => { t.wins = i + 1; t.losses = 81 - i; });
    beginOffseason(l); const order = l.offseason!.picks.slice(0, 30).map(p => p.ownerTeamId);
    expect(new Set(order.slice(0, 4))).toEqual(new Set(l.teams.slice(0, 4).map(t => t.id)));
    expect(order.slice(4)).toEqual(l.teams.slice(4).map(t => t.id));
  });
  it('s’arrête au choix humain, sélectionne réellement puis rejette les doubles clics et fantômes sans mutation', () => {
    const l = prepared(), d = l.offseason!, pick = d.picks[d.cursor];
    expect(pick.ownerTeamId).toBe(l.userTeamId);
    const p = recommendedProspect(l, l.teams.find(t => t.id === l.userTeamId)!)!.player;
    const before = JSON.stringify(l); expect(draftDecision(l, pick.id, p.id)).toEqual([]); expect(JSON.stringify(l)).toBe(before);
    expect(chooseDraftPlayer(l, pick.id, '__proto__').length).toBeGreaterThan(0); expect(JSON.stringify(l)).toBe(before);
    expect(chooseDraftPlayer(l, pick.id, p.id)).toEqual([]); expect(l.players[p.id].teamId).toBe(l.userTeamId);
    expect(d.prospects[p.id]).toBeUndefined();
    const once = JSON.stringify(l); expect(chooseDraftPlayer(l, pick.id, p.id).length).toBeGreaterThan(0); expect(JSON.stringify(l)).toBe(once);
    advanceCPUDraft(l); expect(l.offseason!.stage === 'ready' || l.offseason!.picks[l.offseason!.cursor].ownerTeamId === l.userTeamId).toBe(true);
  });
  it('recharge au milieu du tour sans rejouer progression ni CPU, puis termine et garde tous les effectifs jouables', () => {
    const l = prepared();
    const loaded = migrateLeague(JSON.parse(JSON.stringify(l)) as League), once = JSON.stringify(loaded);
    migrateLeague(loaded); beginOffseason(loaded); advanceCPUDraft(loaded); expect(JSON.stringify(loaded)).toBe(once);
    advanceCPUDraft(loaded, true); expect(loaded.offseason!.stage).toBe('ready');
    const rookieIds = loaded.offseason!.picks.flatMap(p => p.player ? [p.player.id] : []);
    expect(new Set(rookieIds).size).toBe(rookieIds.length);
    finishOffseason(loaded); expect(loaded.season).toBe(2027); expect(loaded.offseason).toBeUndefined(); rosterCheck(loaded);
    const done = JSON.stringify(loaded); expect(() => finishOffseason(loaded)).toThrow(); expect(JSON.stringify(loaded)).toBe(done);
    expect(loaded.seasonReviews![0].draft).toHaveLength(60);
  });
  it('refuse lancement précoce, budget et effectif complets, tout en permettant de passer un choix', () => {
    const l = prepared(), d = l.offseason!, pick = d.picks[d.cursor], id = Object.keys(d.prospects)[0];
    const before = JSON.stringify(l); expect(() => finishOffseason(l)).toThrow(); expect(JSON.stringify(l)).toBe(before);
    l.management!.salaryCap = 0;
    const capped = JSON.stringify(l); expect(chooseDraftPlayer(l, pick.id, id).length).toBeGreaterThan(0); expect(JSON.stringify(l)).toBe(capped);
    l.management!.salaryCap = 10000;
    const team = l.teams.find(t => t.id === l.userTeamId)!; const original = [...team.roster]; team.roster = Array(15).fill(original[0]);
    const full = JSON.stringify(l); expect(chooseDraftPlayer(l, pick.id, id).length).toBeGreaterThan(0); expect(JSON.stringify(l)).toBe(full);
    team.roster = original; expect(chooseDraftPlayer(l, pick.id, null)).toEqual([]); expect(pick.player).toBeUndefined();
  });
  it('ferme le marché pendant la draft et rejette un état de draft corrompu sans le réinitialiser', () => {
    const l = prepared(), free = Object.values(l.players).find(p => p.teamId === null)!;
    const before = JSON.stringify(l);
    expect(evaluateContract(l, l.userTeamId, free.id, { salary: 1, years: 1, promisedRole: 'rolePlayer' }).accepted).toBe(false);
    expect(evaluateTrade(l, { fromTeamId: 'bos', toTeamId: l.teams[0].id, outgoingIds: [], incomingIds: [] }).accepted).toBe(false);
    expect(JSON.stringify(l)).toBe(before);
    const damaged = structuredClone(l); damaged.offseason!.cursor = -1;
    expect(() => migrateLeague(damaged)).toThrow('Draft sauvegardée incohérente'); expect(damaged.offseason!.cursor).toBe(-1);
  });
  it('l’API automatique et la délégation explicite produisent le même résultat', () => {
    const a = fixture(), b = fixture(); startNextSeason(a); beginOffseason(b); advanceCPUDraft(b, true); finishOffseason(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('développement sans farming', () => {
  it('ne progresse pas au clic, compte chaque journée une fois, conserve le passé et réduit les journées blessées', () => {
    const l = createNewGame('bos', 31), t = l.teams.find(t => t.id === 'bos')!, p = l.players[t.roster[0]], attrs = structuredClone(p.attrs);
    for (let i = 0; i < 100; i++) expect(setTrainingFocus(l, p.id, i % 2 ? 'shooting' : 'defense')).toEqual([]);
    expect(p.attrs).toEqual(attrs); expect(p.training!.days).toEqual({});
    setTrainingFocus(l, p.id, 'defense'); accrueTraining(l); accrueTraining(l); expect(p.training!.days.defense).toBe(1);
    setTrainingFocus(l, p.id, 'shooting'); l.day++; p.injuryGames = 5; accrueTraining(l);
    expect(p.training!.days).toEqual({ defense: 1, shooting: 0.25 });
    l.phase = 'playoffs'; l.day++; accrueTraining(l); expect(p.training!.days.shooting).toBe(0.25);
    l.phase = 'regular'; l.day = 999; accrueTraining(l); expect(p.training!.days.shooting).toBe(0.25);
    expect(p.attrs).toEqual(attrs);
  });
  it('rejette focus étranger, inconnu et IDs spéciaux sans aucune mutation', () => {
    const l = createNewGame('bos', 31), foreign = Object.values(l.players).find(p => p.teamId && p.teamId !== l.userTeamId)!;
    const before = JSON.stringify(l);
    expect(setTrainingFocus(l, foreign.id, 'shooting').length).toBeGreaterThan(0);
    expect(setTrainingFocus(l, '__proto__', 'balanced').length).toBeGreaterThan(0);
    expect(setTrainingFocus(l, l.teams.find(t => t.id === l.userTeamId)!.roster[0], 'unknown' as 'balanced').length).toBeGreaterThan(0);
    expect(JSON.stringify(l)).toBe(before);
  });
  it('mesure une différence ciblée sur graines appariées, avec rendement décroissant et déclin vétéran', () => {
    const source = Object.values(createNewGame('bos', 31).players)[0];
    let shooting = 0, lateClick = 0, veteranSpeed = 0, highAttributeGain = 0;
    for (let seed = 0; seed < 100; seed++) {
      const base = { ...structuredClone(source), age: 23, overall: 65, potential: 90 };
      base.attrs.three = 60; base.attrs.speed = 80;
      const trained = structuredClone(base), balanced = structuredClone(base), late = structuredClone(base), ceiling = structuredClone(base);
      trained.training = { focus: 'shooting', days: { shooting: 138 } }; late.training = { focus: 'shooting', days: {} };
      ceiling.training = { focus: 'shooting', days: { shooting: 138 } }; ceiling.attrs.three = 95;
      const highControl = structuredClone(ceiling); highControl.training = { focus: 'balanced', days: {} };
      const vet = { ...structuredClone(base), age: 37, potential: 65, training: { focus: 'physical' as const, days: { physical: 138 } } };
      progressPlayer(new Rng(seed), trained, 138); progressPlayer(new Rng(seed), balanced, 138); progressPlayer(new Rng(seed), late, 138);
      progressPlayer(new Rng(seed), ceiling, 138); progressPlayer(new Rng(seed), highControl, 138); progressPlayer(new Rng(seed), vet, 138);
      shooting += trained.attrs.three - balanced.attrs.three; lateClick += late.attrs.three - balanced.attrs.three;
      highAttributeGain += ceiling.attrs.three - highControl.attrs.three; veteranSpeed += vet.attrs.speed - base.attrs.speed;
      expect(Object.values(trained.attrs).every(v => Number.isFinite(v) && v >= 25 && v <= 99)).toBe(true);
      expect(trained.training!.days).toEqual({});
    }
    expect(shooting / 100).toBeGreaterThan(0.5); expect(lateClick).toBe(0);
    expect(highAttributeGain).toBeLessThan(shooting); expect(veteranSpeed / 100).toBeLessThan(-1);
  });
  it('donne une exposition comparable aux minutes rapides et physiques, sans réécrire les statistiques', () => {
    const l = createNewGame('bos', 31), g = l.schedule[0], home = l.teams.find(t => t.id === g.homeId)!, away = l.teams.find(t => t.id === g.awayId)!;
    const result = simulateGame(new Rng(77), g.id, home, away, l.players);
    result.box.tactics = { source: 'physical', normalizationFactor: 4, durationSeconds: 720, teams: {} };
    recordGame(l, g, result);
    for (const rows of Object.values(result.box.rows)) for (const r of rows) {
      expect(l.players[r.playerId].developmentSeconds).toBeCloseTo(r.line.secs * 4);
      expect(l.players[r.playerId].stats.secs).toBe(r.line.secs);
    }
  });
  it('branche l’exposition dans une journée réellement simulée et la conserve au rechargement', () => {
    const l = createNewGame('bos', 31), id = l.teams.find(t => t.id === l.userTeamId)!.roster[0];
    setTrainingFocus(l, id, 'shooting'); simulateDay(l, { watchUserGame: false });
    expect(l.players[id].training!.days.shooting).toBeGreaterThan(0);
    const loaded = migrateLeague(JSON.parse(JSON.stringify(l))); expect(loaded.players[id].training).toEqual(l.players[id].training);
    const once = JSON.stringify(loaded); migrateLeague(loaded); expect(JSON.stringify(loaded)).toBe(once);
  });
});

describe('projets, rapports et store', () => {
  it('privilégie davantage le potentiel en reconstruction sur des classes identiques', () => {
    let rebuildYouth = 0, contendYouth = 0;
    for (let seed = 0; seed < 60; seed++) {
      const l = createNewGame('bos', seed), team = l.teams[0], source = l.players[team.roster[0]];
      const candidates = [
        { player: { ...source, id: 'young', age: 19, overall: 60, potential: 90, contract: { salary: 5, years: 3 } }, estimatedPotential: 90, uncertainty: 8 },
        { player: { ...source, id: 'ready', age: 22, overall: 72 + seed % 5, potential: 78, contract: { salary: 5, years: 3 } }, estimatedPotential: 78, uncertainty: 8 },
      ];
      for (const direction of ['rebuild', 'contend'] as const) {
        team.frontOffice!.direction = direction;
        const choice = [...candidates].sort((a, b) => prospectScore(l, team, b) - prospectScore(l, team, a))[0];
        if (choice.player.id === 'young') { if (direction === 'rebuild') rebuildYouth++; else contendYouth++; }
      }
    }
    expect(rebuildYouth).toBeGreaterThan(contendYouth + 20);
  });
  it('ne préfère pas un prospect inférieur seulement parce que son écart de progression est plus grand', () => {
    const l = fixture(), team = l.teams[0], source = l.players[team.roster[0]];
    const better = { player: { ...source, age: 20, overall: 54, contract: { salary: 0.8, years: 3 } }, estimatedPotential: 72, uncertainty: 8 };
    const worse = { player: { ...source, age: 20, overall: 40, contract: { salary: 0.8, years: 3 } }, estimatedPotential: 65, uncertainty: 8 };
    for (const direction of ['rebuild', 'compete', 'contend', 'retool'] as const) {
      team.frontOffice!.direction = direction; expect(prospectScore(l, team, better)).toBeGreaterThan(prospectScore(l, team, worse));
    }
  });
  it('explique des décisions annuelles différentes et laisse le projet humain intact', () => {
    const l = fixture(), cpu = l.teams.filter(t => t.id !== l.userTeamId), human = structuredClone(l.teams.find(t => t.id === l.userTeamId)!.frontOffice);
    cpu[0].wins = 65; cpu[0].losses = 17; cpu[1].wins = 20; cpu[1].losses = 62;
    updateCPUProjects(l);
    expect(cpu[0].frontOffice!.direction).toBe('contend'); expect(cpu[1].frontOffice!.direction).toBe('rebuild');
    expect(cpu[0].frontOffice!.decisionReason).toContain('65-17'); expect(l.teams.find(t => t.id === l.userTeamId)!.frontOffice).toEqual(human);
  });
  it('borne les bilans à dix et conserve les noms des récompenses après retraite sans reclôturer deux fois', () => {
    const l = fixture(), p = l.players[l.teams[0].roster[0]]; p.stats.gp = 82; p.stats.pts = 3000;
    const h = closeSeason(l), name = h.playerNames![h.mvpId]; expect(name).toBeTruthy();
    const once = JSON.stringify(l); expect(closeSeason(l)).toBe(h); expect(JSON.stringify(l)).toBe(once);
    for (const team of l.teams) team.roster = team.roster.filter(id => id !== h.mvpId);
    delete l.players[h.mvpId]; expect(h.playerNames![h.mvpId]).toBe(name);
    for (let i = 1; i <= 12; i++) { l.season++; ensureSeasonReview(l); }
    expect(l.seasonReviews).toHaveLength(10);
  });
  it('sauvegarde chaque choix une fois, refuse les appels périmés et bloque les commandes en live', () => {
    const write = vi.fn(); vi.stubGlobal('localStorage', { setItem: write });
    store.league = fixture(); expect(store.prepareDraft()).toEqual([]);
    expect(Object.keys(store.league!.offseason!.prospects)).toHaveLength(60);
    const initial = store.league!.offseason!, initialPick = initial.picks[initial.cursor];
    if (initialPick.ownerTeamId !== store.league!.userTeamId) expect(store.advanceDraft(initialPick.id)).toEqual([]);
    write.mockClear();
    const l = store.league!, d = l.offseason!, pick = d.picks[d.cursor], p = recommendedProspect(l, l.teams.find(t => t.id === l.userTeamId)!)!;
    expect(store.selectRookie(pick.id, p.player.id)).toEqual([]); expect(write).toHaveBeenCalledTimes(1);
    const once = JSON.stringify(l); expect(store.selectRookie(pick.id, p.player.id).length).toBeGreaterThan(0); expect(JSON.stringify(l)).toBe(once); expect(write).toHaveBeenCalledTimes(1);
    store.busy = true; expect(store.prepareDraft().length).toBeGreaterThan(0); expect(store.setTraining(p.player.id, 'defense').length).toBeGreaterThan(0); expect(JSON.stringify(l)).toBe(once);
    store.busy = false; store.newGame('bos', 31); store.simulateToNextUserGame(); store.startLiveMatch('regarder');
    expect(store.liveMatch).toBeTruthy(); write.mockClear();
    const live = JSON.stringify(store.league);
    expect(store.prepareDraft().length).toBeGreaterThan(0);
    expect(store.setTraining(store.league!.teams.find(t => t.id === 'bos')!.roster[0], 'shooting').length).toBeGreaterThan(0);
    expect(JSON.stringify(store.league)).toBe(live); expect(write).not.toHaveBeenCalled();
  });
});
