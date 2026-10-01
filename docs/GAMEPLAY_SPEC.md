# Spec de gameplay — ce que HoopSim doit reproduire

> Rédigée par Matheo en jouant à Hoop Land. Fait foi pour Claude Code.
> Décrire ce qu'on OBSERVE (sensations, timings, règles), pas les visuels à copier.
> Les « ? » sont à compléter. Ajouter des chiffres dès que possible (secondes, fréquences).
> *(à mesurer)* : observé, à chiffrer lors d'une prochaine session avec un chrono.

## 1. Vue et rythme
- Vue : 2D, de côté, look rétro pixel-art façon jeux de basket des années 80-90.
- Vue observée sur la capture de référence de Matheo :
  - vue plongeante de 3/4 : la profondeur et la hauteur sont écrasées d'environ 2/3 par
    rapport à la longueur ;
  - toute la profondeur du terrain tient à l'écran, avec ~22 à 26 m de long visibles ;
  - joueurs à grosse tête, à leur taille réelle ;
  - nom sous les joueurs, marqueur au sol sous le joueur contrôlé.
- Caméra (suit le ballon ?, zoom ?) : ?
- Nombre de joueurs à l'écran / taille relative : ?
- Durée : réglable. On règle la durée totale du match, en 2 mi-temps ou 4 quart-temps
  (la durée totale se répartit entre les périodes). En universitaire, les matchs vus
  durent 10 minutes au total.
- Shot clock : durée réglable.
- Règle des 8 secondes : existe.
- Retour en zone, marcher : ?
- Règles activables : fautes, lancers francs, goaltending.
- Réglage des fautes sur tir : en « élevé », lancers francs presque une attaque sur deux ;
  en « moyen », seulement 1 ou 2 séries par match.
- Style de jeu réglable : simulation, arcade ou un mélange.
- HUD *(à noter précisément)* : a priori score, période, chrono, shot clock, joueur contrôlé,
  jauge de tir pendant le tir. À vérifier : position à l'écran, police, couleurs.

## 2. Contrôles
- Schéma simple : déplacement + Passe + Tir/Saut + Interception. Les boutons changent de rôle
  entre l'attaque et la défense (Tir devient Saut/Contre).
- Toutes les touches sont remappables. Jouable au clavier, plus naturel à la manette ;
  clavier + souris marche mal.
- Touches physiques par défaut (clavier, manette) : ?

| Action | Touche / bouton | Comportement observé |
| --- | --- | --- |
| Déplacement | ? | vitesse liée au gabarit : les petits sont plus rapides (voir §4) |
| Sprint | ? | ? |
| Tir | Tir | maintenir : le joueur saute ; relâcher vers le sommet du saut (voir §3) |
| Passe | Passe | appuyer en étant orienté vers le coéquipier visé |
| Dribble / crossover | ? | ? (dribbles avancés : voir « Phases suivantes ») |
| Dunk / layup | Tir | dunk : attaquer le cercle et appuyer sur Tir ; pas automatique, peut rater. Layup : ? |
| Défense : vol | Interception | difficile. Trop près, on pousse le joueur : faute. Le bras doit être à la bonne distance du ballon. Le plus efficace : se placer dans la ligne de passe. On peut aussi sauter pour dévier une passe, puis ramasser le ballon |
| Défense : contre / saut | Tir (devient Saut/Contre) | sauter au bon moment face au tireur. J'ai fait plus de contres que d'interceptions |
| Changer de joueur contrôlé | ? | ? |

## 3. Tir
- Deux styles de tir (option) :
  - **Timing** : la réussite dépend surtout du moment où on relâche le bouton ;
  - **Real Player %** : la réussite dépend surtout des stats du joueur.
- Réglage de vitesse de tir : vitesse du geste et de la jauge.
- Fonctionnement de la jauge (mode Timing) : on maintient Tir, le joueur saute, on relâche vers
  le sommet du saut. La jauge sert de repère, avec une zone verte à viser.
  - *(à mesurer)* : forme exacte de la jauge, durée entre l'appui et le sommet du saut,
    taille de la fenêtre verte.
