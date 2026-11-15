# LOT 6 — Équilibrage, finition et acceptation finale

État : **TERMINÉ pour le périmètre livré des lots 0–6**, 15 novembre 2026.
Suite du §19 du document fourni. Les options explicitement différées restent listées ci-dessous ; ce bilan ne promet pas l’absence universelle d’exploit.

## 1. Ce qui fonctionne réellement

- La valeur de marché ne monte plus quand on diminue artificiellement le niveau d’un joueur à âge, potentiel et contrat constants. L’évaluation conserve projet, jeunesse, blessure et risque contractuel.
- Les coaches CPU choisissent leur style selon un **atout relatif** du cinq, évitant une convergence automatique vers Pace & Space dès qu’un seuil de tir est atteint. Les six styles restent disponibles au joueur, avec leurs effets propres.
- Les signatures retirent réellement les anciens champs d’agent libre et les marqueurs de contrats remplacés ; la transaction conserve l’identité des objets et reste atomique.
- Les carrières longues, tactiques appariées et matchs physiques sont vérifiés séparément. Les minutes équivalentes et les points réellement marqués restent distincts ; les scores physiques ne sont jamais remplacés par un résultat rapide.
- Effectif, Tactiques, Marché et Développement restent utilisables à **1 280, 768 et 390 px**, sans débordement horizontal de la page. Les tableaux défilent dans leur propre zone, accessible au clavier. Les contrôles de formulaire et le focus sont plus lisibles ; l’onglet actif reste visible après sélection ou redimensionnement.
- Un échec d’enregistrement est maintenant visible. **Exporter la partie** récupère l’état actuel en mémoire, même s’il n’a pas pu être sauvegardé ; **Réessayer** tente un nouvel enregistrement. Une sauvegarde corrompue affiche une erreur et son contenu reste intact.
- Les années des prolongations sont explicites, y compris entre draft et lancement. L’import vérifie aussi l’ordre, la numérotation, les propriétaires, les sélections et le réservoir d’une draft suspendue.

## 2. Fichiers et justification

- `src/engine/management/economy.ts` : correction de la valeur future absolue, à la place d’un écart de croissance exploitable.
- `transactions.ts` : commit des suppressions de champs, style CPU fondé sur les forces relatives, motif de fermeture pendant la draft et année de prolongation.
- `src/engine/development/migrate.ts` : invariants complets de la draft persistée.
- `src/engine/releaseQuality.test.ts` : huit nouveaux tests de monotonie, commit, annulation après validation tardive, style, stockage et import ; aucun seuil sportif existant abaissé.
- `src/state/store.ts`, `src/ui/{App,NewGameScreen,saveBackup}.tsx/ts` : erreurs visibles, réessai, export de l’état en mémoire, chargement qui préserve l’état existant en cas d’erreur.
- `src/styles.css`, `ui/tabs/{MarketTab,DevelopmentTab}.tsx`, `PlayerModal.tsx` : petits écrans, clavier et dates contractuelles.
- `scripts/calibrate-franchise.ts` : trente saisons, distributions, favoris, économie, stockage, invariants et recharge. `calibrate-tactics.ts` accepte un instantané vieilli et choisit alors deux clubs CPU de forces proches.
- `scripts/check-release-metrics.ts` : garde-fous sur les résultats effectivement mesurés. `smoke-release.py` : petit écran, clavier réel, erreurs de stockage et résultat physique unique. README, GAMEPLAY_SPEC et ROADMAP décrivent la livraison.

## 3. Décisions et compromis

### Correction économique

L’ancien terme de croissance pouvait donner, en reconstruction, **71,8** à une note 40 contre **35,8** à une note 80 (20 ans, potentiel 90, 1 M€ sur trois ans). Les mêmes cas valent désormais **54,7 / 74,7**. Les tests parcourent quatre projets, quatre âges et trois potentiels pour vérifier la monotonie à contrat constant. Cela ne signifie pas que tout joueur mieux noté vaut davantage si son âge, son salaire ou son risque diffèrent.

Le plafond initial de **250 M€ minimum**, adapté aux plus gros contrats hérités et conservé dans la sauvegarde, n’est pas abaissé rétroactivement. La campagne vérifie les engagements futurs et l’exception de secours du lot 4. La difficulté économique reste simplifiée ; il n’y a ni revenus ni CBA reproduite.

