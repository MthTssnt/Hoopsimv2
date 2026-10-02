# Direction artistique — HoopSim

> Rédigée avec Matheo. Les points marqués **[à valider]** se tranchent à l'œil sur la scène
> `?style` avant d'être appliqués au match. `src/assets/palette.ts` fait foi pour les couleurs.

## 1. Intention

HoopSim vise le **genre** visuel de Hoop Land : basket rétro en pixel-art, vue plongeante de
3/4, gros joueurs expressifs, arène vivante, HUD discret. On reprend une ambiance, pas des
éléments.

Ce qu'on ne reprend **jamais** : sprites, palette, police, logos, mise en page du HUD,
personnages, noms d'équipes ou de joueurs, décors précis de Hoop Land ou d'un autre jeu.
Tout est dessiné par nous (en code pour l'instant), avec notre palette et notre police.

## 2. Résolution et cadrage (validé)

Cadrage validé par Matheo : celui de 384×216 à 18 px/m (21,3 m visibles, toute la profondeur).
Avec les règles chiffrées des sprites (joueur standard d'environ 32 px), la résolution
retenue est **480×270**. Le passage par 640×360 est abandonné.

| Réglage | Valeur | Pourquoi |
| --- | --- | --- |
| Résolution interne | **480×270** | Celle du match ; mise à l'échelle entière : ×4 en 1080p plein écran, ×3 dans une fenêtre de navigateur, ×2 sur un portable 1366×768 |
| Mise à l'échelle | entière uniquement (`Scale.NONE` + zoom entier, recalculé au redimensionnement) | Pixels nets, jamais de pixel étiré |
| Échelle du terrain | **22,5 px/m** en longueur | ~21,3 m de terrain visibles en largeur |
| Vue 3/4 | profondeur ×0,66, hauteur ×0,68 | Toute la profondeur du terrain à l'écran |

La touche **F** passe en plein écran. Les épaisseurs du décor (lattes, public, poteau,
poutre, panneaux) sont proportionnelles à l'échelle (`artPx`) : elles suivent la résolution.

Ordres de grandeur à 22,5 px/m :

| Élément | Taille à l'écran |
| --- | --- |
| Profondeur du terrain (15,24 m) | ~226 px, soit 84 % de la hauteur de l'écran |
| Hauteur du cercle (3,05 m) | ~47 px au-dessus du sol |
| Joueur standard (ailier) | 32 px, contour compris |

## 3. Règles chiffrées des personnages (font foi)

Les sprites ont leurs propres règles en pixels, données par Matheo. La physique garde les
vraies tailles : seul le dessin suit ces règles.

**Joueur standard (ailier), 32 px contour compris, ~2,5 têtes de haut** :

| Partie | Taille |
| --- | --- |
| Tête, cheveux compris | 13 rangées de haut (contour du haut + 12), 14 de large avec le contour, soit ~40 % de la hauteur |
| Cou | 1 rangée |
| Torse (maillot) | 8 rangées |
| Short | 3 rangées |
| Jambes (chaussette comprise) | 4 rangées |
| Chaussures | 2 rangées, puis le contour au sol |

- **Bras** : 2 px de remplissage et un contour de chaque côté, jamais 1 px. Ils mesurent 9 px
  de l'épaule à la main, quel que soit le gabarit. La main (le bout de 2×2) arrive au niveau
  de la taille.
- **Jambes** : 3 px de large (4 px chez les pivots et les lourds), plus le contour. Elles sont
  écartées, genoux fléchis vers l'extérieur.
- **Membres dans leur propre calque** : chaque bras et chaque jambe a son contour. Un bras
  qui passe devant le maillot en reste séparé par un trait sombre.

**Gabarits** (taille de la tête et longueur des bras identiques, membres jamais allongés) :

| Gabarit | Taille du joueur | Torse | Jambes | Hauteur | Largeur du torse |
| --- | --- | --- | --- | --- | --- |
| Meneur | < 1,93 m | 7 | 3 | 30 px (−2) | 10 px |
| Ailier | 1,93–2,05 m | 8 | 4 | 32 px | 10 px |
| Pivot | > 2,05 m | 10 | 5 | 35 px (+3) | 11 px (+1) |

Corpulence lourde : +1 colonne au torse et au short.

- **Ballon** : 6×6. Le ballon tenu est dessiné à la main du sprite (point d'accroche de chaque
  image). Au lâcher, il rejoindra sa position physique en ~80 ms.
- **Cadre des sprites** : 40×48 px, pieds au milieu du bord bas.
- **Contrôle** : la vue gros plan de `?style` (touche V) affiche les trois gabarits ×2 avec une
  règle par rangée. Les tests de `sprites.test.ts` mesurent chaque règle.

## 4. Palette maîtresse (32 couleurs, la nôtre)

Une seule palette pour tout le jeu, plus **deux rampes d'équipe** (primaire et secondaire,
3 tons chacune : clair, base, sombre) calculées à partir des couleurs de `teamsData.ts`.

| # | Nom | Hex | Rôle |
| --- | --- | --- | --- |
| 0 | outline | `#1a1424` | Contour de tous les sprites |
| 1 | ink | `#2e2a3a` | Ombres des neutres, chaussures, panneaux |
| 2 | slate | `#5a5868` | Gris moyen, poteau |
| 3 | silver | `#9a98a6` | Gris clair, métal, cheveux gris |
| 4 | mist | `#d4d2dc` | Filet, reflets |
| 5 | chalk | `#f6f2ea` | Blanc chaud : lignes, yeux, texte |
| 6–11 | skin0 → skin5 | `#ffe0c2` `#f0bf94` `#d1945f` `#a8693d` `#7a4627` `#4e2b19` | Rampe de peau : chaque teinte prend 3 tons consécutifs (4 teintes) |
| 12 | hairBlack | `#241a1a` | Cheveux noirs |
| 13 | hairBrown | `#5c3a22` | Cheveux châtains |
| 14 | hairBlond | `#d9b25e` | Cheveux blonds |
| 15 | woodLight | `#e8b97a` | Parquet clair |
| 16 | wood | `#d39a5a` | Parquet |
| 17 | woodDark | `#a86d3a` | Joints du parquet |
| 18 | orange | `#f07a2a` | Ballon, cercle |
| 19 | orangeDark | `#b4471c` | Coutures du ballon, ombre du cercle |
| 20 | seatDark | `#1f2340` | Tribunes (rangée sombre) |
| 21 | seat | `#2c3260` | Tribunes (rangée claire) |
| 22 | glass | `#bfe3ec` | Planche transparente |
| 23 | red | `#d8423a` | Accent (public, HUD) |
| 24 | yellow | `#f4c542` | Accent : joueur contrôlé, alertes |
| 25 | green | `#3fa36b` | Accent |
| 26 | blue | `#3f6fd8` | Accent |
| 27 | auburn | `#9a3e22` | Cheveux roux |
| 28 | teal | `#2aa6a0` | Réserve |
| 29 | purple | `#7a4fb8` | Réserve |
| 30 | pink | `#e88aa8` | Réserve |
| 31 | navy | `#18203a` | Fond des panneaux du HUD |

Règles :
- **Lumière** : elle vient d'en haut à gauche. L'ombrage utilise 2 ou 3 tons (clair, base,
  ombre) sans dégradé.
- **Ombres au sol** : noir à 30–35 % d'opacité, en ovale.
- **Couleurs d'équipe trop proches du parquet** : la raquette et la bande de touche prennent
  alors le ton sombre de la rampe.

## 5. Personnages

### Visage (de face, symétrique)
- **Yeux** : 2×2 de blanc, avec une colonne d'iris sombre côté intérieur ; 2 px d'écart entre
  les deux yeux, sur la même rangée.
- **Sourcils** : une rangée sombre de 3 px au-dessus de chaque œil. C'est ce qui donne
  l'expression.
- **Nez** : 1 px d'ombre de peau, décalé d'un pixel vers la droite : très léger trois-quarts.
- **Bouche** : ligne fermée de 4 px. Un grand sourire seulement pour « joyeuse » ; jamais de
  bouche ouverte au repos.
- **Ombrage** : un ton plus foncé sur un seul côté (le droit, lumière en haut à gauche).
  Aucun pixel sombre isolé sur les joues, pas d'oreille dessinée.
- **Contour** : 1 px fermé tout autour de la tête et du corps, ajouté automatiquement.
- **3 expressions** :
  - neutre, par défaut ;
  - concentrée (sourcils inclinés), automatique pendant le tir et le dunk ;
  - joyeuse (sourire avec dents), pour les célébrations, à brancher dans le match.

### Orientation et sol
- **De profil** : corps vu de face, légèrement penché dans le sens du jeu par les poses.
  C'est la vue en course vers la gauche ou la droite, et en descendant.
- **De dos** : dès que le joueur monte (diagonales comprises). La tête est vue de dos (chaque
  coiffure a sa grille de dos, la nuque en peau, pas de visage), le col est droit, le numéro
  est dans le dos, les chaussures sont vues du talon et les deux bras passent derrière le
  torse. À l'arrêt, le joueur garde sa dernière vue.
- Tournés vers la gauche, les joueurs ont leurs propres images, de profil comme de dos : le
  dessin est retourné, puis le numéro est reposé à l'endroit. La feuille compte 4 blocs de
  18 images.
- **Ballon au dribble** : de profil, la main revient devant le corps et le ballon rebondit
  devant les jambes, un peu en avant dans le sens de la course, dessiné par-dessus elles. De
  dos, il rebondit sur le côté de la hanche.
- **Course** : les foulées montent tout le corps d'un pixel (suspension), sans rien allonger.
  Les pas s'accélèrent avec la vitesse au sol (foulée d'environ 0,9 m), pour que les pieds
  accrochent le parquet.
