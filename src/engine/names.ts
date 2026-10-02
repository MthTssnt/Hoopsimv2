import { Rng } from './rng';

/**
 * Prénoms et noms de famille des joueurs générés : banals, de toutes origines, et choisis
 * pour qu'aucun ne désigne un joueur réel (CLAUDE.md). Les noms de famille font 10 lettres au
 * plus, pour que l'étiquette sous un joueur reste compacte sans être tronquée.
 */
export const FIRST_NAMES: readonly string[] = [
  'Marcus', 'Tyrese', 'Jalen', 'Devin', 'Kofi', 'Andre', 'Malik', 'Dante', 'Elias', 'Nikola',
  'Milan', 'Dario', 'Sekou', 'Ibrahim', 'Rudy', 'Evan', 'Théo', 'Bastien', 'Malo', 'Victor',
  'Jamal', 'Isaiah', 'Xavier', 'Trey', 'Damien', 'Cameron', 'Quentin', 'Bilal', 'Omar', 'Hugo',
  'Jonas', 'Lars', 'Mateo', 'Santiago', 'Rafael', 'Oriol', 'Sergio', 'Ricky', 'Willy', 'Emre',
  'Kerem', 'Baran', 'Ilan', 'Aleksa', 'Bogdan', 'Goran', 'Edgars', 'Tomas', 'Vytautas', 'Terrance',
  'Darius', 'Julius', 'Anthony', 'Brandon', 'Malcolm', 'Elijah', 'Caleb', 'Tyler', 'Austin',
  'Grant', 'Miles', 'Desmond', 'Amari', 'Josiah', 'Solomon', 'Nasir', 'Rayan', 'Yanis', 'Adama',
  'Moussa', 'Seydou', 'Ousmane', 'Amadou', 'Lucas', 'Mathis', 'Enzo', 'Noah', 'Gabriel', 'Léo',
  'Aaron', 'Abel', 'Adrian', 'Ahmed', 'Aidan', 'Alec', 'Alexis', 'Ali', 'Amir', 'Andrés', 'Antoine',
  'Arturo', 'Axel', 'Boris', 'Bruno', 'Calvin', 'Cesar', 'Chidi', 'Cole', 'Colin', 'Connor',
  'Corey', 'Cyril', 'Damon', 'Daniel', 'Davi', 'Dmitri', 'Dominic', 'Eamon', 'Eli', 'Emeka', 'Emil',
  'Erik', 'Ethan', 'Ezra', 'Fabien', 'Felix', 'Femi', 'Florian', 'Gael', 'Gianni', 'Glenn', 'Hamza',
  'Hassan', 'Henri', 'Igor', 'Imran', 'Isaac', 'Ivan', 'Jaden', 'Jamie', 'Joaquin', 'Joel',
  'Jordan', 'Joris', 'Jude', 'Kai', 'Karim', 'Kasper', 'Kenji', 'Kenzo', 'Khalil', 'Leon', 'Levi',
  'Liam', 'Loïc', 'Lorenzo', 'Louis', 'Magnus', 'Marco', 'Mario', 'Martin', 'Mason', 'Max', 'Mehdi',
  'Miguel', 'Mika', 'Moses', 'Nathan', 'Nico', 'Nils', 'Noel', 'Olu', 'Oscar', 'Otto', 'Owen',
  'Pablo', 'Paolo', 'Patrice', 'Pedro', 'Quincy', 'Rami', 'Raul', 'Reggie', 'Remi', 'Rico', 'Riley',
  'Robin', 'Roman', 'Ronan', 'Rory', 'Ruben', 'Ryan', 'Sacha', 'Sami', 'Samuel', 'Sean', 'Silas',
  'Simon', 'Stefan', 'Sven', 'Tariq', 'Tevin', 'Tobias', 'Trent', 'Tristan', 'Ugo', 'Valentin',
  'Wesley', 'Yann', 'Yusuf', 'Zach', 'Zane',
];

