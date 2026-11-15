# LOT 5 — Draft, développement et décisions de franchise

État : **TERMINÉ pour le périmètre du lot 5**, 15 novembre 2026.
Suite du §19 du document fourni et du [lot 4](MANAGEMENT_LOT_4.md). Le lot 6 reste à réaliser.

## 1. Ce qui fonctionne réellement

- **Développement → Entraînement** : choisir un focus par joueur, demander un conseil ou réinitialiser à Équilibré. Les journées réellement accumulées et les minutes équivalentes à 48 minutes restent visibles. Aucun clic ne modifie les attributs.
- **Développement → Draft** : après les playoffs et la fenêtre de prolongation, préparer une fois l’intersaison, consulter les **60 prospects avant le premier choix CPU**, filtrer leur poste et voir âge, note, attributs, potentiel estimé et marge d’incertitude. Faire avancer les CPU jusqu’à son tour, choisir n’importe quel prospect abordable, accepter le conseil, passer ou déléguer ses choix restants.
- La draft possède **deux tours et 60 choix identifiés**, avec club d’origine/propriétaire explicite. Les CPU choisissent selon leur projet, la qualité actuelle et future estimée, les besoins de poste et le budget. L’ordre et les décisions sont consultables. Le budget et l’effectif sont visibles au moment du choix.
- Recharger au milieu d’un tour reprend exactement au même choix. Les doubles clics portant un ancien identifiant de choix sont refusés. Après la draft, les non-sélectionnés deviennent agents libres ; le marché rouvre avant **Lancer la saison**.
- **Bilans de saison** : notes avant/après, focus dominant réellement entraîné, jours et minutes, bilan des trente clubs, masse salariale, âge et meilleur marqueur à la clôture ; choix et motifs de sa draft. Les noms archivés restent lisibles après une retraite.
- Les clubs CPU réévaluent annuellement leur projet à partir du bilan et de la maturité de l’effectif, expliquent la décision, adaptent leurs choix de draft, leur entraînement et leur plan actif. Le projet choisi par le joueur est conservé.

## 2. Fichiers et justification

- `src/engine/development/types.ts` : entraînement, scouting, choix identifiés, état d’intersaison et bilans.
- `draft.ts` : génération/scouting, évaluation budgétaire pure, choix effectif, CPU et conseil, finalisation des non-sélectionnés.
- `training.ts` : exposition au temps écoulé, six focus, conseil, progression annuelle bornée et relevé des changements.
- `reports.ts`, `migrate.ts` : instantanés limités et validation de la reprise sans rejouer une étape.
- `src/engine/{types,offseason,simSeason,migrate}.ts` : sous-étapes d’intersaison, branchement des jours d’entraînement et des minutes de développement, clôture idempotente, import compatible.
- `src/engine/management/{aiGm,economy,transactions,types}.ts` : projets expliqués, année contractuelle correctement décalée après expiration, gel du marché durant la draft. L’espace salarial de recrutement CPU est calculé une fois par club/candidat collectif plutôt que pour chaque joueur.
- `src/state/store.ts` : commandes contrôlées, un enregistrement par succès, protection du live et des choix périmés. `src/ui/tabs/DevelopmentTab.tsx`, `App.tsx`, `Dashboard.tsx`, `MarketTab.tsx`, `HistoryTab.tsx` : parcours, navigation et affichage des noms historiques.
- `development.test.ts` : 17 nouveaux tests. `scripts/validate-development.ts` et `smoke-development.py` : campagne longue et scénario navigateur reproductibles.

## 3. Architecture et compromis

La phase de carrière reste `offseason`, avec un état sauvegardé supplémentaire versionné (`draft` puis `ready`). **Préparer** fait progression, retraites, expiration/activation des contrats et génération une seule fois. Les prospects non sélectionnés restent hors de `league.players` jusqu’à la fin de la draft, évitant une signature anticipée. Le lancement exige une draft terminée, complète les effectifs minimaux, remet les statistiques à zéro et construit le calendrier. Les contrats existants gardent leurs règles du lot 4. Les effectifs peuvent être provisoirement sous 13 pendant la draft ; ils sont réparés avant le premier match.

