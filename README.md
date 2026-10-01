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

Test du rendu Phaser (futur mode match jouable) : ouvrir l'URL avec `?court`.

## Ce que le jeu contient

- **Ligue générée** : 30 franchises réparties en 2 conférences et 6 divisions, 14 joueurs par
  effectif, chacun avec 16 attributs, un archétype, une répartition de tirs, un potentiel,
  un âge et un contrat.
- **Saison régulière** : 82 matchs par équipe répartis sur environ 140 journées, classements
  avec différentiel et série en cours, statistiques individuelles et leaders de la ligue.
- **Simulation possession par possession** : choix du porteur de balle, pertes de balle,
  interceptions, fautes (dont le bonus), contres, rebonds offensifs, lancers francs, passes
  décisives, fatigue, rotations, sorties pour six fautes, temps mort de fin de match et
  prolongations.
- **Gestion de la rotation** : l'ordre que vous choisissez fixe le temps de jeu. Les cinq
  premiers sont titulaires, chaque place plus bas signifie moins de minutes.
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

- Pas de marché des transferts ni d'agents libres : les contrats arrivés à terme sont
  reconduits automatiquement, et les effectifs sont complétés par la draft.
- Les feuilles de match ne sont archivées que pour votre équipe et pour les playoffs, afin de
  garder la sauvegarde légère.
- Le déroulé action par action n'est conservé que pour le dernier match affiché.
