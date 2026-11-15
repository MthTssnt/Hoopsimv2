# LOT 4 — Marché, contrats et agents libres

État : **TERMINÉ pour le périmètre minimal du lot 4**, 15 novembre 2026.
Suite du §19 du document fourni, après les [lots 0–2](COACHING_LOTS_1_2.md) et le [lot 3](COACHING_LOT_3.md). Les lots 5–6 restent à développer.

## 1. Ce qui fonctionne réellement

- **Marché → Joueurs et agents libres** : rechercher par nom, club/libre, poste, âge, salaire/demande, potentiel, valeur de négociation et liste des transferts ; ouvrir une fiche, définir le statut de ses joueurs et commencer une offre.
- **Transferts** : composer un échange de un à trois joueurs par côté ; voir les salaires, les engagements futurs et les raisons d’accord/refus ; appliquer une offre acceptée. Les deux effectifs, propriétaires, numéros et plans actifs sont réparés ensemble, avec une seule transaction enregistrée. Statistiques et contrats suivent le joueur.
- **Contrats** : signer un agent libre, choisir salaire/durée/rôle promis, prolonger un contrat dans sa dernière année. Une prolongation commence la saison suivante ; elle ne remplace pas le salaire courant. Un contrat non prolongé expire réellement. La fiche distingue rôle promis, rôle tactique et minutes prévues.
- **Budget et projet** : consulter plafond, masse salariale et cinq exercices d’engagements ; choisir titre/compétitif/réorganisation/reconstruction. La valeur dépend de l’âge, du potentiel, du contrat, de la blessure et du projet de la franchise qui reçoit l’offre.
- Les **29 autres clubs** négocient des prolongations, recrutent, échangent et peuvent adresser des offres au joueur. Leurs plans tactiques sont recalculés après mouvement d’effectif. L’historique et le fil rendent les opérations visibles.
- Les carrières existantes gardent leur clé de sauvegarde et leurs données sportives. Les opérations sont bloquées pendant un match physique ou une action du store en cours.

## 2. Fichiers et justification

- `src/engine/management/{types,economy,state,transactions,aiGm}.ts` : modèle versionné, économie pure, initialisation/migration, journal, évaluations et transactions atomiques, fenêtres CPU.
- `src/engine/{types,index,generate,migrate,simSeason,offseason}.ts` : branchement dans la carrière, génération indépendante du marché, véritables expirations, draft existante conservée sous budget, secours explicites.
- `src/engine/gamePlan.ts` : libellés français des rôles, réutilisés dans les transactions.
- `src/state/store.ts` : commandes de marché contrôlées, refus sans sauvegarde, succès enregistré une fois, offres reçues réévaluées avant acceptation.
- `src/ui/tabs/MarketTab.tsx`, `App.tsx`, `Dashboard.tsx`, `PlayerModal.tsx` : recherche, offres, contrats, finances, historique et avertissement de fin de saison.
- `src/engine/management/market.test.ts` : 15 tests de migration, valeur, atomicité, refus, contrats, exceptions, IA et store. `engine.test.ts` actualise les invariants d’appartenance pour les vrais agents libres et la précondition d’intersaison ; aucun test désactivé.
- `scripts/validate-management.ts`, `smoke-market-fixture.ts`, `smoke-market.py` : neuf saisons/transitions et parcours Chromium reproductibles. README, GAMEPLAY_SPEC et ROADMAP décrivent le comportement livré.

## 3. Architecture et compromis

### Économie fictive

Unité : **M€ par saison**. Plafond initial : maximum de 250 M€ et de la plus grosse masse salariale héritée, arrondie à la dizaine supérieure. Il est conservé dans la sauvegarde. Ce choix préserve les contrats existants sans inventer une CBA NBA : sur les graines 31/8126/919/12345, les masses maximales initiales sont 204,5/224,9/192,0/217,6 M€, pour des médianes 109,5/116,8/111,3/111,1 M€. Le plafond laisse donc de la marge ; sa difficulté économique reste à calibrer au lot 6.