Le moteur conserve `startNextSeason()` comme API explicitement automatique pour les scripts et les parcours historiques. L’interface utilise les nouvelles commandes séparées et ne saute pas les choix humains. Les identifiants de choix, le curseur et le compteur persistant de joueurs protègent la reprise, les doublons et l’historique. Les anciennes sauvegardes sans ces champs restent valides ; un état de draft incohérent est refusé au chargement, sans régénération silencieuse.

La loterie des quatre derniers, l’ordre inverse des bilans et les contrats rookies de trois ans sont conservés. Le scouting est une estimation seedée fixe, avec erreur initiale de ±5 et marge affichée de 6–10 points ; ce n’est pas un système de missions améliorables. Le score de draft combine **qualité actuelle et qualité future absolue estimée**, pas uniquement l’écart de croissance. Les CPU visent 14 joueurs ; le joueur peut drafter jusqu’à la limite de 15. Aucun marché de picks n’est activé : droits futurs, prix et protections ne sont pas encore modélisés. Le propriétaire explicite sert d’invariant, pas de promesse d’échange fonctionnel.

L’entraînement compte une exposition par journée régulière, un quart si blessé, avec marqueur de journée contre le double comptage. Playoffs et intersaison n’ajoutent pas de jours. Changer de focus ne réaffecte pas les jours passés. La progression garde la courbe d’âge et le hasard historique ; les gains positifs des jeunes sont modulés par l’expérience (facteur 0,85–1,15). Un focus redistribue modestement la progression selon durée, marge de potentiel, âge et attribut déjà acquis. La modulation spécifique est au plus d’environ 2,25 points sur un attribut faible pour une année complète et réduit légèrement les autres groupes ; elle est arrondie avec la progression existante, sans garantie de gain. Le déclin des vétérans demeure.

Les minutes de développement sont séparées des statistiques et utilisent le facteur de normalisation déjà enregistré pour les matchs physiques. Les anciens matchs sans ce compteur utilisent leurs secondes déjà conservées ; leur normalisation historique complète n’est pas reconstruite. Les bilans ne présentent pas une variation annuelle comme l’effet causal du seul focus.

Les bilans détaillés sont limités à **dix saisons**, le journal du marché à 200 opérations. Les noms des lauréats sont capturés dans le petit palmarès existant ; les noms déjà perdus avant cette livraison ne peuvent pas être récupérés. Chimie, moral et staff restent facultatifs et absents, sans bonus sportif ajouté.

## 4. Commandes et résultats

- Baseline avant modification : build, lint, calibration et **439 tests** réussis ; 115,5 points, FG 48,0 %, 3 points 35,7 %.
- `npm run build`, `npm run lint` : réussis ; avertissement connu sur le chunk Phaser.
- `npm test` : **456 tests réussis, 47 fichiers** ; 17 nouveaux tests, aucune assertion sportive historique abaissée.
- `npm run calibrate` : **1 230 matchs**, **115,5 points**, FG **48,0 %**, 3 points **35,7 %**, part de tirs à 3 points **39,5 %** ; résultat de la première saison identique à la baseline. La progression et les nouvelles drafts changent volontairement les saisons suivantes.
- `npx tsx scripts/validate-development.ts` : **19 656 matchs**, quinze saisons et transitions sur les graines 31/8126/919, avec playoffs, rechargement d’une draft suspendue à chaque transition, choix humains via l’API contrôlée et vérifications quotidiennes d’appartenance, budgets, contrats, numéros, plans et comptabilité des points. Les effectifs restent jouables, les contrats et plafonds valides, sans réutilisation d’identifiant historique.
- `python scripts/smoke-development.py` : vraie saison et playoffs terminés depuis l’interface, focus et sept journées réelles, consultation des 60 prospects, reprise de draft après recharge, deux choix humains, fenêtre de recrutement, lancement 2027 et bilan. Aucune erreur JavaScript. Prérequis : Vite sur 127.0.0.1:5173, Playwright Python, Chromium système.

