import type { GamePlan, OffenseStyle, DefenseStyle } from '../gamePlan';
import type { GameBox } from '../types';
import type { PlayId, ShotZone } from './tactics';

export interface PlayUsage { possessions: number; points: number; turnovers: number; shots: number }
export interface TeamTacticalReport {
  planName: string;
  initialPlanName?: string;
  live?: { playsStarted: Record<string, number>; screenWindows: number; cutsStarted: number; fallbacks: number; switches: number };
  coachingEvents?: { time: number; message: string }[];
  offense: OffenseStyle;
  defense: DefenseStyle;
  targetMinutes: Record<string, number>;
  possessions?: number;
  shots?: Record<ShotZone, number>;
  plays?: Partial<Record<PlayId, PlayUsage>>;
}
export interface TacticalReport {
  source: 'fast' | 'physical';
  durationSeconds: number;
  normalizationFactor?: number;
  teams: Record<string, TeamTacticalReport>;
}
export function reportSnapshot(plan?: GamePlan, measured = false): TeamTacticalReport {
  return {
    planName: plan?.name ?? 'Équilibré', offense: plan?.offense ?? 'balanced', defense: plan?.defense ?? 'man',
    targetMinutes: { ...plan?.rotation.minutesByPlayerId },
    ...(measured ? { possessions: 0, shots: { rim: 0, mid: 0, three: 0 }, plays: {} } : {}),
  };
}
/** Estimates are explicitly separate from counted possessions; derived only from the recorded box. */
export function boxMetrics(box: GameBox, teamId: string) {
  const rows = box.rows[teamId] ?? [];
  const total = rows.reduce((a, { line: l }) => ({ pts: a.pts + l.pts, fga: a.fga + l.fga, tpa: a.tpa + l.tpa, oreb: a.oreb + l.oreb, tov: a.tov + l.tov, fta: a.fta + l.fta, ast: a.ast + l.ast, secs: a.secs + l.secs }), { pts: 0, fga: 0, tpa: 0, oreb: 0, tov: 0, fta: 0, ast: 0, secs: 0 });
  const report = box.tactics?.teams[teamId];
  const possessions = report?.possessions ?? Math.max(0, total.fga - total.oreb + total.tov + 0.44 * total.fta);
  return { ...total, possessions, estimated: report?.possessions === undefined, rating: possessions > 0 ? total.pts / possessions * 100 : 0,
    durationMinutes: (box.tactics?.durationSeconds ?? total.secs / 5) / 60 };
}
