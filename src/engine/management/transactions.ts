import { defaultRotation } from '../coach';
import { coachingPreset, eligibleIds, PLAYER_ROLES, PLAYER_ROLE_LABELS, repairGamePlan, validateGamePlan } from '../gamePlan';
import { playerName, POSITIONS, type League, type Player, type Team } from '../types';
import { budget, commitmentAt, DIRECTION_LABELS, contractDecision, defaultFrontOffice, initialSalaryCap, LEAGUE_ECONOMY_CONFIG as CONFIG, playerValue, tradeStatus } from './economy';
import { logMarket } from './state';
import type { ContractOffer, Decision, TradeOffer } from './types';

export function marketOpen(league: League): boolean {
  if (league.offseason?.stage === 'draft') return false;
  const end = Math.max(0, ...league.schedule.map(g => g.day));
  return league.phase === 'offseason' || league.phase === 'regular' && league.day <= Math.floor(end * 0.75);
}
export function repairManagedTeam(league: League, team: Team): void {
  team.rotation = team.rotation.filter(id => team.roster.includes(id));
  if (team.id === league.userTeamId) { repairGamePlan(team, league.players); return; }
  team.rotation = defaultRotation(team, league.players);
  if (eligibleIds(team, league.players).length < 5) { repairGamePlan(team, league.players); return; }
  const previous = team.gamePlan;
  const recommended = coachingPreset(team, league.players, team.frontOffice?.direction === 'rebuild' ? 'development' : 'competitive');
  const five = recommended.rotation.starterIds.map(id => league.players[id]);
  const avg = (key: 'three' | 'passing' | 'inside') => five.reduce((n, p) => n + p.attrs[key], 0) / 5;
  team.gamePlan = { ...previous, ...recommended,
    offense: avg('three') >= 72 ? 'paceSpace' : avg('passing') >= 72 ? 'motion' : avg('inside') >= 74 ? 'insideOut' : 'balanced',
    rolesByPlayerId: Object.fromEntries(Object.keys(recommended.rotation.minutesByPlayerId).map(id => [id, previous?.rolesByPlayerId[id] ?? 'rolePlayer'])),
  };
  repairGamePlan(team, league.players);
}
function valueFor(league: League, team: Team, player: Player, outgoing: readonly string[]) {
  const direction = (team.frontOffice ?? defaultFrontOffice(league, team)).direction;
  const remaining = team.roster.filter(id => !outgoing.includes(id)).map(id => league.players[id]);
  const shortage = Math.max(0, 2 - remaining.filter(p => p.pos === player.pos).length);
  return playerValue(player, direction) + shortage * 2;
}
export function evaluateTrade(league: League, offer: TradeOffer): Decision & { receivedValue: number; sentValue: number; salaryIn: number; salaryOut: number; projectedPayrolls: Record<string, number[]> } {
  const reasons: string[] = [], projections: Record<string, number[]> = {};
  const from = league.teams.find(t => t.id === offer.fromTeamId), to = league.teams.find(t => t.id === offer.toTeamId);
  const ids = [...offer.outgoingIds, ...offer.incomingIds];
  if (!marketOpen(league)) reasons.push('Échanges fermés après la date limite et pendant les playoffs.');
  if (!from || !to || from === to) reasons.push('Choisissez deux franchises distinctes.');
  if (!offer.outgoingIds.length || !offer.incomingIds.length || offer.outgoingIds.length > CONFIG.maxTradePlayers || offer.incomingIds.length > CONFIG.maxTradePlayers) reasons.push('Un à trois joueurs sont requis de chaque côté.');
  if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !Object.hasOwn(league.players, id))) reasons.push('Joueur absent ou sélectionné plusieurs fois.');
  const owned = (team: Team | undefined, selected: string[]) => team && selected.every(id => league.players[id]?.teamId === team.id && team.roster.includes(id));
  if (!owned(from, offer.outgoingIds) || !owned(to, offer.incomingIds)) reasons.push('Un joueur n’appartient plus à l’équipe indiquée.');
  if (ids.some(id => league.players[id] && ['core', 'unavailable'].includes(tradeStatus(league, league.players[id])))) reasons.push('Un joueur est dans le noyau dur ou indisponible.');
  let sentValue = 0, receivedValue = 0, salaryIn = 0, salaryOut = 0;
  if (from && to && ids.every(id => typeof id === 'string' && Object.hasOwn(league.players, id))) {
    salaryOut = offer.outgoingIds.reduce((n, id) => n + league.players[id].contract.salary, 0);
    salaryIn = offer.incomingIds.reduce((n, id) => n + league.players[id].contract.salary, 0);
    for (const [team, outgoing, incoming] of [[from, offer.outgoingIds, offer.incomingIds], [to, offer.incomingIds, offer.outgoingIds]] as const) {
      const next = [...team.roster.filter(id => !outgoing.includes(id)), ...incoming];
      if (next.length < CONFIG.minRoster || next.length > CONFIG.maxRoster) reasons.push(`${team.abbr} : effectif futur hors limites (${CONFIG.minRoster}–${CONFIG.maxRoster}).`);
      if (POSITIONS.some(pos => !next.some(id => league.players[id]?.pos === pos))) reasons.push(`${team.abbr} : un poste n’aurait plus aucun joueur.`);
      if (next.filter(id => league.players[id]?.injuryGames === 0).length < 5) reasons.push(`${team.abbr} : moins de cinq joueurs aptes après échange.`);
      const commitments = budget(league, team).commitments.map((sum, offset) => sum - outgoing.reduce((n, id) => n + commitmentAt(league.players[id], offset), 0) + incoming.reduce((n, id) => n + commitmentAt(league.players[id], offset), 0));
      projections[team.id] = commitments;
      if (commitments.some(sum => sum > (league.management?.salaryCap ?? initialSalaryCap(league)) + 1e-6)) reasons.push(`${team.abbr} : plafond dépassé sur un exercice engagé.`);
    }
    // The receiving CPU has its own direction/needs, not the proposer's evaluation.
    sentValue = offer.incomingIds.reduce((n, id) => n + valueFor(league, to, league.players[id], offer.incomingIds), 0);
    receivedValue = offer.outgoingIds.reduce((n, id) => n + valueFor(league, to, league.players[id], offer.incomingIds), 0);
    if (from.id !== league.userTeamId) {
      const sent = offer.outgoingIds.reduce((n, id) => n + valueFor(league, from, league.players[id], offer.outgoingIds), 0);
      const received = offer.incomingIds.reduce((n, id) => n + valueFor(league, from, league.players[id], offer.outgoingIds), 0);
      if (received < sent * 1.03) reasons.push(`${from.abbr} ne confirme pas l’offre à la valeur actuelle des joueurs.`);
    }
    const threshold = to.frontOffice?.direction === 'retool' ? 1.03 : 1.05;
    if (receivedValue < sentValue * threshold) reasons.push(`${to.abbr} refuse : valeur reçue ${receivedValue.toFixed(1)}, cédée ${sentValue.toFixed(1)} (projet ${DIRECTION_LABELS[to.frontOffice?.direction ?? 'compete']}).`);
  }
  return { accepted: !reasons.length, reasons, sentValue, receivedValue, salaryIn, salaryOut, projectedPayrolls: projections };
}

