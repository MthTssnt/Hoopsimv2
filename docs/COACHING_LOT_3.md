# LOT 3 — Tactiques physiques et coaching dans Regarder

État : TERMINÉ pour le noyau du lot 3, avec les limites explicites ci-dessous. Livraison du 15 novembre 2026, à la suite des [lots 1–2](COACHING_LOTS_1_2.md). Les lots 4–6 ne sont pas commencés. L’état initial de cette reprise passait 412 tests, build et lint ; calibration : 112,4 points par équipe.

## 1. Ce qui fonctionne réellement

- Les plans transmis au match pilotent un interprète commun aux cinq IA d’une équipe : transition, placement, écran, roll/lecture, repli. Five-Out, Horns, high P&R, entrée au poste et isolation ont des placements et intentions distincts. Les rôles sont conservés après une passe et recalculés après un changement de cinq ou une nouvelle consigne.
- Les objectifs utilisent les mètres du terrain et le panier attaqué ; ils se reflètent à la mi-temps. Les personnages se déplacent par les entrées normales et la navigation existante, sans écrire leurs positions. Les passes restent de vraies passes vers des receveurs présents et sont contrôlées par les règles de trajectoire/interception existantes.
- Le screener rejoint un point près du défenseur, ralentit et plante ses appuis. Le porteur le contourne lorsqu’il est prêt. Les collisions massiques et le contournement des corps existants créent l’obstacle : aucune prime statistique d’écran n’est ajoutée. Le partenaire roule ensuite vers le cercle, avec repli si le système échoue.
- Individuelle conserve les duels ; switch échange les responsabilités du défenseur du porteur et de celui du screener près d’un écran planté, une fois par séquence ; drop fait protéger la peinture au défenseur de l’intérieur. Aide et pression modifient les positions, la pression augmente aussi la fatigue de façon bornée. Le rebond offensif change le nombre de joueurs envoyés au rebond.
- Dans Regarder → Pause : changer attaque/défense, rythme/priorités, système, créateur ciblé, charger une variante, envoyer les consignes, demander un cinq. Les commandes sont tracées avec leur attente/application/annulation. Les rotations automatiques indiquent leur contexte de décision.
- Les consignes attendent la fin d’un tir, d’une passe, d’un saut ou d’une série de lancers avant de modifier les fiches utilisées. Le cinq attend un arrêt légal, hors geste et hors lancers ; une demande devenue impossible est annulée. Le porteur, le ballon et les statistiques ne sont pas réassignés par une commande.
- En Jouer, les pensées de l’IA du joueur sélectionné sont toujours remplacées par ses commandes selon le chemin existant. Le panneau coach de Regarder n’est pas affiché. « Simuler la fin » continue le même monde physique et enregistre son résultat réel une seule fois.

## 2. Fichiers créés/modifiés et justification

- `match/tactics/director.ts` : sélection du play à partir du contrat partagé, machine d’états, formations, intentions et politiques défensives ; comptage diagnostique borné par les séquences du match.
- `match/tactics/coaching.ts` et `match/ui/MatchCoaching.tsx` : contrats de commandes, photo de pause et formulaire de coaching.
- `match/ai/playerAi.ts`, `teamPlay.ts`, `rebounding.ts` : adaptation des décisions existantes ; les parties sans plan conservent leurs anciennes séquences.
- `match/world/MatchWorld.ts`, `world/rotation.ts` : file de consignes, application sûre, substitutions par le mécanisme existant, fatigue de pression et remise à zéro du contrôleur entre modes.
- `MatchScene.ts`, `PhaserGame.tsx`, `MatchPause.tsx`, `ui/App.tsx` : événements pause/commande/accusé de réception et variantes ; abonnements de scène nettoyés à l’arrêt.
- `engine/gamePlan.ts` : validation réutilisable avec l’identité et l’effectif du match, sans fabriquer une équipe de ligue complète.
- `engine/coaching/analytics.ts`, `match/gameResult.ts`, `ui/TacticalReport.tsx` : dernières consignes appliquées, nom du plan initial, observations et chronologie du match conservés dans sa feuille.
- `match/tactics/director.test.ts` : géométrie, miroir à la mi-temps, rôles après passe, écrans, replis, switch/drop, gestes en cours, lancers, rejets et réinitialisation.
- `scripts/validate-live-tactics.ts`, `scripts/smoke-live-coach.py` : campagnes et parcours navigateur reproductibles. README, GAMEPLAY_SPEC et ROADMAP décrivent le comportement courant.

