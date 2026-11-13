# Rapport de fin d’action — naturel des matchs

13 novembre 2026. Référence avant correction : `d6fe43f`. Implémentation principale : `99d2a58` ; contrôle des formats et test de contre sur dunk : `a2277f9`.

Les huit lots autorisés ont été appliqués. Les 35 constats de [l’audit](GAMEPLAY_AUDIT.md) sont reliés ci-dessous à leurs corrections. Les modèles restent ceux d’un jeu arcade ; cette livraison ne prétend pas reproduire toutes les règles ou tous les gestes du basket professionnel.

## Comparaison avant/après

[Vidéo comparative de 30 secondes](media/gameplay-before-after.mp4) · [capture comparative](media/gameplay-before-after.png) · [capture avant](media/gameplay-before.png) · [capture après](media/gameplay-after.png).

Les deux côtés utilisent la graine 8126, les mêmes effectifs, réglages et dimensions 1280×720. Les deux versions sont enregistrées successivement en lecture réelle, avec `canvas.captureStream(30)` et MediaRecorder, puis les trente premières secondes sont montées côte à côte à 30 images par seconde. L’IA corrigée prend de nouvelles décisions : les actions et les scores divergent normalement. La vidéo ne possède pas de piste audio ; les FPS du rendu sont mesurées séparément. Un enregistrement au pas fixe a également servi au diagnostic, mais ce montage publié montre la lecture normale.

Mesures comparables sur les trois graines initiales, 4 × 3 minutes :

| Indicateur | Avant | Après |
|---|---:|---:|
| Écart physique/dessin du centre du ballon, médiane / maximum dans la séquence Chromium inspectée | 9,87 / 40,41 pixels du monde | 0 / 0 |
| Changements de cible >3 m sans changement de porteur/passe | 891 | 0 |
| Corrections de contact sur des corps à vitesse <0,1 m/s | 26 782 | 257 |
| Rebonds pris en l’air | 1/228 | 157/167 |
| Rebonds offensifs | 117/228 (51,3 %) | 61/167 (36,5 %) |
| Entrées individuelles de remplaçants, deux équipes cumulées | 423 | 219 |
| Pas où une action de l’ancien porteur reste active avec un nouveau porteur | 26 | 0 |

Les contacts comptent des corrections par corps et par pas, pas des collisions uniques. La baisse de 99 % du compteur sur corps presque immobiles ne signifie pas que toute déformation visuelle ou tout glissement possible a disparu. Les prises de rebond ont changé : les dénominateurs avant/après ne sont donc pas identiques.

## Traitement des 35 constats