/** Commit only after all speculative changes/plan repairs succeeded. Preserve object identities used by callers. */
function transact(league: League, teams: string[], ids: string[], mutate: (draft: League) => void): string[] {
  if (!league.management) return ['Marché non initialisé : rechargez la carrière.'];
  const draft = structuredClone(league);
  try {
    mutate(draft);
    for (const teamId of teams) {
      const team = draft.teams.find(t => t.id === teamId)!;
      repairManagedTeam(draft, team);
      if (eligibleIds(team, draft.players).length >= 5) {
        const errors = validateGamePlan(team.gamePlan, team, draft.players);
        if (errors.length) return errors;
      }
      if (new Set(team.roster).size !== team.roster.length || team.roster.some(id => draft.players[id]?.teamId !== team.id)) return ['Effectif incohérent.'];
    }
  } catch (error) { return [error instanceof Error ? error.message : 'Transaction impossible.']; }
  for (const teamId of teams) Object.assign(league.teams.find(t => t.id === teamId)!, draft.teams.find(t => t.id === teamId)!);
  for (const id of ids) Object.assign(league.players[id], draft.players[id]);
  league.management = draft.management; league.feed = draft.feed;
  return [];
}
export function executeTrade(league: League, offer: TradeOffer): string[] {
  const decision = evaluateTrade(league, offer);
  if (!decision.accepted) return decision.reasons;
  return transact(league, [offer.fromTeamId, offer.toTeamId], [...offer.outgoingIds, ...offer.incomingIds], draft => {
    const from = draft.teams.find(t => t.id === offer.fromTeamId)!, to = draft.teams.find(t => t.id === offer.toTeamId)!;
    from.roster = [...from.roster.filter(id => !offer.outgoingIds.includes(id)), ...offer.incomingIds];
    to.roster = [...to.roster.filter(id => !offer.incomingIds.includes(id)), ...offer.outgoingIds];
    for (const id of offer.outgoingIds) { draft.players[id].teamId = to.id; draft.players[id].tradeStatus = 'normal'; }
    for (const id of offer.incomingIds) { draft.players[id].teamId = from.id; draft.players[id].tradeStatus = 'normal'; }
    assignIncomingNumbers(draft, from, offer.incomingIds); assignIncomingNumbers(draft, to, offer.outgoingIds);
    logMarket(draft, { type: 'trade', teamIds: [from.id, to.id], playerIds: [...offer.outgoingIds, ...offer.incomingIds], description: `${from.abbr} échange ${offer.outgoingIds.map(id => playerName(draft.players[id])).join(', ')} contre ${offer.incomingIds.map(id => playerName(draft.players[id])).join(', ')} (${to.abbr}).` });
  });
}
export function evaluateContract(league: League, teamId: string, playerId: string, offer: ContractOffer) {
  const team = league.teams.find(t => t.id === teamId), player = Object.hasOwn(league.players, playerId) ? league.players[playerId] : undefined;
  if (!team || !player) return { accepted: false, reasons: ['Équipe ou joueur absent.'], askingSalary: 0, projectedPayroll: [] };
  if (!PLAYER_ROLES.includes(offer.promisedRole)) return { accepted: false, reasons: ['Rôle promis inconnu.'], askingSalary: 0, projectedPayroll: [] };
  if (league.offseason?.stage === 'draft') return { accepted: false, reasons: ['Terminez la draft avant de négocier des contrats.'], askingSalary: 0, projectedPayroll: [] };
  if (league.phase === 'playoffs') return { accepted: false, reasons: ['Signatures fermées pendant les playoffs.'], askingSalary: 0, projectedPayroll: [] };
  return contractDecision(league, team, player, offer);
}
export function signFreeAgent(league: League, teamId: string, playerId: string, offer: ContractOffer): string[] {
  if (league.players[playerId]?.teamId !== null) return ['Ce joueur n’est plus agent libre.'];
  const decision = evaluateContract(league, teamId, playerId, offer);
  if (!decision.accepted) return decision.reasons;
  return transact(league, [teamId], [playerId], draft => {
    const team = draft.teams.find(t => t.id === teamId)!, player = draft.players[playerId];
    player.teamId = teamId; player.contract = { salary: offer.salary, years: offer.years }; player.promisedRole = offer.promisedRole;
    delete player.extension; delete player.freeAgentSince; delete player.minimumException; delete player.legacyMinimum;
    if (budget(draft, team).payroll + offer.salary > draft.management!.salaryCap + 1e-6) player.minimumException = true;
    team.roster.push(playerId);
    const used = new Set(team.roster.filter(id => id !== playerId).map(id => draft.players[id].number));
    player.number = Array.from({ length: 100 }, (_, i) => i).find(n => !used.has(n)) ?? 0;
    logMarket(draft, { type: 'sign', teamIds: [teamId], playerIds: [playerId], description: `${team.abbr} signe ${playerName(player)} : ${offer.salary.toFixed(1)} M€ × ${offer.years} an(s), rôle ${PLAYER_ROLE_LABELS[offer.promisedRole]}.` });
  });
}
export function extendContract(league: League, teamId: string, playerId: string, offer: ContractOffer): string[] {
  if (league.players[playerId]?.teamId !== teamId) return ['Ce joueur n’appartient pas à votre équipe.'];
  const decision = evaluateContract(league, teamId, playerId, offer);
  if (!decision.accepted) return decision.reasons;
  return transact(league, [teamId], [playerId], draft => {
    const player = draft.players[playerId]; player.extension = structuredClone(offer);
    logMarket(draft, { type: 'extend', teamIds: [teamId], playerIds: [playerId], description: `${draft.teams.find(t => t.id === teamId)!.abbr} prolonge ${playerName(player)} : ${offer.salary.toFixed(1)} M€ × ${offer.years} an(s) à partir de la saison suivante.` });
  });
}

function assignIncomingNumbers(league: League, team: Team, incoming: string[]): void {
  const used = new Set(team.roster.filter(id => !incoming.includes(id)).map(id => league.players[id].number));
  for (const id of incoming) {
    const player = league.players[id];
    if (used.has(player.number)) player.number = Array.from({ length: 100 }, (_, n) => n).find(n => !used.has(n))!;
    used.add(player.number);
  }
}
