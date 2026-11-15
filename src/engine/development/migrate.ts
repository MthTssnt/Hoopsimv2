import type { League } from '../types';
import { REVIEW_LIMIT } from './reports';
import { TRAINING_FOCI } from './types';
/** Optional fields keep old saves unchanged; active drafts are validated without replaying any step. */
export function migrateDevelopment(league: League): void {
  for (const p of Object.values(league.players)) if (p.training) {
    if (!TRAINING_FOCI.includes(p.training.focus)) p.training.focus = 'balanced';
    p.training.days = Object.fromEntries(TRAINING_FOCI.filter(f => Number.isFinite(p.training!.days?.[f]) && p.training!.days[f]! > 0).map(f => [f, Math.min(365, p.training!.days[f]!)]));
  }
  if (league.seasonReviews) league.seasonReviews = league.seasonReviews.slice(-REVIEW_LIMIT);
  const d = league.offseason;
  if (!d) return;
  const fail = () => { throw new Error('Draft sauvegardée incohérente : aucun passage d’intersaison automatique n’a été effectué.'); };
  if (league.phase !== 'offseason' || d.version !== 1 || d.season !== league.season || !['draft', 'ready'].includes(d.stage) || !Number.isInteger(d.cursor) || d.cursor < 0 || d.cursor > d.picks.length) fail();
  if (d.picks.length !== league.teams.length * 2 || new Set(d.picks.map(p => p.id)).size !== d.picks.length || d.picks.some(p => !league.teams.some(t => t.id === p.ownerTeamId && t.id === p.originalTeamId))) fail();
  if (d.stage === 'ready' && d.cursor !== d.picks.length || d.stage === 'draft' && d.cursor === d.picks.length) fail();
  for (const [id, prospect] of Object.entries(d.prospects)) if (id !== prospect.player.id || Object.hasOwn(league.players, id) || prospect.player.teamId !== null || !Number.isFinite(prospect.estimatedPotential)) fail();
  if (d.stage === 'draft') for (const pick of d.picks.slice(0, d.cursor)) if (pick.player && league.players[pick.player.id]?.teamId !== pick.ownerTeamId) fail();
}
