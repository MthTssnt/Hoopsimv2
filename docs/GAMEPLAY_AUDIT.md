# Audit du naturel des matchs — HoopSimV2

Date : 13 novembre 2026. Version auditée : `d6fe43f0d539cbacd9ef3115efedb0b3587eb9b7`.

Cette revue porte sur les chemins exécutés pendant les matchs : monde, IA, déplacements, ballon, tirs, contacts, règles, rotations, entrées, animations, rendu, caméra, audio et interface de match, ainsi que leurs dépendances dans `engine/`. Les écrans de gestion et les illustrations sans effet sur le match ne font pas l'objet d'un audit fonctionnel complet.

Ce document conserve les constats avant correction. Le traitement est détaillé dans [GAMEPLAY_REMEDIATION.md](GAMEPLAY_REMEDIATION.md). À la date de cet audit, aucune correction du jeu n'avait été appliquée. Les scripts d'observation et les preuves sont conservés dans ce dossier, hors du dépôt. Les anciens commits ne sont nécessaires à aucun constat ci-dessous.

## Lecture des résultats

- **P1** : casse fréquemment la crédibilité du match, permet un exploit majeur ou altère une action réelle.
- **P2** : rupture visible, situation particulière incorrecte, ou limitation importante du basket collectif.
- **P3** : défaut de finition ou de retour d'information.
- **Reproduit** : scénario contrôlé ou navigateur. **Mesuré** : matchs instrumentés. **Code** : comportement établi par le chemin de code, sans mesure de fréquence.
- Un **choix simplifié** est explicitement distingué d'un bug : plusieurs comportements viennent des décisions de phase initiale documentées. Leur manque de naturel ne prouve pas une régression de la reconstruction.

## Vérifications et mesures

Trois matchs complets IA contre IA de 4 × 3 minutes, graines 8126, 31 et 919, mêmes chemins de création des effectifs et de RNG que la scène. Ce petit échantillon sert à reproduire les mécanismes ; il ne constitue pas une calibration de toute la ligue.

| Mesure | 8126 | 31 | 919 |
|---|---:|---:|---:|
| Score final | 106–74 | 85–87 | 83–74 |
| Rebonds pris avec le récupérateur en l'air | 1 | 0 | 0 |
| Rebonds pris avec le récupérateur au sol | 66 | 91 | 70 |
| Rebonds offensifs / tous les rebonds | 31/67 | 52/91 | 34/70 |
| Cibles d'écartement déplacées de >3 m, même porteur et même objet passe | 310 | 299 | 282 |
| Corrections de contact sur des corps à vitesse <0,1 m/s | 8 995 | 10 171 | 7 616 |
| Pas avec au moins un déplacement de joueur >1 m | 111 | 108 | 96 |
| Entrées individuelles de remplaçants, deux équipes cumulées | 147 | 141 | 135 |
| Pas où un nouveau porteur coexiste avec le dunk actif d'un autre joueur | 0 | 13 | 13 |

Les corrections de contact sont comptées par corps et par pas, pas comme autant de collisions distinctes. Les changements de cible sont également comptés par joueur ; ils peuvent arriver simultanément. Les entrées en jeu ne sont pas des arrêts de jeu distincts.

Navigateur Chromium : inspection pas à pas pendant 40 secondes simulées, puis lecture normale pendant 10 secondes, captures en 1280×720 et 1920×1080. Aucun `pageerror` pendant cette séquence. Les 2 519 mesures de ballon concernent un porteur au sol en phase de jeu : écart médian de 9,87 pixels de projection entre centre physique et centre dessiné, 95e centile de 12,24, maximum de 40,41. Ce sont des pixels du monde avant le zoom et l'agrandissement de la fenêtre.

Validation existante : **355 tests passent dans 39 fichiers** ; `npm run lint` et `npm run build` passent. Le build conserve un avertissement de taille de bundle. Les tests verts ne vérifient pas le naturel des situations ci-dessous.

## Priorité P1

### G01 — Le ballon visible et le ballon des contacts ne sont pas au même endroit