/** Noms de famille, regroupés par origine. Plus nombreux que les joueurs actifs d'une ligue. */
export const LAST_NAMES: readonly string[] = [
  // Anglo-américains
  'Abbott', 'Adair', 'Ainsley', 'Ashby', 'Ashford', 'Atwood', 'Averill', 'Bainbridge', 'Baldwin',
  'Barclay', 'Barlow', 'Barnaby', 'Barrow', 'Barton', 'Baxter', 'Beckett', 'Benson', 'Bentley',
  'Birch', 'Blackwood', 'Blakely', 'Bradford', 'Bramley', 'Brennan', 'Briggs', 'Brock', 'Brooker',
  'Buckley', 'Burgess', 'Burrows', 'Calloway', 'Carver', 'Channing', 'Chester', 'Clayton',
  'Clifford', 'Colby', 'Collier', 'Conway', 'Corbett', 'Cowan', 'Crane', 'Crawley', 'Crosby',
  'Dalton', 'Darby', 'Davenport', 'Dawson', 'Denham', 'Dexter', 'Dixon', 'Donovan', 'Dorsett',
  'Draper', 'Dudley', 'Dunbar', 'Durham', 'Eastman', 'Easton', 'Eckert', 'Edgerton', 'Ellery',
  'Ellison', 'Emerson', 'Everett', 'Fairbanks', 'Falkner', 'Farley', 'Farrow', 'Faulk', 'Fenwick',
  'Finch', 'Fletcher', 'Forbes', 'Foxworth', 'Gaines', 'Galloway', 'Garrison', 'Gentry', 'Gibbs',
  'Gorman', 'Grady', 'Grayson', 'Greer', 'Gresham', 'Hadley', 'Halsey', 'Hammond', 'Harlow',
  'Harper', 'Hartley', 'Haskins', 'Hastings', 'Hawley', 'Hayes', 'Hazelton', 'Hendricks', 'Hollis',
  'Holloway', 'Holt', 'Hopkins', 'Horton', 'Hudson', 'Hurst', 'Jarvis', 'Kendall', 'Kenyon',
  'Kessler', 'Kingsley', 'Kirby', 'Knowles', 'Langley', 'Larkin', 'Leland', 'Lockhart', 'Lowell',
  'Lynch', 'Maddox', 'Mallory', 'Marlowe', 'Marsh', 'Marshall', 'Mayfield', 'McAllister', 'McCall',
  'McKenna', 'Mercer', 'Merritt', 'Milburn', 'Montague', 'Mosley', 'Neville', 'Newell', 'Norris',
  'Ogden', 'Osborne', 'Overton', 'Paget', 'Palmer', 'Parrish', 'Pemberton', 'Pendleton', 'Penrose',
  'Pickett', 'Prescott', 'Preston', 'Pruitt', 'Quinlan', 'Radcliffe', 'Ramsey', 'Randall', 'Ransom',
  'Rawlings', 'Redmond', 'Remington', 'Rhodes', 'Ridley', 'Riggs', 'Ripley', 'Rowland', 'Royce',
  'Sanders', 'Sawyer', 'Sheldon', 'Shepherd', 'Sherwood', 'Sinclair', 'Slater', 'Somers',
  'Spalding', 'Stanton', 'Stratton', 'Sutton', 'Swanson', 'Talbot', 'Tanner', 'Thorne', 'Tilden',
  'Townsend', 'Trask', 'Underwood', 'Upton', 'Vance', 'Vaughn', 'Walcott', 'Walker', 'Wallis',
  'Warwick', 'Webster', 'Wendell', 'Weston', 'Wheeler', 'Whitaker', 'Whitfield', 'Whitley',
  'Wilder', 'Winters', 'Woodard', 'Wyatt', 'Yardley', 'Ackerman', 'Alcott', 'Ambrose', 'Ashton',
  'Banning', 'Blevins', 'Boone', 'Boyer', 'Bratton', 'Calhoun', 'Carrington', 'Caskey', 'Chambers',
  'Coburn', 'Corliss', 'Cutler', 'Dade', 'Dennison', 'Doyle', 'Dryden', 'Eldridge', 'Ellsworth',
  'Fanning', 'Fielding', 'Gilchrist', 'Halloran', 'Hanley', 'Hargrove', 'Hollister', 'Keane',
  'Kimball', 'Lathrop', 'Linwood', 'Mabry', 'Mattox', 'Merriman', 'Nolan', 'Pace', 'Pratt',
  'Quimby', 'Rankin', 'Reeder', 'Sargent', 'Shelton', 'Stoddard', 'Strickland', 'Thayer',
  'Treadwell', 'Vickers', 'Wakefield', 'Whitmer', 'Winfield', 'Yates',
  // Francophones
  'Lemaire', 'Garnier', 'Lefebvre', 'Duval', 'Rousseau', 'Morvan', 'Bertin', 'Blanchard', 'Boucher',
  'Bourdon', 'Brunet', 'Carpentier', 'Chauvin', 'Chevalier', 'Clément', 'Collet', 'Cordier',
  'Dufour', 'Dumas', 'Durand', 'Faure', 'Ferrand', 'Fontaine', 'Gauthier', 'Girard', 'Guérin',
  'Hébert', 'Joubert', 'Lacroix', 'Lambert', 'Langlois', 'Laurent', 'Leblanc', 'Leclerc', 'Legrand',
  'Lemoine', 'Lenoir', 'Leroy', 'Marchand', 'Martel', 'Masson', 'Mercier', 'Meunier', 'Michaud',
  'Moreau', 'Navarre', 'Olivier', 'Paquet', 'Perrin', 'Picard', 'Poulain', 'Prévost', 'Renard',
  'Renaud', 'Rivière', 'Roche', 'Rolland', 'Roussel', 'Royer', 'Sauvage', 'Simonet', 'Tessier',
  'Thibault', 'Vasseur', 'Vidal', 'Barbier', 'Caron', 'Delmas', 'Fabre', 'Giraud', 'Jacquet',
  'Lebrun', 'Maillard', 'Millet', 'Pasquier', 'Ravel', 'Tardieu', 'Valette', 'Verdier', 'Aubert',
  'Bazin', 'Bouvier', 'Cousin', 'Delorme', 'Devaux', 'Lagarde', 'Marchal', 'Poirot', 'Rocher',
  'Tissot',
  // Afrique de l'Ouest et centrale, Afrique de l'Est et australe
  'Diallo', 'Traoré', 'Ndiaye', 'Camara', 'Konaté', 'Sissoko', 'Faye', 'Gueye', 'Sy', 'Toure',
  'Sangaré', 'Habimana', 'Mukendi', 'Essomba', 'Kouadio', 'Okonkwo', 'Afolabi', 'Chukwu', 'Nwosu',
  'Adeyemi', 'Balogun', 'Bankole', 'Oyelaran', 'Okeke', 'Eze', 'Nnamdi', 'Obi', 'Onyeka', 'Uchenna',
  'Ibekwe', 'Adewale', 'Ogunleye', 'Akande', 'Ayodele', 'Babatunde', 'Olatunji', 'Oladele',
  'Ogbonna', 'Mensah', 'Owusu', 'Asante', 'Appiah', 'Osei', 'Agyeman', 'Ansah', 'Amoah', 'Tetteh',
  'Quaye', 'Kamara', 'Bangura', 'Conteh', 'Sesay', 'Diop', 'Ba', 'Seck', 'Sow', 'Mbaye', 'Thiam',
  'Ndour', 'Cissé', 'Bah', 'Sylla', 'Doumbia', 'Fofana', 'Kone', 'Ouattara', 'Kouassi', 'Kouamé',
  'Tshibangu', 'Kabongo', 'Ilunga', 'Mbuyi', 'Nzinga', 'Malonga', 'Mavinga', 'Nkosi', 'Dlamini',
  'Mokoena', 'Ndlovu', 'Moyo', 'Banda', 'Phiri', 'Mwangi', 'Otieno', 'Kamau', 'Wanjiru', 'Kiprop',
  'Haile', 'Tesfaye', 'Girma', 'Abebe', 'Tadesse', 'Cissoko', 'Ekwueme', 'Nwachukwu', 'Okafo',
  'Udeh', 'Anyanwu', 'Iwu', 'Okpara', 'Adeleke', 'Ajayi', 'Oyewole', 'Fashola', 'Danso', 'Boakye',
  'Kyei', 'Ofori', 'Sarpong', 'Badji', 'Coly', 'Diatta', 'Sagna', 'Mendy', 'Sambou', 'Dabo',
  'Sidibé', 'Diakité', 'Tounkara', 'Djalo', 'Embalo',
  // Hispaniques et lusophones
  'Vasquez', 'Delgado', 'Herrera', 'Ibáñez', 'Cortés', 'Navarro', 'Reyes', 'Mendoza', 'Salazar',
  'Ortega', 'Aguilar', 'Alvarado', 'Benítez', 'Cabrera', 'Campos', 'Cardenas', 'Castillo',
  'Cervantes', 'Contreras', 'Duarte', 'Escobar', 'Espinoza', 'Estrada', 'Figueroa', 'Fuentes',
  'Galindo', 'Gallardo', 'Guerrero', 'Gutiérrez', 'Ibarra', 'Lozano', 'Luna', 'Macías', 'Maldonado',
  'Medina', 'Molina', 'Montero', 'Montoya', 'Morales', 'Muñoz', 'Núñez', 'Ochoa', 'Orozco',
  'Pacheco', 'Padilla', 'Paredes', 'Peña', 'Quintero', 'Ramos', 'Rincón', 'Robles', 'Rosales',
  'Salinas', 'Sandoval', 'Santana', 'Serrano', 'Solís', 'Soto', 'Suárez', 'Tapia', 'Toledo',
  'Valdez', 'Valencia', 'Vargas', 'Velasco', 'Vega', 'Villalobos', 'Zamora', 'Cardoso', 'Carvalho',
  'Correia', 'Esteves', 'Ferreira', 'Fonseca', 'Freitas', 'Gouveia', 'Lacerda', 'Monteiro',
  'Moreira', 'Pereira', 'Queiroz', 'Rocha', 'Sampaio', 'Siqueira', 'Tavares', 'Teixeira', 'Valente',
  'Acuña', 'Bermúdez', 'Cisneros', 'Domínguez', 'Echeverría', 'Lucero', 'Mejía', 'Olivares',
  'Palacios', 'Quiroga', 'Rivas', 'Salgado', 'Trujillo', 'Urrutia', 'Zapata', 'Azevedo', 'Brandão',
  'Coutinho', 'Damasceno', 'Falcão', 'Pimentel', 'Resende',
  // Europe centrale et de l'Est, Balkans
  'Marković', 'Radić', 'Novak', 'Zeman', 'Kowalski', 'Novotný', 'Lazić', 'Ristić', 'Zupan', 'Babić',
  'Ilić', 'Kostić', 'Hodžić', 'Jurić', 'Perić', 'Mujić', 'Vuković', 'Pavlović', 'Jovanović',
  'Nikolić', 'Simić', 'Lukić', 'Savić', 'Horvat', 'Knežević', 'Božić', 'Grgić', 'Kralj', 'Vidović',
  'Mandić', 'Blažević', 'Petković', 'Popović', 'Stojković', 'Milić', 'Rakić', 'Vasić', 'Filipović',
  'Kranjc', 'Zorić', 'Bašić', 'Halilović', 'Begović', 'Husić', 'Kowalczyk', 'Wiśniewski', 'Nowak',
  'Kaczmarek', 'Mazur', 'Krawczyk', 'Dvořák', 'Svoboda', 'Procházka', 'Kučera', 'Horák', 'Němec',
  'Pokorný', 'Marek', 'Hájek', 'Szabó', 'Kovács', 'Tóth', 'Nagy', 'Varga', 'Farkas', 'Horváth',
  'Molnár', 'Balogh', 'Papp', 'Popescu', 'Dumitru', 'Stoica', 'Constantin', 'Ivanov', 'Petrov',
  'Sokolov', 'Volkov', 'Morozov', 'Orlov', 'Zaitsev', 'Lebedev', 'Kuznetsov', 'Bondarenko',
  'Kovalenko', 'Tkachenko', 'Melnyk', 'Levchenko', 'Bajić', 'Dukić', 'Jakšić', 'Mitrović',
  'Radović', 'Tadić', 'Zečević', 'Jelić', 'Barišić', 'Pranjić', 'Rukavina', 'Kos', 'Zajc', 'Golob',
  'Mlakar', 'Krajnc', 'Kolar', 'Sokol', 'Dudek', 'Wójcik', 'Kubiak', 'Michalak', 'Sikora',
  'Grabowski', 'Zając', 'Pawlak', 'Walczak', 'Duda', 'Jankowski', 'Lis', 'Rusu', 'Munteanu',
  'Matei', 'Florea', 'Lupu',
  // Grèce, Turquie, Méditerranée orientale et Maghreb
  'Vlachos', 'Karalis', 'Doukas', 'Stavrou', 'Galanis', 'Manolakis', 'Papadakis', 'Georgiou',
  'Nikolaou', 'Dimitriou', 'Christou', 'Antoniou', 'Pappas', 'Alexiou', 'Makris', 'Kyriakou',
  'Vasilakis', 'Andreou', 'Theodorou', 'Michalakis', 'Sotiriou', 'Mavros', 'Karras', 'Demir',
  'Yilmaz', 'Kaya', 'Çelik', 'Şahin', 'Aydin', 'Arslan', 'Doğan', 'Öztürk', 'Koç', 'Kurt',
  'Özdemir', 'Aksoy', 'Polat', 'Erdem', 'Haddad', 'Khoury', 'Saleh', 'Mansour', 'Amrani', 'Benali',
  'Bouzid', 'Ziani', 'Tahiri', 'Belkadi', 'Saidi', 'Mekki', 'Hamdi', 'Zerrouki',
  // Europe du Nord, germanique, Benelux, Baltes
  'Lindqvist', 'Bergström', 'Halvorsen', 'Virtanen', 'Andersson', 'Lindgren', 'Sandberg',
  'Holmberg', 'Lundqvist', 'Nyström', 'Ekström', 'Sjöberg', 'Dahl', 'Lund', 'Berg', 'Hagen',
  'Solberg', 'Haugen', 'Moen', 'Strand', 'Nieminen', 'Mäkinen', 'Korhonen', 'Laine', 'Heikkinen',
  'Salonen', 'Rantanen', 'Jensen', 'Nielsen', 'Madsen', 'Larsen', 'Kristensen', 'Vogel', 'Becker',
  'Krüger', 'Brandt', 'Hoffmann', 'Keller', 'Lange', 'Fischer', 'Richter', 'Schmitt', 'Wolf',
  'Krause', 'Zimmer', 'Bauer', 'Brenner', 'Bakker', 'Visser', 'Smit', 'Mulder', 'Jansen', 'Dekker',
  'Brouwer', 'Kuipers', 'Janssens', 'Peeters', 'Maes', 'Willems', 'Petrauskas', 'Jankauskas',
  'Balodis', 'Ozols', 'Kalnins', 'Tamm', 'Saar', 'Kask', 'Engström', 'Falk', 'Holm', 'Nygaard',
  'Rasmussen', 'Thorsen', 'Aalto', 'Lehtonen', 'Hartmann', 'Lorenz', 'Seidel', 'Vos', 'Verhoeven',
  // Italie
  'Bianchi', 'Rossi', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Conti', 'Costa',
  'Giordano', 'Lombardi', 'Barbieri', 'Fontana', 'Rinaldi', 'Santoro', 'Ferri', 'Galli',
  'Pellegrini', 'Leone', 'Longo', 'Marchetti', 'Ruggiero', 'Testa', 'Benedetti', 'Fabbri',
  'Sartori', 'Bellini', 'Cattaneo', 'Ferraro', 'Mazza', 'Parisi', 'Villa',
  // Asie et Océanie
  'Tanaka', 'Sato', 'Takahashi', 'Kobayashi', 'Yamamoto', 'Nakamura', 'Kimura', 'Hayashi',
  'Matsuda', 'Inoue', 'Kim', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Han', 'Nguyen', 'Tran',
  'Pham', 'Hoang', 'Cruz', 'Bautista', 'Tupou', 'Fifita', 'Taufa', 'Ngata', 'Wang', 'Zhang', 'Liu',
  'Chen', 'Zhao', 'Huang', 'Xu', 'Sun', 'Gao', 'Luo', 'Okada', 'Ishikawa', 'Fujita', 'Shin', 'Lim',
  'Santos', 'Aquino', 'Mahe', 'Leota',
];

