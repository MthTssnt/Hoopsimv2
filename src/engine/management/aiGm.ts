import { generateMarketPlayers, nextRookieId } from '../generate';
import { hashSeed, Rng } from '../rng';
import { playerName, POSITIONS, type League, type Player, type Team } from '../types';
import { budget, defaultFrontOffice, expectedSalary, LEAGUE_ECONOMY_CONFIG as CONFIG, playerValue, tradeStatus } from './economy';
import { ensureManagement, logMarket, reservePlayerIds } from './state';
import { evaluateContract, evaluateTrade, executeTrade, extendContract, marketOpen, signFreeAgent } from './transactions';

function contractFor(player: Player) { return { salary: expectedSalary(player), years: player.age < 27 && player.overall >= 70 ? 2 : 1, promisedRole: 'rolePlayer' as const }; }
/** Round-robin one signing at a time; user only receives explicit minimum-depth rescues. */
export function fillRosters(league: League): void {
  const order = [...league.teams].sort((a, b) => hashSeed(`${league.seed}:${league.season}:${a.id}`) - hashSeed(`${league.seed}:${league.season}:${b.id}`));
  for (let round = 0; round < CONFIG.targetRoster; round++) {
    let changed = false;
    for (const team of order) {
      const target = team.id === league.userTeamId ? CONFIG.minRoster : CONFIG.targetRoster;
      if (team.roster.length >= target) continue;
      const missing = POSITIONS.find(pos => !team.roster.some(id => league.players[id].pos === pos));
      if (team.id !== league.userTeamId) {
        const reserve = Math.max(0, CONFIG.minRoster - team.roster.length - 1) * CONFIG.minimumSalary;
        const available = budget(league, team).space - reserve;
        const candidates = Object.values(league.players).filter(p => p.teamId === null && (!missing || p.pos === missing) && expectedSalary(p) <= available + 1e-6)
          .sort((a, b) => (playerValue(b, team.frontOffice?.direction) - expectedSalary(b) * 0.15) - (playerValue(a, team.frontOffice?.direction) - expectedSalary(a) * 0.15) || a.id.localeCompare(b.id));
        const player = candidates.find(p => evaluateContract(league, team.id, p.id, contractFor(p)).accepted);
        if (player && !signFreeAgent(league, team.id, player.id, contractFor(player)).length) { changed = true; continue; }
      }
      // Never use a minimum exception to acquire a star or to exceed the regulatory minimum.
      if (team.roster.length >= CONFIG.minRoster) continue;
      const pos = missing ?? POSITIONS[team.roster.length % 5];
      let player = Object.values(league.players).find(p => p.teamId === null && p.replacement && p.overall <= 58 && p.pos === pos);
      if (!player) {
        const rng = new Rng(hashSeed(`depth:${league.seed}:${league.season}:${team.id}:${nextRookieId(league.players)}`));
        player = generateMarketPlayers(rng, 1, reservePlayerIds(league, 1), Object.values(league.players).map(p => p.lastName), pos)[0];
        player.freeAgentSince = league.season; league.players[player.id] = player;
        logMarket(league, { type: 'pool', teamIds: [team.id], playerIds: [player.id], description: `Renfort de secours créé pour ${team.abbr} sous le minimum : ${playerName(player)}.` });
      }
      const errors = signFreeAgent(league, team.id, player.id, { salary: 0.8, years: 1, promisedRole: 'rolePlayer' });
      if (errors.length) throw new Error(errors.join(' '));
      logMarket(league, { type: 'pool', teamIds: [team.id], playerIds: [player.id], description: `${team.abbr} complète son minimum réglementaire avec ${playerName(player)} (0,8 M€, un an${player.minimumException ? ', exception budgétaire' : ''}).` });
      changed = true;
    }
    if (!changed) break;
  }
}

/** Explicit CPU renewals before expiry, at a controlled season boundary. User chooses their own renewals. */
export function cpuRenewals(league: League): void {
  for (const team of league.teams) {
    if (team.id === league.userTeamId) continue;
    const candidates = team.roster.map(id => league.players[id]).filter(p => p.contract.years === 1 && !p.extension && p.overall >= 68 && p.age < 35)
      .sort((a, b) => playerValue(b, team.frontOffice?.direction) - playerValue(a, team.frontOffice?.direction));
    for (const player of candidates.slice(0, 2)) extendContract(league, team.id, player.id, { salary: expectedSalary(player), years: player.age < 29 ? 3 : 1, promisedRole: 'rolePlayer' });
  }
}

