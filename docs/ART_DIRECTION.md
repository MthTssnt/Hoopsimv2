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

## 2. Résolution et cadrage

Cadrage validé par Matheo : 21,3 m de terrain visibles en largeur et toute la profondeur (celui
de 384×216 à 18 px/m). Depuis l'incrément 14 (redesign des joueurs), la résolution interne passe
à **640×360 à 30 px/m** : même cadrage, un tiers de pixels en plus partout, pour des joueurs
mieux définis (et plus minces) sans les grossir à l'écran.

| Réglage | Valeur | Pourquoi |
| --- | --- | --- |
| Résolution interne | **640×360** | Mise à l'échelle entière : ×3 en 1080p plein écran, ×2 dans une fenêtre de navigateur 1080p et sur un portable 1366×768, ×4 en 1440p, ×6 en 4K |
| Mise à l'échelle | entière uniquement (`Scale.NONE` + zoom entier, recalculé au redimensionnement) | Pixels nets, jamais de pixel étiré |
| Échelle du terrain | **30 px/m** en longueur | ~21,3 m de terrain visibles en largeur |
| Vue 3/4 | profondeur ×0,66, hauteur ×0,68 | Toute la profondeur du terrain à l'écran |

La touche **F** passe en plein écran. Les épaisseurs du décor (lattes, public, poteau,
poutre, panneaux) sont proportionnelles à l'échelle (`artPx`) : elles suivent la résolution.
En fenêtre 1080p, le jeu passe de ×3 (480×270) à ×2 (1280×720) ; l'option « remplir l'écran »
(incrément 18) rattrapera la fenêtre.

Ordres de grandeur à 30 px/m :

| Élément | Taille à l'écran |
| --- | --- |
| Profondeur du terrain (15,24 m) | ~302 px, soit 84 % de la hauteur de l'écran |
| Hauteur du cercle (3,05 m) | ~62 px au-dessus du sol |
| Joueur standard (ailier) | 43 px, contour compris |

## 3. Règles chiffrées des personnages (font foi une fois validées)

Les sprites ont leurs propres règles en pixels. Celles de l'incrément 14 (redesign) reprennent
les proportions données par Matheo en S3d, avec plus de pixels et une silhouette plus mince ;
elles sont à valider sur `?style` (vues gros plan et avant / après). La physique garde les
vraies tailles : seul le dessin suit ces règles.

**Joueur standard (ailier), 43 px contour compris, même taille par rapport au terrain qu'en
480×270, tête ~40 % de la hauteur** :

| Partie | Taille |
| --- | --- |
| Tête, cheveux compris | 17 rangées de haut (contour du haut + 16), 18 de large avec le contour |
| Cou | 1 rangée |
| Torse (maillot) | 11 rangées, 11 px de large (26 % de la hauteur : plus mince qu'avant) |
| Short | 4 rangées |
| Jambes (chaussette comprise) | 6 rangées |
| Chaussures | 3 rangées (dessus `ink` sur 2, semelle `chalk`), puis le contour au sol |

- **Bras** : 2 px de remplissage et un contour de chaque côté, jamais 1 px. Ils mesurent 12 px
  de l'épaule à la main, quel que soit le gabarit. La main (le bout de 2×2) arrive au niveau
  de la taille.
- **Jambes** : 3 px de large (4 px chez les pivots et les lourds), plus le contour, séparées
  par leurs contours.
  - À l'arrêt, elles sont droites, et l'entrejambe reste un trait droit (pas de croix sombre).
    Le genou de la jambe avant est marqué d'un pixel d'ombre côté extérieur.
  - Les genoux ne se plient vraiment qu'en course, en flexion et en l'air.
- **Membres dans leur propre calque** : chaque bras et chaque jambe a son contour. Un bras
  qui passe devant le maillot en reste séparé par un trait sombre.
- **Largeur** : 19 px au plus pour l'ailier à l'arrêt, bras compris (18 avant, pour 32 px de
  haut).

**Gabarits** (taille de la tête et longueur des bras identiques, membres jamais allongés) :

| Gabarit | Taille du joueur | Torse | Jambes | Hauteur | Largeur du torse |
| --- | --- | --- | --- | --- | --- |
| Meneur | < 1,93 m | 9 | 5 | 40 px (−3) | 11 px |
| Ailier | 1,93–2,05 m | 11 | 6 | 43 px | 11 px |
| Pivot | > 2,05 m | 13 | 7 | 46 px (+3) | 12 px (+1) |

Corpulence lourde : +1 colonne au torse et au short.

- **Ballon** : 8×8 (10×10 avec le contour), deux coutures `ink`, un reflet en haut à gauche,
  l'ombre en bas à droite. Le ballon tenu est dessiné à la main du sprite (point d'accroche de
  chaque image). Au lâcher, il rejoint sa position physique en ~80 ms.