- Ce qui influence la réussite :
  - les stats du joueur (3PT, tir intérieur, dunk…) ;
  - la taille : un grand contre mieux, finit mieux ses dunks et gagne plus souvent les duels
    au cercle ;
  - la fatigue : un joueur cramé perd en efficacité ;
  - *(à mesurer)* : la distance du défenseur, le tir en mouvement contre le tir arrêté.
- Même avec un bon timing, ça peut ressortir : la physique du cercle a le dernier mot
  (des tirs annoncés « bons » ont raté).
- Retour visuel : zone verte sur la jauge ; le jeu annonce certains tirs « bons »
  (forme de l'annonce : ?).
- Taux de réussite ressenti :
  - mi-distance : ?
  - 3 pts : en mode Timing, une fois le rythme trouvé, plus faciles que les tirs à 2 ; un
    shooteur peut enchaîner presque tous ses tirs à 3. Presque trop facile en difficulté basse ;
    Real Player % est plus exigeant. → À ne PAS reproduire (voir « Décisions d'architecture »).
  - dunk : pas automatique, j'en ai vu rater.

## 4. Joueurs, sauts et ballon
- La taille et le poids définissent la vitesse, la force et l'endurance :
  - les petits sont plus rapides ;
  - les lourds poussent les défenseurs ;
  - un petit pivot se fait bouger par tout le monde.
- Jauge d'endurance / fatigue : les joueurs qui jouent beaucoup baissent en efficacité.
- Rebonds : la balle retombe presque toujours juste autour du cercle, rarement loin.
- *(à mesurer)* :
  - vitesse de course (temps pour traverser le terrain) ;
  - hauteur et durée d'un saut ;
  - différence entre un rebond sur la planche et sur le cercle ;
  - rebond du ballon au sol.

## 5. IA
- Comportement des coéquipiers en attaque (écrans, coupes, spacing) : ?
- Rebond offensif : l'IA n'y va pas beaucoup.
- Défense adverse (individuelle, aide, pression) : ? Observé :
  - sur les remises en jeu depuis la ligne de fond, le défenseur ne suit pas : souvent un
    lay-up facile ;
  - la règle des 8 secondes est facile à provoquer en bloquant le meneur adverse dans son camp.
- Lancers francs : l'IA est mauvaise.
- Niveau de difficulté : réglable, avec des sliders.

## 6. Modes et écrans
- Match : Play (je joue), Live Sim (je regarde CPU contre CPU), Quick Sim (résultat en quelques
  secondes).
- Mode coach : dans les réglages Game Plan, depuis l'écran des cinq de départ, on peut se mettre
  « coach » et ne plus contrôler de joueur.
- Carrière : je crée un joueur, je passe par l'université puis la ligue pro. Recrutement college,
  draft, entraînement, objectifs : ?
- GM / Franchise : draft, transferts, rotations. Agents libres, budget : ?
- Commissioner : édition de ligue, règles modifiables : ?
- Customize : modifier ou importer des ligues entières, depuis un fichier ou un lien.
- Après le match : une note de F à A+, de l'XP, des pièces et les relations avec les coéquipiers
  et le coach.
- Flux des menus (écran par écran) : ?

## 7. Progression des joueurs
- Liste des attributs : ? (cités en jeu : 3PT, tir intérieur, dunk ; gabarit taille/poids, voir §4)
- Comment ils évoluent (âge, entraînement, temps de jeu) : ?

## 8. Ce qui rend le jeu fun (à ne pas perdre)
- Le contrôle est réactif. Tout repose sur le timing (tirs, contres) et le placement.
- Les tirs ne sont jamais complètement garantis, ce qui crée des moments imprévisibles.
- Rendu 2D, mais le ballon et le cercle se comportent comme en 3D : vraie hauteur, trajectoire
  et rebonds crédibles.

## Décisions d'architecture
- **Simulation 3D, rendu 2D.** Le monde est simulé en 3D : x = longueur du terrain,
  y = profondeur, z = hauteur. L'affichage est en 2D, avec une ombre au sol pour lire la hauteur.
- **Tir : l'engine tire le résultat, la physique le met en scène.** `engine/` tire le résultat
  à partir des stats, du timing, de la défense et de la fatigue. La physique produit ensuite une
  trajectoire qui aboutit à ce résultat. Contrairement à Hoop Land (§3), la physique du cercle
  ne décide pas du résultat.
  - Mode Timing : le timing pèse fort.
  - Mode Real Player % : ce sont surtout les stats.
- **Les 3 points ne doivent PAS être trop faciles** comme dans Hoop Land. L'équilibrage est calé
  sur nos stats de calibration (`npm run calibrate` ; valeurs actuelles du README : 35,6 % à 3 pts,
  sur 36 % des tirs).

## Périmètre de la phase 1
Seulement :
- déplacement ;
- tir avec jauge ;
- saut / contre ;
- physique du ballon, du cercle et de la planche ;
- dunk simple.

Hors phase 1 : passes, interception, IA, règles, HUD, modes (voir `docs/ROADMAP.md`) et les
gestes de « Phases suivantes ».

## Phases suivantes
Gestes observés dans Hoop Land, à reprendre après la phase 1 :
- **Dribbles avancés** : step back, double step back, euro step, step through. Touches : ?
- **Floater** près du cercle. Déclenchement : ?
- **Spin move** : collé par un défenseur, un cercle rouge apparaît ; appuyer sur Saut en
  avançant à ce moment-là déclenche un spin.
- **Alley-oop** : quand un coéquipier a une petite icône au-dessus de la tête, maintenir Passe
  tourné vers lui lance un lob. Sans le ballon, près du cercle, maintenir Passe permet de
  réclamer l'alley-oop.
- **Self-lob** : floater déclenché tard près du cercle, puis dunk derrière.
- **Dunk 360** : tourner le stick en spirale en maintenant Tir.

## Questions ouvertes (Claude Code ajoute ici ce qui lui manque)
Pour coder la phase 1 :
- **Caméra** : suit le ballon ou le joueur ? zoom ? terrain entier ou demi-terrain visible ?
  camera suit le joueur mais le ballon doit toujours etre visible, le zoom peut donc s'adapter en consequence, meme si on sera plus proche d'un zoom demi terrain.
- **Échelle** : terrain aux dimensions réelles (ligne à 3 pts pro ou college ?) ou proportions
  arcade ? Taille d'un joueur à l'écran, en pixels sur 180 de haut ?
  ligne a 3 pts college en college et pro en pro; terrain aux dimensions reelles, adapter la taille des joueurs en fonction.
- **Scène de test** : un joueur seul sur un demi-terrain ? Pour le contre, il faut un tireur :
  un adversaire IA qui tire, un 1 contre 1, ou on alterne attaque et défense ? Après un panier
  ou un rebond, comment le ballon revient-il au joueur ?
  un joueur seul oui. pour le contre on alterne attaque defense. le joueur doit aller chercher le ballon.
  *Précisé dans le chat :* vrai 1 contre 1. L'IA défend aussi quand j'attaque, et la balle
  revient à celui qui la récupère.
- **Touches par défaut** : quelles touches clavier pour le déplacement et Tir/Saut ? Manette
  (Gamepad API) dès la phase 1 ?
  laisser les touches modifiables dans les parametres et partir sur des touches classiques pour l'instant zqsd 
- **Mode de tir** : Timing seul en phase 1, ou aussi Real Player % ? Réglage de vitesse de tir
  dès la phase 1 ?
  le real player % doit jouer sur la barre de timing, ensuite on implementera d'autres conditions, si le tir est conteste etc, oui on regle la vitess de tir des la phase 1
- **Poids du timing** : en mode Timing, quelle réussite viser pour un tireur moyen à 3 pts quand
  il relâche dans le vert, et hors du vert ? En Real Player %, le timing compte-t-il encore un
  peu ? (référence : 35,6 % à 3 pts en simulation)
  la reference est ok pour l'instant on pourra regler cela plus tard.
  En real player%, le timing compte toujours, les stats viendront influenceer sur la barre de timing notamment
  *Précisé à la validation du plan :* le vert parfait donne un vrai bonus au-dessus de la base,
  ~45 % à 3 pts pour un tireur moyen sans défenseur. La cible de calibration est la moyenne
  d'un humain réel (~35 %), pas le cas parfait. Ces valeurs sont des constantes réglables.
- **Défense dans la proba** : en phase 1, comment mesurer la défense (distance du défenseur le
  plus proche, à partir de quand un tir est « contesté ») ? Le tir en mouvement est-il pénalisé ?
  en phase 1, on va mesurer cela avec la distance et le fait d'etre bien en face
  le tir en mouvement sera pour l'instant penalise oui, a l'avenir on lui fera peut etre des stats precices comme une autre categorie de shoot
- **Valeurs à mesurer** (jauge, saut, course, rebonds) : j'attends tes mesures, ou je pose des
  valeurs provisoires réglables dans un fichier de constantes, à remplacer ensuite ?
  pose des valeurs provisoires
- **Hauteur de saut** : de quoi dépend-elle ? Le moteur n'a pas d'attribut de détente. On part
  de la taille (`heightCm`), d'un attribut existant, ou on en ajoute un (impact moteur et
  calibration) ?
  elle va dependre de la taille du joeurs, de sa vitesse et de son poids.
  chaque joeur aura egalement une stat de detente qu'on pourra faire evoluer comme d'autre stats et qui aura un impact positif sur le dunk le contre etc
- **Dunk simple** : à quelle distance du cercle devient-il possible ? Faut-il arriver en
  mouvement ? Entre dunk et layup, qui décide (taille, distance, attribut) ? Le layup est-il
  dans la phase 1 ? Le moteur n'a pas d'attribut « dunk » : on utilise `inside` + la taille ?
  a la moitie de la raquette cela devient possible.
  pas forcement en mouvement, on mettra des stats de dunk en mouvemenent et sans mouvemenet et le dunk deviendra ppossible a un seuil minimale de stats et en fonction de l'adversaire qui conteste s'il y en a, et de sa taille et sa detente, ses stats, ...
  Le layup est dans la phase 1, par defaut selon le moment ou on en declenche le tir et les stats, le dunk est prioritaire sinon layup
  *Précisé dans le chat :* le layup passe par la jauge de timing, le dunk part sur un simple
  appui. Trois attributs sont ajoutés dès la phase 1 : détente, dunk arrêté, dunk en mouvement.
- **Contre** : goaltending actif en phase 1 ? Un contact au contre peut-il être une faute, ou
  on ignore les fautes en phase 1 ?
  oui goaltending actif, oui cela peut etre une faute
  *Précisé à la validation du plan :* ordre de résolution d'un tir : contre → faute →
  goaltending → résultat tiré au lâcher. Un contre réussi annule le résultat tiré.
- **Fatigue** : l'énergie baisse-t-elle pendant la partie de test (et le sprint existe-t-il ?),
  ou on garde une énergie fixe en phase 1 ?
  le sprint existe pas pour l'instant, mais les joueurs peuvent avoir des vitesses differentes selon leur physique taille poids strenght.
  Energie fixe en phase

Vu sur la capture de référence, pour plus tard :
- **« J. Lawson 7% »** : que veut dire le % affiché sous le nom du porteur adverse quand on
  défend près de lui ? Chance d'interception, proba de son tir, autre chose ? Et la zone verte
  au sol entre le défenseur et le porteur ? 
