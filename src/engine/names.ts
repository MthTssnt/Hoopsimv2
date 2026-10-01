import type { Rng } from './rng';

const FIRST_NAMES = [
  'Marcus', 'Tyrese', 'Jalen', 'Devin', 'Kofi', 'Andre', 'Malik', 'Dante', 'Elias', 'Nikola',
  'Luka', 'Dario', 'Sekou', 'Ibrahim', 'Rudy', 'Evan', 'Théo', 'Nando', 'Killian', 'Victor',
  'Jamal', 'Isaiah', 'Xavier', 'Trey', 'Damien', 'Cameron', 'Quentin', 'Bilal', 'Omar', 'Hugo',
  'Jonas', 'Lars', 'Mateo', 'Santiago', 'Rafael', 'Pau', 'Sergio', 'Ricky', 'Willy', 'Alperen',
  'Cedi', 'Furkan', 'Deni', 'Vasilije', 'Bogdan', 'Goran', 'Kristaps', 'Domantas', 'Jonas', 'Arvydas',
  'Terrance', 'Darius', 'Julius', 'Anthony', 'Brandon', 'Zion', 'Ja', 'Shai', 'Tyler', 'Austin',
  'Grant', 'Miles', 'Keon', 'Amari', 'Josiah', 'Solomon', 'Nasir', 'Rayan', 'Yanis', 'Adama',
  'Moussa', 'Cheick', 'Ousmane', 'Amadou', 'Lucas', 'Mathis', 'Enzo', 'Noah', 'Gabriel', 'Léo',
];

const LAST_NAMES = [
  'Bennett', 'Carver', 'Holloway', 'Whitfield', 'Ramsey', 'Okafor', 'Diallo', 'Traoré', 'Ndiaye', 'Camara',
  'Petrović', 'Jokić', 'Dončić', 'Šarić', 'Vučević', 'Bogdanović', 'Marković', 'Radić', 'Novak', 'Zeman',
  'Gobert', 'Fournier', 'Wembanyama', 'Coulibaly', 'Ntilikina', 'Lessort', 'Yabusele', 'Poirier', 'Heurtel', 'Albicy',
  'Antetokounmpo', 'Papagiannis', 'Sloukas', 'Calathes', 'Larentzakis', 'Mitoglou', 'Kalaitzakis', 'Dorsey', 'Baldwin', 'Hayes',
  'Robinson', 'Hendricks', 'Sanders', 'Curry', 'Whitmore', 'Sheppard', 'Cissoko', 'Barlow', 'Prosper', 'Walker',
  'Vasquez', 'Delgado', 'Herrera', 'Ibáñez', 'Rubio', 'Cortés', 'Navarro', 'Reyes', 'Mendoza', 'Salazar',
  'Kowalski', 'Novotný', 'Lindqvist', 'Bergström', 'Halvorsen', 'Virtanen', 'Nurkić', 'Zubac', 'Hezonja', 'Musa',
  'Adebayo', 'Ojeleye', 'Achiuwa', 'Bamba', 'Konaté', 'Sissoko', 'Faye', 'Gueye', 'Sy', 'Toure',
  'Ellis', 'Vaughn', 'Marshall', 'Osborne', 'Kingsley', 'Pruitt', 'Rawlings', 'Sutton', 'Vance', 'Wheeler',
];

export function makeName(rng: Rng, used: Set<string>): { firstName: string; lastName: string } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const key = `${firstName} ${lastName}`;
    if (!used.has(key)) {
      used.add(key);
      return { firstName, lastName };
    }
  }
  // Repli : on suffixe pour garantir l'unicité même sur un très gros univers.
  const firstName = rng.pick(FIRST_NAMES);
  const lastName = `${rng.pick(LAST_NAMES)} Jr.`;
  used.add(`${firstName} ${lastName}`);
  return { firstName, lastName };
}
