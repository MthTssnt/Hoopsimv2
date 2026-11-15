import type { League, Player, Team } from '../types';
import type { FrontOfficeDirection, FrontOfficePlan, ContractOffer, Decision, TradeStatus } from './types';

/** Fictitious league, M€ per season; no claim to reproduce an NBA CBA. */
export const LEAGUE_ECONOMY_CONFIG = {
  baseSalaryCap: 250, minimumSalary: 0.8, maximumSalary: 60, maximumYears: 4,
  minRoster: 13, targetRoster: 14, maxRoster: 15, maxTradePlayers: 3,
  retainedTransactions: 200, initialFreeAgents: 30,
} as const;
export const DIRECTION_LABELS: Record<FrontOfficeDirection, string> = { contend: 'Viser le titre', compete: 'Compétitif', retool: 'Réorganiser', rebuild: 'Reconstruire' };
export function payrollOf(league: League, team: Team): number { return Math.round(team.roster.reduce((s, id) => s + (league.players[id]?.contract.salary ?? 0), 0) * 10) / 10; }
export function initialSalaryCap(league: League): number {
  return Math.max(LEAGUE_ECONOMY_CONFIG.baseSalaryCap, ...league.teams.map(t => Math.ceil(payrollOf(league, t) / 10) * 10));
}
export function defaultFrontOffice(league: League, team: Team): FrontOfficePlan {
  const average = team.roster.reduce((s, id) => s + (league.players[id]?.overall ?? 0), 0) / Math.max(1, team.roster.length);
  const direction = average >= 69 ? 'contend' : average >= 65 ? 'compete' : average >= 62 ? 'retool' : 'rebuild';
  return { direction, budgetDiscipline: direction === 'rebuild' ? 80 : 60, priorities: direction === 'rebuild' ? ['youth', 'depth'] : ['shooting', 'defense'] };
}
export function expectedSalary(player: Player): number {
  if (player.replacement && player.overall <= 58) return 0.8;
  const scale = Math.max(0, (player.overall - 48) / 45);
  return Math.round(Math.min(60, Math.max(0.8, Math.pow(scale, 2.6) * 48 + 1.1)) * 10) / 10;
}
/** Contract control includes already negotiated extensions, starting after the current contract. */
export function commitmentAt(player: Player, offset: number): number {
  if (offset < player.contract.years) return player.contract.salary;
  if (player.extension && offset < player.contract.years + player.extension.years) return player.extension.salary;
  return 0;
}
export function contractSeason(league: League): number { return league.season + (league.offseason ? 1 : 0); }
export function budget(league: League, team: Team) {
  const cap = league.management?.salaryCap ?? initialSalaryCap(league);
  const commitments = Array.from({ length: 5 }, (_, year) => Math.round(team.roster.reduce((s, id) => s + commitmentAt(league.players[id], year), 0) * 10) / 10);
  return { cap, payroll: commitments[0], space: Math.round((cap - commitments[0]) * 10) / 10, commitments,
    expiringIds: team.roster.filter(id => league.players[id].contract.years === 1 && !league.players[id].extension) };
}
export function tradeStatus(league: League, player: Player): TradeStatus {
  if (player.tradeStatus) return player.tradeStatus;
  if (player.teamId && player.teamId !== league.userTeamId && player.overall >= 85) {
    const team = league.teams.find(t => t.id === player.teamId);
    if (team?.roster.map(id => league.players[id]).sort((a, b) => b.overall - a.overall).slice(0, 2).some(p => p.id === player.id)) return 'core';
  }
  return 'normal';
}
export function playerValue(player: Player, direction: FrontOfficeDirection = 'compete'): number {
  const now = Math.pow(Math.max(0, player.overall - 35), 2) / 80;
  // Absolute future quality prevents a lower current rating from manufacturing market value.
  const projected = Math.pow(Math.max(0, Math.max(player.overall, player.potential) - 35), 2) / 80;
  const youth = Math.max(0, Math.min(1, (30 - player.age) / 10));
  const immediate = { contend: 1.2, compete: 1, retool: 0.95, rebuild: 0.8 }[direction];
  const future = { contend: 0.35, compete: 0.75, retool: 0.95, rebuild: 1.4 }[direction];
  const contractRisk = Math.max(0, player.contract.salary - expectedSalary(player)) * Math.max(1, player.contract.years) * 0.45;
  const extensionRisk = player.extension ? Math.max(0, player.extension.salary - expectedSalary(player)) * player.extension.years * 0.45 : 0;
  return Math.round(Math.max(0.5, now * immediate + projected * youth * future + Math.min(4, player.contract.years) * 0.5 - Math.max(0, player.age - 31) * 0.6 - player.injuryGames * 0.12 - contractRisk - extensionRisk) * 10) / 10;
}
export function contractDecision(league: League, team: Team, player: Player, offer: ContractOffer): Decision & { askingSalary: number; projectedPayroll: number[] } {
  const reasons: string[] = [];
  if (!Number.isFinite(offer.salary) || offer.salary < 0.8 || offer.salary > 60 || Math.abs(offer.salary * 10 - Math.round(offer.salary * 10)) > 1e-6) reasons.push('Salaire : 0,8 à 60 M€, par dixième.');
  if (!Number.isInteger(offer.years) || offer.years < 1 || offer.years > 4) reasons.push('Durée : un à quatre ans.');
  const extension = player.teamId === team.id;
  if (extension && (player.contract.years !== 1 || player.extension)) reasons.push('Prolongation disponible uniquement sur le dernier exercice, sans prolongation déjà signée.');
  if (!extension && player.teamId !== null) reasons.push('Ce joueur n’est pas agent libre.');
  if (!extension && team.roster.length >= LEAGUE_ECONOMY_CONFIG.maxRoster) reasons.push('Effectif complet (15 joueurs).');
  const rank = team.roster.filter(id => id !== player.id && league.players[id].overall > player.overall).length;
  if (offer.promisedRole === 'primaryCreator' && rank >= 3 || offer.promisedRole === 'secondaryCreator' && rank >= 6 || offer.promisedRole === 'sixthMan' && rank >= 8) reasons.push('Le rôle promis n’est pas crédible au vu de cet effectif.');
  const askingSalary = expectedSalary(player);
  if (offer.salary + 1e-6 < askingSalary * (extension ? 0.94 : 1)) reasons.push(`Le joueur demande environ ${askingSalary.toFixed(1)} M€ par saison.`);
  if (player.age < 27 && offer.years < 2 && player.overall >= 70) reasons.push('Ce jeune joueur souhaite au moins deux ans de sécurité.');
  const hypothetical = { ...player, ...(extension ? { extension: offer } : { contract: { salary: offer.salary, years: offer.years } }) };
  const projectedPayroll = budget(league, team).commitments.map((sum, offset) => Math.round((sum - (extension ? commitmentAt(player, offset) : 0) + commitmentAt(hypothetical, offset)) * 10) / 10);
  const cap = league.management?.salaryCap ?? initialSalaryCap(league);
  const minimumException = !extension && player.replacement === true && player.overall <= 58 && offer.salary === 0.8 && offer.years === 1 && team.roster.length < LEAGUE_ECONOMY_CONFIG.minRoster;
  if (projectedPayroll.some((sum, offset) => sum > cap + 1e-6 && (!extension || offset > 0)) && !minimumException) reasons.push('Le plafond budgétaire serait dépassé sur un exercice engagé.');
  return { accepted: !reasons.length, reasons, askingSalary, projectedPayroll };
}
