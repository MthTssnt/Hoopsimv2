import { describe, expect, it, vi, afterEach } from 'vitest';
import { createNewGame, simulateGame } from './index';
import { coachedPlayer, distributeMinutes, distributeRemaining, planRotationIds, repairGamePlan, type GamePlan } from './gamePlan';
import { matchRotation, newCoachContext, nextLineup, planMemberOptions, rotationTargets } from './rotation';
import { Rng } from './rng';
import { gmMatchSetup, worldGamePlans, worldRotations } from '../match/gameResult';
import { MatchWorld } from '../match/world/MatchWorld';
import { createSquad, matchTimeScale } from '../match/world/rotation';
import { makeCourt } from '../match/physics/court';
import { store } from '../state/store';

function fixture() {
  const league = createNewGame('bos', 8126);
  const team = league.teams.find(t => t.id === 'bos')!;
  return { league, team, plan: structuredClone(team.gamePlan!) };
}
afterEach(() => { store.league = null; store.liveMatch = null; vi.unstubAllGlobals(); });

describe('coaching commun aux deux moteurs', () => {
  it('répartit le reste sans changer les minutes explicitement fixées', () => {
    const minutes = distributeRemaining({ a: 34, b: 26, c: 12, d: 20, e: 20, f: 20, g: 20, h: 20 }, ['a', 'b', 'c']);
    expect([minutes.a, minutes.b, minutes.c]).toEqual([34, 26, 12]);
    expect(Object.values(minutes).reduce((a, b) => a + b)).toBe(240);
    expect(() => distributeRemaining({ a: 10, b: 10 }, ['a'])).toThrow();
  });

  it('transmet un instantané indépendant du plan au bon côté et aligne les titulaires par poste', () => {
    const { league, team, plan } = fixture();
    [plan.rotation.starterIds[0], plan.rotation.starterIds[4]] = [plan.rotation.starterIds[4], plan.rotation.starterIds[0]];
    team.gamePlan = plan; team.rotation = planRotationIds(plan);
    const game = league.schedule.find(g => g.homeId === team.id || g.awayId === team.id)!;
    const setup = gmMatchSetup(league, game, 'regarder');
    const plans = worldGamePlans(setup);
    const [mine, theirs] = worldRotations(setup);
    const w = new MatchWorld(makeCourt('pro'), mine[0], { x: 0, y: 0, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(4));
    w.startFullCourt(mine, theirs, 3, plans);
    expect(w.lineup[0].map(body => w.memberOf(body)!.id)).toEqual(plan.rotation.starterIds);
    expect(w.squads![0].members.map(m => m.targetSecs)).toEqual([...rotationTargets(mine, plan).values()]);
    const before = plans[0]!.name;
    team.gamePlan.name = 'Modifié plus tard';
    expect(plans[0]!.name).toBe(before);
    expect(w.squads![0].members.reduce((sum, m) => sum + m.targetSecs / matchTimeScale(3), 0)).toBe(12 * 5 * 60);
  });
  it('conserve les choix après blessure et import JSON ; retire les références invalides', () => {
    const { league, team, plan } = fixture();
    plan.rotation.autoSubstitutions = false;
    plan.rotation.minutesByPlayerId = distributeMinutes(Object.keys(plan.rotation.minutesByPlayerId), { [team.rotation[5]]: 100 });
    team.gamePlan = plan;
    league.players[plan.rotation.starterIds[0]].injuryGames = 3;
    expect(repairGamePlan(team, league.players)).toHaveLength(1);
    expect(team.gamePlan!.rotation.autoSubstitutions).toBe(false);
    expect(Object.values(team.gamePlan!.rotation.minutesByPlayerId).reduce((a, b) => a + b)).toBe(240);
  });
  it('interprète les rôles dans les deux adaptateurs sans altérer les joueurs de la ligue', () => {
    const { league, team, plan } = fixture();
    const id = team.rotation[0], player = league.players[id];
    const original = structuredClone(player);
    plan.rolesByPlayerId[id] = 'shooter';
    const expected = coachedPlayer(player, plan);
    expect(expected.tendencies.three).toBeGreaterThan(player.tendencies.three);
    expect(createSquad(0, matchRotation(team, league.players), plan).members.find(m => m.id === id)!.player.tendencies).toEqual(expected.tendencies);
    expect(player).toEqual(original);
  });
  it('respecte le cinq de fin serrée, les minutes nulles et les expulsions', () => {
    const { league, team, plan } = fixture();
    plan.rotation.closingFiveIds = team.rotation.slice(5, 10) as GamePlan['rotation']['starterIds'];
    const members = createSquad(0, matchRotation(team, league.players), plan).members;
    const ctx = { ...newCoachContext(4), closing: true, progress: 0.95 };
    expect(new Set(nextLineup(members, ctx).map(m => m.id))).toEqual(new Set(plan.rotation.closingFiveIds));
    const excluded = members[5]; excluded.fouledOut = true;
    expect(nextLineup(members, ctx)).not.toContain(excluded);
    members[6].targetSecs = 0;
    expect(nextLineup(members, ctx)).not.toContain(members[6]);
    expect(planMemberOptions(plan.rotation.starterIds[0], plan).starterSlot).toBe(0);
  });
  it('un changement marqué de minutes modifie le temps réellement joué sur plusieurs graines', () => {
    const { league, team, plan } = fixture();
    const other = league.teams.find(t => t.id !== team.id)!;
    const id = team.rotation[6];
    const ids = Object.keys(plan.rotation.minutesByPlayerId);
    const run = (target: number) => {
      let secs = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const players = structuredClone(league.players);
        const p = structuredClone(plan);
        const rest = distributeMinutes(ids.filter(x => x !== id), Object.fromEntries(ids.filter(x => x !== id).map(x => [x, 1])));
        // Fix the selected player's target, share the remainder among the nine others.
        p.rotation.minutesByPlayerId = Object.fromEntries(ids.map(x => [x, x === id ? target : rest[x] * (240 - target) / 240]));
        const result = simulateGame(new Rng(seed), `coaching-${seed}`, { ...team, gamePlan: p }, other, players);
        secs += result.box.rows[team.id].find(r => r.playerId === id)?.line.secs ?? 0;
      }
      return secs / 12 / 60;
    };
    expect(run(36) - run(6)).toBeGreaterThan(12);
  });
});

describe('commandes et sauvegarde du store', () => {
  it('rejette les commandes invalides sans mutation, sauvegarde et recharge le plan', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) });
    const { league, team, plan } = fixture(); store.league = league;
    const before = JSON.stringify(team);
    expect(store.setRotation([team.rotation[0], team.rotation[0]]).length).toBeGreaterThan(0);
    const invalid = structuredClone(plan); invalid.rotation.minutesByPlayerId[team.rotation[0]] = 49;
    expect(store.setGamePlan(invalid).length).toBeGreaterThan(0);
    expect(JSON.stringify(team)).toBe(before);
    plan.name = 'Plan sauvegardé';
    expect(store.setGamePlan(plan)).toEqual([]);
    expect(memory.has('hoopsim.save.v1')).toBe(true);
    store.league = null;
    expect(store.load()).toBe(true);
    expect(store.league!.teams.find(t => t.id === 'bos')!.gamePlan).toEqual(plan);
  });
});
