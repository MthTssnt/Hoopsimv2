/**
 * Script de calibration : simule une saison complète et affiche les moyennes
 * de la ligue, pour vérifier que la simulation produit des chiffres crédibles.
 *   npx tsx scripts/calibrate.ts
 */
import { createNewGame } from '../src/engine';
import { buildStandings, leaders, perGame } from '../src/engine/stats';
import { regularSeasonFinished, seasonDays, simulateDay } from '../src/engine/simSeason';
import { advancePlayoffs, playoffsFinished, startPlayoffs } from '../src/engine/playoffs';
import { playerName, totalReb } from '../src/engine/types';

const league = createNewGame('bos', 12345);
const started = Date.now();

const days = seasonDays(league);
console.log(`Calendrier : ${league.schedule.length} matchs sur ${days} journées`);

const gamesPerTeam = new Map<string, number>();
for (const g of league.schedule) {
  gamesPerTeam.set(g.homeId, (gamesPerTeam.get(g.homeId) ?? 0) + 1);
  gamesPerTeam.set(g.awayId, (gamesPerTeam.get(g.awayId) ?? 0) + 1);
}
const counts = [...gamesPerTeam.values()];
console.log(`Matchs par équipe : min ${Math.min(...counts)} / max ${Math.max(...counts)}`);

let homeWins = 0;
let totalGames = 0;
let totalPoints = 0;
while (!regularSeasonFinished(league)) {
  const summary = simulateDay(league, { watchUserGame: false });
  for (const { result } of summary.games) {
    totalGames++;
    totalPoints += result.homeScore + result.awayScore;
    if (result.homeScore > result.awayScore) homeWins++;
  }
}

const teamGames = totalGames * 2;
console.log(`\n--- Saison régulière (${totalGames} matchs, ${((Date.now() - started) / 1000).toFixed(1)}s) ---`);
console.log(`Points par équipe et par match : ${(totalPoints / teamGames).toFixed(1)}`);
console.log(`Victoires à domicile : ${((homeWins / totalGames) * 100).toFixed(1)} %`);

const agg = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, secs: 0 };
for (const p of Object.values(league.players)) {
  for (const k of Object.keys(agg) as (keyof typeof agg)[]) agg[k] += p.stats[k];
}
const per = (v: number) => (v / teamGames).toFixed(1);
console.log(`FG : ${per(agg.fgm)}/${per(agg.fga)} (${((agg.fgm / agg.fga) * 100).toFixed(1)} %)`);
console.log(`3 pts : ${per(agg.tpm)}/${per(agg.tpa)} (${((agg.tpm / agg.tpa) * 100).toFixed(1)} %) — ${((agg.tpa / agg.fga) * 100).toFixed(1)} % des tirs`);
console.log(`LF : ${per(agg.ftm)}/${per(agg.fta)} (${((agg.ftm / agg.fta) * 100).toFixed(1)} %)`);
console.log(`Rebonds ${per(agg.oreb + agg.dreb)} (dont ${per(agg.oreb)} off.) — Passes ${per(agg.ast)} — Pertes ${per(agg.tov)}`);
console.log(`Interceptions ${per(agg.stl)} — Contres ${per(agg.blk)} — Fautes ${per(agg.pf)}`);
console.log(`Minutes cumulées par équipe et par match : ${(agg.secs / 60 / teamGames).toFixed(1)} (attendu ~240)`);

const overalls = Object.values(league.players).map((p) => p.overall).sort((a, b) => b - a);
const mean = overalls.reduce((s, v) => s + v, 0) / overalls.length;
console.log(`\nNotes : moyenne ${mean.toFixed(1)}, max ${overalls[0]}, top10 ${overalls.slice(0, 10).join(' ')}, min ${overalls[overalls.length - 1]}`);

console.log('\n--- Meilleurs marqueurs ---');
for (const row of leaders(league, 'pts', 0.5, 8)) {
  const p = row.player;
  console.log(
    `${playerName(p).padEnd(24)} ${row.team?.abbr}  ${perGame(p.stats, 'pts').toFixed(1)} pts  ${perGame(p.stats, 'reb').toFixed(1)} rbds  ${perGame(p.stats, 'ast').toFixed(1)} pd  ${perGame(p.stats, 'min').toFixed(1)} min  (${p.overall})`,
  );
}

const user = league.teams.find((t) => t.id === league.userTeamId)!;
console.log(`\n--- Rotation de ${user.city} ${user.name} (${user.wins}-${user.losses}) ---`);
for (const id of user.rotation) {
  const p = league.players[id];
  if (!p) continue;
  console.log(
    `${playerName(p).padEnd(24)} ${p.pos}  ${p.overall}  ${perGame(p.stats, 'min').toFixed(1)} min  ${perGame(p.stats, 'pts').toFixed(1)} pts  ${(totalReb(p.stats) / Math.max(1, p.stats.gp)).toFixed(1)} rbds`,
  );
}

console.log('\n--- Classement Est ---');
for (const row of buildStandings(league, 'Est').slice(0, 8)) {
  console.log(`${row.rank}. ${row.team.abbr} ${row.wins}-${row.losses} (${row.diff > 0 ? '+' : ''}${row.diff})`);
}

startPlayoffs(league);
while (!playoffsFinished(league.playoffs)) {
  advancePlayoffs(league, { watchUserGame: false });
}
const champion = league.teams.find((t) => t.id === league.playoffs!.championId);
const mvp = league.players[league.playoffs!.finalsMvpId ?? ''];
console.log(`\nChampion : ${champion?.city} ${champion?.name} — MVP des finales : ${mvp ? playerName(mvp) : 'n/a'}`);
console.log(`Durée totale : ${((Date.now() - started) / 1000).toFixed(1)}s`);
