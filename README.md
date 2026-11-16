# HoopSim

Jeu de simulation et de gestion de basket-ball jouable dans le navigateur, dans l'esprit
de *Hoop Land*. Vous prenez une franchise en main, composez votre rotation, simulez la saison
match par match et essayez de décrocher le titre.

## Démarrer

```bash
npm install
npm run dev        # serveur de développement
npm run build      # build de production dans dist/
npm run test       # tests du moteur (Vitest)
npm run calibrate  # simule une saison complète et affiche les moyennes de la ligue
```

Les designs officiels sont utilisés automatiquement dans tous les matchs. Depuis l'accueil,
« Tester un match jouable » lance un 5 contre 5 ; dans une partie GM, utiliser « Jouer ».
`?court` ouvre directement le match, `?style` le catalogue des dix designs. L’onglet
« Animations » (ou `?anims`) permet de visualiser les 18 animations, au ralenti ou image par
image, avec les références validées. Chaque geste contient 4 à 8 images.

Commandes : ZQSD pour se déplacer, Espace pour sauter/tirer (relâcher pour déclencher),
E pour passer/changer de défenseur, A pour tenter une interception, P ou Échap pour la pause,
F pour le plein écran. Les touches sont modifiables dans Paramètres.

## Ce que le jeu contient

- **Ligue générée** : 30 franchises réparties en 2 conférences et 6 divisions, 14 joueurs par
  effectif, chacun avec 19 attributs (dont détente et dunks, réservés au match joué), un
  archétype, une répartition de tirs, un potentiel, un âge et un contrat.
- **Saison régulière** : 82 matchs par équipe répartis sur environ 140 journées, classements
  avec différentiel et série en cours, statistiques individuelles et leaders de la ligue.
- **Simulation possession par possession** : choix du porteur de balle, pertes de balle,
  interceptions, fautes (dont le bonus), contres, rebonds offensifs, lancers francs, passes
  décisives, fatigue, rotations, sorties pour six fautes, temps mort de fin de match et
  prolongations.
- **Coaching** : cinq titulaire explicite, minutes cibles totalisant 240, rôles, cinq de fin de
  match, fréquence des changements et huit variantes de plan sauvegardables.
- **Blessures** : elles surviennent en fonction des minutes jouées, de l'âge et de la
  résistance du joueur, et écartent automatiquement l'intéressé de la rotation.
- **Playoffs** : 16 équipes, séries au meilleur des sept avec avantage du terrain 2-2-1-1-1,
  tableau complet et MVP des finales.
- **Intersaison** : vieillissement, progression et déclin des joueurs, retraites, draft des
  rookies dans l'ordre inverse du classement, puis nouvelle saison.
- **Sauvegarde automatique** dans le navigateur après chaque action.

## Architecture

```
src/
  engine/          moteur de jeu, TypeScript pur, sans dépendance à React
    rng.ts         générateur pseudo-aléatoire déterministe (mulberry32)
    types.ts       types de données et statistiques
    generate.ts    génération des joueurs, des effectifs et de la draft
    ratings.ts     calcul des notes globales par poste
    coach.ts       composition du cinq et plan de temps de jeu
    schedule.ts    construction du calendrier
    simGame.ts     simulation d'un match, possession par possession
    simSeason.ts   déroulé d'une journée, statistiques, blessures
    playoffs.ts    tableau final
    offseason.ts   récompenses, progression, retraites, draft
    stats.ts       classements, leaders, course au MVP
  state/store.ts   état de la partie et sauvegarde locale
  ui/              interface React (onglets, écran de match, fiches joueur)
scripts/calibrate.ts  vérification des moyennes de la ligue
```

Le moteur est déterministe : à graine identique, une partie se rejoue à l'identique.
L'état du générateur aléatoire est sérialisé avec la sauvegarde.

## Calibration

`npm run calibrate` simule une saison entière (1 230 matchs, environ 3 secondes) et affiche
les moyennes obtenues. Les valeurs actuelles :

| Indicateur | HoopSim | Ordre de grandeur réel |
| --- | --- | --- |
| Points par équipe | 113 | 113 |
| Réussite aux tirs | 48,3 % | 47,5 % |
| Réussite à 3 points | 35,6 % (36 % des tirs) | 36,5 % |
| Lancers francs | 80,4 % | 78 % |
| Passes décisives | 24,7 | 26,5 |
| Balles perdues | 12,3 | 13,5 |
| Contres / interceptions | 4,7 / 6,8 | 5,0 / 7,5 |
| Fautes | 17,7 | 19,5 |
| Victoires à domicile | 56 % | 55 % |

## Limites connues

- Les picks ne sont pas encore négociables. Le marché utilise
  une économie fictive et une IA GM minimale, sans clauses ni enchères concurrentes.
- Les feuilles de match ne sont archivées que pour votre équipe et pour les playoffs, afin de
  garder la sauvegarde légère.
- Le déroulé action par action n'est conservé que pour le dernier match affiché.

## Naturel des matchs : audit et corrections

Les 35 constats et les huit lots de correction sont documentés dans
[le rapport de fin d’action](docs/GAMEPLAY_REMEDIATION.md), avec une
[vidéo avant/après de 30 secondes](docs/media/gameplay-before-after.mp4).

`npm run validate:gameplay` rejoue les trois graines de référence et vérifie la fin
et la cohérence du box score. La campagne enregistrée contient douze graines.
La capture reproductible utilise `scripts/record-gameplay.py` avec Playwright Python,
Chromium et FFmpeg ; les commandes complètes figurent dans le rapport.