### Équilibre des styles

Les seuils absolus du coach choisissaient presque systématiquement Pace & Space après progression. Désormais, un axe doit dépasser les autres d’au moins deux points, en plus du seuil existant, pour recommander Pace & Space, Motion ou Inside-Out ; sinon le coach garde Équilibré. Aucun coefficient de réussite au tir, sprite, input ou moteur physique n’est changé. Le joueur peut toujours utiliser Pick & Roll et Isolation ; les CPU ne choisissent pas automatiquement les six styles à parts égales.

Les résultats avant/après portent sur les mêmes graines initiales, mais les transactions et effectifs divergent ensuite : ils décrivent l’effet de la livraison complète, pas un effet causal isolé du seul coach. Les confrontations tactiques utilisent séparément graines appariées, aller-retour et permutation des effectifs.

Le contrat commun reste `GamePlan` → `prepareTactics` / `resolvePossessionTactics` (`engine/coaching/tactics.ts`). Le moteur rapide interprète les lectures en durée de possession, choix du créateur, passes et zones ; `match/tactics/director.ts` traduit les mêmes systèmes en destinations, écran/roll, coupes, repli et responsabilités défensives. Five-Out favorise ainsi l’espace extérieur dans les deux moteurs, mais seul le monde physique déplace réellement cinq corps. Les commandes de pause sont locales au match et attendent les fenêtres sûres. Les campagnes rapides et les arrivées physiques mesurées ci-dessous vérifient ces deux interprétations sans imposer des scores identiques.

## 4. Commandes et mesures

Baseline : build, lint et **456 tests** réussis. Calibration graine 12345 : 115,5 points, FG 48,0 %, 3 points 35,7 %.

Validation finale :

- `npm run build`, `npm run lint`, `npm test` : **464 tests, 48 fichiers**, réussis ; avertissement connu sur le chunk Phaser.
- `npm run calibrate` : 1 230 matchs, **112,6 points**, FG **48,3 %**, 3 points **35,5 %**, 36,4 % des tirs à 3 points, 24,8 passes, 12,5 pertes. L’écart avec la baseline vient des décisions GM et styles CPU ; les probabilités de tir ne changent pas.
- `npx tsx scripts/calibrate-franchise.ts --snapshot=/tmp/hoopsim-aged-league.json` : **36 900 matchs réguliers + 2 373 matchs de playoffs**, trois graines × dix saisons, trente transitions, invariants et recharges. Baseline sur le même scénario : 36 900 + 2 407 matchs.
- `npx tsx scripts/calibrate-tactics.ts --output=/tmp/hoopsim-lot6-tactics.json` : **6 480 matchs appariés**, trois graines, six styles. Taux de victoire du round-robin : **44,9–54,8 %** selon style.
- `npx tsx scripts/calibrate-tactics.ts --fixture=/tmp/hoopsim-aged-league.json --output=/tmp/hoopsim-lot6-tactics-aged.json` : **2 160 matchs**, effectifs de 2036 ; clubs SAS/PHX, forces projetées 79,74/79,85. Taux de victoire : **46,0–56,0 %**. Un premier essai utilisait Boston très affaibli face à un club CPU : le niveau écrasait l’effet des styles ; la comparaison finale utilise des forces proches.
- `npx tsx scripts/check-release-metrics.ts` : trente saisons dans les garde-fous de régression (100–125 points, FG 40–56 %, 3 points 25–45 %, favoris >55 %), tous les styles dans 30–70 % pour les deux round-robins. Ces intervalles sont des garde-fous issus du projet, pas des cibles NBA ni des preuves universelles.
- `validate-live-tactics.ts` : **30 matchs physiques complets**, cinq systèmes × deux graines × trois défenses, quarts d’une minute. Déplacement maximal continu **0,06682 m par pas**, corps finis, scores cohérents. Five-Out : 310 observations avec cinq joueurs derrière l’arc ; Horns : 289 avec les deux intérieurs aux elbows. Fenêtres d’écran : 22 Horns, 17 high P&R ; intentions de coupe : 69/63/67 en Five-Out/Horns/P&R. **Deux switches** observés : comportement existant mais rare dans cet échantillon.
- `validate-coaching.ts` : **huit matchs physiques**, deux durées, sensibilité des minutes cibles et comptabilité réussies.
- `npm run validate:gameplay -- --output=/tmp/hoopsim-lot6-gameplay.json` : trois graines, matchs à trois minutes par quart terminés, score/box score cohérents, contrôles physiques historiques réussis.
- `python scripts/smoke-release.py`, `smoke-live-coach.py`, `smoke-market.py`, `smoke-development.py` : parcours Chromium réussis, aucune erreur JavaScript non gérée.

