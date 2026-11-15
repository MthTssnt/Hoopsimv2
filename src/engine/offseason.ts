import { ensureManagement, logMarket } from './management/state';
import { cpuRenewals, fillRosters, updateCPUProjects } from './management/aiGm';
import { defaultRotation, refreshRotations } from './coach';
import { repairManagedTeam } from './management/transactions';
import { progressPlayer, recommendTraining } from './development/training';
import { advanceCPUDraft, createDraft } from './development/draft';
import { ensureSeasonReview } from './development/reports';
import { defenseRating } from './ratings';
import type { Rng } from './rng';
import { buildSchedule } from './schedule';
import { withRng } from './simSeason';
import { buildStandings, gameScore, mvpRace } from './stats';
import {
  emptyStatLine,
  playerName,
  type League,
  type Player,
  type SeasonAward,
  type SeasonHistory,
} from './types';

export function computeAwards(league: League): { mvpId: string; awards: SeasonAward[] } {
  const race = mvpRace(league, 5);
  const mvpId = race[0]?.player.id ?? '';
  const awards: SeasonAward[] = race.slice(0, 5).map((row, i) => ({
    playerId: row.player.id,
    teamId: row.team?.id ?? '',
    label: i === 0 ? 'MVP' : 'All-League',
  }));

  const dpoy = Object.values(league.players)
    .filter((p) => p.teamId && p.stats.gp >= 40)
    .map((p) => {
      const perGameStops = (p.stats.stl + p.stats.blk + p.stats.dreb * 0.35) / Math.max(1, p.stats.gp);
      return { player: p, score: defenseRating(p) * 0.6 + perGameStops * 6 };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (dpoy) {
    awards.push({ playerId: dpoy.player.id, teamId: dpoy.player.teamId ?? '', label: 'Meilleur défenseur' });
  }

  return { mvpId, awards };
}

/** Clôt la saison : archive le palmarès et bascule en intersaison. */
export function closeSeason(league: League): SeasonHistory {
  const existing = league.history.find(h => h.season === league.season);
  if (existing) return existing;
  const playoffs = league.playoffs;
  const championId = playoffs?.championId ?? '';
  const finals = playoffs?.rounds[3]?.[0];
  const runnerUpId = finals
    ? finals.winnerId === finals.highSeed.teamId
      ? finals.lowSeed.teamId
      : finals.highSeed.teamId
    : '';

  const { mvpId, awards } = computeAwards(league);
  const entry: SeasonHistory = {
    playerNames: Object.fromEntries([...new Set([mvpId, playoffs?.finalsMvpId ?? '', ...awards.map(a => a.playerId)])].filter(id => league.players[id]).map(id => [id, playerName(league.players[id])])),
    season: league.season,
    championId,
    runnerUpId,
    mvpId,
    finalsMvpId: playoffs?.finalsMvpId ?? '',
    standings: buildStandings(league).map((row) => ({ teamId: row.team.id, wins: row.wins, losses: row.losses })),
    allLeague: awards,
  };

  const champion = league.teams.find((t) => t.id === championId);
  if (champion) {
    for (const id of champion.roster) {
      const p = league.players[id];
      if (p) p.career.titles += 1;
    }
  }

  league.history.push(entry);
  ensureSeasonReview(league);
  league.phase = 'offseason';
  return entry;
}

function shouldRetire(rng: Rng, player: Player): boolean {
  if (player.age >= 40) return true;
  if (player.age >= 37 && player.overall < 74) return true;
  if (player.age >= 34 && player.overall < 60) return rng.chance(0.6);
  if (player.age >= 32 && player.overall < 50) return rng.chance(0.5);
  return player.age >= 35 && rng.chance(0.18);
}

/**
 * Passe à la saison suivante : vieillissement, progression, retraites,
 * draft des rookies puis nouveau calendrier.
 */
export function beginOffseason(league: League): void {
  if (league.phase !== 'offseason') throw new Error('Terminez la saison avant de lancer l’intersaison.');
  if (league.offseason) return; // Reload/click cannot age, progress or expire twice.
  ensureManagement(league);
  const review = ensureSeasonReview(league);
  cpuRenewals(league);
  updateCPUProjects(league);
  const retired: Player[] = [];
  const duration = Math.max(1, ...league.schedule.map(g => g.day + 1));

  withRng(league, (rng) => {
    // --- Vieillissement et progression ---
    for (const player of Object.values(league.players)) {
      player.age += 1;
      player.career.seasons += 1;
      const change = progressPlayer(rng, player, duration);
      if (player.teamId === league.userTeamId) review.development.push(change);
      const delta = change.after - change.before;
      if (Math.abs(delta) >= 6 && player.teamId) {
        const team = league.teams.find((t) => t.id === player.teamId);
        league.feed.push({
          day: 0,
          text: `${playerName(player)} (${team?.abbr ?? '?'}) ${delta > 0 ? 'progresse' : 'régresse'} de ${Math.abs(Math.round(delta))} points (${player.overall}).`,
        });
      }
      player.contract.years = Math.max(0, player.contract.years - 1);
    }

    // --- Retraites ---
    for (const player of Object.values(league.players)) {
      if (!shouldRetire(rng, player)) continue;
      retired.push(player);
      const team = league.teams.find((t) => t.id === player.teamId);
      if (team) team.roster = team.roster.filter((id) => id !== player.id);
      delete league.players[player.id];
    }

    // --- Expiration réelle ou activation d’une prolongation déjà négociée ---
    for (const player of Object.values(league.players)) {
      if (!player.teamId || player.contract.years > 0) continue;
      if (player.extension) {
        player.contract = { salary: player.extension.salary, years: player.extension.years };
        player.promisedRole = player.extension.promisedRole;
        delete player.extension; delete player.minimumException; delete player.legacyMinimum;
      } else {
        const team = league.teams.find(t => t.id === player.teamId)!;
        team.roster = team.roster.filter(id => id !== player.id);
        player.teamId = null; player.contract = { salary: 0, years: 0 }; player.freeAgentSince = league.season + 1;
        delete player.minimumException; delete player.legacyMinimum; delete player.promisedRole; player.tradeStatus = 'normal';
        logMarket(league, { type: 'expire', teamIds: [team.id], playerIds: [player.id], description: `${playerName(player)} quitte ${team.abbr} à l’expiration de son contrat et devient agent libre.` });
      }
    }

    review.retiredCount = retired.length;
    createDraft(league, rng, retired);
    league.management!.proposals = [];
  });
  for (const team of league.teams) repairManagedTeam(league, team);
}

/** Finalizes only a completed draft. The user can still sign free agents before this step. */
export function finishOffseason(league: League): void {
  if (league.phase !== 'offseason' || league.offseason?.season !== league.season || league.offseason.stage !== 'ready') throw new Error('Terminez la draft avant de lancer la saison.');
  withRng(league, (rng) => {
    fillRosters(league);
    for (const team of league.teams) {
      const used = new Set<number>();
      for (const id of team.roster) {
        const p = league.players[id];
        if (used.has(p.number)) p.number = Array.from({ length: 100 }, (_, i) => i).find(n => !used.has(n))!;
        used.add(p.number);
      }
    }

    // --- Remise à zéro ---
    for (const player of Object.values(league.players)) {
      player.stats = emptyStatLine();
      player.developmentSeconds = 0;
      player.playoffStats = emptyStatLine();
      player.energy = 100;
      player.injuryGames = 0;
      player.injuryLabel = null;
    }
    for (const team of league.teams) {
      team.wins = 0;
      team.losses = 0;
      team.pointsFor = 0;
      team.pointsAgainst = 0;
      team.streak = 0;
      team.confWins = 0;
      team.confLosses = 0;
      team.lastTen = [];
      team.roster.sort((a, b) => (league.players[b]?.overall ?? 0) - (league.players[a]?.overall ?? 0));
      team.rotation = defaultRotation(team, league.players);
    }

    for (const team of league.teams) if (team.id !== league.userTeamId) for (const id of team.roster) {
      const p = league.players[id]; p.training = { focus: recommendTraining(p), days: {} };
    }
    delete league.offseason;
    delete league.lastTrainingDay;
    league.season += 1;
    league.day = 0;
    league.phase = 'regular';
    league.playoffs = null;
    league.boxScores = {};
    league.feed = league.feed.slice(-200);
    league.schedule = buildSchedule(rng, league.teams);
  });

  refreshRotations(league, false);
  for (const team of league.teams) if (team.id !== league.userTeamId) repairManagedTeam(league, team);
}

/** Explicit fully automated compatibility API for scripts; the UI uses begin/draft/finish steps. */
export function startNextSeason(league: League): { retired: Player[]; drafted: { teamId: string; player: Player }[] } {
  beginOffseason(league);
  advanceCPUDraft(league, true);
  const d = league.offseason!;
  const retired = d.retired;
  const drafted = d.picks.filter(p => p.player).map(p => ({ teamId: p.ownerTeamId, player: league.players[p.player!.id] }));
  finishOffseason(league);
  return { retired, drafted };
}

/** Meilleurs joueurs de la ligue, pour l'écran d'intersaison. */
export function topPlayers(league: League, limit = 10): Player[] {
  return Object.values(league.players)
    .sort((a, b) => b.overall - a.overall || gameScore(b.stats) - gameScore(a.stats))
    .slice(0, limit);
}