| ID | Correction livrée | Vérification |
|---|---|---|
| G01 | `BallControlRig` transforme les repères des poses officielles en coordonnées physiques ; le ballon dessiné utilise la position physique. | Mesure Chromium médiane/P95/max à zéro ; test de géométrie pure. |
| G02 | Volume de prise, hauteur minimale, orientation et vitesse relative ; transition progressive vers le contrôle. | Balle à 30 m/s refusée ; prise sous les pieds refusée ; réception haute sans saut de 1,70 m. |
| G03 | Rayons selon gabarit, résistance liée au poids/force/appui, résolution de vitesse normale ; foulées calculées après contacts. | Corps lourd moins déplacé, vitesse de fermeture résolue, séparation verticale respectée ; métriques sur 12 matchs. |
| G04 | Prévision physique fer/planche/parquet, rôles persistants, sauts anticipés, box-out et repli. | Scénario de saut atteignable ; rebonds aériens et offensifs mesurés. |
| G05 | Places conservées pendant la possession et les changements de porteur ; réaffectation aux changements de cinq. | Bruit de position sans échange de place ; zéro grand changement inexpliqué sur les trois références. |
| G06 | Portée précise et décroissance progressive hors de la portée utile. Les appels historiques sans distance gardent leur modèle. | 24 m nettement pénalisé ; référence 8 m conservée ; saison de calibration exécutée. |
| G07 | R/M réservées au mode atelier explicite. | Touche R sans modification de l’action quand l’atelier est désactivé. |
| G08 | Le smash libère l’action globale ; l’accroche/retombée appartient au dunkeur. Le vol pendant le ramassage annule aussi l’action de l’ancien porteur. | Nouveau tir pendant la récupération d’un autre joueur ; invariant vérifié sur 12 matchs. |
| G09 | Choix local de trajectoire, dégagement des obstacles, limites du terrain et protection de la ligne médiane ; blocage mesuré par la progression réelle. | Obstacle contourné ; tests de rythme et de violations IA conservés. |
| G10 | Freinage avant retournement, direction du regard indépendante et déplacement borné du ballon tenu. | À 5,5 m/s vers la droite, une demande gauche ne retourne plus immédiatement le joueur. |
| G11 | Exclusion temporaire des acteurs concernés, au lieu de bloquer tous les joueurs. | Un adversaire récupère une balle accessible pendant l’exclusion du tireur. |
| G12 | Élan du layup conservé et borné sur la durée du saut. | Finition proche sans inversion de vitesse ; dérive maximale vérifiée. |
| G13 | Zone et approche du dunk bornées ; saut tenant compte de la portée visuelle ; montée du ballon vers le cercle ; récupération indépendante ; élan conservé sur raté. | Dunks réussis/ratés, accroche, retour au saut normal et nouveau porteur testés. |
| G14 | Origine de tir prise dans la pose de lâcher ; suppression du déplacement automatique devant la planche. | Test sous le panier : l’origine garde sa position horizontale. |
| G15 | Vitesse de repli non nulle, résultat demandé signalé comme non garanti et journal `trajectoryFallbacks`. | Échec géométrique contrôlé ; 14 replis consignés sur les 12 matchs de validation. |
| G16 | Sélection du contest effectif le plus fort. | Défenseur derrière à 0,7 m n’évince plus celui devant à 1 m. |
| G17 | Orientation des volumes de bras/vol, extension liée à la phase du saut, référence commune du ballon ; prise d’interception refusée si incontrôlable. | Contact derrière le défenseur refusé ; tests de contre et d’interception. |
| G18 | Protection selon le cylindre et la projection de trajectoire, au lieu du disque de 1 m. | Balle à 0,95 m s’éloignant du cercle non protégée ; ballon dans le cylindre protégé. |
| G19 | Géométrie verticale, vitesse relative et contacts significatifs distincts/aggravés ; un premier refus ne ferme plus toute la fenêtre. | Second défenseur évalué après un premier contact non sifflé ; fautes/lancers/bonus testés. |
| G20 | Contacts possibles sur ballon descendant hors zone protégée et pendant la montée d’un dunk ; tentatives suivies par défenseur. | Contre descendant loin du cercle ; tests de résolution et de score. |
| G21 | Échange de responsabilités entre défenseur battu et aide, avec délai contre les oscillations. | Le helper reprend le porteur et les cinq adversaires restent attribués. |
| G22 | Passe et coupe, écran avec déroulement, main-à-main ; rôles persistants et abandon borné. | Les trois séquences exécutent leur action clé ; retour au jeu ordinaire après expiration. |
| G23 | Conservation d’avance, deux points rapides, recherche de trois points et faute intentionnelle selon score/temps/possession. | Décisions différentes selon le score ; fautes intentionnelles observées dans les matchs complets. |
| G24 | Intervalle réel minimal de rotation aux arrêts, sorties forcées préservées et transition de présentation. | 219 entrées contre 423 sur les références ; tests élimination, fatigue, minutes et tireur des lancers. |
| G25 | Transitions courtes explicites de remise/placement/substitution, dessinées par le HUD avec le temps simulé. | Captures et matchs navigateur ; le replacement logique instantané est masqué par cette présentation. |
| G26 | Un seul état de prise pour les décisions de pose et de ballon, pour tout nouveau porteur. | Plus de combinaison réception active/dribble affiché dans la séquence inspectée ; scénario de prise haute. |
| G27 | Type de passe conservé ; lâcher depuis la pose correspondante ; lob plus lent avec trajectoire physique. | Tests de passe, direction, réception et déterminisme. |
| G28 | États démarrage, freinage, pivot, défense, pas latéraux et recul, avec phases liées aux appuis et regard séparé. | Tests de freinage/recul et sélection ; emploi de personnages entiers officiels, voir limite artistique ci-dessous. |
| G29 | Atterrissage conservé avec ballon et en mouvement, puis reprise du dribble/course. | Tests du sélecteur et captures. |
| G30 | Réglages du tir différés pendant un geste ; durée des quarts au suivant ; panneau de réglage suspendant l’avancement. | Contexte de saut inchangé en l’air ; chrono courant préservé ; navigateur pause/réglages. |
| G31 | Fin accélérée prise en charge en observation autonome ; restitution des commandes à la fin ; action masquée dans les formats sans périodes. | Match autonome terminé, score = box score, pause/vitesses de nouveau visibles. |
| G32 | Même mode d’observation pour clavier et boutons. | Touche 2 et bouton ×2 donnent la vitesse 2. |
| G33 | Événements de faute sur tir/faute intentionnelle et sirène de période reliés à l’audio. | Fin autonome : 11 sifflets et 4 sirènes, contexte audio actif. |
| G34 | Phase de déséquilibre depuis l’action et phases de repos décalées selon l’identité. | Tests de phase et identités au repos. |
| G35 | Annonces liées à l’identité et au lieu de l’événement ; progression par temps simulé, y compris en pas à pas. | Chemins de changement de joueur et de rendu inspectés ; captures ×1/×2/×4. |

