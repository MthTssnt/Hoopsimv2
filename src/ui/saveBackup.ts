import type { League } from '../engine/types';
/** Export the current in-memory state, including moves not persisted because storage is full. */
export function downloadSave(league: League): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(league)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `hoopsim-${league.userTeamId}-${league.season}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
