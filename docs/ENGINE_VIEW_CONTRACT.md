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

Les valeurs réglables sont dans `SHOT_TUNING`, `DUNK_TUNING`, `BLOCK_TUNING`, `FOUL_TUNING` et
`ATHLETICS_TUNING`. La base par zone (`SHOT_MODEL`) est partagée avec la simulation.

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
  sur elle, et reste plantée une fois le tireur en l'air.

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

## Ce que `match/` ne décide pas
- Il ne modifie jamais un résultat tiré pour « suivre » la physique. Si une trajectoire candidate
  ne donne pas le résultat voulu, le solveur en essaie une autre.
- La possession, le score et les règles du 1 contre 1 de test restent dans `match/world/` en
  phase 1. Le box score officiel (match joué = match simulé, mêmes fonctions de `simSeason`)
  arrive en phase 2 avec le 5 contre 5.

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
