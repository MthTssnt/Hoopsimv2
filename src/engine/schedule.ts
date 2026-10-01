import type { Rng } from './rng';
import type { Game, Team } from './types';

/** Nombre maximum de rencontres programmées le même soir. */
const MAX_GAMES_PER_DAY = 9;

interface Matchup {
  homeId: string;
  awayId: string;
}

/**
 * Construit un calendrier de 82 matchs par équipe :
 * 4 matchs contre chaque équipe de division (16), 4 contre six adversaires de
 * conférence et 3 contre les quatre autres (36), 2 contre chaque équipe de
 * l'autre conférence (30).
 */
export function buildSchedule(rng: Rng, teams: Team[]): Game[] {
  const byDivision = new Map<string, Team[]>();
  for (const team of teams) {
    const key = `${team.conference}/${team.division}`;
    if (!byDivision.has(key)) byDivision.set(key, []);
    byDivision.get(key)!.push(team);
  }
  const divisionIndex = new Map<string, number>();
  const divisionOrder = [...byDivision.keys()].sort();
  divisionOrder.forEach((key, i) => divisionIndex.set(key, i));
  const slotInDivision = new Map<string, number>();
  for (const [, group] of byDivision) {
    group.forEach((team, i) => slotInDivision.set(team.id, i));
  }
  const divKey = (t: Team) => `${t.conference}/${t.division}`;

  const matchups: Matchup[] = [];
  const pushSeries = (a: Team, b: Team, homeForA: number, homeForB: number) => {
    for (let i = 0; i < homeForA; i++) matchups.push({ homeId: a.id, awayId: b.id });
    for (let i = 0; i < homeForB; i++) matchups.push({ homeId: b.id, awayId: a.id });
  };

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i];
      const b = teams[j];
      if (a.conference !== b.conference) {
        pushSeries(a, b, 1, 1);
        continue;
      }
      if (a.division === b.division) {
        pushSeries(a, b, 2, 2);
        continue;
      }
      // Le nombre de confrontations dépend d'un décalage cyclique entre divisions,
      // ce qui garantit exactement six adversaires à quatre matchs par équipe.
      const [low, high] = (divisionIndex.get(divKey(a))! < divisionIndex.get(divKey(b))! ? [a, b] : [b, a]);
      const diff = (slotInDivision.get(high.id)! - slotInDivision.get(low.id)! + 5) % 5;
      if (diff <= 2) {
        pushSeries(a, b, 2, 2);
      } else {
        // Série impaire : l'avantage du terrain alterne selon la parité des places.
        const lowHostsTwice = (slotInDivision.get(low.id)! + slotInDivision.get(high.id)!) % 2 === 0;
        if (lowHostsTwice) pushSeries(low, high, 2, 1);
        else pushSeries(low, high, 1, 2);
      }
    }
  }

  return distributeOverDays(rng, matchups);
}

function distributeOverDays(rng: Rng, matchups: Matchup[]): Game[] {
  const remaining = rng.shuffle([...matchups]);
  const games: Game[] = [];
  let playedYesterday = new Set<string>();
  let day = 0;
  let gameCounter = 0;

  while (remaining.length > 0) {
    const busyToday = new Set<string>();
    const todayTeams: string[] = [];
    let placed = 0;

    // Premier passage : on privilégie les équipes qui n'ont pas joué la veille.
    for (let pass = 0; pass < 2 && placed < MAX_GAMES_PER_DAY; pass++) {
      for (let i = 0; i < remaining.length && placed < MAX_GAMES_PER_DAY; i++) {
        const m = remaining[i];
        if (busyToday.has(m.homeId) || busyToday.has(m.awayId)) continue;
        if (pass === 0 && (playedYesterday.has(m.homeId) || playedYesterday.has(m.awayId))) continue;
        busyToday.add(m.homeId);
        busyToday.add(m.awayId);
        todayTeams.push(m.homeId, m.awayId);
        games.push({
          id: `g${gameCounter++}`,
          day,
          homeId: m.homeId,
          awayId: m.awayId,
          played: false,
          homeScore: null,
          awayScore: null,
        });
        remaining.splice(i, 1);
        i--;
        placed++;
      }
    }

    playedYesterday = new Set(todayTeams);
    day++;
    if (day > 400) break; // garde-fou contre une boucle infinie
  }

  return games.sort((a, b) => a.day - b.day);
}

export function scheduleLength(schedule: Game[]): number {
  return schedule.reduce((max, g) => Math.max(max, g.day), 0) + 1;
}

export function gamesOnDay(schedule: Game[], day: number): Game[] {
  return schedule.filter((g) => g.day === day);
}