| Indicateur, plage des moyennes saisonnières sur 30 saisons | Avant lot 6 | Après lot 6 |
| --- | ---: | ---: |
| Points par équipe | 117,9–135,6 | 111,7–117,6 |
| Possessions comptées | 102,1–117,3 | 94,9–99,8 |
| FG | 46,8–48,2 % | 48,7–51,8 % |
| Part des tirs à 3 points | 39,8–50,8 % | 25,8–35,1 % |
| Réussite à 3 points | 35,6–37,5 % | 35,6–37,4 % |
| Pertes de balle | 12,7–15,3 | 11,9–12,8 |
| Victoires des favoris | 68,5–81,4 % | 70,5–80,1 % |

Moyenne globale des points : **130,60 → 113,23**. Un favori désigne ici le club dont la force de rotation projetée avant la journée dépasse celle de l’autre d’au moins trois points. Les scores individuels, prolongations comprises, restent plus dispersés que les moyennes saisonnières.

Les contrats, 13–15 joueurs par club, cinq apte quand disponible, plans, numéros, propriété unique et non-réutilisation des IDs historiques sont vérifiés. Les dix bilans détaillés et le journal de 200 opérations restent bornés. Le plus gros relevé de sauvegarde est **1 910 781 caractères JSON** en cours de saison ; les agents libres atteignent 299–317 à la fin de la dixième saison observée. Aucun joueur n’est supprimé pour embellir ces chiffres. La stationnarité sur plusieurs décennies et les quotas de tous les navigateurs ne sont pas démontrés.

Relevés conservés sous [validation/release/lot6](validation/release/lot6/).

## 5. Parcours réellement exécutés et acceptation §17

Dans Chromium, les menus ont été visités aux trois largeurs ; un tableau a défilé avec la flèche droite. Le test de quota simule `QuotaExceededError` au point d’écriture `Storage.setItem` (sans injecter de message dans React), vérifie que l’ancienne sauvegarde est intacte, télécharge la partie en mémoire puis réussit le réessai. L’import JSON corrompu reste intact et son erreur est visible.

Le parcours **Jouer** lance un vrai match GM et vérifie les entrées natives Z/Q/S/D, E, A et relâchement Espace dans l’enregistreur physique existant. Le joueur se déplace, la pause/reprise fonctionne, la fin physique produit un seul résultat comptable. Le parcours **Regarder** envoie un plan et un cinq en pause, constate leur application différée puis conserve le rapport et le plan de carrière. Marché et Développement sont également rejoués après les corrections.

