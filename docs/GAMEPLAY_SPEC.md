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
- Vue retenue (validée dans `?style`, appliquée au match en S4) : 480×270 à 22,5 px/m, soit
  ~21 m de long visibles et toute la profondeur du terrain ; mise à l'échelle entière (pixels
  nets), F pour le plein écran. Les joueurs ont la taille de leur gabarit (meneur ~30 px,
  ailier ~32 px, pivot ~35 px) ; la physique garde les vraies tailles.
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
| Passe | Passe (E par défaut) | appuyer en étant orienté vers le coéquipier visé. HoopSim : le coéquipier le plus aligné avec la direction tenue (cône de ~60°), passe tendue en avance sur sa course ; tu prends le receveur dès le lâcher |
| Dribble / crossover | ? | ? (dribbles avancés : voir « Phases suivantes ») |
| Dunk / layup | Tir | dunk : attaquer le cercle et appuyer sur Tir ; pas automatique, peut rater. Layup (décision de Matheo) : seulement en attaquant le cercle (en course vers lui, à moins de ~3 m), avec la jauge ; à l'arrêt près du cercle, c'est un petit tir en suspension |
| Défense : vol | Interception (A par défaut) | difficile. Trop près, on pousse le joueur : faute. Le bras doit être à la bonne distance du ballon. Le plus efficace : se placer dans la ligne de passe. On peut aussi sauter pour dévier une passe, puis ramasser le ballon. HoopSim : voir « Interception (incrément 9) » plus bas |
| Défense : contre / saut | Tir (devient Saut/Contre) | sauter au bon moment face au tireur. J'ai fait plus de contres que d'interceptions |
| Changer de joueur contrôlé | Passe (E), en défense | décision de Matheo : en attaque, le contrôle suit le ballon (receveur d'une passe, joueur qui ramasse) ; en défense, tu prends le défenseur le plus proche du ballon, et E te fait changer pour lui à tout moment (le suivant si c'est déjà toi) |

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
  - la contestation (depuis le 7a) : distance du défenseur et position face au tireur ou sur
    le côté ; un défenseur collé peut aussi empêcher un dunk ;
  - *(à mesurer)* : le tir en mouvement contre le tir arrêté.
- Même avec un bon timing, ça peut ressortir : la physique du cercle a le dernier mot
  (des tirs annoncés « bons » ont raté).