- **Ombre au sol** : ovale sous les pieds ; elle reste au sol et rétrécit pendant le saut.

### Variété
Tout est tiré de l'identifiant du joueur, déterministe :
- 4 teintes de peau ;
- 5 formes de tête ;
- 10 coiffures (ras, court, afro, tresses, chignon, bandeau, chauve, frange, dégradé, barbe),
  toutes dans la boîte de la tête ;
- 5 couleurs de cheveux ;
- gabarit et numéro de maillot.

Objectif : sur 200 joueurs générés, au moins 95 % d'apparences différentes. L'expression n'est
plus une variante d'identité : c'est un état.

### Tenues
- **Maillot et short** : rampe primaire de l'équipe (clair, base, sombre) ; ceinture du
  short sombre.
- **Col, emmanchures, bande latérale du short, liseré du bas et numéro** : rampe secondaire.
- **Numéro** : police de chiffres dédiée (`jerseyDigits.ts`), 5 rangées, « 1 » étroit de
  2 px, 0/6/8/9 arrondis pour ne pas se confondre. Il commence une rangée sous le col rond et
  se centre sur la poitrine. Il ne peint que le maillot encore visible : un bras qui passe
  devant le cache.
- **Chaussures** : `ink` avec semelle `chalk`.
- **Équipe à l'extérieur** : rampes inversées (maillot clair) si les deux équipes sont trop
  proches.