## Validation exécutée

- `npm test` : **383 tests dans 40 fichiers, tous verts**. Les anciennes fixtures ont été adaptées lorsque le comportement qu’elles imposaient faisait précisément partie des défauts corrigés ; les bornes de rythme, de réussite, de pertes et de défense des matchs IA sont conservées, hors conservation d’avance volontaire en fin de match.
- `npm run build` et `npm run lint` : réussite. L’avertissement de taille du bundle Phaser subsiste.
- `npm run calibrate` : 1 230 matchs, 112,7 points par équipe, 48,0 % aux tirs, 35,6 % à trois points, 79,7 % aux lancers et 12,3 pertes par équipe. Il s’agit de la simulation de saison, distincte des matchs physiques.
- `npm run validate:gameplay -- --seeds=8126,31,919,1,2,3,7,42,123,2026,31415,2718` : **12 matchs physiques terminés**, score/box score concordants, états finaux finis et aucune action résiduelle monopolisant le nouveau porteur.
- Chromium : rejeu de 600 entrées identiques entre composition worker et repli principal, mêmes états ; match entier avec 20 joueurs utilisés/préparés, aucun bake à l’entrée d’un remplaçant ; commandes clavier, pause, réglages audio et ateliers contrôlés ; aucune erreur JavaScript dans cette campagne.
- Fin autonome vérifiée jusqu’au bout avec restitution des commandes, sifflets et quatre sirènes.

Les résultats navigateur et Node sont rapportés séparément. Les compteurs FPS relevés pendant les campagnes simultanées ne constituent pas une mesure isolée de performance. Pendant les captures réelles successives, le compteur donne environ 49,4 i/s avant et 45,4 i/s après ; la captation ajoute sa propre charge. Cette mesure ne démontre donc pas une amélioration de performance et le profilage reste nécessaire.

## Limites à conserver dans la lecture du résultat

Les nouveaux états d’appuis réutilisent des images complètes des dix designs officiels. Les 48 illustrations témoins restent dans leur atelier ; elles n’ont pas été présentées comme une nouvelle série de dessins validée pour les dix designs. Une production artistique dédiée reste utile pour améliorer encore les pas chassés et les pivots.

Les transitions de placement sont des transitions de présentation courtes ; elles ne simulent pas encore un arbitre apportant physiquement le ballon ou chaque remplaçant marchant depuis le banc. Les 14 trajectoires de repli restent des situations à examiner dans la géométrie des finitions ; elles sont désormais explicites et ne produisent plus un lâcher silencieux à vitesse nulle.

Le réglage global des probabilités n’a pas servi à masquer les problèmes de position. Le taux de rebonds offensifs baisse mais mérite une campagne de calibration plus large. Les règles de marcher, pied de pivot, reprise de dribble, trois secondes et faute offensive complète restent hors du plan autorisé, comme indiqué lors de sa proposition.

**60 FPS stables ne sont pas démontrées** dans cet environnement Chromium headless. La vidéo comparative est encodée à 30 i/s ; cette cadence de fichier ne prouve pas une fréquence de rendu stable.

## Reproduire

```sh
npm ci
npm test
npm run build
npm run lint
npm run calibrate
npm run validate:gameplay
npm run dev -- --host 0.0.0.0 --port 5173
```

Avec Playwright Python, Chromium et FFmpeg disponibles :

```sh
HOOPSIM_EVIDENCE_DIR=/tmp/hoopsim-validation python scripts/validate-reconstruction.py
python scripts/record-gameplay.py --live --label apres --seed 8126 --seconds 30
```

Les commandes de mesure et d’enregistrement écrivent des preuves ; elles ne changent ni les sauvegardes GM ni les règles du match. Pour refaire le côté avant, utiliser la version `d6fe43f` dans un checkout distinct avec le même enregistreur et les mêmes paramètres.

## Données brutes

[Trois matchs avant](validation/gameplay-before.json) · [douze matchs après](validation/gameplay-after.json) · [campagne Chromium](validation/gameplay-browser.json) · [fin autonome et audio](validation/gameplay-finish.json) · [formats compatibles](validation/gameplay-watch-formats.json) · [capture avant](validation/gameplay-video-before.json) · [capture après](validation/gameplay-video-after.json) · [calibration de saison](validation/gameplay-calibration.txt).