- Retour visuel : zone verte sur la jauge ; le jeu annonce certains tirs « bons »
  (forme de l'annonce : ?).
- Dunk (incrément 6, décisions de Matheo) : seuil du moteur gardé (seuls, ~80 % des joueurs
  peuvent dunker en mouvement ; le défenseur fera baisser ce chiffre) ; décollage immédiat sur
  un simple appui ; accroché ~0,3 s au cercle après un dunk réussi ; annonce « DUNK » et
  petite secousse de caméra ; rien sur un dunk raté.
- Choix de HoopSim (incrément 5, décisions de Matheo) : jauge verticale à côté du joueur, zone
  verte centrée sur le sommet du saut ; annonce PARFAIT / BON / TÔT / TARD au-dessus de la
  tête. Tir encore enfoncé à l'atterrissage : le tir part tout seul, très en retard.
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
- Saut en course (décision de Matheo) : le joueur garde environ 1/4 de sa vitesse au
  décollage, et un saut porte au plus ~2 m, quelle que soit la vitesse de tir. Sur place,
  il reste sur place ; aucun contrôle en l'air. Les layups et dunks auront leur propre élan.
- Appuis (provisoire) : freinage net (arrêt en ~0,1 s), virages et demi-tours qui effacent
  vite l'ancienne vitesse, pour que le joueur ne glisse pas.
- *(à mesurer)* :
  - vitesse de course (temps pour traverser le terrain) ;
  - hauteur et durée d'un saut ;
  - différence entre un rebond sur la planche et sur le cercle ;
  - rebond du ballon au sol.

## 5. IA
- **1 contre 1 de test (incrément 7a, décisions de Matheo)** :
  - un seul panier (celui de droite) ; après un panier ou un rebond défensif, le nouveau
    porteur doit ressortir le ballon derrière la ligne à 3 pts ; un panier marqué sans
    ressortir ne compte pas et le ballon passe à l'autre ;
  - l'adversaire est le meilleur joueur de l'équipe adverse au même poste que ton joueur, et
    il change avec lui (1-3) ;
  - premier à 11 (paniers à 2 et 3 pts) : on annonce le gagnant, puis reprise à 0-0 ;
  - au départ, tu as le ballon en haut de la raquette et l'IA défend.
- **Comportement de l'IA en 7a** (choix de HoopSim, réglages dans `AI_TUNING`) :
  - en attaque, elle ressort d'abord si elle le doit, puis choisit un plan selon ses tendances
    (cercle, mi-distance, 3 pts) ; elle dribble vers sa place, en change si elle reste bloquée
    ~0,6 s, et tire une fois sur place ou au bout de ~3 s ; plan cercle : dunk dès que c'est
    possible, sinon layup en attaquant le cercle ;
  - elle lâche au sommet plus une erreur qui diminue avec sa stat de tir ;
  - en défense, elle se place entre toi et le cercle à ~1,1 m, avec un temps de réaction de
    0,12 à 0,3 s selon sa défense, et saute pour contester quand tu tires près d'elle ;
  - au rebond, elle court vers le ballon.
- **Contre, fautes, goaltending (incrément 7b, décisions de Matheo)** :
  - contre : un défenseur en l'air touche le ballon pendant sa montée ; le moteur tranche
    (contre, détente, taille, qualité du contact). Réussi, il annule le panier et le ballon est
    frappé. Un dunk n'est pas contrable en 7b ;
  - faute : tout contact des corps pendant le tir (de l'appui à l'atterrissage du tireur),
    défenseur au sol ou en l'air ; tir marqué → le panier compte et le ballon passe à l'autre ;
    tir raté → le ballon revient au tireur en haut de la raquette, rien à ressortir ;
  - goaltending : ballon touché en redescente au-dessus du cercle, avant le cercle ou la
    planche → le panier compte ;
  - pose « contre » (deux bras levés) pour tout saut sans le ballon ;
  - l'IA (choix de HoopSim) : son saut de contestation peut contrer ; elle anticipe un peu la
    course de l'attaquant, ne lui rentre pas dedans et reste plantée quand il est en l'air.
  - Mesuré en IA contre IA : ~5-11 % des tirs contrés, ~6-11 % sifflés (environ 2 fautes par
    partie à 11). Un réglage de la fréquence des fautes (comme « moyen » / « élevé » dans Hoop
    Land) pourra venir avec les règles activables.
- Comportement des coéquipiers en attaque (écrans, coupes, spacing) : ?
- Rebond offensif : l'IA n'y va pas beaucoup.
- Défense adverse (individuelle, aide, pression) : ? Observé :
  - sur les remises en jeu depuis la ligne de fond, le défenseur ne suit pas : souvent un
    lay-up facile ;
  - la règle des 8 secondes est facile à provoquer en bloquant le meneur adverse dans son camp.
- Lancers francs : l'IA est mauvaise.
- Niveau de difficulté : réglable, avec des sliders.

## Phase 2 — décisions de Matheo
- **Contrôle** : le porteur en attaque ; le défenseur le plus proche du ballon en défense, et la
  touche Passe change de défenseur.
- **Durée d'un match joué** : 4 × 3 min de chrono réel par défaut (réglable), shot clock de
  24 s. Le box score est brut : un match joué compte moins de points qu'un match simulé, mais il
  est enregistré par les mêmes fonctions.
- **Rotation** : la fatigue baisse en jouant ; le coach automatique fait entrer les remplaçants
  aux arrêts de jeu (même logique que la simulation).
- **Lancers francs** : la jauge du tir, sans saut ; la stat de lancer franc élargit la zone verte
  en Real Player %.
- **Ordre** : 3 contre 3 sur un panier d'abord (incrément 8), puis le 5 contre 5 sur terrain
  entier.
- **Règles** en plus du chrono, du shot clock, des 8 s, des remises en jeu, du hors-jeu, des
  fautes, des lancers et du goaltending : retour en zone, entre-deux au début, élimination à
  6 fautes.
- **Live Sim** : « Regarder » un match CPU contre CPU, à la fin de la phase.
- **Touches par défaut** : ZQSD, Espace tir/saut, E passe (en défense : changer de joueur),
  A interception ; toutes remappables.
- **Demi-terrain en équipes (incrément 8)** : les règles du 1 contre 1 s'appliquent par équipe
  (ressortie de l'équipe, une passe reçue derrière l'arc compte ; panier non valable → ballon à
  l'adversaire le plus proche) ; 1 contre 1 à 11, 2 contre 2 et 3 contre 3 à 21.
- **Interception (incrément 9)** :
  - **vol réussi** : le ballon est arraché et devient libre, poussé vers le défenseur ; il le
    récupère le plus souvent, mais le porteur peut encore le reprendre ;
  - **faute de main** (trop près, ou main à travers le corps) : 1 s de ballon mort, puis
    l'équipe qui l'a subie reprend en haut de la raquette, comme après une faute sur un tir raté
    (fautes d'équipe et bonus à l'incrément 11) ;
  - **ligne de passe** : se placer dans la ligne donne déjà une chance d'interception ; appuyer
    sur A quand le ballon arrive allonge le bras et l'augmente ; sauter (Espace) peut dévier une
    passe ;
  - **vol raté** (manqué, ou A trop loin) : le défenseur est déséquilibré ~0,3 s (il avance au
    ralenti), ce qui laisse passer l'attaquant.
- **5 contre 5 sur terrain entier (incrément 10)** :
  - **remises de ton équipe** : c'est toi qui passes, avec E ; le contrôle va au joueur hors du
    terrain, et l'IA défend la remise ;
  - **chrono** : il s'arrête à chaque ballon mort (sortie, faute, violation) et repart quand la
    remise est touchée sur le terrain ; il continue après un panier, sauf dans la dernière minute
    du QT4 et des prolongations ;
  - **entre-deux** : tu joues ton pivot et sautes avec Espace ; la première main sur le ballon
    après son sommet le tape vers un coéquipier (taille, détente, timing) ;
  - **toutes les règles d'un coup** : 8 s, retour en zone, 5 s sur remise, 24 s, sorties ;
  - **choix par défaut** (règles NBA ramenées à nos quart-temps, à corriger si besoin) :
    - shot clock : 14 s après un rebond offensif qui a touché le cercle ;
    - prolongation : 5/12 d'un quart-temps ;
    - remise de la ligne de fond au début des QT2-QT4 (le perdant de l'entre-deux aux QT2 et QT3) ;
    - changement de panier à la mi-temps ;
    - fautes hors tir : remise de côté ;
    - fin de match : bandeau, puis nouveau match ;
    - durée d'un quart-temps réglable dans les paramètres (1 à 12 min, 3 par défaut).
- **Retours sur le 5 contre 5 (incrément 11)** :
  - **lancers francs** : faute sur un tir raté → 2 lancers, 3 si le tir était derrière l'arc ;
    tir marqué avec faute → le panier compte, plus 1 lancer ; faute hors tir → remise en jeu.
    En 5 contre 5 seulement. Fautes d'équipe, bonus et 6 fautes : plus tard (avec le box score) ;
  - **jauge** : elle s'affiche à côté du tireur dès l'appui, même juste après un rebond ; un appui
    sur Tir en retombant, ballon en main, part à l'atterrissage s'il est tenu ;
  - **sauts sans ballon** : à la vitesse réelle (plus de « slow motion ») ; le saut de tir garde la
    jauge ;
  - **défense automatique** : en défense, tant que tu ne touches à rien, ton joueur suit son
    joueur comme l'IA (déplacement seulement : sauter et A restent à toi). Dès qu'une touche est
    appuyée, tu reprends la main.
- **Fatigue, rotation et box score (incrément 12)** :
  - **fatigue et rotation à l'échelle du match** : les coefficients de la simulation, accélérés
    selon la durée (×4 pour 4 × 3 min) ; un match joué fatigue et fait tourner le banc comme un
    match complet ;
  - **bonus comme la simulation** : lancers sur faute hors tir dès la 6e faute d'équipe de la
    période, 2 lancers ; élimination à 6 fautes personnelles ;
  - **changements** : le coach automatique pour les deux équipes, aux arrêts de jeu ; les
    changements à la main viendront avec les modes de jeu ;
  - **menu pause** : Échap ou P (ou le bouton « Pause ») ; le match s'arrête et affiche le score
    par période, les fautes d'équipe et le box score des deux équipes.

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

Apparu à la fin de la phase 1 (à trancher avant ou pendant la phase 2) :
- **Fréquence des fautes** : faut-il un réglage (comme « moyen » / « élevé » dans Hoop Land) ?
  Aujourd'hui ~6-11 % des tirs sont sifflés en 1 contre 1.
- **Faute offensive** (passage en force) : à ajouter, et selon quoi (défenseur arrêté, placé
  avant le contact) ?
- **Contrer un dunk** : à quel moment, et avec quelle chance ?
- **Hors-jeu** : le ballon peut partir dans le public et rester jouable ; quelle règle en
  1 contre 1 et en match ?
