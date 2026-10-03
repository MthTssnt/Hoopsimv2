# Contrat engine ⇄ match

> Version phase 1 (1 contre 1 de test). Ce document fixe qui décide de quoi entre `src/engine/`
> (règles, probabilités, tirages) et `src/match/` (géométrie, physique, rendu, inputs).
> Les signatures exactes vivent dans le code (`engine/athletics.ts`, `engine/shot.ts`).

## Principe
- `engine/` **décide** : toute probabilité et tout tirage aléatoire passent par des fonctions
  pures de `engine/`, à partir des attributs et d'un `Rng` seedé.
- `match/` **mesure, met en scène et affiche** : il calcule la géométrie (distances, zone de
  tir, orientation, écart de timing), produit une trajectoire physique qui aboutit au résultat
  décidé et dessine le tout. Il ne tire jamais lui-même un résultat.
- Unités partagées : mètres, secondes, attributs sur l'échelle 25-99.

## Ce que `match/` reçoit de `engine/`
- Les joueurs (`Player`) : attributs, dont détente (`vertical`), dunk arrêté (`standingDunk`)
  et dunk en mouvement (`drivingDunk`) ; taille (`heightCm`) ; poids (`weightKg`).
  L'énergie est fixe en phase 1.
- Une graine : le match crée son `Rng` et le passe à chaque fonction de tirage, ce qui rend un
  match rejouable à l'identique avec les mêmes inputs.
- Les grandeurs athlétiques dérivées des attributs : vitesse de course (m/s), hauteur de saut
  (m), hauteur de main bras levés (m).
- Les paramètres du tir : largeur de la zone verte selon le mode (Timing / Real Player %), la
  stat du tireur et la vitesse de tir choisie.

## Ce que `match/` envoie à `engine/`
| Moment | Contexte envoyé | Réponse de `engine/` |
| --- | --- | --- |
| Lâcher d'un tir ou d'un layup | tireur, type (tir / layup), zone (près du cercle / mi-distance / 3 pts, selon la ligne du niveau), écart de timing au sommet, mode de tir, vitesse de tir, défenseur (distance, face au tireur ou non), tir en mouvement ou non | probabilité + résultat tiré (réussi / raté) |
| Appui sur Tir près du cercle | tireur, distance au cercle, en mouvement ou non, défenseur (distance, taille, détente) | dunk possible ou non (sinon : layup) ; si dunk, résultat tiré |
| La main du défenseur croise le ballon pendant la montée | défenseur, tireur, qualité du contact (hauteur, timing du saut) | contre réussi ou non |
| Contact des corps pendant un contre | défenseur, tireur, distance, vitesse d'approche | faute ou non |

### Conventions des mesures envoyées par `match/`
- **Écart de timing** : lâcher moins instant du sommet du saut, en secondes. Il est négatif si
  le lâcher est trop tôt. La durée entre l'appui et le sommet vient de `gaugeTime(vitesse)`.
- **Face au tireur** (`facing`) : cosinus de l'angle entre (tireur → défenseur) et
  (tireur → cercle), ramené à 0-1. 1 = le défenseur est pile entre le tireur et le cercle ;
  0 = il est sur le côté ou derrière.
- **Zone de dunk** (`inDunkZone`) : le joueur est dans la moitié de la raquette côté panier
  (entre la ligne de fond et le milieu de la raquette).
- **Qualité du contact** d'un contre : 0 si la main effleure le ballon, 1 si elle le prend en
  plein. Mesure (7b, `world/defense.ts`, `DEFENSE_FLOW`) : le bras levé va de l'épaule
  (0,82 × taille au-dessus des pieds) à la main levée (`reach`), et peut viser le ballon dans un
  cône au-dessus de l'épaule (au moins 20° au-dessus de l'horizontale). Le ballon est touché
  s'il est à portée du bras (+ son rayon) ; qualité = marge dans la portée / 0,25 m, bornée
  à 0-1.
- **Contact des corps** : recouvrement en mètres, plus la vitesse du défenseur vers le tireur.
  Mesure (7b) : les corps sont à ≤ 0,75 m l'un de l'autre (ils ne descendent jamais sous
  0,7 m) ; recouvrement = 0,75 m − distance ; vitesse = composante de la vitesse du défenseur
  vers le tireur (0 s'il s'éloigne).

