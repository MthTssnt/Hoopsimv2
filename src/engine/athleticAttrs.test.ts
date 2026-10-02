import { describe, expect, it } from 'vitest';
import { ensureAthleticAttrs } from './generate';
import { createNewGame, migrateLeague } from './index';
import { FIRST_NAMES, LAST_NAMES } from './names';
import { computeOverall } from './ratings';
import type { League, Player, Position } from './types';

const KEYS = ['vertical', 'standingDunk', 'drivingDunk'] as const;

function average(players: Player[], pos: Position, key: (typeof KEYS)[number]): number {
  const group = players.filter((p) => p.pos === pos);
  return group.reduce((sum, p) => sum + p.attrs[key], 0) / group.length;
}

describe('attributs athlétiques (détente, dunks)', () => {
  const league = createNewGame('bos', 2024);
  const players = Object.values(league.players);

  it('sont générés pour chaque joueur, entre 25 et 99', () => {
    for (const p of players) {
      for (const key of KEYS) {
        expect(Number.isInteger(p.attrs[key])).toBe(true);
        expect(p.attrs[key]).toBeGreaterThanOrEqual(25);
        expect(p.attrs[key]).toBeLessThanOrEqual(99);
      }
    }
  });

  it('sont identiques pour une même graine', () => {
    const again = createNewGame('bos', 2024);
    for (const p of players) {
      for (const key of KEYS) expect(again.players[p.id].attrs[key]).toBe(p.attrs[key]);
    }
  });

  it('ne dépendent que du joueur (le flux aléatoire de la ligue est intact)', () => {
    for (const p of players.slice(0, 50)) {
      const copy: Player = { ...p, attrs: { ...p.attrs } };
      for (const key of KEYS) delete (copy.attrs as Partial<Player['attrs']>)[key];
      ensureAthleticAttrs(copy);
      for (const key of KEYS) expect(copy.attrs[key]).toBe(p.attrs[key]);
    }
  });

  it('suivent le physique : les meneurs sautent plus, les pivots dunkent mieux sans élan', () => {
    expect(average(players, 'PG', 'vertical')).toBeGreaterThan(average(players, 'C', 'vertical'));
    expect(average(players, 'C', 'standingDunk')).toBeGreaterThan(average(players, 'PG', 'standingDunk') + 15);
  });

  it("n'entrent pas dans la note globale", () => {
    const p = players[0];
    const boosted = { ...p.attrs, vertical: 99, standingDunk: 99, drivingDunk: 99 };
    expect(computeOverall(boosted, p.pos)).toBe(computeOverall(p.attrs, p.pos));
  });

  it("sont complétés au chargement d'une ancienne sauvegarde, sans toucher au reste", () => {
    const old = JSON.parse(JSON.stringify(league)) as League;
    for (const p of Object.values(old.players)) {
      for (const key of KEYS) delete (p.attrs as Partial<Player['attrs']>)[key];
    }
    const migrated = migrateLeague(old);
    for (const p of players) {
      expect(migrated.players[p.id].attrs).toEqual(p.attrs);
    }
  });
});

describe('noms originaux', () => {
  it('ne contiennent aucun nom de joueur réel retiré, et gardent la taille des listes (même flux aléatoire)', () => {
    const removed = ['Jokić', 'Dončić', 'Šarić', 'Vučević', 'Bogdanović', 'Petrović', 'Nurkić', 'Zubac', 'Hezonja', 'Gobert', 'Fournier', 'Wembanyama', 'Ntilikina', 'Yabusele', 'Antetokounmpo', 'Kalaitzakis', 'Adebayo', 'Curry', 'Rubio'];
    const removedFirst = ['Luka', 'Zion', 'Ja', 'Shai', 'Alperen', 'Kristaps', 'Domantas', 'Killian'];
    expect(LAST_NAMES.filter((n) => removed.includes(n))).toEqual([]);
    expect(FIRST_NAMES.filter((n) => removedFirst.includes(n))).toEqual([]);
    expect([FIRST_NAMES.length, LAST_NAMES.length]).toEqual([80, 90]);
    expect(new Set(LAST_NAMES).size).toBe(LAST_NAMES.length);
  });

  it("renomme l'ancienne équipe de Détroit au chargement d'une sauvegarde", () => {
    const old = JSON.parse(JSON.stringify(createNewGame('bos', 3))) as League;
    old.teams.find((t) => t.id === 'det')!.name = 'Pistons Mécaniques';
    expect(migrateLeague(old).teams.find((t) => t.id === 'det')!.name).toBe('Gears');
  });
});
