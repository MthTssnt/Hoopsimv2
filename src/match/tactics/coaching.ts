import type { GamePlan } from '../../engine/gamePlan';
import type { MatchWorld } from '../world/MatchWorld';

export type CoachCommand = { kind: 'plan'; plan: GamePlan } | { kind: 'five'; ids: string[] };
export interface CoachSnapshot {
  plan?: GamePlan;
  members: { id: string; name: string; position: string; energy: number; fouls: number; onCourt: boolean; fouledOut: boolean }[];
  events: MatchWorld['coachingEvents'];
  phase: string;
}
export function coachSnapshot(world: MatchWorld, team: number): CoachSnapshot {
  return {
    plan: world.getGamePlan(team),
    members: (world.squads?.[team].members ?? []).map(m => ({ id: m.id, name: `${m.player.firstName} ${m.player.lastName}`, position: m.player.pos, energy: Math.round(m.energy), fouls: m.line.pf, onCourt: m.body !== null, fouledOut: m.fouledOut })),
    events: world.coachingEvents.filter(e => e.team === team).slice(-12).map(e => ({ ...e })),
    phase: world.tactics.peek(team)?.phase ?? world.full?.phase ?? '',
  };
}