### Tir et layup côté `match/` (incrément 5, réglages dans `world/shooting.ts`, `SHOT_FLOW`)
- **Départ** : appui sur Tir avec le ballon, au sol. Le joueur saute, se tourne vers le panier
  visé (celui de droite en 1 contre 1, le plus proche pour un joueur seul) et la jauge démarre
  au décollage.
- **Lâcher** : au relâchement de Tir. Si Tir est encore enfoncé quand le joueur touche le sol,
  le tir part tout seul à ce moment-là, donc très en retard.
- **Zone**, mesurée au décollage : près du cercle à ≤ 2,5 m du cercle ; 3 pts selon la ligne
  du niveau (pro ou college) ; mi-distance sinon.
- **Layup** : seulement si le joueur attaque le cercle (à ≤ 3 m, à ≥ 2,5 m/s, à moins de 60°
  de la direction du cercle). C'est un tir `layup` en zone « près du cercle », sans pénalité
  de mouvement. Le joueur file vers un point à ~0,7 m devant le cercle (jamais sous la
  planche). À l'arrêt près du cercle, c'est un petit tir en suspension.
- **En mouvement** : `moveSpeed` est la vitesse au sol au décollage.
- **Contestation** (7a) : mesurée au lâcher sur le défenseur le plus proche (`contestFor`) :
  distance horizontale tireur-défenseur et `facing` (convention ci-dessus). Elle est envoyée à
  `resolveShot` pour toi comme pour l'IA, et notée dans le tir enregistré (`contest`).
- **Trajectoire** : le ballon part de la main, au-dessus de la tête, ramenée devant le cercle
  si le tireur est dessous ou derrière la planche. Si aucune trajectoire n'existe (cas
  extrême), le ballon tombe de la main : raté.
- **Points** : 2 ou 3 quand le ballon passe vraiment dans le cercle. Les tirs de démo (R/M)
  ne comptent pas.

### Dunk côté `match/` (incrément 6)
- **Choix à l'appui sur Tir** (avec le ballon, au sol) : dunk si `canDunk` (moitié de la
  raquette, `moveSpeed` = vitesse au décollage, `defender` = défenseur le plus proche avec sa
  distance, son `facing` et ses attributs, depuis le 7a) ; sinon layup si le joueur attaque le
  cercle ; sinon tir en suspension. Un défenseur collé et en face peut donc empêcher un dunk :
  c'est alors un layup ou un tir.
- **Résultat** : tiré par `resolveDunk` dès l'appui. Pas de jauge ; relâcher Tir ne fait rien.
- **Mise en scène** :
  - le joueur atteint au sommet un point à ~0,35 m devant le cercle, jamais sous la planche ;
  - si sa détente ne suffit pas, le saut du dunk est relevé pour que la main dépasse le cercle
    de 0,15 m ; le saut normal reprend ensuite ;
  - au sommet, le ballon est smashé avec `solveDunk` (`physics/dunk.ts`) : il traverse le
    cercle (réussi) ou frappe le fer et rebondit dehors (raté), trajectoire vérifiée par
    simulation ;
  - après un dunk réussi, le joueur reste accroché au cercle 0,3 s.
- **Dessin** : le sprite, à la taille de son gabarit, est monté pour que ses mains touchent le
  cercle (rendu seulement).
- **Points** : 2 quand le ballon passe dans le cercle.

### Fonctions de `engine/`
| Fichier | Fonctions |
| --- | --- |
| `athletics.ts` | `runSpeed`, `jumpHeight`, `reach` |
| `shot.ts` | `gaugeTime`, `greenWindow`, `timingGrade`, `shotProbability` / `resolveShot` |
| `shot.ts` | `canDunk`, `dunkProbability` / `resolveDunk` |
| `shot.ts` | `blockProbability` / `resolveBlock`, `foulProbability` / `foulOnContact` |
| `steal.ts` | `stealProbability` / `resolveSteal`, `reachFoulProbability` / `resolveReachFoul`, `interceptionChances` / `resolveInterception` |

Les valeurs réglables sont dans `SHOT_TUNING`, `DUNK_TUNING`, `BLOCK_TUNING`, `FOUL_TUNING`,
`STEAL_TUNING` et `ATHLETICS_TUNING`. La base par zone (`SHOT_MODEL`) est partagée avec la simulation.

