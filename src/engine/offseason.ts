import { defaultRotation, refreshRotations } from './coach';
import { generateDraftClass, nextRookieId } from './generate';
import { clampRating, computeOverall, defenseRating } from './ratings';
import { Rng } from './rng';
import { buildSchedule } from './schedule';
import { withRng } from './simSeason';
import { buildStandings, gameScore, mvpRace, winPct } from './stats';
import {
  emptyStatLine,
  playerName,
  type AttributeKey,
  type League,
  type Player,
  type SeasonAward,
  type SeasonHistory,
} from './types';

const ATTR_KEYS: AttributeKey[] = [
  'inside', 'midRange', 'three', 'freeThrow', 'passing', 'handling', 'offReb', 'defReb',
  'interiorDef', 'perimeterDef', 'steal', 'block', 'speed', 'strength', 'stamina', 'iq',
  'vertical', 'standingDunk', 'drivingDunk',
];

const ROSTER_TARGET = 14;
const ROSTER_MINIMUM = 13;

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
  league.phase = 'offseason';
  return entry;
}

function progressPlayer(rng: Rng, player: Player): number {
  const before = player.overall;
  let delta: number;
  if (player.age <= 24) {
    delta = (player.potential - player.overall) * rng.range(0.18, 0.5) + rng.normal(0.6, 1.2);
  } else if (player.age <= 28) {
    delta = (player.potential - player.overall) * rng.range(0.05, 0.22) + rng.normal(0.2, 1.4);
  } else if (player.age <= 31) {
    delta = rng.normal(-0.6, 1.4);
  } else {
    delta = -(player.age - 30) * rng.range(0.35, 1.1) + rng.normal(0, 1);
  }

  for (const key of ATTR_KEYS) {
    // Les qualités athlétiques déclinent plus vite, le tir et le QI vieillissent bien.
    const bias = key === 'speed' || key === 'stamina' || key === 'vertical' ? -0.5 : key === 'iq' || key === 'three' ? 0.4 : 0;
    player.attrs[key] = clampRating(player.attrs[key] + delta + bias + rng.normal(0, 1.2));
  }
  player.overall = computeOverall(player.attrs, player.pos);
  if (player.age <= 24) player.potential = clampRating(Math.max(player.potential, player.overall));
  else player.potential = clampRating(Math.max(player.overall, player.potential - rng.range(0, 1.5)));
  return player.overall - before;
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
export function startNextSeason(league: League): { retired: Player[]; drafted: { teamId: string; player: Player }[] } {
  const retired: Player[] = [];
  const drafted: { teamId: string; player: Player }[] = [];

  withRng(league, (rng) => {
    // --- Vieillissement et progression ---
    for (const player of Object.values(league.players)) {
      player.age += 1;
      player.career.seasons += 1;
      const delta = progressPlayer(rng, player);
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

    // --- Draft, dans l'ordre inverse du classement ---
    const order = [...league.teams].sort((a, b) => winPct(a.wins, a.losses) - winPct(b.wins, b.losses));
    // Petite loterie : les quatre pires bilans peuvent échanger leurs places.
    const lottery = rng.shuffle(order.slice(0, 4));
    const draftOrder = [...lottery, ...order.slice(4)];
    const activeNames = () => Object.values(league.players).map((p) => p.lastName);
    const pool = generateDraftClass(rng, 60, nextRookieId(league.players), activeNames());

    for (let round = 0; round < 2; round++) {
      for (const team of draftOrder) {
        if (pool.length === 0) break;
        if (team.roster.length >= ROSTER_TARGET) continue;
        const pick = pool.shift()!;
        pick.teamId = team.id;
        league.players[pick.id] = pick;
        team.roster.push(pick.id);
        drafted.push({ teamId: team.id, player: pick });
      }
    }

    // --- Agents libres : on complète les effectifs trop courts ---
    for (const team of league.teams) {
      while (team.roster.length < ROSTER_MINIMUM) {
        const filler = pool.shift() ?? generateDraftClass(rng, 1, nextRookieId(league.players), activeNames())[0];
        filler.teamId = team.id;
        filler.age = rng.int(23, 31);
        league.players[filler.id] = filler;
        team.roster.push(filler.id);
      }
    }

    // --- Numéros et contrats ---
    for (const player of Object.values(league.players)) {
      if (player.contract.years === 0) {
        player.contract = {
          salary: Math.round(Math.max(1, Math.pow(Math.max(0, (player.overall - 48) / 45), 2.6) * 48 + 1.1) * 10) / 10,
          years: rng.int(1, 4),
        };
      }
    }

    // --- Remise à zéro ---
    for (const player of Object.values(league.players)) {
      player.stats = emptyStatLine();
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

    league.season += 1;
    league.day = 0;
    league.phase = 'regular';
    league.playoffs = null;
    league.boxScores = {};
    league.feed = league.feed.slice(-40);
    league.schedule = buildSchedule(rng, league.teams);
  });

  refreshRotations(league, false);
  return { retired, drafted };
}

/** Meilleurs joueurs de la ligue, pour l'écran d'intersaison. */
export function topPlayers(league: League, limit = 10): Player[] {
  return Object.values(league.players)
    .sort((a, b) => b.overall - a.overall || gameScore(b.stats) - gameScore(a.stats))
    .slice(0, limit);
}