Les sprites, atlas, terrain, caméra, physique de balle/collision et touches ne sont pas modifiés.

## 3. Décisions d’architecture / compromis

Le moteur rapide et le terrain utilisent `prepareTactics`/`resolvePossessionTactics` pour la signification du plan : sélection pondérée, porteur/usage, opportunités de tir et propension à passer. Le terrain traduit ces intentions en destinations et entrées physiques ; il ne reçoit pas un score prédéterminé. Son générateur de séquence est dérivé du match, de la possession, du cinq et de la révision du plan, sans `Math.random()`.

Le contrôleur avance au plus une fois par pas du monde pour les dix IA ; la lecture de son diagnostic dans l’inspecteur ne le fait pas avancer. Les systèmes ont une durée maximale et abandonnent sous six secondes de chrono utile. Une occasion évidente, un tir, une perte ou une intervention humaine peut interrompre leur développement. Le système ne force jamais cinq trajectoires synchrones.

Les consignes en match sont locales au monde courant : le plan de carrière reste inchangé, et les instantanés du coup d’envoi ne sont pas réécrits. Une variante contenant des joueurs absents de l’effectif préparé pour ce match est refusée ; le coach peut choisir parmi les membres disponibles de ce match. La demande de cinq est une commande distincte de l’envoi d’un plan, afin de rendre explicite son application à un arrêt.

Les observations physiques comptent les séquences démarrées, fenêtres d’écran planté à proximité d’un défenseur, intentions de coupe, replis et switches. Elles ne sont pas présentées comme des écrans réussis ou des points causés par un système. Les possessions physiques restent estimées et la répartition cercle/mi-distance reste indisponible dans ce rapport ; les tableaux ne fabriquent pas ces données.

## 4. Commandes exécutées et résultats

- `npm run build` : réussi, avertissement habituel sur la taille du chunk Phaser.
- `npm run lint` : réussi.
- `npm test` : 45 fichiers, **424 tests réussis**. Aucune assertion préexistante abaissée ni test désactivé.
- `npm run calibrate` : 1 230 matchs, 112,4 points/équipe, FG 47,9 %, 3 pts 35,4 % ; moteur rapide équilibré inchangé.
- `npm run validate:gameplay -- --output=/tmp/hoopsim-gameplay-lot3.json` : trois graines terminées avec les invariants du script (chemin sans plans explicites conservé).
- `npx tsx scripts/validate-live-tactics.ts` : **30 matchs physiques complets**, cinq systèmes × deux graines de ligue × individuelle/switch/drop, quarts d’une minute. Tous terminent, positions/vitesses finies, somme des points des joueurs égale au score, aucun saut de position non légal (>0,5 m en un pas) dans le jeu continu. Déplacement maximal observé : environ **0,067 m** par pas.

La campagne `validate-coaching.ts` a aussi été relancée après intégration : huit matchs complets sur deux durées. Pour des cibles 6/36 minutes, les moyennes équivalentes sont 8,14/31,16 à 1 min/quart et 8,81/31,88 à 3 min/quart ; le test de sensibilité et les invariants réussissent. Cela ne promet pas l’égalité exacte des minutes en présence de fatigue, fautes et fin de match.

Les prélèvements de positions sont effectués toutes les 0,2 seconde, sans interpolation graphique. Ils ne constituent pas des possessions indépendantes :

| Système | Prélèvements avec ≥3 joueurs près des destinations | Fenêtres d’écran planté | Intentions de coupe |
| --- | ---: | ---: | ---: |
| Five-Out | 415 | 0 | 69 |
| Horns | 861 | 22 | 63 |
| High P&R | 918 | 17 | 67 |
| Entrée au poste | 883 | 0 | 0 |
| Isolation | 494 | 0 | 0 |