| Critère d’acceptation | Preuve exécutée |
| --- | --- |
| 1. Cinq et minutes 240/240 | `gamePlan.test.ts`, `coaching.test.ts`, campagne de huit matchs |
| 2. Fatigue, fautes, blessures et fin de match | tests de rotation et monde physique, minutes à deux durées |
| 3. Transfert absent de l’ancien effectif et plan | `market.test.ts`, parcours marché Chromium |
| 4. Plans conservés après recharge et intersaison | `planLibrary.test.ts`, campagnes de carrière |
| 5. Styles rapides mesurables | `tactics.test.ts`, 6 480 + 2 160 matchs appariés |
| 6. Five-Out et Horns reconnaissables | 30 matchs, arrivées physiques et observations géométriques |
| 7. Écrans, coupes, réactions défensives | fenêtres plantées, coupes et switches mesurés, tests du directeur |
| 8. Man, switch, drop distincts | tests géométriques et campagnes sur les trois politiques ; switch rare signalé |
| 9. Coaching depuis la pause | `smoke-live-coach.py`, événement d’application et cinq à arrêt légal |
| 10. Clavier jouable conservé | `smoke-release.py`, entrées natives, déplacement, pause/reprise et résultat |
| 11. Conseil fondé sur le roster | tests du scouting et des presets, Tactiques sur vrais effectifs |
| 12. Rapport sans statistiques inventées | compteurs rapides/physiques, estimations étiquetées, score égal aux lignes |
| 13. Recherche, offre et refus compréhensible | parcours marché, filtres et aperçu du moteur |
| 14. Transaction atomique | tests de refus sans mutation, succès unique et suppression de champs |
| 15. Expiration, prolongation, agents libres | tests marché, parcours navigateur, trente transitions |
| 16. Clubs CPU actifs selon leur projet | fenêtres GM, choix de draft, projets annuels et tests de préférence |
| 17. Draft/progression sur plusieurs saisons | dix saisons par graine, trois graines, invariants et recharges |
| 18. Migration des anciennes carrières | tests de migration, plans et marché ; erreurs d’import conservant la sauvegarde |
| 19. Tests et build | 464 tests, build/lint et campagnes réussis |
| 20. Identité graphique, contrôles et résultats | aucun asset modifié ; matchs physiques et Chromium, résultat unique |

Ces critères sont validés dans les scénarios cités, pas par une promesse de couverture exhaustive de tout matériel ou réglage.

## 6. Régressions investiguées et limites connues

- L’inversion de valeur de marché et les champs supprimés non répercutés au commit sont corrigés avec tests.
- La dernière campagne de tests a aussi dépassé les 5 s du test de quatre intersaisons (5,815 s, sans échec d’assertion). Les transactions copiaient inutilement calendrier, feuilles et historique : la copie est maintenant limitée aux équipes/joueurs touchés, au journal et au feed ; les autres données sont un contexte en lecture seule. Un test injecte un refus de validation après préparation et vérifie que toute la ligue reste identique. Les 464 tests passent ensuite sans relever les délais. La mesure isolée du test de quatre intersaisons prend 789 ms (commande avec `--testNamePattern`, distincte de la suite complète sans tests ignorés). La campagne de trente saisons relancée sur cette version réussit avec les mêmes trente relevés sportifs et économiques. Un seul relevé de stockage diminue de 140 caractères avec le nouveau libellé des années de prolongation ; les résultats et finances restent identiques.
- La dérive des saisons longues est corrigée par les recommandations CPU, sans réécriture des tirages sportifs. Inside-Out reste fréquent dans les effectifs de fin de campagne ; aucune répartition égale des styles n’est imposée artificiellement.
- Les premières tentatives navigateur ont échoué sur des sélecteurs ambigus (même libellé dans la barre et le panneau). Les scripts ciblent désormais la bonne zone ; aucune règle produit n’a été assouplie.
- Les moteurs rapide et physique partagent la signification des consignes, tout en gardant leurs mécanismes et durées. Les distributions physiques sont mesurées séparément ; les points bruts d’un match court ne sont pas assimilés à une rencontre rapide de 48 minutes.
- Switch reste rare dans l’échantillon ; son efficacité générale n’est pas calibrée comme une simulation professionnelle. L’assignation manuelle d’un défenseur à un joueur précis, zone, press et temps mort coach artificiel restent absents.
- Picks non négociables, scouting fixe, économie fictive, psychologie/staff absents : aucun bouton ne prétend proposer ces options. L’export JSON est disponible ; un nouveau parcours d’import de fichier n’est pas ajouté.
- Le test clavier ne garantit pas chaque combinaison de touche, manette ou appareil. Les contrôles physiques existants et leurs tests restent inchangés. La fluidité à 60 fps sur tout matériel n’est pas garantie par un test Chromium headless.
- Les anciens noms déjà perdus avant les instantanés historiques ne sont pas inventés. Les bilans sont limités à dix saisons et le journal à 200 opérations ; les données physiques non mesurées restent indiquées comme indisponibles.

## 7. Suite

L’ordre des **lots 0 à 6** du §19 est achevé pour ce périmètre. Les extensions ci-dessus sont des évolutions futures, distinctes de la livraison actuelle. Les relevés permettent de reproduire les vérifications ; aucun paquet ni asset tiers n’a été ajouté.