/**
 * Joueurs réels dont le prénom et le nom pourraient sortir de nos listes : ces combinaisons
 * sont refusées au tirage. La liste garde aussi des noms célèbres déjà retirés, au cas où un
 * nom reviendrait dans les listes.
 */
const REAL_PLAYERS: readonly string[] = [
  'Jalen Pickett', 'Isaiah Collier', 'Moussa Cissé', 'Anthony Davis', 'Anthony Edwards',
  'Kevin Durant', 'Stephen Curry', 'LeBron James', 'Chris Paul', 'Paul George', 'Kevin Love',
  'Jimmy Butler', 'Kyle Lowry', 'Damian Lillard', 'James Harden', 'Russell Westbrook',
  'Kawhi Leonard', 'Devin Booker', 'Jamal Murray', 'Jalen Brunson', 'Jalen Williams', 'Jalen Green',
  'Jalen Johnson', 'Jalen Suggs', 'Jalen Rose', 'Isaiah Thomas', 'Brandon Ingram', 'Malik Monk',
  'Marcus Smart', 'Tyler Herro', 'Trey Murphy', 'Aaron Gordon', 'Aaron Holiday', 'Reggie Miller',
  'Moses Malone', 'Julius Randle', 'Darius Garland', 'Cameron Johnson', 'Miles Bridges',
  'Desmond Bane', 'Grant Hill', 'Ricky Rubio', 'Rudy Gobert', 'Evan Fournier', 'Nikola Jokic',
  'Nikola Vucevic', 'Luka Doncic', 'Victor Wembanyama', 'Bilal Coulibaly', 'Killian Hayes',
  'Keon Ellis', 'Cheick Diallo', 'Tyler Dorsey', 'Anthony Bennett', 'Cameron Whitmore',
  'Lucas Nogueira', 'Jordan Goodwin', 'Ryan Rollins', 'Malcolm Delaney', 'Anthony Tolliver',
  'Anthony Morrow', 'Malik Beasley', 'Marcus Landry', 'Andre Drummond', 'Hamidou Diallo',
  'Seydou Keita', 'Isaiah Stewart', 'Zach Randolph', 'Tobias Harris', 'Tristan Thompson',
  'Otto Porter',
];