### Animations minimales
| Animation | Images | Durée | Notes |
| --- | --- | --- | --- |
| Arrêt | 2 | 400 ms chacune | Respiration (1 px) |
| Course | 4 | 90 ms (selon la vitesse) | Bras opposés aux jambes |
| Dribble | 4 | cale sur le dribble (0,5 s l'aller-retour) | Jambes de course ou d'arrêt, bras + ballon |
| Saut / tir | 3 | flexion 80 ms, montée jusqu'au sommet, lâcher jusqu'à la réception | Ballon à la poitrine, puis au-dessus de la main levée à côté de la tête ; visage concentré |
| Dunk | 3 | élan, bras tendu vers le cercle, accroché 150 ms | Visage concentré |

Planche complète : vue « poses » de `?style` (touche V), pour les trois gabarits et vers la
gauche ; vue « dos » pour les mêmes images vues de dos.

## 6. Panier et terrain
- **Panier massif** :
  - socle et poteau rembourrés aux couleurs de l'équipe à domicile, cernés de sombre pour se
    détacher de la bande de même couleur, chapeau au sommet du poteau ;
  - poutre métallique (contour, reflet) du poteau jusqu'au milieu de la planche, où elle passe
    derrière le verre, avec jambe de force et platine : la planche ne flotte pas ;
  - planche transparente en perspective, avec cadre et carré de visée ; elle est dessinée en
    biais exagéré pour montrer sa face (vue strictement de côté, elle serait de chant) ;
  - cercle dessiné **1,35× plus grand** que le cercle physique (~14 px de large pour un ballon
    de 6 px), moitié arrière sombre derrière le ballon, moitié avant épaisse devant ; la
    physique garde le vrai rayon (noté dans `docs/ENGINE_VIEW_CONTRACT.md`) ;
  - filet à mailles croisées ;
  - ombres au sol d'un seul tenant : socle, bande sous la poutre, cercle.
- **Terrain** :
  - parquet en lattes (3 tons de bois) ;
  - raquette et rond central aux couleurs de l'équipe à domicile, logo maison (abréviation
    en police HoopSim, à l'échelle 2) ;
  - lignes `chalk`.

## 7. Arène
- **Bandes de touche** : aux couleurs de l'équipe à domicile, avec son nom (ville, nom du
  club) en police HoopSim à l'échelle 2, répété le long de la bande du fond. Le nom vertical derrière la
  ligne de fond a été retiré : il passait sous le socle du panier.
