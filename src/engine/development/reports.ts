import { payrollOf } from '../management/economy';
import { playerName, type League, type Player } from '../types';
import type { PlayerIdentity, SeasonReview } from './types';
export const REVIEW_LIMIT = 10;
export function identity(p: Player): PlayerIdentity { return { id: p.id, name: playerName(p), pos: p.pos, age: p.age, overall: p.overall }; }
export function ensureSeasonReview(league: League): SeasonReview {
  league.seasonReviews ??= [];
  let review = league.seasonReviews.find(r => r.season === league.season);
  if (review) return review;
  review = { season: league.season, development: [], draft: [], retiredCount: 0,
    teams: league.teams.map(t => {
      const roster = t.roster.map(id => league.players[id]);
      const scorer = [...roster].filter(p => p.stats.gp > 0).sort((a, b) => b.stats.pts / b.stats.gp - a.stats.pts / a.stats.gp)[0];
      return { teamId: t.id, wins: t.wins, losses: t.losses, payroll: payrollOf(league, t),
        averageAge: roster.reduce((n, p) => n + p.age, 0) / Math.max(1, roster.length), averageOverall: roster.reduce((n, p) => n + p.overall, 0) / Math.max(1, roster.length),
        direction: t.frontOffice?.direction ?? 'compete', scorer: scorer ? { ...identity(scorer), pointsPerGame: scorer.stats.pts / scorer.stats.gp } : undefined };
    }),
  };
  league.seasonReviews.push(review); league.seasonReviews = league.seasonReviews.slice(-REVIEW_LIMIT);
  return review;
}