## Coaching et tactiques

L’onglet **Effectif** permet de fixer les cinq postes et les minutes équivalentes à 48 minutes,
de répartir le reste automatiquement et de choisir les rôles. Mémoriser une variante conserve
une copie ; la charger propose un brouillon, puis **Enregistrer le plan** l’active.

L’onglet **Tactiques** configure les six identités offensives, le playbook pondéré, la défense
individuelle/switch/drop et les priorités. Ces systèmes collectifs s’appliquent à **Simuler**, **Jouer** et **Regarder**, avec des résultats
propres à chaque moteur. Les matchs physiques utilisent des placements, écrans, coupes et replis.
Dans **Regarder → Pause**, vous pouvez envoyer des consignes et demander un cinq au prochain
arrêt légal. Ces changements restent locaux au match. Zone et press ne sont pas disponibles.

Après un match, **Analyse tactique** présente les comptes réellement suivis et les minutes
cibles/effectives. Une possession estimée est indiquée comme telle ; les données non suivies
ne sont pas inventées. Les anciennes carrières restent sous la même clé de sauvegarde.

Validation reproductible, sans écraser les rapports suivis :

```bash
npx tsx scripts/validate-coaching.ts  # huit matchs physiques complets, deux durées
npx tsx scripts/calibrate-tactics.ts # 6 480 matchs rapides, graines appariées
npx tsx scripts/validate-live-tactics.ts # 30 matchs physiques, cinq systèmes et trois défenses
```

Les rapports sont produits sous `/tmp` par défaut. Voir le [bilan des lots 1–2](docs/COACHING_LOTS_1_2.md)
pour les résultats et limites de ces campagnes.

Le [bilan du lot 3](docs/COACHING_LOT_3.md) détaille le coaching en match, ses mesures et ses limites.

## Marché et contrats

L’onglet **Marché** permet de rechercher les joueurs et agents libres, composer un échange
de un à trois joueurs par côté, comprendre les refus et négocier salaire/durée/rôle promis.
Les finances affichent le plafond et les engagements futurs. Les clubs CPU gèrent aussi
leurs effectifs et peuvent envoyer des offres lors des fenêtres de marché.

Avant **Préparer la draft**, négociez les prolongations dans **Contrats** : sans accord,
les joueurs expirants quittent réellement le club. Les éventuels renforts de secours
pour atteindre 13 joueurs sont identifiés dans les transactions.

```bash
npx tsx scripts/validate-management.ts # trois graines × trois saisons complètes
python scripts/smoke-market.py        # Vite démarré, Playwright Python et Chromium système
```

Voir le [bilan du lot 4](docs/MANAGEMENT_LOT_4.md) pour les règles économiques,
les preuves et les limites. La livraison des lots 0–6 est terminée ; les limites sont détaillées dans le bilan final.

## Draft et développement

L’onglet **Développement** permet de choisir un focus individuel, suivre les journées
réellement entraînées et consulter les dix derniers bilans de saison. Les effets sont
appliqués une seule fois à l’intersaison, selon âge, potentiel, expérience et durée ;
changer de focus ne donne aucun gain immédiat.

Après les playoffs, négociez vos prolongations puis **Préparer la draft** : consultez
les 60 prospects avant de faire avancer les CPU, sélectionnez vos joueurs à chaque tour,
ou passez/déléguez vos choix. La draft reprend au même endroit après recharge.
Une fois terminée, vous pouvez encore recruter dans Marché avant **Lancer la saison**.

```bash
npx tsx scripts/validate-development.ts # trois graines × cinq saisons, drafts rechargées
python scripts/smoke-development.py   # Vite, Playwright Python et Chromium système
```

Le [bilan du lot 5](docs/DEVELOPMENT_LOT_5.md) précise les règles, preuves et limites.

## Bilan de la refonte et sauvegardes

Les lots 0 à 6 sont livrés. Le [bilan final](docs/REFONTE_FINAL_LOT_6.md)
relie les vingt critères d’acceptation à leurs preuves : 464 tests, trente saisons
sur trois graines, confrontations tactiques appariées et matchs physiques.
Les menus de gestion sont vérifiés à 1 280, 768 et 390 pixels ; les tableaux
se parcourent horizontalement et au clavier.

Une erreur d’enregistrement est affichée avec **Exporter la partie** et **Réessayer**.
Le menu permet aussi d’exporter une copie JSON de la carrière courante.
Un chargement invalide conserve le contenu déjà stocké dans le navigateur.

```bash
npx tsx scripts/calibrate-franchise.ts --snapshot=/tmp/hoopsim-aged-league.json
npx tsx scripts/calibrate-tactics.ts --output=/tmp/hoopsim-lot6-tactics.json
npx tsx scripts/calibrate-tactics.ts --fixture=/tmp/hoopsim-aged-league.json --output=/tmp/hoopsim-lot6-tactics-aged.json
npx tsx scripts/check-release-metrics.ts
python scripts/smoke-release.py # Vite démarré, Playwright Python et Chromium système
```

Les résultats sont écrits sous `/tmp`. Les règles fictives de budget, les limites
du journal, du scouting et des stratégies physiques sont précisées dans le bilan ;
les échanges de picks, zone/press et la psychologie ne sont pas annoncés comme disponibles.

## Clubhouse

L’interface Clubhouse, les cinq identités, l’atelier et les écussons des trente franchises sont intégrés. Sur l’écran de création, **Découvrir Clubhouse • le #45 à Boston** lance la carrière témoin. [Parcours, captures, vidéos et validation](docs/CLUBHOUSE.md).