- **Public en rangées lisibles** : chaque spectateur (8×10 px) est une tête (cheveux, peau,
  yeux) sur des épaules colorées, assis sur des rangées de ~11 px alternées. Il y a des maillots de l'équipe à
  domicile en majorité et quelques accents.
- **Photographes** : 2 ou 3 par ligne de fond, accroupis (14×14 px), appareil `slate`/`silver`.
- **Arbitre** : même gabarit que les joueurs, maillot à rayures noires et blanches génériques
  (pas de marque), sifflet.

## 8. HUD original

Notre mise en page, différente de la référence : tableau de score compact **en haut à
gauche**, carte du joueur **en bas à gauche**. La police HoopSim fait 5×7, et les panneaux
sont `navy` avec un liseré `ink`.

```
Tableau de score (116×25 px)              Carte du joueur contrôlé (150×28 px)
+------------------------------+          +--------------------------------+
| [DAL] 48   [BOS] 37          |          | [tête] E. OKONKWO   MEN         |
| QT3  1:35   TIR 14           |          |        ######..  12 PTS 4 REB  |
+------------------------------+          +--------------------------------+
  [DAL] = pastille aux couleurs              barre d'énergie + 3 stats
```

- **Étiquette sous chaque joueur** (validé) : nom de famille seul et en entier, en petite
  police 3×5 maison sur fond sombre. L'étiquette prend la largeur du nom ; les noms générés
  font 10 lettres au plus. Aucun nom de famille n'apparaît deux fois dans une ligue, donc dans
  un match. L'étiquette du joueur contrôlé est soulignée en `yellow`, avec un anneau `yellow`
  au sol.
- **Texte de debug** : masqué par défaut, affiché par une touche ; la bande des 32 couleurs de
  la palette n'apparaît qu'avec lui.

## 9. Liste de contrôle d'originalité (avant chaque nouvel asset)
1. Dessiné par nous (ou pack sous licence noté dans `src/assets/CREDITS.md`) ?
2. Couleurs prises uniquement dans la palette maîtresse ou les rampes d'équipe ?
3. Aucun nom, logo, personnage ni mise en page reconnaissable d'un jeu existant, d'une ligue
   ou d'une marque réelle ?
4. Lisible à l'échelle ×1 (capture sans zoom) ?

## 10. Ce qui reste à décider
- Les sprites S3d (règles chiffrées), à valider sur `?style` (vues terrain, gros plan,
  poses), puis à comparer avec la planche des concepts v2 quand elle arrivera.
- Quand afficher l'expression « joyeuse » en match (panier marqué, victoire) : avec le score
  (incrément 7a) ou en phase 2.
- Bandes noires en fenêtre : le match les a aussi depuis S4 (mise à l'échelle entière). Garder
  le plein écran (F), ou ajouter un réglage « remplir l'écran » (facteur non entier).
