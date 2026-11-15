import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAM_SEEDS } from '../src/engine/teamsData';
const unique = new Set<string>();
for (const team of TEAM_SEEDS) {
  const svg = readFileSync(`src/assets/branding/teams/${team.id}.svg`, 'utf8');
  assert(svg.includes('viewBox="0 0 32 32"'));
  assert(svg.toLowerCase().includes(team.colors.primary.toLowerCase()), team.id);
  assert(svg.toLowerCase().includes(team.colors.secondary.toLowerCase()), team.id);
  assert(!/<(?:image|script)|href=/.test(svg));
  assert(!unique.has(svg), `Duplicate ${team.id}`); unique.add(svg);
}
assert.equal(unique.size, 30);
console.log('Branding: 30/30 original assets; canonical palettes, viewBoxes and no external resources verified.');