## Ordre de résolution d'un tir
Le résultat du tir est tiré **au lâcher**. Pendant le vol, les événements suivants sont
examinés dans cet ordre :

1. **Contre.** Si `engine/` valide un contre, il **annule le résultat tiré** : pas de panier,
   ballon dévié par la physique.
2. **Faute.** Un contact des corps pendant le tir peut être sifflé. En phase 1, sans lancers
   francs : un panier marqué compte (puis la suite normale) ; sinon le ballon revient **au
   tireur** en haut de la raquette. Un contre jugé fautif ne compte pas comme contre.
3. **Goaltending.** Le ballon touché en redescente au-dessus du cercle : le panier compte,
   quel que soit le résultat tiré.
4. **Résultat tiré au lâcher.** S'il n'y a ni contre ni goaltending, la physique produit une
   trajectoire qui aboutit exactement à ce résultat. Pour un raté, le rebond retombe de
   préférence près du cercle.

## 1 contre 1 de test (incrément 7a, `world/oneOnOne.ts`, `ONE_ON_ONE`)
Règles décidées par Matheo, appliquées par `match/world/` (pas par `engine/`) :
- **Terrain** : un seul panier, celui de droite. Départ : toi juste derrière l'arc en haut de
  la raquette avec le ballon, l'IA à 1,1 m entre toi et le cercle.
- **Possession** : le ballon va à celui qui le ramasse (le plus proche à portée).
- **Ressortie** : après un panier, ou un rebond pris par le défenseur, le nouveau porteur doit
  ressortir le ballon, c'est-à-dire le tenir derrière la ligne à 3 pts (`isThreePoint`). Un
  rebond offensif ne l'oblige pas.
- **Panier non valable** : marqué sans avoir ressorti, il ne compte pas ; le ballon passe
  directement à l'autre, qui doit à son tour ressortir.
- **Score et fin** : paniers à 2 et 3 pts ; premier à 11 (`&cible=N` dans l'URL pour les
  tests). Le monde se fige 3 s, puis reprise à 0-0, ballon à toi.
- **Corps** : deux joueurs ne se chevauchent jamais (rayon 0,35 m, écartés à parts égales après
  chaque pas) : le défenseur bouche le chemin.