- **Cadre des sprites** : 56×64 px, pieds au milieu du bord bas.
- **Contrôle** : la vue gros plan de `?style` (touche V) affiche les trois gabarits ×2 avec une
  règle par rangée ; la vue avant / après montre l'ailier de 480×270 (×4) et celui de 640×360
  (×3) à la même taille à l'écran. Les tests de `sprites.test.ts` mesurent chaque règle.

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

### Visage (de 3/4, tourné dans le sens de la course)
Le visage n'est jamais vu de face : il est toujours tourné en diagonale (incrément 15 ter,
décision de Matheo). Il est dessiné tourné vers la droite ; vers la gauche, le dessin est
retourné.
- **Yeux**, sur les mêmes rangées (7 à 9) :
  - l'œil proche (du côté qui s'éloigne) a 2×3 de blanc et une colonne d'iris ;
  - l'œil éloigné, raccourci, n'a qu'une colonne de blanc et son iris, contre le bord de la
    tête du côté de la course ;
  - les iris regardent dans le sens de la course.
- **Sourcils** : une rangée sombre de 4 px sur l'œil proche, de 2 px sur l'œil éloigné. C'est ce
  qui donne l'expression.
- **Nez** : 3 px d'ombre de peau en équerre, à au moins 2 colonnes du centre, vers le sens de la
  course.
- **Bouche** : ligne fermée de 3 px, décalée comme le nez. Un sourire avec dents seulement pour
  « joyeuse » ; jamais de bouche ouverte au repos.
- **Oreille** : 3 px au ton d'ombre de la peau, du côté qui s'éloigne (colonne 1, rangées 8 à
  10), posée seulement sur la peau : une coiffure qui couvre les côtés la cache.
- **Ombrage** : un ton plus foncé sur un seul côté (le droit, lumière en haut à gauche).
  Aucun pixel sombre isolé sur les joues.
- **Portrait du HUD** : le même visage de 3/4 (diagonale bas, tourné vers la droite).
- **Contour** : 1 px fermé tout autour de la tête et du corps, ajouté automatiquement.
- **3 expressions** :
  - neutre, par défaut ;
  - concentrée (sourcils inclinés), automatique pendant le tir et le dunk ;
  - joyeuse (sourire avec dents), pour les célébrations, à brancher dans le match.

### Orientation et sol
Quatre positions, toutes en diagonale (incrément 15 ter, décision de Matheo) : il n'y a plus ni
profil, ni vue de face, ni dos plein.

| Position | Déplacement | Vu |
| --- | --- | --- |
| diagonale bas droite | descend vers la droite | de face, en diagonale |
| diagonale bas gauche | descend vers la gauche | de face, en diagonale |
| diagonale haut droite | monte vers la droite | de dos, en diagonale |
| diagonale haut gauche | monte vers la gauche | de dos, en diagonale |