Nouveaux contrats : **0,8–60 M€**, par dixième, **1–4 ans**. Les anciens contrats sous 0,8 M€ sont conservés et identifiés jusqu’à leur expiration ; les rookies sont désormais au moins à 0,8 M€. Effectif : **13–15 joueurs**, objectif CPU 14. Les engagements futurs incluent les prolongations déjà signées.

L’exception budgétaire est limitée à un renfort de secours identifié, faible (note ≤58), à 0,8 M€ pour un an, uniquement pour atteindre 13 joueurs. Elle ne finance ni star ni quatorzième joueur. Le club utilisateur reçoit seulement ces secours si nécessaire, sans renouvellement automatique de ses anciens titulaires.

### Transactions et temps

Les aperçus sont purs. Une transaction est préparée sur une copie, puis validée (propriété, limites d’effectif, postes, cinq aptes pour un échange, budgets et plan actif) avant toute écriture. Les objets des joueurs/équipes existants gardent leur identité. Les variantes sauvegardées restent des copies réparées lors de leur chargement ; le plan actif exclut immédiatement les partants.

Échanges : ouverts en saison régulière jusqu’aux trois quarts du calendrier et pendant l’intersaison, fermés en playoffs. Signatures/prolongations : fermées en playoffs. Le même écran d’intersaison sert de fenêtre explicite de renouvellement avant **Lancer la saison**. Ensuite vieillissement/retraites, activation ou expiration, draft historique et recrutement CPU/secours sont exécutés au passage de saison. Les agents libres restants peuvent être signés en saison régulière. Ce n’est pas une enchère simultanée ni une nouvelle sous-phase de calendrier.

Fenêtres CPU tous les 28 jours, au plus quatre échanges CPU par fenêtre, un passage par équipe, au plus cinq offres reçues en attente. Les offres expirent après 14 jours et sont réévaluées à l’acceptation. Un marqueur persistant empêche de rejouer la même fenêtre après recharge. Les CPU renouvellent au plus deux joueurs pertinents en intersaison et réévaluent leur projet annuellement. Génération/ordre du marché utilisent des graines dédiées ; le RNG sportif n’est pas consommé par l’import.

Le journal conserve les **200 dernières opérations** avec identifiants monotones. Un compteur persistant de joueurs empêche de réutiliser l’identifiant d’un retraité encore cité dans l’historique. Les agents libres ont un contrat nul, sans appartenir à aucun effectif.

## 4. Commandes et résultats

- `npm run build` : réussi ; avertissement existant sur le chunk Phaser volumineux.
- `npm run lint` : réussi.
- `npm test` : **439 tests réussis, 46 fichiers**, dont 15 tests de marché.
- `npm run calibrate` : 1 230 matchs réguliers, 82 par équipe ; **115,5 points**, FG **48,0 %**, 3 points **35,7 %**, part de tirs à 3 points **39,5 %**, passes **26,0**, pertes **12,7**. Avant le lot : 112,4 points, FG 47,9 %, 3 points 35,4 %. Les échanges CPU et les plans recalculés changent désormais les saisons ; ce résultat n’est pas présenté comme inchangé.
- Contrôle apparié sur le même code/graine 12345, en renseignant `lastAIWindow` avant chaque journée pour ignorer uniquement les fenêtres GM : **112,4 points**, FG 47,9 %, 3 points 35,4 %, identiques au niveau de départ. Cela isole l’effet des décisions GM/plans recalculés ; aucune probabilité sportive n’a été ajustée dans ce lot.
- `npx tsx scripts/validate-management.ts` : **11 785 matchs réels**, trois graines (31, 8126, 919), trois saisons complètes avec playoffs chacune, **neuf transitions**. Appartenance unique, contrats, effectifs 13–15, numéros uniques, budgets/engagements, plans actifs, comptabilité des points et recharge vérifiés. Le double passage d’intersaison est refusé sans mutation. Rapport : `/tmp/hoopsim-management-campaign.json` par défaut, ou `--output=...`.
- `python scripts/smoke-market.py` : Chromium système, Vite sur 127.0.0.1:5173, Playwright Python disponible. Refus sans mutation, transfert unique, salaire invalide refusé, signature libre, prolongation différée, recharge, historique puis vrai match regardé avec les nouveaux joueurs. Aucune erreur JavaScript.

