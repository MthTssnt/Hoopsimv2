import { generateDraftClass } from '../generate';
import { budget, LEAGUE_ECONOMY_CONFIG as CONFIG, DIRECTION_LABELS } from '../management/economy';
import { logMarket, reservePlayerIds } from '../management/state';
import { repairManagedTeam } from '../management/transactions';
import { clampRating } from '../ratings';
import { hashSeed, Rng } from '../rng';
import { winPct } from '../stats';
import { playerName, type League, type Team } from '../types';
import { identity, ensureSeasonReview } from './reports';
import type { DraftPick, DraftProspect, OffseasonState } from './types';

export function createDraft(league: League, rng: Rng, retired: OffseasonState['retired']): void {
  const order = [...league.teams].sort((a, b) => winPct(a.wins, a.losses) - winPct(b.wins, b.losses));
  const draftOrder = [...rng.shuffle(order.slice(0, 4)), ...order.slice(4)];
  const pool = generateDraftClass(rng, 60, reservePlayerIds(league, 60), Object.values(league.players).map(p => p.lastName));
  const prospects = Object.fromEntries(pool.map(player => {
    player.contract.salary = Math.max(CONFIG.minimumSalary, player.contract.salary);
    const scout = new Rng(hashSeed(`scout:${league.seed}:${league.season}:${player.id}`));
    return [player.id, { player, estimatedPotential: clampRating(player.potential + scout.int(-5, 5)), uncertainty: scout.int(6, 10) }];
  }));
  const picks: DraftPick[] = [];
  for (let round = 1; round <= 2; round++) for (const t of draftOrder) picks.push({ id: `${league.season}:${round}:${t.id}`, round, number: picks.length + 1, originalTeamId: t.id, ownerTeamId: t.id });
  league.offseason = { version: 1, season: league.season, stage: 'draft', cursor: 0, picks, prospects, retired };
}
export function draftDecision(league: League, pickId: string, playerId: string): string[] {
  const d = league.offseason, pick = d?.picks[d.cursor];
  if (league.phase !== 'offseason' || d?.stage !== 'draft' || d.season !== league.season || !pick || pick.id !== pickId) return ['Ce choix n’est plus le choix courant.'];
  const p = Object.hasOwn(d.prospects, playerId) ? d.prospects[playerId].player : undefined;
  if (!p || Object.hasOwn(league.players, playerId)) return ['Prospect absent ou déjà sélectionné.'];
  const team = league.teams.find(t => t.id === pick.ownerTeamId);
  if (!team) return ['Propriétaire du choix absent.'];
  if (team.roster.length >= CONFIG.maxRoster) return ['Effectif complet (15 joueurs).'];
  if (budget(league, team).commitments.slice(0, p.contract.years).some(sum => sum + p.contract.salary > league.management!.salaryCap + 1e-6)) return ['Contrat rookie incompatible avec les engagements budgétaires.'];
  return [];
}
/** CPU uses the same visible scouting estimate as the human, plus own strategy and positional need. */
export function prospectScore(league: League, team: Team, prospect: DraftProspect): number {
  const p = prospect.player, direction = team.frontOffice?.direction ?? 'compete';
  const count = team.roster.filter(id => league.players[id].pos === p.pos).length;
  const readiness = Math.pow(Math.max(0, p.overall - 35), 2) / 80;
  const ceiling = Math.pow(Math.max(0, prospect.estimatedPotential - 35), 2) / 80;
  const weights = { contend: [1.2, 0.35], compete: [1, 0.7], retool: [0.8, 0.95], rebuild: [0.65, 1.1] }[direction];
  // Absolute projected quality: a worse prospect must not gain value merely from a larger growth gap.
  return readiness * weights[0] + ceiling * weights[1] + Math.max(0, 22 - p.age) * (direction === 'rebuild' ? 0.3 : 0.05)
    + Math.max(0, 2 - count) * 1.5 - p.contract.salary * 0.15 - prospect.uncertainty * (direction === 'contend' ? 0.12 : 0.04);
}
export function recommendedProspect(league: League, team: Team): DraftProspect | undefined {
  const d = league.offseason, pick = d?.picks[d.cursor];
  if (!d || !pick) return;
  return Object.values(d.prospects).filter(p => !draftDecision(league, pick.id, p.player.id).length)
    .sort((a, b) => prospectScore(league, team, b) - prospectScore(league, team, a) || a.player.id.localeCompare(b.player.id))[0];
}
export function chooseDraftPlayer(league: League, pickId: string, playerId: string | null): string[] {
  const d = league.offseason, pick = d?.picks[d.cursor];
  if (league.phase !== 'offseason' || d?.stage !== 'draft' || d.season !== league.season || !pick || pick.id !== pickId) return ['Ce choix n’est plus le choix courant.'];
  if (playerId !== null) { const errors = draftDecision(league, pickId, playerId); if (errors.length) return errors; }
  const team = league.teams.find(t => t.id === pick.ownerTeamId)!;
  if (playerId === null) {
    pick.reason = team.roster.length >= CONFIG.targetRoster ? 'Effectif suffisamment fourni ; choix passé.' : 'Choix passé : décision du club ou aucun contrat rookie abordable.';
    logMarket(league, { type: 'draft', teamIds: [team.id], playerIds: [], description: `${team.abbr} passe le choix ${pick.number} : ${pick.reason}` });
  } else {
    const prospect = d.prospects[playerId], p = prospect.player;
    p.teamId = team.id; league.players[p.id] = p; team.roster.push(p.id);
    const used = new Set(team.roster.filter(id => id !== p.id).map(id => league.players[id].number));
    p.number = Array.from({ length: 100 }, (_, n) => n).find(n => !used.has(n))!;
    pick.player = identity(p); pick.estimatedPotential = prospect.estimatedPotential; pick.salary = p.contract.salary;
    pick.reason = `Projet ${DIRECTION_LABELS[team.frontOffice?.direction ?? 'compete']}, note ${p.overall}, potentiel estimé ${prospect.estimatedPotential}, ${team.roster.filter(id => league.players[id].pos === p.pos).length - 1} joueur(s) déjà au poste.`;
    delete d.prospects[playerId];
    repairManagedTeam(league, team);
    logMarket(league, { type: 'draft', teamIds: [team.id], playerIds: [p.id], description: `${team.abbr} sélectionne ${playerName(p)} au choix ${pick.number} (tour ${pick.round}). ${pick.reason}` });
  }
  d.cursor++;
  if (d.cursor === d.picks.length) {
    for (const { player } of Object.values(d.prospects)) {
      player.teamId = null; player.contract = { salary: 0, years: 0 }; player.freeAgentSince = league.season + 1;
      league.players[player.id] = player;
    }
    d.prospects = {}; d.stage = 'ready';
    ensureSeasonReview(league).draft = structuredClone(d.picks);
    logMarket(league, { type: 'pool', teamIds: [], playerIds: [], description: 'Draft terminée : les prospects non retenus deviennent agents libres. Complétez les effectifs avant la nouvelle saison.' });
  }
  return [];
}
/** Stops at each actionable human pick; explicit automation is available for headless careers. */
export function advanceCPUDraft(league: League, automateUser = false): void {
  const d = league.offseason;
  if (league.phase !== 'offseason' || d?.stage !== 'draft') return;
  while (d.cursor < d.picks.length) {
    const pick = d.picks[d.cursor], team = league.teams.find(t => t.id === pick.ownerTeamId)!;
    const candidate = recommendedProspect(league, team);
    if (team.id === league.userTeamId && !automateUser && candidate) return;
    const playerId = team.roster.length < CONFIG.targetRoster ? candidate?.player.id ?? null : null;
    const errors = chooseDraftPlayer(league, pick.id, playerId);
    if (errors.length) throw new Error(errors.join(' '));
  }
}
