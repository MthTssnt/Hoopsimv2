import type { Rng } from './rng';

/** Prénoms et noms inventés ou banals : aucun ne doit désigner un joueur réel (CLAUDE.md). */
export const FIRST_NAMES = [
  'Marcus', 'Tyrese', 'Jalen', 'Devin', 'Kofi', 'Andre', 'Malik', 'Dante', 'Elias', 'Nikola',
  'Milan', 'Dario', 'Sekou', 'Ibrahim', 'Rudy', 'Evan', 'Théo', 'Bastien', 'Malo', 'Victor',
  'Jamal', 'Isaiah', 'Xavier', 'Trey', 'Damien', 'Cameron', 'Quentin', 'Bilal', 'Omar', 'Hugo',
  'Jonas', 'Lars', 'Mateo', 'Santiago', 'Rafael', 'Oriol', 'Sergio', 'Ricky', 'Willy', 'Emre',
  'Kerem', 'Baran', 'Ilan', 'Aleksa', 'Bogdan', 'Goran', 'Edgars', 'Tomas', 'Jonas', 'Vytautas',
  'Terrance', 'Darius', 'Julius', 'Anthony', 'Brandon', 'Malcolm', 'Elijah', 'Caleb', 'Tyler', 'Austin',
  'Grant', 'Miles', 'Desmond', 'Amari', 'Josiah', 'Solomon', 'Nasir', 'Rayan', 'Yanis', 'Adama',
  'Moussa', 'Seydou', 'Ousmane', 'Amadou', 'Lucas', 'Mathis', 'Enzo', 'Noah', 'Gabriel', 'Léo',
];

export const LAST_NAMES = [
  'Pemberton', 'Carver', 'Holloway', 'Whitfield', 'Ramsey', 'Nwosu', 'Diallo', 'Traoré', 'Ndiaye', 'Camara',
  'Lazić', 'Ristić', 'Zupan', 'Babić', 'Ilić', 'Kostić', 'Marković', 'Radić', 'Novak', 'Zeman',
  'Lemaire', 'Garnier', 'Essomba', 'Sangaré', 'Habimana', 'Morvan', 'Mukendi', 'Lefebvre', 'Duval', 'Rousseau',
  'Adeyemi', 'Karalis', 'Vlachos', 'Doukas', 'Stavrou', 'Galanis', 'Manolakis', 'Ashford', 'Baldwin', 'Hayes',
  'Robinson', 'Hendricks', 'Sanders', 'Langley', 'Hollis', 'Sheppard', 'Cissoko', 'Barlow', 'Calloway', 'Walker',
  'Vasquez', 'Delgado', 'Herrera', 'Ibáñez', 'Ortega', 'Cortés', 'Navarro', 'Reyes', 'Mendoza', 'Salazar',
  'Kowalski', 'Novotný', 'Lindqvist', 'Bergström', 'Halvorsen', 'Virtanen', 'Hodžić', 'Jurić', 'Perić', 'Mujić',
  'Okonkwo', 'Afolabi', 'Chukwu', 'Kouadio', 'Konaté', 'Sissoko', 'Faye', 'Gueye', 'Sy', 'Toure',
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