- **Choix de la position** (`headingFor`, `render/playerView.ts`) :
  - en montant à plus de 15° au-dessus de l'horizontale : diagonale haut ; en descendant à plus
    de 15° : diagonale bas ; montée et descente tout droit comprises ;
  - entre les deux (course horizontale, zone morte de ±15°), le joueur garde sa diagonale et ne
    change que de côté. La zone morte évite aussi tout clignotement ;
  - à l'arrêt et en l'air, il garde sa position ; au départ, diagonale bas ;
  - le côté (gauche ou droite) est celui du corps : la dernière direction horizontale ;
  - le tireur (tir, layup, dunk, lancer franc), le passeur et le voleur prennent la même règle
    sur la direction du cercle, du receveur ou du ballon : diagonale haut depuis l'aile proche,
    diagonale bas depuis l'aile du fond, position gardée de face au panier.
- **Repères communs**, dessinés vers la droite (vers la gauche, le dessin est retourné, puis le
  numéro est reposé à l'endroit) :
  - la tête est décalée d'1 px vers le sens de la course par rapport au torse ;
  - le torse et le short ont un flanc de 2 colonnes au ton sombre ;
  - les membres sont étagés : le bras et la jambe éloignés de la caméra passent derrière, au ton
    d'ombre de la peau, et le pied éloigné est dessiné 2 px plus haut (le pied proche reste sur
    la rangée du sol, le cadre ne change pas) ;
  - à l'arrêt, les jambes restent droites (entrejambe droit).
- **Diagonale bas** (de face, 3/4) :
  - visage de 3/4 (voir « Visage ») sur la tête et la coiffure de face ;
  - flanc du côté qui s'éloigne, col et numéro décalés vers le sens de la course ;
  - le bras du côté de la course passe derrière le torse, épaule rentrée de 2 px : on voit
    l'avant-bras et la main ; le bras proche passe devant le torse ;
  - la jambe du côté de la course est l'éloignée : hanche rentrée d'1 px, pied 2 px plus haut ;
  - chaussures de 3/4, pointe de 5 px ;
  - le ballon du dribble rebondit devant les jambes, dessiné devant le corps.
- **Diagonale haut** (de dos, 3/4) :
  - tête et coiffure de dos ; du côté de la course, la joue, la mâchoire et l'oreille dépassent
    sur 3 colonnes (rangées 7 à 12), l'oreille au ton d'ombre : on devine le profil ;
  - flanc du côté de la course, col et numéro décalés vers l'arrière ;
  - les deux bras passent derrière le torse ; l'épaule du bras éloigné (côté opposé à la course)
    est rentrée de 2 px ;
  - la jambe éloignée est celle du côté opposé à la course (pied 2 px plus haut) ;
  - chaussures vues du talon, avec un bout de pointe ;
  - le ballon du dribble rebondit sur le côté de la hanche, dessiné derrière le corps.
- Un bras levé (tir, dunk, contre) n'est jamais rentré : il passe devant la tête et le torse.
- Tir, dunk et contre gardent leurs poses dans les deux diagonales, avec la tête, le torse, les
  jambes et les chaussures de la diagonale.
- **Feuille** : 4 blocs (bas droite, bas gauche, haut droite, haut gauche) de 19 images, soit
  76 images rangées en grille (une rangée par bloc, 1 064×256 px). En une seule bande, une
  feuille dépasserait la taille maximale d'une texture.
- **Course** : les foulées montent tout le corps d'un pixel (suspension), sans rien allonger.
  Les pas s'accélèrent avec la vitesse au sol (foulée d'environ 0,9 m), pour que les pieds
  accrochent le parquet.
- **Ombre au sol** : ovale sous les pieds ; elle reste au sol et rétrécit pendant le saut.

### Variété
Tout est tiré de l'identifiant du joueur, déterministe :
- 4 teintes de peau ;
- 5 formes de tête ;
- 10 coiffures (ras, court, afro, tresses, chignon, bandeau, chauve, frange, dégradé, barbe),
  toutes dans la boîte de la tête (16×16), de face et de dos, avec un ton de reflet (gris
  ardoise sur les cheveux noirs, bois clair ou foncé sur les blonds et les bruns, orange sombre
  sur les roux, brume sur les gris) ;
- 5 couleurs de cheveux ;
- gabarit et numéro de maillot.

Objectif : sur 200 joueurs générés, au moins 95 % d'apparences différentes. L'expression n'est
plus une variante d'identité : c'est un état.