**Mesuré ; compromis de rendu documenté, effet sur la lisibilité du gameplay.** [Position physique](../src/match/world/MatchWorld.ts#L487), [accroche du rendu](../src/match/scenes/MatchScene.ts#L1027), [mesure du vol](../src/match/world/steal.ts#L51).

Le monde tient le ballon à un décalage générique du corps, avec une hauteur de dribble commune. Le rendu le replace sur les mains des images de chaque joueur. Les vols et l'exposition du ballon utilisent la première position. L'écart observé atteint 40,41 pixels pendant une réception. Une main peut donc viser le ballon dessiné sans correspondre au contact évalué, ou réussir une action visuellement éloignée du ballon. L'écart est volontaire dans le contrat de rendu, mais son ampleur nuit au placement défensif. Direction : donner une référence de contact cohérente au jeu et au dessin, avec une validation pendant dribble, réception, pivot et départ du tir.

### G02 — Les réceptions happent le ballon, puis le téléportent

**Reproduit.** [Ramassage](../src/match/world/MatchWorld.ts#L2044), [ballon tenu au pas suivant](../src/match/world/MatchWorld.ts#L618).

Le choix du receveur ne vérifie que la distance horizontale et une hauteur maximale. Ni vitesse du ballon, ni orientation, ni main disponible, ni hauteur minimale relativement aux pieds. Un joueur tourné à gauche attrape une balle arrivant de droite à 2,55 m ; au pas suivant, elle se retrouve à 0,85 m : **1,70 m de chute instantanée**, avec déplacement horizontal. Une balle à 30 m/s est aussi attrapée automatiquement dans le scénario contrôlé. Un joueur en l'air peut théoriquement récupérer une balle sous ses pieds puisque seule la borne haute est testée. Direction : volume de réception lié au geste, capture progressive et continuité de la vitesse/position avant la tenue.

### G03 — Les contacts font glisser les corps sans poids ni appuis

**Reproduit et mesuré ; modèle simplifié.** [Séparation des corps](../src/match/world/MatchWorld.ts#L1835), [distance des foulées](../src/match/world/player.ts#L173).

Deux disques de même rayon sont écartés à parts égales, sans poids, force, impulsion ou modification de vitesse. Un joueur de 65 kg et un de 135 kg se déplacent chacun de 10 cm dans la reproduction, malgré une vitesse et une distance de foulée nulles. Les corrections interviennent après la mesure des foulées : glissement sans pas, course qui pousse dans un corps, déplacement d'un joueur immobile. Elles affectent également les trajectoires aériennes selon la même règle plane. De 7 616 à 10 171 corrections sur corps presque immobiles par match. Direction : résoudre le contact dans le mouvement effectif, tenir compte des gabarits/appuis et alimenter l'animation avec ce mouvement.

### G04 — Le rebond est presque entièrement une course au sol

**Mesuré et code ; fonctionnalité encore simplifiée.** [Choix des rebondeurs](../src/match/ai/playerAi.ts#L540), [poursuite](../src/match/ai/playerAi.ts#L934).

Les deux joueurs les plus proches du ballon de chaque équipe poursuivent sa position horizontale extrapolée ; cette branche ne commande jamais de saut. Aucun box-out ni calcul du moment où le ballon sera à portée. Sur trois matchs : **1 rebond pris en l'air sur 228** ; aucun saut explicitement déclenché par la branche de poursuite. Les rares prises aériennes peuvent provenir d'un saut de contestation encore en cours. Les attaquants prennent **117/228 rebonds**, soit 51,3 %, signal à examiner avec ce mécanisme avant de toucher aux pourcentages. Direction : prédire un point/instant de récupération, attribuer les rôles et préparer saut, prise et réception.

### G05 — Les joueurs sans ballon échangent brutalement leurs destinations

**Mesuré.** [Affectation des places](../src/match/ai/playerAi.ts#L247), [appel pendant l'écartement](../src/match/ai/playerAi.ts#L790).

L'affectation gloutonne des places est recalculée à partir de toutes les distances, sans mémoire de place ni hystérésis. Un petit changement d'ordre peut envoyer un joueur vers une autre place à plusieurs mètres, puis inverser la décision. Mesure conservatrice, même porteur et même objet passe : **282 à 310 sauts de cible supérieurs à 3 m par match**. Cela explique des demi-tours et croisements sans intention de jeu identifiable. Direction : conserver une place par séquence, avec motifs explicites de changement.

### G06 — Un tir parfait de 24 m peut avoir la même probabilité qu'un tir de 8 m

**Reproduit ; limite du modèle par zones.** [Contexte du tir](../src/engine/shot.ts#L97), [probabilité](../src/engine/shot.ts#L170), [appel depuis le match](../src/match/world/MatchWorld.ts#L1981).

La distance précise ne parvient pas au modèle de réussite. À joueur, zone à trois points, timing, vitesse et défense identiques, les deux tirs ont **50 %** dans la reproduction. Une trajectoire réussie de 24 m existe bien pour la position testée. L'intérêt de remonter le terrain et la valeur du placement sont ainsi contournables par le joueur humain. Direction : traiter la portée, les distances extrêmes et les tirs désespérés ; cela exige une décision de gameplay/calibration, pas seulement un changement d'animation.

### G07 — R/M peuvent remplacer une action réelle par un tir de démonstration

**Reproduit dans le navigateur ; exposition également présente dans le chemin GM.** [Touches de test](../src/match/scenes/MatchScene.ts#L957), [tir de démonstration](../src/match/world/MatchWorld.ts#L2146).

Ces raccourcis sont actifs sans garde de route atelier ou de développement, sauf si la touche est déjà liée à une commande. La touche R a produit `demo: true` et retiré le porteur dans le match inspecté. Le chemin peut interrompre tir/passe/possession et consommer le RNG avec une action exclue du score. Direction : réserver ces commandes à un contexte de test explicite.

### G08 — Le nouveau porteur peut être empêché de tirer ou passer par l'ancien dunk

**Reproduit dans une situation issue du match graine 31.** [Début du tir](../src/match/world/MatchWorld.ts#L573), [passe](../src/match/world/MatchWorld.ts#L595), [fin du dunk](../src/match/world/MatchWorld.ts#L1964).

Le dunk reste dans l'état global `shot` jusqu'à l'atterrissage de son auteur. Si quelqu'un ramasse entre-temps, les conditions globales `shot === null` bloquent son tir et sa passe. À 855,55 s du match contrôlé, le joueur 9 a le ballon pendant que le dunk du joueur 4 reste actif ; appuyer sur Tir fait sauter le nouveau porteur **sans lancer son tir**. Treize pas de coexistence dans chacun de deux matchs, soit environ 108 ms cumulées par match concerné. Direction : distinguer l'action résiduelle de l'ancien joueur de l'action disponible au porteur.

## Priorité P2 — Déplacements, ballon et contacts

### G09 — L'IA fonce vers sa cible sans contourner les corps

**Code.** [Déplacement](../src/match/ai/playerAi.ts#L570), [détection de blocage](../src/match/ai/playerAi.ts#L687).

Le déplacement ne fait qu'un vecteur direct vers la cible. Pas d'évitement local des partenaires/adversaires, de couloir ou de contournement. De plus, l'anti-blocage mesure `body.vel`, alors que G03 peut annuler le progrès en ne corrigeant que la position. Un joueur qui pousse et n'avance pas peut donc être considéré comme en mouvement. Direction : mesurer le progrès réel et choisir une trajectoire praticable. G03 et G09 se renforcent mutuellement.

### G10 — Le joueur et son ballon se retournent avant la fin du freinage

**Reproduit.** [Orientation à la commande](../src/match/world/player.ts#L144), [position du ballon](../src/match/world/MatchWorld.ts#L487).

L'orientation gauche/droite suit immédiatement l'entrée, sans attendre l'inversion de la vitesse. Après une commande gauche depuis 6 m/s vers la droite, le corps va encore à **5,5 m/s à droite**, mais le ballon bascule immédiatement de côté : saut de **39,4 cm**. Direction : état de freinage/pivot et transfert de main explicite, séparés de la direction demandée.

### G11 — Le délai de ramassage protège le ballon contre tout le monde

**Reproduit ; règle simplifiée.** [Délai après tir](../src/match/world/MatchWorld.ts#L2039), [garde globale](../src/match/world/MatchWorld.ts#L2045).

Le délai de 0,5 s présenté dans le réglage comme une protection contre la reprise par le tireur interdit en réalité le ramassage à tous les joueurs. Un défenseur à portée d'un ballon accessible ne peut donc pas le prendre. Les frappes et déviations possèdent aussi des délais globaux. Direction : préciser qui est exclu, et utiliser la séparation réelle ballon/main plutôt qu'une immunité universelle.

### G12 — Un layup très près du cercle peut inverser l'élan instantanément

**Reproduit.** [Point d'arrivée](../src/match/world/shooting.ts#L73), [vitesse imposée](../src/match/world/MatchWorld.ts#L1895).

Le layup remplace la vitesse par celle qui rejoint un point fixé devant le cercle. Si le joueur a déjà dépassé ce point en attaquant le panier, il repart en arrière au décollage. À 0,30 m devant le cercle, avec 3 m/s vers lui et un profil ne déclenchant pas de dunk, le layup passe à **−0,333 m/s**. Direction : préserver la continuité de l'élan et choisir une finition compatible avec le point de départ.

### G13 — Les dunks suivent une trajectoire imposée et peuvent arrêter le joueur net

**Code ; mise en scène prévue dans la phase initiale.** [Contexte](../src/match/world/MatchWorld.ts#L519), [impulsion imposée](../src/match/world/MatchWorld.ts#L1879), [smash et accroche](../src/match/world/MatchWorld.ts#L1918).

Le contexte géométrique est une demi-raquette ; le début du dunk réoriente sa vitesse vers un point de finition et peut relever son saut. Le ballon du smash provient ensuite du plan de dunk, tandis que les corrections de contact peuvent avoir déplacé le corps. L'accroche d'un dunk réussi arrête la vitesse horizontale. Cela favorise traction vers le cercle, saut amplifié et arrêt brusque, particulièrement depuis une approche latérale. Direction : contrôler continuité corps/main/cercle et qualité d'approche. Le dunk à l'arrêt est une possibilité voulue, à conserver comme telle dans la discussion.

### G14 — Le départ d'un tir sous/derrière le panier est déplacé devant le cercle

**Code ; contournement géométrique documenté.** [Origine corrigée du tir](../src/match/world/shooting.ts#L92).

`releasePoint` déplace l'origine physique vers un minimum de 0,5 m devant le cercle dans l'ombre de la planche. Le joueur peut donc lâcher depuis un endroit que sa main n'a pas atteint. Le fondu graphique masque seulement une partie des écarts et ne corrige pas le geste. Direction : finition adaptée à la position, ou refus/ajustement du geste avant le lâcher.

### G15 — Quand le solveur échoue, un tir peut simplement tomber verticalement

**Échec du solveur reproduit ; conséquence établie par code.** [Solveur](../src/match/physics/shotSolver.ts#L116), [exception absorbée](../src/match/world/MatchWorld.ts#L2030).

Si aucune trajectoire ne convient, le monde garde une vitesse de départ nulle et ne signale rien. L'échec existe depuis `(1 ; 7,62 ; 2,8)` vers le panier droit, sous la zone de l'autre planche. Le joueur peut accomplir son geste puis lâcher un ballon qui tombe droit, même si le modèle avait demandé une réussite. Ce cas extrême n'a pas été rencontré dans les trois matchs IA. Direction : validation de la position et repli visuellement explicable, avec trace diagnostique.

### G16 — Le défenseur le plus proche masque parfois le vrai contest

**Reproduit.** [Sélection du défenseur](../src/match/world/MatchWorld.ts#L500).

La sélection prend la distance minimale avant d'évaluer la gêne. Un défenseur à 0,7 m derrière le tireur évince un autre à 1 m devant. Dans le scénario, le tir obtient **48,68 %**, contre **38,33 %** en considérant celui devant. Ajouter un défenseur peut ainsi rendre le tir moins contesté. Direction : sélectionner la gêne la plus forte ou agréger les menaces compatibles.

### G17 — Les contacts de main ne suivent pas la main ni l'orientation dessinées

**Code ; modèle simplifié, aggravé par G01.** [Portée du contre](../src/match/world/defense.ts#L40), [vol](../src/match/world/steal.ts#L51).

La portée du contre est un volume au-dessus de l'épaule sans angle horizontal de face ni référence à la main réellement levée dans la pose. Le vol évalue aussi la proximité générique du ballon, sans orientation du bras du voleur. Une action peut donc être jugée sur le côté ou derrière le joueur alors que le dessin étend la main ailleurs. Direction : volumes d'action orientés, actifs au bon moment du geste, cohérents avec les contacts de pose.

### G18 — Le goaltending protège aussi des ballons qui s'éloignent du panier

**Reproduit sur la condition géométrique ; approximation explicitement documentée.** [Zone](../src/match/world/defense.ts#L67), [attribution du panier](../src/match/world/MatchWorld.ts#L1529).

La zone est un rayon horizontal de 1 m, sans vérifier si la trajectoire peut entrer. Une balle à **0,95 m** du centre, au-dessus du cercle, descendante et s'en éloignant à 5 m/s est déclarée protégée. Si une main admissible la touche dans cette zone, le panier est accordé. Direction : critère lié au cylindre et/ou à la trajectoire réelle. Ce changement modifierait une règle de phase initiale, pas une simple constante graphique.

### G19 — Le premier contact clôt définitivement l'évaluation de faute du tir

**Code ; décision de phase initiale.** [Faute](../src/match/world/MatchWorld.ts#L1495), [contact des corps](../src/match/world/defense.ts#L57).

Le premier contact, même jugé non fautif, laisse un objet `play.foul` qui empêche toute évaluation suivante. Un frôlement initial peut donc immuniser une collision plus violente avec un autre défenseur. La géométrie est horizontale et la vitesse retenue est celle du défenseur vers le tireur, sans vitesse relative ni séparation verticale. Il n'existe pas de distinction charge/obstruction. Direction : caractériser les contacts significatifs et leur chronologie ; faire évoluer cette règle exige de revoir le choix documenté « une évaluation par tir ».

### G20 — Certaines mains ne peuvent pas modifier un ballon pourtant touché

**Code ; limites explicites de la première phase.** [Contacts sur tir](../src/match/world/MatchWorld.ts#L1523).

Un tir descendant hors de la zone de goaltending ne peut pas être contré par cette branche : les contres sont limités à la montée du ballon. Les dunks et les lancers francs sont exclus de `checkTouch`. Un joueur en l'air peut donc sembler atteindre un ballon sans effet. Direction : séparer le contact physique, le résultat de la défense et la qualification réglementaire. L'immunité des dunks est déjà documentée ; ce n'est pas une perte récente.

## Priorité P2 — Collectif, transitions et animations

### G21 — Les duels défensifs restent figés par poste en 5 contre 5

**Code ; simplification tactique.** [Affectation](../src/match/ai/playerAi.ts#L215), [rafraîchissement](../src/match/ai/playerAi.ts#L531), [défense du tir](../src/match/ai/playerAi.ts#L829).

Meneur contre meneur, intérieur contre intérieur, sans transfert organisé si le joueur est battu. La défense du tireur peut ensuite rester plantée après son temps de réaction, et l'aide utilise une position géométrique autour de son propre adversaire. Il manque une prise en charge collective du porteur libre et une récupération coordonnée. Direction : responsabilités temporaires d'aide, reprise et changement de duel.

### G22 — Le jeu placé est une suite de destinations individuelles

**Code ; fonctionnalités collectives manquantes.** [Attaque du porteur](../src/match/ai/playerAi.ts#L625), [jeu sans ballon](../src/match/ai/playerAi.ts#L790).

Plans individuels cercle/mi-distance/trois points, places d'écartement et coupes périodiques, sans écran, pick-and-roll, hand-off ou synchronisation passe/coupe. Plusieurs intentions compatibles isolément créent ensemble un embouteillage près du cercle. Direction : un petit nombre de séquences collectives et des rôles persistants, plutôt qu'ajouter du hasard à chaque joueur.

### G23 — Les joueurs ne changent pas leur tactique avec le score en fin de match

**Code ; fonctionnalité manquante.** [Décision d'attaque](../src/match/ai/playerAi.ts#L650).

L'IA utilise le temps restant au quart-temps/shot clock et sa patience, mais ne consulte pas le score pour ses décisions sur le terrain. Même comportement pour conserver une avance ou rattraper trois points : pas de gestion d'horloge, faute intentionnelle, recherche prioritaire d'un trois points ou organisation de dernier tir. Le coach de rotation, lui, possède bien une logique de fin de match ; il ne faut pas confondre les deux. Direction : politique tactique commune selon score/temps/possession.

### G24 — Les changements sont nombreux et remplacent instantanément l'identité du corps

**Mesuré ; fréquence voulue par le modèle de rotation, représentation abrupte.** [Coach et remplacement](../src/match/world/MatchWorld.ts#L769), [intervalle](../src/engine/rotation.ts#L30).

135 à 147 entrées individuelles cumulées par match de douze minutes, aux arrêts de jeu. L'intervalle de 95 s est ramené à environ 23,75 s de chrono par l'échelle 48/12. Le remplaçant prend immédiatement le corps et la position de celui qui sort : changement de visage/gabarit sans entrée/sortie. Direction : d'abord une transition lisible ; la réduction du nombre de changements serait une décision distincte de rythme/fatigue.

### G25 — Remises et lancers francs repositionnent les joueurs par téléportation

**Mesuré et code.** [Mise en place de la remise](../src/match/world/MatchWorld.ts#L1047), [placement global](../src/match/world/MatchWorld.ts#L1139).

Les replacements sont instantanés. De 96 à 111 pas par match comportent au moins un joueur déplacé de plus d'un mètre ; ces transitions incluent remises, lancers et périodes. L'arrêt du chrono est correct, mais on voit les corps et parfois le cadrage changer sans temps de déplacement ou transition de présentation. Direction : montrer le replacement ou employer une transition visuelle explicite.

### G26 — Une réception en course active deux logiques de ballon incompatibles

**Reproduit dans le navigateur.** [Choix du geste](../src/match/render/playerView.ts#L176), [rendu du ballon](../src/match/scenes/MatchScene.ts#L1033), [suivi de réception](../src/match/render/gestureTracker.ts#L55).

Au-delà de 1,2 m/s, le porteur affiche déjà le dribble, mais `catching` reste vrai pendant jusqu'à 150 ms et empêche le rendu continu de ce dribble. À 6,708 s, cette combinaison est effectivement présente. Le ballon suit alors l'accroche discrète de la frame avant de retrouver son interpolation. En outre, la pose de prise n'est déclenchée que pour le receveur désigné de la passe : un autre partenaire, un intercepteur ou un rebondeur n'a pas la même transition. Direction : un état de réception commun aux décisions du corps et du ballon, pour toutes les origines de prise.

### G27 — Une passe longue est dessinée comme un lob sans départ physique au-dessus de la tête

**Code.** [Choix visuel du lob](../src/match/render/gestureTracker.ts#L84), [lâcher de passe](../src/match/world/MatchWorld.ts#L1807), [trajectoire](../src/match/world/passing.ts#L78).

Au-delà de 8 m, la pose devient `lobPass`. Le monde n'a pourtant pas de type de passe correspondant : il part toujours devant la poitrine vers la poitrine, avec la même formule balistique. La trajectoire possède bien une courbure liée à la gravité ; le problème est la différence entre geste haut et origine/choix physique, pas une absence de parabole. Direction : relier le type de passe à son lâcher et à sa trajectoire.

### G28 — Il manque des appuis pour freiner, pivoter et défendre latéralement

**Code et rendu observé ; travail graphique encore non activé.** [Sélection des poses](../src/match/render/playerView.ts#L188), [orientation](../src/match/render/gestureTracker.ts#L125).

Hors geste, le joueur au sol est en course/arrêt ou dribble. Il n'y a pas de phase active de démarrage, freinage, pivot, recul défensif ou pas chassés. L'orientation suit essentiellement le déplacement au lieu de permettre de surveiller le porteur tout en reculant. Les poses candidates de locomotion sont conservées dans l'atelier mais ne sont pas utilisées en match. Direction : activer une grammaire d'appuis à partir du mouvement réel, après stabilisation des collisions/cibles.

### G29 — Les réceptions de saut disparaissent dès que le joueur court ou garde le ballon

**Code.** [Geste d'atterrissage](../src/match/render/playerView.ts#L177).

La pose d'atterrissage exige de ne pas tenir le ballon et d'aller à moins de 1,2 m/s. Un rebondeur qui conserve sa balle ou un sauteur avec de l'élan passe directement à dribble/course, sans compression des jambes ni reprise d'appui. De même, les poses courtes de passe/vol peuvent déplacer un corps avec des pieds figés. Direction : superposer l'action du haut du corps à des appuis cohérents, et prévoir les atterrissages mobiles avec et sans ballon.

### G30 — Les réglages peuvent changer les règles d'un geste déjà commencé

**Code.** [Application en direct](../src/match/scenes/MatchScene.ts#L931), [timing du saut](../src/match/world/player.ts#L94), [durée des périodes](../src/match/world/MatchWorld.ts#L416).

Ouvrir le panneau bloque les entrées mais ne suspend pas le match. Modifier la vitesse de tir change `timeToApex` sans changer la gravité déjà prise par le saut en cours : la jauge et le sommet peuvent ne plus coïncider ; le dunk consulte aussi cette valeur pour son smash. La durée des quarts est modifiée immédiatement alors que le commentaire annonce « à partir du suivant » : le chrono courant reste le même mais l'échelle de fatigue/rotation change. Direction : appliquer ces paramètres à une frontière de geste/période définie, ou figer leur contexte au départ.

### G31 — « Simuler la fin » casse les commandes du mode d'observation autonome

**Reproduit dans Chromium sur `?court&watch&atelier&seed=31`.** [Bouton](../src/match/PhaserGame.tsx#L149), [garde de scène](../src/match/scenes/MatchScene.ts#L807).

React passe en état `finishing` et masque pause/vitesses. La scène refuse de commencer sans `setup`, absent de `?court`. Résultat observé : `sceneFinishing: false`, `over: false`, boutons pause et vitesse invisibles. Direction : proposer cette action seulement dans les contextes gérés, ou prendre en charge la fin du match autonome.

## Priorité P3 — Retours d'information et finition

### G32 — Les raccourcis de vitesse ne fonctionnent pas dans `?court&watch`

**Reproduit.** [Raccourcis](../src/match/PhaserGame.tsx#L95).

Le clavier vérifie `initialMatch.current?.mode === 'regarder'`, contrairement aux boutons qui prennent aussi en charge `watch` dans l'URL. Touche 2 : vitesse reste 1 ; bouton ×2 : vitesse passe à 2. Direction : un même calcul de mode pour les boutons et le clavier.

### G33 — Les fautes sur tir n'ont pas le coup de sifflet attendu

**Code.** [Événements sonores](../src/match/audio/MatchAudio.ts#L61).

Le son de sifflet est émis pour `faute-main` seulement. Une faute sur tir peut donc arrêter l'action et envoyer aux lancers sans ce repère sonore. Il manque aussi une sirène de période dans cette couche audio. Direction : événements explicites de faute et de fin de période, indépendants du texte de l'interface.

### G34 — Certains gestes partagent une phase globale au lieu de partir avec l'action

**Code.** [Déséquilibre](../src/match/render/gestureTracker.ts#L156), [image de déséquilibre](../src/match/render/playerView.ts#L174), [repos](../src/match/scenes/MatchScene.ts#L1011).

Le déséquilibre après un vol raté utilise une phase calculée avec l'horloge globale : il peut commencer au milieu de l'animation et boucler sans correspondre au début de la perte d'appui. Les joueurs au repos partagent aussi `world.clock % 1`, donc respirent sur le même cycle. Direction : phase depuis l'événement pour les gestes, décalage déterministe par joueur pour les cycles autonomes.

### G35 — Les annonces peuvent survivre au joueur ou à l'action qu'elles décrivent

**Code.** [Animation des annonces](../src/match/scenes/MatchScene.ts#L1276).

La durée des bulles dépend du temps affiché (`deltaMs`), tandis que le match peut avancer à ×4. Elles occupent donc quatre fois plus de temps de jeu. Leur propriétaire est un index de corps, pas une identité de joueur : une substitution pendant leur durée peut faire suivre l'annonce au remplaçant. Les annonces au cercle utilisent le dernier tir courant pour leur position. Direction : figer l'identité/le lieu de l'événement et choisir explicitement la base de temps.

## Points à surveiller, sans les présenter comme bugs confirmés

- **Fluidité/caméra.** Les mesures Chromium après lecture réelle sont autour de 50,7 i/s, avec une pire image relevée à 30 ms. Ce contexte headless ne suffit pas à attribuer un défaut au matériel utilisateur. Le zoom continu et les paliers à 0,75 produisent aussi des échelles internes non entières malgré le réglage pixel-art ; un test vidéo sur le poste cible doit distinguer tremblement des pixels et saccade réelle. Sources : [caméra](../src/match/render/camera.ts#L4) et [suivi dans la scène](../src/match/scenes/MatchScene.ts#L1078).
- **Préparation.** Le passage navigateur a préparé les vingt joueurs en worker en 14,63 s. Cela affecte l'attente d'entrée en match, mais aucun bake synchrone de remplaçant n'a été constaté dans cette séquence (`syncEntries: 0`).
- **Équilibrage.** 117 rebonds offensifs sur 228 et 138 lancers réussis sur 156 (88,5 %) sont des signaux de cet échantillon. Ils ne justifient pas à eux seuls de baisser une probabilité globale. Revoir d'abord les opportunités physiques et l'exécution de l'IA, puis élargir les graines/effectifs.
- **Règles non implémentées.** Pas de système complet de marcher, pied de pivot, reprise de dribble, trois secondes ou faute offensive dans les chemins inspectés. Le périmètre réglementaire est partiellement laissé ouvert dans les spécifications. Ce sont des limites à décider, pas des régressions prouvées.
- **Trajectoires de tirs prédéterminées.** Le solveur choisit une trajectoire conforme au résultat de `engine/`. Cela contraint la variété des ratés/rebonds mais correspond au contrat actuel ; le principe n'est pas un bug en soi.
- **Pas de faux diagnostic sur la défense automatique.** Reprendre le déplacement du joueur sans entrée est prévu dans les spécifications. L'effet peut surprendre, mais son existence n'est pas une erreur ; les problèmes de trajectoire/appuis restent ceux de G03/G09/G28.

## Fonctionnalités conservées constatées

Les trois matchs atteignent leur fin. Le chemin comporte toujours les périodes/prolongations, chronos, remises, sorties, retour en zone, entre-deux, lancers, fautes/bonus/éliminations, fatigue/rotation et box score. Cette revue ne certifie pas tous leurs cas limites. Dans les snapshots navigateur, points d'équipe et points de box score concordent ; les effectifs préparés et les changements continuent de fonctionner. Les poses d'actions distinctes, le suivi par pas physique et les contacts d'assets sont présents, même si plusieurs décisions d'usage restent imparfaites.

Les défauts ne viennent donc pas seulement du dessin. Les causes dominantes sont la continuité du ballon, le traitement des contacts, l'absence d'anticipation au rebond et les intentions collectives instables.

## Ordre de traitement recommandé

1. Isoler les commandes de démonstration et séparer le dunk résiduel des actions du nouveau porteur : G07/G08.
2. Unifier la continuité physique/visuelle du ballon et les réceptions : G01/G02/G10/G26/G27.
3. Stabiliser mouvement et intentions : G03/G05/G09, puis appuis G28/G29.
4. Construire un vrai cycle de rebond : G04, puis mesurer de nouveau les rebonds offensifs.
5. Corriger le choix du contest et examiner les règles de portée/contact : G06/G16/G17, puis décisions explicites sur G18–G20.
6. Améliorer collectif et transitions : G21–G25, puis interface et retours G30–G35.

Chaque lot devrait être validé sur des situations courtes reproductibles puis sur des matchs complets identiques par graine. Les probabilités et les règles déjà décidées doivent rester des changements identifiés et mesurés, pas des ajustements cachés dans une retouche visuelle.

## Preuves conservées dans le dépôt

- [Mesures avant correction](validation/gameplay-before.json).
- [Rapport de fin d'action et nouvelles validations](GAMEPLAY_REMEDIATION.md).
- [Vidéo comparative](media/gameplay-before-after.mp4).

Les reproductions d'origine ont été transformées en tests de non-régression dans `src/match/world/naturalGameplay.test.ts` et les suites de physique/défense existantes. Les références de lignes ci-dessus correspondent à la version auditée `d6fe43f`, pas aux positions après correction.
