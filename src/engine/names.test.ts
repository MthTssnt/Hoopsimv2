import { describe, expect, it } from 'vitest';
import { generateDraftClass } from './generate';
import { createNewGame } from './index';
import { FIRST_NAMES, isRealPlayerName, LAST_NAMES, NameGenerator, nameKey } from './names';
import { Rng } from './rng';

/** Noms de famille qui désignent à eux seuls un joueur réel connu : jamais dans nos listes. */
const DISTINCTIVE_REAL_SURNAMES = [
  'Jokic', 'Doncic', 'Antetokounmpo', 'Wembanyama', 'Gobert', 'Curry', 'Durant', 'Embiid', 'Tatum', 'Lillard',
  'Harden', 'Westbrook', 'Nowitzki', 'Olajuwon', 'Pippen', 'Rodman', 'Mutombo', 'Ginobili', 'Garnett', 'Iverson',
  'Stockton', 'Barkley', 'Drexler', 'Mourning', 'Haliburton', 'Brunson', 'Siakam', 'Morant', 'Sabonis', 'Valanciunas',
  'Porzingis', 'Markkanen', 'Vucevic', 'Bogdanovic', 'Nurkic', 'Zubac', 'Hezonja', 'Saric', 'Ntilikina', 'Batum',
  'Diaw', 'Yabusele', 'Lessort', 'Coulibaly', 'Risacher', 'Okafor', 'Ojeleye', 'Achiuwa', 'Adebayo', 'Papagiannis',
  'Sloukas', 'Calathes', 'Spanoulis', 'Diamantidis', 'Kalaitzakis', 'Mitoglou', 'Larentzakis', 'Rubio', 'Gasol',
  'Llull', 'Scola', 'Nocioni', 'Barbosa', 'Splitter', 'Varejao', 'Hachimura', 'Watanabe', 'Sengun', 'Turkoglu',
  'Kanter', 'Korkmaz', 'Ilyasova', 'Mirotic', 'Teodosic', 'Bodiroga', 'Divac', 'Stojakovic', 'Kukoc', 'Petrovic',
  'Dragic', 'Obradovic', 'Ionescu', 'Villanueva', 'Nogueira',
];

describe('réservoir de noms', () => {
  it('est large, sans doublon (accents compris), et en noms de 10 lettres au plus', () => {
    expect(LAST_NAMES.length).toBeGreaterThanOrEqual(600);
    expect(FIRST_NAMES.length).toBeGreaterThanOrEqual(150);
    expect(new Set(LAST_NAMES.map(nameKey)).size).toBe(LAST_NAMES.length);
    expect(new Set(FIRST_NAMES.map(nameKey)).size).toBe(FIRST_NAMES.length);
    expect(LAST_NAMES.filter((n) => nameKey(n).length > 10)).toEqual([]);
  });

  it('ne contient aucun nom de famille qui désigne un joueur réel', () => {
    const blocked = new Set(DISTINCTIVE_REAL_SURNAMES.map(nameKey));
    expect(LAST_NAMES.filter((n) => blocked.has(nameKey(n)))).toEqual([]);
  });

  it('refuse les combinaisons prénom + nom de joueurs réels', () => {
    const gen = new NameGenerator(42);
    for (let i = 0; i < 900; i++) {
      const { firstName, lastName } = gen.next();
      expect(isRealPlayerName(firstName, lastName)).toBe(false);
    }
    expect(isRealPlayerName('Jalen', 'Pickett')).toBe(true);
  });
});

describe('tirage des noms', () => {
  it('ne donne jamais deux fois le même nom de famille, même au-delà du réservoir', () => {
    const gen = new NameGenerator(7);
    const names = Array.from({ length: LAST_NAMES.length + 50 }, () => nameKey(gen.next().lastName));
    expect(new Set(names).size).toBe(names.length);
  });

  it('est déterministe', () => {
    const a = new NameGenerator(99);
    const b = new NameGenerator(99);
    for (let i = 0; i < 20; i++) expect(a.next()).toEqual(b.next());
  });

  it('donne des noms de famille tous différents dans une ligue, donc dans chaque match', () => {
    for (const seed of [1, 2, 3]) {
      const names = Object.values(createNewGame('bos', seed).players).map((p) => nameKey(p.lastName));
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('écarte de la draft les noms déjà portés dans la ligue', () => {
    const league = createNewGame('bos', 5);
    const taken = Object.values(league.players).map((p) => p.lastName);
    const rookies = generateDraftClass(new Rng(5), 60, 1000, taken);
    const takenKeys = new Set(taken.map(nameKey));
    const rookieKeys = rookies.map((p) => nameKey(p.lastName));
    expect(rookieKeys.filter((k) => takenKeys.has(k))).toEqual([]);
    expect(new Set(rookieKeys).size).toBe(rookieKeys.length);
  });
});
