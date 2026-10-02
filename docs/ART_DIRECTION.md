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

Matheo a validé le **cadrage** de 384×216 à 18 px/m, puis demandé **plus de pixels sans
agrandir** joueurs et ballon. On garde donc exactement ce cadrage, avec 1,67× plus de pixels
partout.

| Réglage | Valeur | Pourquoi |
| --- | --- | --- |
| Résolution interne | **640×360** | Mise à l'échelle entière : ×3 en 1080p, ×4 en 1440p, ×6 en 4K, ×2 sur un portable 1366×768 et en 720p |
| Mise à l'échelle | entière uniquement (`Scale.NONE` + zoom entier, recalculé au redimensionnement) | Pixels nets, jamais de pixel étiré |
| Échelle du terrain | **30 px/m** en longueur | ~21 m de terrain visibles en largeur, comme à 384×216 / 18 px/m |
| Vue 3/4 | profondeur ×0,66, hauteur ×0,68 | Toute la profondeur du terrain à l'écran |

**Fenêtre de navigateur** : sur un écran 1080p, une fenêtre non plein écran n'offre qu'environ
950 px de haut. Le facteur tombe alors à ×2 (1280×720, avec des bandes). La touche **F** passe
en plein écran, ce qui donne ×3. Un réglage « remplir l'écran » (facteur non entier) pourra
s'ajouter si les bandes gênent.

Ordres de grandeur à 30 px/m :

| Élément | Taille à l'écran |
| --- | --- |
| Profondeur du terrain (15,24 m) | ~302 px, soit 84 % de la hauteur de l'écran |
| Hauteur du cercle (3,05 m) | ~62 px au-dessus du sol |
| Joueur de 2 m à l'échelle réelle | ~41 px |

## 3. Échelle des personnages (validé : 1,1)

- **La physique reste à l'échelle réelle.** Seul le dessin des joueurs et du ballon est
  agrandi, par `VISUAL_SCALE` = **1,1**. Matheo l'a choisi sur `?style`, en comparant 1,1,
  1,25 et 1,4 à côté du panier. À 1,4, un joueur de 2 m arrivait presque au cercle debout.
