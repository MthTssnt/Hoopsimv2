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
  plein.
- **Contact des corps** : recouvrement en mètres, plus la vitesse du défenseur vers le tireur.

### Tir et layup côté `match/` (incrément 5, réglages dans `world/shooting.ts`, `SHOT_FLOW`)
- **Départ** : appui sur Tir avec le ballon, au sol. Le joueur saute, se tourne vers le panier
  visé (le plus proche en phase 1) et la jauge démarre au décollage.
- **Lâcher** : au relâchement de Tir. Si Tir est encore enfoncé quand le joueur touche le sol,
  le tir part tout seul à ce moment-là, donc très en retard.
- **Zone**, mesurée au décollage : près du cercle à ≤ 2,5 m du cercle ; 3 pts selon la ligne
  du niveau (pro ou college) ; mi-distance sinon.
- **Layup** : seulement si le joueur attaque le cercle (à ≤ 3 m, à ≥ 2,5 m/s, à moins de 60°
  de la direction du cercle). C'est un tir `layup` en zone « près du cercle », sans pénalité
  de mouvement. Le joueur file vers un point à ~0,7 m devant le cercle (jamais sous la
  planche). À l'arrêt près du cercle, c'est un petit tir en suspension.
- **En mouvement** : `moveSpeed` est la vitesse au sol au décollage.
- **Contestation** : `null` en attendant l'adversaire (7a).
- **Trajectoire** : le ballon part de la main, au-dessus de la tête, ramenée devant le cercle
  si le tireur est dessous ou derrière la planche. Si aucune trajectoire n'existe (cas
  extrême), le ballon tombe de la main : raté.
- **Points** : 2 ou 3 quand le ballon passe vraiment dans le cercle. Les tirs de démo (R/M)
  ne comptent pas.

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
2. **Faute.** Un contact pendant le contre peut être sifflé. En phase 1, sans lancers francs :
   un panier marqué compte, sinon la balle revient au joueur fautif en haut de la raquette.
   Un contre jugé fautif ne compte pas comme contre.
3. **Goaltending.** Le ballon touché en redescente au-dessus du cercle : le panier compte,
   quel que soit le résultat tiré.
4. **Résultat tiré au lâcher.** S'il n'y a ni contre ni goaltending, la physique produit une
   trajectoire qui aboutit exactement à ce résultat. Pour un raté, le rebond retombe de
   préférence près du cercle.

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
