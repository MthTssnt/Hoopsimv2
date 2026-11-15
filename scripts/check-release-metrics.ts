/** Gates on actual campaign artifacts; ranges are anchored to the project's calibration, not an external NBA target. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const arg = (key: string, fallback: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const career = JSON.parse(readFileSync(arg('franchise', '/tmp/hoopsim-franchise-calibration.json'), 'utf8'));
assert.equal(career.records.length, 30); assert.equal(career.games, 36900);
for (const row of career.records) {
  assert(row.points > 100 && row.points < 125, `Season scoring drift ${row.seed}/${row.season}`);
  assert(row.fg > 0.4 && row.fg < 0.56 && row.threePct > 0.25 && row.threePct < 0.45);
  assert(row.favoriteWinRate > 0.55 && row.p10 < row.median && row.median < row.p90);
}
for (const [key, file] of [['tactics', '/tmp/hoopsim-lot6-tactics.json'], ['aged', '/tmp/hoopsim-lot6-tactics-aged.json']]) {
  const result = JSON.parse(readFileSync(arg(key, file), 'utf8'));
  for (const [style, row] of Object.entries(result.metrics) as [string, { roundRobinWinRate: number }][]) assert(row.roundRobinWinRate > 0.3 && row.roundRobinWinRate < 0.7, `${key}/${style}: round-robin domination`);
}
console.log('PASS: 30 seasons, 36 900 games; scoring 100–125, FG 40–56%, 3P 25–45%, favorites >55%; all six styles within 30–70% in both paired round-robins. These are broad regression guards, not estimates of every possible roster.');
