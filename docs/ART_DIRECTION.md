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

## 2. Résolution et cadrage **[à valider]**

| Réglage | Valeur proposée | Pourquoi |
| --- | --- | --- |
| Résolution interne | **384×216** | Mise à l'échelle entière : ×5 en 1080p, ×10 en 4K, ×3 sur un portable 1366×768, ×6 en 1440p (bandes noires autour) |
| Mise à l'échelle | entière uniquement (`Scale.NONE` + `MAX_ZOOM`, recalculée au redimensionnement) | Pixels nets, jamais de pixel étiré |
| Échelle du terrain | **18 px/m** en longueur | ~21 m de terrain visibles en largeur |
| Vue 3/4 | profondeur ×0,66, hauteur ×0,68 | Comme aujourd'hui (incrément 4b) |

Ordres de grandeur à 18 px/m :

| Élément | Taille à l'écran |
| --- | --- |
| Profondeur du terrain (15,24 m) | ~181 px, soit 84 % de la hauteur de l'écran |
| Hauteur du cercle (3,05 m) | ~37 px au-dessus du sol |
| Joueur de 2 m à l'échelle réelle | ~24 px |

## 3. Échelle des personnages **[à valider]**

- **La physique reste à l'échelle réelle.** Seul le dessin des joueurs est agrandi, par un
  facteur `VISUAL_SCALE`.
- **Demande initiale : 1,4×.** Attention : avec un panier à l'échelle réelle, un joueur de 2 m
  ferait alors ~34 px pour un cercle à ~37 px du sol. Il serait presque à hauteur du cercle
  debout. Sur la capture de référence, les joueurs ne sont agrandis que d'environ 1,1× par
  rapport au panier ; l'impression de « gros joueurs » vient surtout de la grosse tête, du
  corps trapu et du cadrage serré.
- **Décision à l'œil** : la scène `?style` montre le même joueur à **1,1 / 1,25 / 1,4** à côté
  du panier.
- **Ballon tenu** : il est dessiné dans la main du sprite (point d'accroche de chaque image).
  Au lâcher, il rejoint sa position physique en ~80 ms, pour éviter un saut visible.

| Échelle | Joueur de 2 m | Tête (1/3) |
| --- | --- | --- |
| 1,1× | ~27 px | ~9 px |
| 1,25× | ~31 px | ~10 px |
| 1,4× | ~34 px | ~11 px |

Cadre des sprites : **40×56 px**. Il couvre le plus grand joueur à 1,4× et le bras tendu du
dunk ; les pieds sont au milieu du bord bas.

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
- **Visage lisible** : yeux de 2 px (blanc + pupille), sourcils d'1 px, bouche, oreille. Les
  joueurs sont vus de 3/4 profil et retournés selon leur orientation.
- **Contour** : un pixel de la couleur `outline` autour de la silhouette entière, ajouté
  automatiquement après assemblage.
- **Ombre au sol** : ovale sous les pieds ; elle reste au sol et rétrécit pendant le saut.

### Gabarits (6)
Taille : **petit** (< 1,93 m), **moyen** (1,93–2,05 m), **grand** (> 2,05 m).
Corpulence : **léger** ou **lourd**, selon le poids rapporté à la taille.

| | Léger | Lourd |
| --- | --- | --- |
| Torse | 8 px de large | 11 px de large |
| Jambes | fines | épaisses |

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
- **Maillot et short** : rampe primaire de l'équipe (clair, base, sombre).
- **Liserés et numéro** : rampe secondaire.
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
| Dunk | 3 | élan, bras tendu vers le cercle, accroché 150 ms | Cadre de 56 px pour le bras tendu |

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
    en police HoopSim) ;
  - lignes `chalk`.

## 7. Arène
- **Bandes de touche** : aux couleurs de l'équipe à domicile, avec son nom (ville, nom du
  club) en police HoopSim, répété le long de la bande du fond. Le nom vertical derrière la
  ligne de fond a été retiré : il passait sous le socle du panier.
- **Public en rangées lisibles** : chaque spectateur est une petite tête (cheveux, peau) sur
  des épaules colorées, assis sur des rangées alternées. Il y a des maillots de l'équipe à
  domicile en majorité et quelques accents.
- **Photographes** : 2 ou 3 par ligne de fond, accroupis, appareil `ink`/`silver`.
- **Arbitre** : même gabarit que les joueurs, maillot à rayures noires et blanches génériques
  (pas de marque), sifflet.

## 8. HUD original

Notre mise en page, différente de la référence : tableau de score compact **en haut à
gauche**, carte du joueur **en bas à gauche**. La police HoopSim fait 5×7, et les panneaux
sont `navy` avec un liseré `ink`.

```
Tableau de score (≈ 96×22 px)             Carte du joueur contrôlé (≈ 92×26 px)
+------------------------------+          +--------------------------------+
| [DAL] 48   [BOS] 37          |          | [tête] E. OJELEYE   MEN         |
| QT3  1:35   TIR 14           |          |        ######..  12 PTS 4 REB  |
+------------------------------+          +--------------------------------+
  [DAL] = pastille aux couleurs              barre d'énergie + 3 stats
```

- **Étiquette sous chaque joueur** : nom de famille (8 lettres au plus) en petite police 3×5
  maison, sur fond sombre. Avec la police 5×7, elles étaient trop larges et se chevauchaient.
  Celle du joueur contrôlé est soulignée en `yellow`, avec un anneau `yellow` au sol.
- **Texte de debug** : masqué par défaut, affiché par une touche.

## 9. Liste de contrôle d'originalité (avant chaque nouvel asset)
1. Dessiné par nous (ou pack sous licence noté dans `src/assets/CREDITS.md`) ?
2. Couleurs prises uniquement dans la palette maîtresse ou les rampes d'équipe ?
3. Aucun nom, logo, personnage ni mise en page reconnaissable d'un jeu existant, d'une ligue
   ou d'une marque réelle ?
4. Lisible à l'échelle ×1 (capture sans zoom) ?

## 10. Ce qui reste à décider
- Résolution 384×216 et 18 px/m (section 2).
- `VISUAL_SCALE` (section 3), à choisir sur `?style`.
- Le style des 8 coiffures et des 4 visages, à valider sur `?style`.