- **Ballon tenu** : il est dessiné dans la main du sprite (point d'accroche de chaque image).
  Au lâcher, il rejoint sa position physique en ~80 ms, pour éviter un saut visible.

| Joueur | Hauteur à l'écran (×1,1) | Tête |
| --- | --- | --- |
| 1,80 m | ~40 px | 14 px |
| 2,00 m | ~45 px | 14 px |
| 2,20 m | ~49 px | 14 px |

Cadre des sprites : **64×80 px**. Il couvre le plus grand joueur et le bras tendu du dunk ;
les pieds sont au milieu du bord bas. Ballon : **8×8 px**.

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

### Proportions et lecture
- **Style chibi** : la tête fait ~1/3 de la hauteur et le corps est trapu. Les épaules sont
  plus larges que le bassin.
- **Visage lisible** (tête de 14×14 px) : deux yeux de 2×2 (blanc + pupille), sourcils,
  oreille et nez dans l'ombre de la peau, bouche. Les joueurs sont vus de 3/4 et retournés
  selon leur orientation.
- **Contour** : un pixel de la couleur `outline` autour de la silhouette entière, ajouté
  automatiquement après assemblage.
- **Ombre au sol** : ovale sous les pieds ; elle reste au sol et rétrécit pendant le saut.

### Gabarits (6)
Taille : **petit** (< 1,93 m), **moyen** (1,93–2,05 m), **grand** (> 2,05 m).
Corpulence : **léger** ou **lourd**, selon le poids rapporté à la taille.

| | Léger | Lourd |
| --- | --- | --- |
| Torse | 12 px de large | 15 px de large |
| Short | 12 px, 5 rangées | 15 px, 6 rangées |
| Jambes | 3 px | 4 px |

Les grands ont des jambes et un torse plus longs (rangées « étirables » des grilles).

### Variété
Tout est tiré de l'identifiant du joueur, déterministe :
- 4 teintes de peau ;
- 4 formes de tête ;
- 4 visages (yeux et sourcils) ;
- 8 coiffures (ras, court, afro, tresses, chignon, bandeau, chauve, barbe) ;
- 5 couleurs de cheveux ;
- numéro de maillot.

Objectif : sur 200 joueurs générés, au moins 95 % d'apparences différentes.

### Tenues
- **Maillot et short** : rampe primaire de l'équipe (clair, base, sombre) ; ceinture du
  short sombre.
- **Col, emmanchures, bande latérale du short, liseré du bas et numéro** : rampe secondaire.
  Le numéro (chiffres 3×5) est centré sur la partie du maillot que le bras avant ne couvre
  pas.
- **Chaussures** : `ink` avec semelle `chalk`.
- **Équipe à l'extérieur** : rampes inversées (maillot clair) si les deux équipes sont trop
  proches.

### Animations minimales
| Animation | Images | Durée | Notes |
| --- | --- | --- | --- |
| Arrêt | 2 | 400 ms chacune | Respiration (1 px) |
| Course | 4 | 90 ms (selon la vitesse) | Bras opposés aux jambes |
| Dribble | 4 | cale sur le dribble (0,5 s l'aller-retour) | Jambes de course ou d'arrêt, bras + ballon |
| Saut / tir | 3 | flexion 80 ms, montée jusqu'au sommet, lâcher jusqu'à la réception | Ballon au-dessus de la tête, puis bras tendu |
| Dunk | 3 | élan, bras tendu vers le cercle, accroché 150 ms | Cadre de 80 px pour le bras tendu |

## 6. Panier et terrain
- **Panier massif** :
  - socle et poteau rembourrés aux couleurs de l'équipe à domicile, cernés de sombre pour se
    détacher de la bande de même couleur, bras métallique ;
  - planche transparente en perspective, avec cadre et carré de visée ; elle est dessinée en
    biais exagéré pour montrer sa face (vue strictement de côté, elle serait de chant) ;
  - cercle épais, avec moitié arrière et moitié avant autour du ballon ;
  - filet à mailles ;
  - ombre du socle et de la planche au sol.
- **Terrain** :
  - parquet en lattes (3 tons de bois) ;
  - raquette et rond central aux couleurs de l'équipe à domicile, logo maison (abréviation
    en police HoopSim, à l'échelle 2) ;
  - lignes `chalk`.

## 7. Arène
- **Bandes de touche** : aux couleurs de l'équipe à domicile, avec son nom (ville, nom du
  club) en police HoopSim à l'échelle 2, répété le long de la bande du fond. Le nom vertical derrière la
  ligne de fond a été retiré : il passait sous le socle du panier.
- **Public en rangées lisibles** : chaque spectateur (10×12 px) est une tête (cheveux, peau,
  yeux) sur des épaules colorées, assis sur des rangées de 15 px alternées. Il y a des maillots de l'équipe à
  domicile en majorité et quelques accents.
- **Photographes** : 2 ou 3 par ligne de fond, accroupis (18×18 px), appareil `slate`/`silver`.
- **Arbitre** : même gabarit que les joueurs, maillot à rayures noires et blanches génériques
  (pas de marque), sifflet.

## 8. HUD original

Notre mise en page, différente de la référence : tableau de score compact **en haut à
gauche**, carte du joueur **en bas à gauche**. La police HoopSim fait 5×7 (scores à
l'échelle 2), et les panneaux sont `navy` avec un liseré `ink`.

```
Tableau de score (156×34 px)              Carte du joueur contrôlé (176×36 px)
+------------------------------+          +--------------------------------+
| [DAL] 48   [BOS] 37          |          | [tête] E. OKONKWO   MEN         |
| QT3  1:35   TIR 14           |          |        ######..  12 PTS 4 REB  |
+------------------------------+          +--------------------------------+
  [DAL] = pastille aux couleurs              barre d'énergie + 3 stats
```

- **Étiquette sous chaque joueur** (validé) : nom de famille seul, 8 lettres au plus, en
  police 5×7 sur fond sombre. En 640×360, elle occupe la même place que la petite police 3×5
  en 384×216. La petite police reste pour les indications discrètes (« D aide »). L'étiquette
  du joueur contrôlé est soulignée en `yellow`, avec un anneau `yellow` au sol.
- **Texte de debug** : masqué par défaut, affiché par une touche.

## 9. Liste de contrôle d'originalité (avant chaque nouvel asset)
1. Dessiné par nous (ou pack sous licence noté dans `src/assets/CREDITS.md`) ?
2. Couleurs prises uniquement dans la palette maîtresse ou les rampes d'équipe ?
3. Aucun nom, logo, personnage ni mise en page reconnaissable d'un jeu existant, d'une ligue
   ou d'une marque réelle ?
4. Lisible à l'échelle ×1 (capture sans zoom) ?

## 10. Ce qui reste à décider
- Le dessin plus fin (têtes, visages, coiffures, corps, ballon), à valider sur `?style`.
- Bandes noires en fenêtre : garder le plein écran (F), ou ajouter un réglage « remplir
  l'écran » en S4.