Après cinq transitions, les réservoirs libres comptent 230/226/230 joueurs (graines 31/8126/919), les masses salariales maximales sont 181,6/196,2/190,4 M€ sous un plafond de 250 M€, et les sauvegardes mesurées juste après transition font environ 1,23 million de caractères JSON. Ce relevé n’est pas une mesure du maximum de stockage en cours de saison. Sur les quinze classes identiques comparées, le choix favorisé par le projet reconstruction a un potentiel estimé moyen de 91,4 contre 90,4 pour le projet titre ; l’estimation retenue diffère dans quatre classes. Les projets ne sont donc pas contraints de diverger sur chaque classe.

Relevés sous [validation/development/lot5](validation/development/lot5/). Le JSON de campagne comprend aussi une comparaison de projets sur les mêmes classes : il s’agit d’un score contrefactuel à effectif constant, distinct des choix réellement effectués dans l’ordre de draft.

## 5. Démonstration et reproduction

1. Créer Boston, ouvrir **Développement**, choisir Tir extérieur pour un joueur. Changer plusieurs fois le focus : ses attributs restent identiques. Avancer sept jours : seule l’exposition d’entraînement augmente.
2. Finir la saison et les playoffs. Négocier les contrats souhaités dans Marché, puis **Préparer la draft** depuis Développement.
3. Examiner les 60 prospects, puis **Faire avancer les choix CPU**. Au tour de Boston, choisir un prospect ou le conseil. Recharger avant ou après le choix : aucune nouvelle progression ni sélection supplémentaire n’a lieu.
4. Effectuer son second choix ou le passer. Consulter les décisions de la ligue ; les non-sélectionnés sont maintenant libres. Recruter si nécessaire, puis **Lancer la saison**.
5. Ouvrir **Bilans de saison** : retrouver les notes observées, journées, minutes, résultats des clubs et choix de draft. Le script navigateur exécute ce parcours sans fabriquer la phase ou les résultats.

## 6. Régressions et limites

- La première démonstration a identifié un conseil préférant un joueur faible à cause de son grand écart de potentiel. Le score utilise désormais le niveau futur absolu ; un test vérifie qu’un prospect inférieur à la fois aujourd’hui et à terme n’est pas préféré uniquement pour cet écart. Les validations longues et navigateur sont relancées après correction.
- Deux erreurs des premières fixtures de test ont été corrigées : focus final mal identifié après alternance, et suppression artificielle d’un lauréat sans retrait de son effectif. Aucune règle de jeu assouplie pour les faire passer.
- Les tests existants des rotations, sauvegardes, transactions, matchs physiques et résultats restent actifs. Aucun asset, contrôle, sprite, rendu ni moteur physique modifié.
- La qualité et l’économie des classes de draft, la taille du réservoir libre à très long terme et les équilibres offensifs après plusieurs années restent à calibrer au lot 6. Le plafond demeure volontairement généreux ; les CPU peuvent passer des choix lorsqu’ils ont déjà 14 joueurs. Ce n’est pas une CBA avec droits exclusifs sur un rookie non signé.
- Le parcours navigateur ne démontre pas toutes les durées de match ni toutes les tailles d’écran. La campagne longue vérifie les invariants et la reprise, pas l’absence universelle d’exploit.

## 7. Suite

**Lot 6** : calibration multi-graines approfondie des distributions et stratégies après progression, exploitation économique, finition des messages et petits écrans, vérification finale de la checklist §17 et bilan des limites. La psychologie et les échanges de picks ne sont pas annoncés comme disponibles.

Suite livrée : [lot 6 — équilibrage, finition et acceptation finale](REFONTE_FINAL_LOT_6.md).