export function runFrontOffices(league: League): void {
  if (!marketOpen(league) || league.phase !== 'regular' || league.day === 0 || league.day % 28 !== 0) return;
  ensureManagement(league);
  const key = `${league.season}:${league.day}`;
  if (league.management!.lastAIWindow === key) return;
  league.management!.lastAIWindow = key;
  league.management!.proposals = league.management!.proposals.filter(p => p.season === league.season && league.day - p.day <= 14);
  const teams = [...league.teams].sort((a, b) => hashSeed(`${key}:${a.id}`) - hashSeed(`${key}:${b.id}`));
  const used = new Set<string>();
  let executed = 0;
  for (const from of teams) {
    if (from.id === league.userTeamId || used.has(from.id)) continue;
    const outgoing = tradeCandidates(league, from);
    let found = false;
    for (const to of teams) {
      if (to.id === from.id || used.has(to.id)) continue;
      for (const give of outgoing) {
        for (const take of tradeCandidates(league, to)) {
          // Own rationality is checked independently, with the same current ownership/budget rules.
          if (playerValue(take, from.frontOffice?.direction) <= playerValue(give, from.frontOffice?.direction) * 1.03) continue;
          const offer = { fromTeamId: from.id, toTeamId: to.id, outgoingIds: [give.id], incomingIds: [take.id] };
          if (!evaluateTrade(league, offer).accepted) continue;
          if (to.id === league.userTeamId) {
            if (league.management!.proposals.length < 5) league.management!.proposals.push({ id: `${key}:${from.id}:${to.id}`, season: league.season, day: league.day, offer });
            found = true; break;
          }
          if (executed >= 4) break;
          if (!executeTrade(league, offer).length) { executed++; used.add(from.id); used.add(to.id); found = true; break; }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (executed >= 4 && league.management!.proposals.length >= 1) break;
  }
  fillRosters(league);
}
function tradeCandidates(league: League, team: Team): Player[] {
  return team.roster.map(id => league.players[id]).filter(p => !['core', 'unavailable'].includes(tradeStatus(league, p)))
    .sort((a, b) => Number(tradeStatus(league, b) === 'listed') - Number(tradeStatus(league, a) === 'listed') || a.id.localeCompare(b.id)).slice(0, 10);
}
export function updateCPUProjects(league: League): void {
  for (const team of league.teams) if (team.id !== league.userTeamId) {
    const next = defaultFrontOffice(league, team);
    const roster = team.roster.map(id => league.players[id]);
    const age = roster.reduce((n, p) => n + p.age, 0) / Math.max(1, roster.length);
    const record = team.wins + team.losses, rate = team.wins / Math.max(1, record);
    const young = roster.filter(p => p.age <= 25 && p.potential - p.overall >= 8).length;
    if (record >= 50) {
      next.direction = rate >= 0.6 ? 'contend' : rate < 0.35 ? 'rebuild' : age >= 29 && rate < 0.5 ? 'retool' : 'compete';
      next.decisionReason = `${team.wins}-${team.losses}, âge moyen ${age.toFixed(1)}, ${young} jeunes à développer : ${next.direction === 'rebuild' ? 'privilégier l’avenir' : next.direction === 'contend' ? 'renforcer les résultats immédiats' : next.direction === 'retool' ? 'rajeunir progressivement le noyau' : 'conserver un effectif compétitif'}.`;
    } else next.decisionReason = `Évaluation de l’effectif : note moyenne et ${young} jeunes à développer ; bilan insuffisant pour décider sur les résultats.`;
    next.directionSinceSeason = team.frontOffice?.direction === next.direction ? team.frontOffice.directionSinceSeason ?? league.season : league.season + 1;
    next.budgetDiscipline = next.direction === 'rebuild' ? 80 : next.direction === 'contend' ? 45 : 65;
    next.priorities = next.direction === 'rebuild' ? ['youth', 'depth'] : next.direction === 'retool' ? ['youth', 'defense'] : ['shooting', 'defense'];
    team.frontOffice = next;
    logMarket(league, { type: 'project', teamIds: [team.id], playerIds: [], description: `${team.abbr} réévalue son projet : ${next.decisionReason}` });
  }
}