- **IA** (`ai/opponent.ts`) : elle ne fait que produire des entrées (direction, saut, lâcher)
  comme un joueur au clavier ; le monde et `engine/` lui appliquent les mêmes règles. Son
  erreur de lâcher suit `N(0, σ)`, σ diminuant avec la stat de tir de la zone ; son temps de
  réaction en défense dépend de `perimeterDef` (et d'`interiorDef` près du cercle). Depuis le
  7b, son saut de contestation est une vraie tentative de contre. Elle anticipe en partie la
  course de l'attaquant (35 % de son temps de réaction), ne s'avance pas vers un attaquant déjà
  sur elle, et reste plantée une fois le tireur en l'air. Depuis le 8, la même IA joue chaque
  joueur non contrôlé (`ai/playerAi.ts`) : porteur (plan, passe au démarqué quand il est serré
  ou après sa patience), sans ballon (écartement autour de l'arc, coupes), défense individuelle
  (duels appariés au plus près à chaque possession, aide loin du ballon), rebond (les deux plus
  proches de chaque équipe).

## Contre, faute et goaltending côté `match/` (incrément 7b, `world/defense.ts`)
Décisions de Matheo, appliquées par `match/world/` ; `engine/` tranche avec `resolveBlock` et
`foulOnContact` (inchangés) :
- **Contre** : seulement par un défenseur **en l'air**, pendant la **montée** du ballon d'un
  tir ou d'un layup, une seule tentative par tir (le premier contact). `engine/` reçoit le
  contreur, le tireur et la qualité du contact.
  - Réussi : le résultat tiré est annulé (aucun point, même si le ballon finit dans le
    cercle), le ballon est frappé (4-7 m/s, loin de la main, angle seedé) et reste libre ;
    celui qui le ramasse le garde, le défenseur doit ressortir (rebond défensif).
  - Raté : la trajectoire ne change pas.
  - Un **dunk** n'est pas contrable en 7b : le défenseur agit déjà à l'appui.
- **Faute** : tout contact des corps pendant le tir, de l'appui (décollage) à l'atterrissage du
  tireur, défenseur au sol ou en l'air, tir, layup ou dunk. Une seule évaluation par tir, au
  premier contact. Une tentative de contre après le coup de sifflet est ignorée.
  - Tir marqué et valable : le panier compte, puis la suite normale (ramassage, ressortie).
  - Tir raté (cercle, planche ou sol sans entrer), contré, ou non valable : ballon mort 1 s,
    personne ne joue, puis le tireur reprend le ballon en haut de la raquette (place de départ,
    derrière l'arc, rien à ressortir), l'autre en défense.
  - Pas de faute offensive en 7b : tout contact est jugé comme une faute possible du défenseur.
- **Goaltending** : la main d'un défenseur en l'air touche le ballon qui redescend, au-dessus du
  cercle (+ le rayon du ballon), à ≤ 1 m du centre du cercle à l'horizontale, avant que le
  ballon ait touché le cercle ou la planche. Le panier compte (2 ou 3 pts, ou non valable si le
  tireur n'avait pas ressorti), le ballon est frappé, puis comme après un panier.
- **Mesures en partie IA contre IA** (10 min, 9 parties de contrôle) : contres réussis 5-11 %
  des tirs (surtout des layups), fautes 6-11 %, goaltending ~0, réussite globale 43-49 %.

## Passes et demi-terrain en équipes (incrément 8, `world/passing.ts`, `world/halfCourt.ts`)
- **Passe** : côté `match/` (le moteur ne tranche que l'interception, voir l'incrément 9) :
  - cible : le coéquipier le plus aligné avec la direction tenue (sinon l'orientation), dans un
    cône de 60° ; à angle voisin, le plus proche ;
  - trajectoire tendue de poitrine à poitrine, en avance sur la course du receveur (avance
    plafonnée à 3 m), à 10-14 m/s selon la stat de passe ;
  - seuls les coéquipiers du passeur l'attrapent normalement (un adversaire ne la prend que par
    une interception) ; ratée, elle devient un ballon libre au premier rebond (ou après 1,6 s) ;
  - au sol seulement, 0,25 s entre deux passes ; la dernière passe attrapée est notée pour la
    future passe décisive.
- **Demi-terrain en équipes** : points, ressortie et vainqueur par équipe ; une obligation de
  ressortir due le reste jusqu'à ce qu'un joueur de l'équipe tienne le ballon derrière l'arc
  (une passe reçue derrière l'arc compte) ; un panier non valable donne le ballon à l'adversaire
  le plus proche. La contestation, les contres et les fautes ne considèrent que les adversaires.
- **Contrôle** (décision de Matheo) : il suit le ballon dans ton équipe (au lâcher d'une passe,
  au ramassage) ; quand l'adversaire prend le ballon, tu prends ton défenseur le plus proche du
  ballon ; en défense, Passe te fait changer pour lui.

## Vol, faute de main et interception (incrément 9, `world/steal.ts`, `engine/steal.ts`)
`match/` mesure, `engine/` tranche (`STEAL_TUNING`). Ces fonctions n'entrent pas dans
`simGame` : la simulation garde son propre modèle de pertes de balle, et `calibrate` est
identique.
- **Geste de vol** (A, `STEAL_FLOW`) : un défenseur au sol, sans le ballon ; 0,6 s entre deux
  gestes ; le bras reste allongé 0,25 s (pour la ligne de passe). Sur le porteur adverse,
  `match/` mesure à l'appui :
  - la main : distance horizontale du défenseur au ballon tenu ; qualité 1 jusqu'à 0,8 m, 0 à
    1,05 m ; au-delà, ou ballon levé au-dessus de 1,6 m, le geste est dans le vide ;
  - l'exposition du ballon : 1 s'il est tourné vers le défenseur, 0 s'il est caché derrière le
    porteur (cosinus de l'angle porteur → ballon, porteur → défenseur, ramené à 0-1) ;
  - le rapprochement : mètres sous 0,85 m entre les corps.
- **Ordre** : faute de main d'abord (`resolveReachFoul` : rapprochement, main à travers le corps
  = 1 − exposition, QI du voleur, force des deux), puis vol (`resolveSteal` : stat
  d'interception du voleur contre le dribble du porteur, qualité de la main, exposition).
  - Faute : ballon mort 1 s, puis le porteur reprend en haut de la raquette (remise du 7b).
  - Vol : le ballon part du porteur vers le défenseur (2,5-4 m/s, ±30°, seedé), libre.
  - Raté ou dans le vide : déséquilibre de 0,3 s (entrées de déplacement ×0,3, pas de saut).
- **Ligne de passe** : pendant le vol d'une passe, chaque adversaire du passeur est évalué une
  seule fois, au premier contact :
  - au sol : le ballon passe à moins de 0,55 m de son corps (0,85 m bras allongé avec A), entre
    0,35 m au-dessus de ses pieds et sa main levée ; la qualité du contact se mesure au point de
    passage le plus proche (1 en plein sur lui, 0 au bord) ;
  - en l'air : la même mesure depuis ses pieds, ou le bras levé du contre (`armContact`) ;
  - `resolveInterception` reçoit la qualité, la vitesse de la passe, A appuyé, en l'air ou non,
    et renvoie : attrapée (le défenseur a le ballon, son équipe doit ressortir), déviée (le
    ballon repart à 2-4 m/s dans une direction seedée, libre) ou ratée (la passe continue).
- **Pertes de balle** (`world.turnovers`) : type (vol, interception, déviation), voleur, joueur
  qui perd, instant. Un ballon arraché ou dévié n'est une perte que si la défense le ramasse.
  Le box score de l'incrément 12 lira ces lignes.
- **IA** :
  - le défenseur du porteur, à son rythme (stat d'interception), sur un ballon exposé à un pas,
    s'avance pour l'avoir à bonne distance et tend la main dès qu'il y est ; un QI élevé ne la
    tend jamais trop près du corps ;
  - loin du ballon, les défenseurs se décalent vers la ligne de passe vers leur joueur (plus
    pour les bons intercepteurs) ;
  - le passeur évite une ligne où un adversaire passe à moins de 0,25-0,7 m de la trajectoire
    (selon son QI), jugée à partir de 0,9 m devant lui.
- **Mesures en partie IA contre IA** (3 contre 3, 10 min, 3 graines) : pertes de balle sur
  4-10 % des possessions (surtout des passes coupées), 17-25 gestes de vol, 0-2 fautes de main.

## Terrain entier (incrément 10, `world/fullCourt.ts`, `FULL_COURT`)
Règles appliquées par `match/world/` (le moteur n'est pas modifié). Le demi-terrain (formats 1 à
3) garde ses règles.
- **Équipes** : le cinq majeur de chaque équipe, comme la simulation (les cinq premiers valides
  de la rotation, rangés par poste par `pickLineup`). L'équipe 0 attaque à droite en première
  mi-temps, à gauche ensuite (prolongations comprises).
- **Phases** : entre-deux, jeu, ballon mort (pause avant une remise), remise, fin de période, fin
  de match. Pendant le ballon mort et la remise, personne ne ramasse le ballon ; pendant les fins
  de période, personne ne joue.
- **Entre-deux** (début de match et prolongations) :
  - les pivots dans le rond central, chacun du côté du panier qu'il défend, les autres autour ;
  - le ballon est lancé du centre, son sommet 0,45 m au-dessus de la plus haute main (saut
    compris) ;
  - la première main en l'air qui le touche après son sommet (mesure de `armContact`) le tape vers
    son coéquipier le plus proche ; si les deux le touchent au même pas, la main la plus haute ;
  - toucher en montée est une violation (remise pour l'autre équipe) ;
  - sans toucher, il est relancé ; le chrono part au toucher.
- **Chrono** (décision de Matheo) : il tourne pendant le jeu et s'arrête à chaque ballon mort
  (sortie, faute, violation) jusqu'à ce que la remise soit touchée sur le terrain. Après un
  panier, il continue pendant la remise, sauf dans la dernière minute du QT4 et des
  prolongations. Un tir lâché avant la sirène va jusqu'à son issue.
- **Périodes** : 4 quart-temps de 3 min par défaut (réglable), prolongation de 5/12 d'un
  quart-temps tant qu'il y a égalité. Les QT2 et QT3 commencent par une remise du perdant de
  l'entre-deux, le QT4 du gagnant, depuis la ligne de fond de sa moitié arrière.
- **Shot clock** :
  - 24 s à chaque changement de possession ;
  - 14 s après un rebond offensif qui a touché le cercle ;
  - au moins 14 s après une faute de main ;
  - après une sortie provoquée par la défense, l'attaque garde son temps ;
  - il s'arrête quand un tir touche le cercle ;
  - à 0, violation, sauf si un tir lâché avant touche ensuite le cercle ;
  - il ne compte plus quand le chrono de jeu restant est plus court.
- **Remises** :
  - le joueur de l'équipe le plus proche du point de remise s'y place, hors du terrain, avec le
    ballon ; il ne bouge pas et passe (E pour toi) ;
  - 5 s au plus ;
  - après un panier, derrière la ligne de fond sous ce panier, à côté du poteau ;
  - après une sortie ou une violation, sur la ligne la plus proche (jamais derrière le panier) ;
  - après une faute, sur la ligne de côté.
- **Dernier toucher** : noté à la prise, à la passe, au tir, à la déviation, au contre et au
  ballon arraché (pas au cercle).
- **Sorties** (la ligne est dehors) :
  - le porteur qui pose le pied sur la ligne ou dehors (au sol) ;
  - le ballon libre qui touche le sol dehors ou le bord de la salle (événement `wall` de la
    physique) ;
  - un joueur qui touche le ballon en étant dehors.
  Le ballon va à l'équipe qui ne l'a pas touché en dernier.
- **Violations** : 8 s pour passer la ligne médiane (ballon tenu ou en passe) ; retour en zone
  (le porteur qui revient dans sa moitié arrière, ou une prise dans sa moitié arrière d'un ballon
  que son équipe a touché en dernier ; une touche de la défense l'excuse, un tir aussi) ; 24 s ;
  5 s. Chacune est une perte de balle (`turnovers`, sans voleur), annoncée au-dessus du fautif.
- **Fautes, en attendant les lancers francs du 11** : faute de main ou faute sur un tir raté →
  ballon mort, puis remise de côté pour l'équipe qui l'a subie ; tir marqué avec faute → le panier
  compte, puis la remise après panier.
- **IA** :
  - duels par poste ;
  - montée de balle par le milieu : un intérieur la donne à un arrière, le porteur passe en avant
    s'il traîne ou s'il est serré, et attaque le cercle en contre-attaque ;
  - placements à 5 (pivot au poste bas côté ballon, les autres autour de l'arc) ;
  - tir au plus tard quand il reste ~6 s au shot clock ;
  - remise après 0,5-1,5 s au plus démarqué (au moins couvert après 3,5 s), le receveur venant
    de côté ;
  - retour en défense (on attend son joueur à 9 m de son cercle au plus), défenseur du porteur à
    3 m tant qu'il est dans sa moitié arrière ;
  - au tir de son équipe, les deux arrières se replient ;
  - à l'entre-deux, le pivot saute avec une erreur selon sa détente et son QI.
- **Mesures en IA contre IA** (match de 4 × 3 min, 3 graines) :
  - le match dure 13 à 14 min de temps réel, avec ~95-105 possessions ;
  - 54 à 78 points par équipe, 34-47 % de réussite ;
  - 5 à 12 pertes de balle ;
  - aucune violation des 8 s, 24 s ou 5 s, 0-1 retour en zone, 1 à 4 sorties.

## Ce que `match/` ne décide pas
- Il ne modifie jamais un résultat tiré pour « suivre » la physique. Si une trajectoire candidate
  ne donne pas le résultat voulu, le solveur en essaie une autre.
- La possession, le score et les règles du match restent dans `match/world/`. Le box score
  officiel (match joué = match simulé, mêmes fonctions de `simSeason`) arrive aux incréments 12
  et 13.

## Écarts entre le dessin et la physique (rendu seulement)
Le rendu prend quelques libertés pour la lisibilité. Elles ne changent ni les mesures envoyées
à `engine/`, ni la physique :
- **Cercle** : dessiné 1,35× plus grand que le cercle physique. La physique garde le vrai rayon :
  un ballon qui passe dans le cercle physique passe aussi dans le dessin.
- **Ballon tenu** : dessiné au point d'accroche de l'image courante du sprite (main du dribble,
  ballon levé en l'air). Au lâcher et au ramassage, le dessin rejoint la position physique en
  ~80 ms. Le ramassage, l'ombre du ballon et le départ des tirs utilisent la position physique.
- **Taille des joueurs** : la hauteur affichée suit le gabarit du sprite (meneur, ailier, pivot ;
  voir `docs/ART_DIRECTION.md`). La physique garde les vraies tailles (portée, saut, contre).
