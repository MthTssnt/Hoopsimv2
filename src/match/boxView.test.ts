import { describe, expect, it } from 'vitest';
import { createNewGame } from '../engine';
import { matchRotation } from '../engine/rotation';
import { Rng } from '../engine/rng';
import { buildBoxView, formatMinutes } from './boxView';
import { makeCourt } from './physics/court';
import { MatchWorld } from './world/MatchWorld';

const league = createNewGame('bos', 31);
const names = [
  { name: 'A', abbr: 'AAA', color: '#111111' },
  { name: 'B', abbr: 'BBB', color: '#222222' },
];

describe('box score du menu pause', () => {
  it('minutes en m:ss', () => {
    expect(formatMinutes(0)).toBe('0:00');
    expect(formatMinutes(452.7)).toBe('7:32');
  });

  it('titulaires en tête, toute la rotation, totaux, périodes, fautes et bonus', () => {
    const home = matchRotation(league.teams[0], league.players);
    const away = matchRotation(league.teams[1], league.players);
    const w = new MatchWorld(makeCourt('pro'), home[0], { x: 10, y: 7, z: 0 }, { mode: 'timing', speed: 'normal' }, new Rng(1));
    expect(buildBoxView(w, names)).toBeNull();
    w.startFullCourt(home, away, 3);
    const squads = w.squads!;
    const scorer = squads[0].members[6];
    scorer.line.pts = 7;
    scorer.line.fgm = 3;
    scorer.line.fga = 5;
    scorer.line.secs = 95;
    squads[1].fouls = 6;
    const view = buildBoxView(w, names)!;
    expect(view.period).toBe('QT1');
    expect(view.clock).toBe('3:00');
    expect(view.periodLabels).toEqual(['QT1']);
    expect(view.teams[0].rows).toHaveLength(home.length);
    expect(view.teams[0].rows.slice(0, 5).every((r) => r.starter && r.onCourt)).toBe(true);
    expect(view.teams[0].rows.slice(5).every((r) => !r.starter && !r.onCourt)).toBe(true);
    const row = view.teams[0].rows.find((r) => r.id === scorer.id)!;
    expect(row).toMatchObject({ pts: 7, fg: '3/5', minutes: '1:35' });
    expect(view.teams[0].totals.pts).toBe(7);
    // L'équipe 1 a 6 fautes : l'équipe 0 est en bonus.
    expect(view.teams[0].bonus).toBe(true);
    expect(view.teams[1]).toMatchObject({ fouls: 6, bonus: false, name: 'B' });
  });
});