| Graine | Agents libres après 1 / 2 / 3 transitions | Masse maximale après 3 transitions | Opérations cumulées |
| --- | --- | ---: | ---: |
| 31 | 75 / 127 / 170 | 180,3 M€ | 728 |
| 8126 | 70 / 125 / 172 | 207,9 M€ | 718 |
| 919 | 75 / 122 / 168 | 202,8 M€ | 749 |

Les journaux et le JSON sont conservés sous [validation/management/lot4](validation/management/lot4/). Les nombres de trades « retainedTrades » du JSON concernent uniquement les 200 dernières opérations, pas tous les échanges de la saison.

## 5. Démonstration exécutée et reproduction

Le script navigateur crée une vraie carrière Boston, graine 31, et cherche les offres selon le moteur courant, sans fabriquer leur acceptation :

1. Marché → Transferts : Ali Strand contre Valentin Crosby (NYM), refus expliqué et sauvegarde identique.
2. Ali Strand contre Oscar Hájek : échange accepté, propriété modifiée des deux côtés, une seule entrée au journal.
3. Agents libres → Adrian Dudek : 0,5 M€ refusé sans écriture, puis demande normale acceptée.
4. Contrats → Oscar Hájek : prolongation signée, contrat courant inchangé, engagement futur présent.
5. Recharger → Transactions : les trois opérations persistent ; lancer Regarder avec l’effectif modifié, ouvrir la pause puis terminer le match physique et vérifier les points de la feuille.

Pour tester manuellement les expirations : finir la saison et les playoffs, ouvrir Marché avant Lancer la saison, prolonger un joueur et en laisser un autre sans accord ; au passage de saison, le premier active sa prolongation, le second quitte le club (il peut être recruté ailleurs). Les éventuels renforts minimaux sont explicitement tracés.

## 6. Régressions et limites connues

- Les premières vérifications ont identifié deux attentes historiques devenues fausses : « tout joueur appartient à un club » et l’appel d’intersaison hors phase. Elles sont remplacées par des invariants plus précis, avec conservation des contrôles sportifs.
- La première campagne a signalé les anciens contrats à 0,6 M€ ; ils sont préservés et identifiés, et le minimum des nouveaux rookies est corrigé. Aucun ancien salaire n’est réécrit silencieusement.
- Une relance de la suite en parallèle du build, de la calibration et de Chromium a dépassé les 5 s du test de quatre intersaisons (6,05 s), sans échec d’assertion. La suite relancée seule réussit (438/438), puis 439/439 en 21,61 s avec le test supplémentaire des offres CPU ; aucun seuil n’est relevé.
- Aucun sprite, terrain, contrôle ou moteur physique modifié dans ce lot. La préparation et la pause d’un match regardé après transfert/signature passent ; les tests physiques existants restent actifs.
- La valeur et l’acceptation sont déterministes et simplifiées. Pas de picks échangeables, protections, libérations, clauses, concurrence d’offres ou moral simulé ; le rôle promis est visible et validé à la signature, sans effet psychologique artificiel.
- Le réservoir libre augmente sur ces trois années (168–172 joueurs à la fin). Les retraites existent, mais cette campagne ne démontre pas une taille stationnaire sur des décennies. La purge/archivage et les performances très longues restent à examiner.
- Le journal est borné ; il ne constitue pas un historique exhaustif de carrière. Les plans CPU changent après mouvements et leur politique est minimale, pas une IA GM avancée achevée.

## 7. Suite

**Lot 5** : draft interactive, modèle de choix/picks avant leur négociation, focus d’entraînement, développement et décisions GM/coach plus riches, rapports et historique. **Lot 6** : calibrage de la difficulté économique et des stratégies, saisons très longues, exploits, finition UX et validation complète de la checklist §17.