/** Clé de comparaison d'un nom : majuscules sans accents (« Marín » et « Marin » se confondent à l'écran). */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

const REAL_KEYS = new Set(REAL_PLAYERS.map(nameKey));

export function isRealPlayerName(firstName: string, lastName: string): boolean {
  return REAL_KEYS.has(nameKey(`${firstName} ${lastName}`));
}

const SUFFIXES = ['Jr.', 'II', 'III', 'IV'];

/**
 * Tire des noms de joueurs sans jamais réutiliser un nom de famille déjà pris : deux joueurs
 * actifs d'une même ligue (et donc d'un même match) n'ont jamais le même nom. A son propre
 * générateur aléatoire, pour que les listes de noms n'influencent pas les notes des joueurs.
 */
export class NameGenerator {
  private readonly rng: Rng;
  private readonly taken = new Set<string>();

  constructor(seed: number, takenLastNames: Iterable<string> = []) {
    this.rng = new Rng(seed);
    for (const name of takenLastNames) this.taken.add(nameKey(name));
  }

  next(): { firstName: string; lastName: string } {
    for (let attempt = 0; attempt < 40; attempt++) {
      const lastName = this.rng.pick(LAST_NAMES);
      if (!this.taken.has(nameKey(lastName))) return this.take(lastName);
    }
    // Ligue presque pleine : premier nom libre à partir d'un point tiré au hasard.
    const start = this.rng.int(0, LAST_NAMES.length - 1);
    for (let i = 0; i < LAST_NAMES.length; i++) {
      const lastName = LAST_NAMES[(start + i) % LAST_NAMES.length];
      if (!this.taken.has(nameKey(lastName))) return this.take(lastName);
    }
    // Réservoir épuisé (plus de joueurs actifs que de noms) : suffixe, toujours unique.
    for (const suffix of SUFFIXES) {
      for (let i = 0; i < LAST_NAMES.length; i++) {
        const lastName = `${LAST_NAMES[(start + i) % LAST_NAMES.length]} ${suffix}`;
        if (!this.taken.has(nameKey(lastName))) return this.take(lastName);
      }
    }
    throw new Error('Réservoir de noms épuisé');
  }

  private take(lastName: string): { firstName: string; lastName: string } {
    this.taken.add(nameKey(lastName));
    let firstName = this.rng.pick(FIRST_NAMES);
    for (let i = 0; i < 20 && isRealPlayerName(firstName, lastName); i++) firstName = this.rng.pick(FIRST_NAMES);
    return { firstName, lastName };
  }
}