La campagne compte 310 prélèvements avec cinq joueurs réellement derrière l’arc en Five-Out et 289 avec les deux intérieurs simultanément près des elbows en Horns. Deux switches de proximité sont observés dans cet échantillon ; leur rareté n’est pas masquée et ne constitue pas une calibration complète des couvertures. Les tests géométriques vérifient séparément qu’un switch valide permute les responsabilités sans doublons et que man/drop gardent leurs politiques distinctes.

## 5. Démonstrations réellement exécutées

1. **Regarder et coach** : onglet Tactiques → Horns → enregistrer → Regarder → attendre la préparation → Pause → choisir Five-Out/Pace & Space/Switch et rythme 80 → Envoyer les consignes → changer un membre du cinq → Demander ce cinq → Reprendre → Pause pour constater l’application → Simuler la fin → Analyse tactique. Chromium confirme la fin du vrai match, les consignes dans sa feuille et le plan de carrière conservé. Aucun `pageerror`.
2. **Formations** : Chromium, carrière graine 31, inspecteur au pas fixe (`?atelier&qt=1`), vrais pas de jeu jusqu’à atteindre des placements, puis captures de Horns et Five-Out. Les corps étaient effectivement proches d’au moins trois destinations ; aucune position n’est déplacée par le banc navigateur.
3. **Jouer** : vraie scène GM en mode Jouer ; après l’entre-deux, touche Z pendant 0,9 s. Le joueur contrôlé s’est déplacé d’environ 2,17 m. Pause/reprise fonctionne, le panneau coach n’apparaît pas, aucune erreur JavaScript. Ce contrôle n’équivaut pas à un test exhaustif de chaque touche/manette.

Captures locales sous `/tmp/hoopsim-evidence/`. Le parcours coach peut être relancé avec `python scripts/smoke-live-coach.py` lorsque Vite écoute sur 127.0.0.1:5173, avec Playwright Python et Chromium système disponibles.

## 6. Régressions investiguées et limites connues

- Première campagne : le porteur contournait l’écran avant l’arrivée du screener et du mauvais côté. Correction de l’attente, du sens du contournement et de l’arrêt des appuis. Les fenêtres physiques mesurées apparaissent ensuite ; aucun bonus au tir n’a servi à masquer le problème.
- Le nouvel arrêt sur écran affectait aussi une séquence historique sans plan : un test de contrôle dépassait sa limite de pertes (26,2 % au lieu de <25 %). La règle a été restreinte aux plans explicites ; le test initial passe sans changer son seuil.
- Les premiers essais de capture sur une carrière aléatoire n’ont pas trouvé Five-Out dans la fenêtre retenue. Le contrôle visuel a été repris avec la graine 31 et des prélèvements plus rapprochés, sans modifier les positions de jeu. La campagne physique conserve des assertions de placement indépendantes.
- Les écrans/coupes restent opportunistes et peuvent échouer. La réussite d’une passe et le tir ne sont pas garantis par le playbook. Les mesures ci-dessus ne prouvent ni une efficacité offensive supérieure ni une absence d’exploit sur tous les réglages.
- Pas de zone, press ni temps mort artificiel. Le monde n’avait pas de contrat de temps mort sûr ; aucun bouton factice n’a été ajouté. L’affectation individuelle d’un défenseur à un adversaire précis reste à développer ; les politiques actuelles utilisent les postes et les switches mesurés.
- L’équilibrage physique prolongé sur plusieurs durées, les réglages d’efficacité des couvertures et l’UX avancée restent des sujets du lot 6. Le marché n’est pas branché sur une tactique instable ou un résultat de match inventé.

## 7. Suite

État lors de cette livraison : le prochain chantier était le **lot 4** : transactions atomiques, marché, contrats et agents libres, avec invariants et IA minimale. La reconduction automatique des contrats n’est pas supprimée avant que ses parcours de remplacement soient prêts. Les lots 5–6 (draft/développement, finition et équilibrage) restent à faire.

Les relevés de cette tranche sont conservés dans [validation/coaching/lot3](validation/coaching/lot3/), en plus des rapports précédents. Aucun paquet ajouté et aucune publication/déploiement effectué par cette tranche.

Suite livrée : [lot 4 — marché et contrats](MANAGEMENT_LOT_4.md).