### Tenues
- **Maillot et short** : rampe primaire de l'équipe (clair, base, sombre) ; ceinture du
  short sombre.
- **Col, emmanchures, bande latérale du short, liseré du bas et numéro** : rampe secondaire.
- **Numéro** : police de chiffres dédiée (`jerseyDigits.ts`), 6 rangées, « 1 » étroit de
  2 px, 0/6/8/9 arrondis pour ne pas se confondre. Il commence une rangée sous le col rond (sur
  2 rangées) et se centre sur la poitrine. Il ne peint que le maillot encore visible : un bras qui passe
  devant le cache.
- **Chaussures** : `ink` sur 2 rangées avec semelle `chalk`.
- **Équipe à l'extérieur** : rampes inversées (maillot clair) si les deux équipes sont trop
  proches.
- **1 contre 1 de test (7a)** : tes trois joueurs (1-3) portent la tenue de l'équipe à
  domicile, celle de l'arène ; leurs vis-à-vis portent celle de l'équipe adverse, choisie pour
  trancher avec elle (`contrastingTeam`). Les six sprites sont cuits au démarrage.

### Animations minimales
| Animation | Images | Durée | Notes |
| --- | --- | --- | --- |
| Arrêt | 2 | 400 ms chacune | Respiration (1 px) |
| Course | 4 | 90 ms (selon la vitesse) | Bras opposés aux jambes |
| Dribble | 4 | cale sur le dribble (0,5 s l'aller-retour) | Jambes de course ou d'arrêt, bras + ballon |
| Saut / tir | 3 | flexion 80 ms, montée jusqu'au sommet, lâcher jusqu'à la réception | Ballon à la poitrine, puis au-dessus de la main levée à côté de la tête ; visage concentré |
| Dunk | 3 | élan, bras tendu vers le cercle, accroché ~0,3 s au cercle (deux bras) | Visage concentré ; en match, sprite monté pour que les mains touchent le cercle |
| Contre (image 18) | 1 | tout le saut sans le ballon | Deux bras tendus vers le haut, jambes du saut, visage concentré ; contre, contestation, rebond. Après son lâcher, le tireur garde l'image 14 (bras du lâcher) jusqu'au sol |

Planches complètes (touche V de `?style`) :
- vue « gros-plan » : les trois gabarits en diagonale bas, avec la règle des proportions, et les
  3 expressions de 3/4 en grand ;
- vue « poses » : les 19 images des trois gabarits en diagonale bas, et l'ailier vers la gauche ;
- vue « dos » : les mêmes images en diagonale haut ;
- vue « directions » : les trois gabarits courent ou dribblent, animés, dans les 8 directions
  (les 4 positions en diagonale).

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

Depuis le passage à 640×360 (incrément 15), le HUD, les étiquettes et les messages gardent
leurs tailles en pixels : ils paraissent ~25 % plus petits à l'écran et laissent plus de place
au jeu, jusqu'à la reprise du HUD (incrément 18). Les distances du rendu autour des joueurs
(étiquette sous les pieds, messages au-dessus de la tête, jauge, secousse, boîte suivie par la
caméra) sont, elles, passées à l'échelle (× 4/3, `MATCH_PX` dans `MatchScene`).

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
- **Jauge de tir** : barre verticale de 5×27 px cernée de `outline` (4×20 en 480×270), à côté du
  tireur, du côté opposé au panier, posée à hauteur du torse et sur le sol (elle ne suit pas le
  saut).
  - Fond `navy`, zone verte `green` sur toute la largeur, remplissage `chalk` au centre (le
    vert reste visible sur les bords), trait `yellow` au lâcher.
  - Le sommet du saut est à ~70 % de la hauteur.
  - Elle disparaît 0,6 s après le lâcher.
- **Annonce du lâcher** : PARFAIT (`yellow`), BON (`green`), TÔT / TARD (`silver`), en petite
  police sur fond sombre, au-dessus de la tête ; elle monte de 4 px et s'efface en 0,9 s.
- **Pose du tir** : ballon levé (tir en suspension) ou bras tendu vers le cercle (layup), visage
  concentré, tourné vers le panier dans la diagonale de la direction du cercle (voir
  « Orientation et sol »).
- **Dunk réussi** : annonce « DUNK » (`yellow`, même style que PARFAIT) et secousse de caméra de
  ±2 px entiers pendant 0,15 s (le pixel-art reste net), pour toi comme pour l'IA.
- **1 contre 1 (7a)** :
  - tableau de score : toi (pastille de l'équipe à domicile) contre l'IA (pastille adverse) ;
    la ligne du bas devient « PREMIER À 11 » ;
  - la jauge et les notes du lâcher ne s'affichent que pour tes tirs ;
  - « RESSORS » (`orange`) au-dessus de ta tête tant que tu dois ressortir le ballon, empilé
    au-dessus de l'annonce du tir si elle est encore là ;
  - « NON VALABLE » (`red`) au-dessus du panier quand un panier ne compte pas ; il monte de
    4 px et s'efface en 1,5 s ;
  - fin de partie : bandeau au centre du HUD pendant la pause de 3 s, titre en police 5×7
    doublée (« GAGNÉ 11-7 » en `yellow`, « PERDU 8-11 » en `red`), sous-titre « NOUVELLE
    PARTIE À 0-0 » en petite police ;
  - étiquettes : quand les deux joueurs sont côte à côte, les étiquettes s'écartent chacune de
    son côté au lieu de se chevaucher ; seule la tienne est soulignée.
- **Équipes (incrément 8)** :
  - l'anneau jaune, l'étiquette soulignée et la carte du HUD suivent le joueur contrôlé ; au
    changement de joueur, l'anneau clignote ~0,25 s pour qu'on le repère ;
  - les étiquettes de tous les joueurs s'écartent entre elles (jamais de chevauchement) ;
  - pose de passe provisoire : l'image 14 (bras du lâcher) pendant 0,15 s, au sol ; une vraie
    pose de passe viendra en phase 3 ;
  - ton équipe en tenue de l'arène, l'adversaire en tenue extérieure (`contrastingTeam`).
- **Défense (7b)** : « CONTRE » (`yellow`) au-dessus du contreur, avec la même secousse que le
  dunk ; « FAUTE » (`red`) au-dessus du défenseur, dès le contact ; « GOALTENDING » (`yellow`)
  au-dessus du panier. Comme NON VALABLE, ils montent de 4 px et s'effacent en 1,5 s, et
  s'empilent quand plusieurs visent le même joueur ou le panier (au-dessus de l'annonce du
  tir).
- **Vols et passes coupées (incrément 9)** : « VOL » (`yellow`) au-dessus du défenseur qui
  arrache le ballon, « INTERCEPTION » (`yellow`) au-dessus de celui qui attrape une passe,
  « DÉVIÉE » (`silver`) au-dessus de celui qui la touche sans la garder ; une faute de main
  reprend « FAUTE » (`red`) au-dessus du défenseur. Mêmes règles que les messages du 7b (montée,
  effacement en 1,5 s, pile). Pose provisoire du geste de vol : l'image 14 (bras tendu) pendant
  0,25 s, dans la diagonale de la direction du ballon ; une vraie pose viendra en phase 3. Le déséquilibre
  après un vol raté (0,3 s) n'a pas encore de pose : il se voit au ralentissement.
- **Terrain entier (incrément 10)** :
  - **tableau de score vivant** : période (QT1 à QT4, puis P1, P2… en prolongation), chrono
    (« 2:47 », puis « 45.3 » sous la minute) et shot clock (« TIR 14 ») ;
    - le shot clock passe en `red` sous 5 s et disparaît quand il ne compte plus (pendant
      l'entre-deux, ou si le chrono restant est plus court) ;
  - **bandeaux de période** au centre du HUD, en `silver` : « FIN DU 1ER QT », « MI-TEMPS »
    (avec « CHANGEMENT DE PANIER »), « PROLONGATION » (avec « ÉGALITÉ 61-61 ») ;
  - **fin de match** : « GAGNÉ 66-63 » (`yellow`) ou « PERDU » (`red`), sous-titre « NOUVEAU
    MATCH » ;
  - **violations** en `orange`, au-dessus du fautif : « SORTIE », « 8 SECONDES », « RETOUR EN
    ZONE », « 24 SECONDES », « 5 SECONDES », et « VIOLATION » pour un entre-deux touché en
    montée ;
  - « ENTRE-DEUX » (`chalk`) au-dessus du rond central au lancer, sans arbitre dessiné (il
    viendra en phase 3) ;
  - **remise** : le lanceur se tient hors des lignes, sur le tablier de l'arène ; s'il est de ton
    équipe, il a l'anneau.
- **Lancers francs (incrément 11)** :
  - « LANCER 1/2 », « 2/2 », « 1/3 »… (`chalk`) au-dessus du tireur à chaque lancer, puis la
    note PARFAIT, BON, TÔT ou TARD comme pour un tir ; la petite police gagne la barre « / » ;
  - la jauge du tir, à côté du tireur, sans saut ;
  - pose provisoire : l'image 13 (ballon levé) pendant la visée, l'image 14 (lâcher) ~0,4 s
    après, au sol ; de vraies poses viendront en phase 3.
- **Rotation et box score (incrément 12)** :
  - **carte du joueur contrôlé** : la barre d'énergie suit son énergie, la ligne du bas donne ses
    stats du match, « 12 PTS 4 REB 3 PD » (demi-terrain : taille et saut, comme avant) ;
  - **messages** : « BONUS » (`orange`) au-dessus du fautif quand une faute de main envoie
    l'adversaire aux lancers ; « 6 FAUTES » (`red`) au-dessus de l'éliminé ; « CHANGEMENT »
    (`chalk`) au-dessus de chaque joueur qui entre. Mêmes règles que les autres messages
    (montée, effacement en 1,5 s, pile) ;
  - **remplaçants** : le corps garde sa place, seuls le sprite et l'étiquette changent. Une
    feuille de 76 images coûte ~21 ms dans le navigateur (composition bornée à la boîte de
    chaque calque, 15 bis ; 4 blocs depuis le 15 ter) : les dix titulaires sont cuits au
    chargement (~0,2 s), le banc en
    tâche de fond (~4 ms par image). Un remplaçant pas encore
    prêt serait fini d'un trait à son entrée (le debug H compte ces cas et affiche la plus
    longue image des 5 dernières secondes) ;
  - **menu pause** (React, superposé au match comme le panneau des réglages, qui reste
    accessible) : score par période et fautes d'équipe (avec « bonus »), puis un tableau par
    équipe (MIN, PTS, REB, OFF/DÉF, PD, INT, CTR, BP, F, TIRS, 3 PTS, LF, +/-, énergie), titulaires
    en tête et en gras, ● pour les joueurs sur le terrain, éliminés grisés, bouton « Reprendre ».
- **Match du GM (incrément 13)** :
  - **arène** du club qui reçoit (couleurs, nom, rond central, poteaux) ;
  - **tenue extérieure** (`awayLook`) : les couleurs de l'équipe, sinon sa couleur secondaire en
    maillot, sinon un maillot `chalk` à ses couleurs (ou `ink`), dès que les deux maillots sont à
    moins de 140 d'écart ;
  - **Regarder** : ni anneau, ni étiquette soulignée, ni carte du joueur ; la caméra suit le
    porteur (sinon le ballon) ; boutons ×1 ×2 ×4 et « Simuler la fin » en bas au centre ;
  - **bandeaux** : « SIMULATION DE LA FIN » (sous-titre : période et chrono simulés) pendant la
    fin simulée, sans messages ni jauge ; en fin de match, « GAGNÉ / PERDU 92-86 » avec « FIN DU
    MATCH » (« IND 92-86 » quand tu regardes) ;
  - menu pause : bouton « Simuler la fin » à côté de « Reprendre ».

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
