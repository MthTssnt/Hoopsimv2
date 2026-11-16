# Clubhouse — intégration du 16 novembre 2026

Clubhouse est le thème de gestion par défaut. L’intégration inclut les portraits, l’atelier, les écussons et le rendu Phaser autorisés dans le brief Clubhouse. Les probabilités sportives, les attributs, les commandes et les règles de saison restent ceux du jeu ; les points de main et de lâcher suivent les nouveaux dessins.

Sur l’écran de création, **Découvrir Clubhouse • le #45 à Boston** ouvre une vraie carrière Boston, graine 2861, avec un prochain match contre New York. Le remplacement d’une carrière locale existante demande confirmation. Les noms, tailles, notes et numéros proviennent de cette carrière : aucun numéro de référence artistique n’a été imposé au moteur.

| Identité artistique | Joueur de la carrière témoin | Numéro réel |
| --- | --- | --- |
| Mèches courtes, bandeau ivoire, barbe courte | Andre Fifita | 45 |
| Coupe rase, visage carré | Ronan Kim | 49 |
| Boucles cuivrées | Miles Zeman | 32 |
| Mèche latérale, moustache | Milan Fenwick | 3 |
| Tresses attachées, barbe fournie | Yusuf Vasić | 51 |

## Parcours livrés

- **Franchise** : prochain match et écussons, une action Préparer, prochaine décision réelle, cinq portraits ouvrant les fiches. Les autres décisions et le bilan restent consultables sous des détails.
- **Équipe → Rotation** : demi-terrain avec fiches, remplacement immédiat d’un titulaire par un joueur actif, permutation d’un titulaire déjà sélectionné, minutes et banc. Tous les rôles, joueurs hors rotation, profils, variantes et réglages de remplacement restent accessibles. Le plan est un brouillon jusqu’à l’enregistrement à 240 minutes.
- **Marché** : accès Recruter, Contrats, Agents libres et Échanges. La décision d’accueil et la fiche ouvrent le même joueur. Salaire, durée et saison d’effet sont visibles avant confirmation ; le statut signé est lu dans la carrière et retire la décision traitée.
- **Fiche → Modifier l’apparence** : portrait et sprite issus des mêmes modules, huit rangées de vignettes, aperçu face/dos et gauche/droite, animation ou arrêt, enregistrement et annulation. Le stockage refusé conserve le brouillon. Les tresses adaptent ou désactivent le bandeau incompatible.
- **Préparation → Jouer / Regarder / Simuler** : les trois modes restent disponibles, avec les plans et effectifs existants. Les tactiques, entraînements, statistiques, playoffs, draft et import/export restent accessibles.

L’apparence versionnée est distincte des attributs. Les anciennes sauvegardes et les nouveaux joueurs reçoivent des valeurs reproductibles à partir de leur identifiant, sans consommer le RNG sportif. Les personnalisations survivent au rechargement, aux échanges et au changement de saison ; les couleurs d’équipement suivent la franchise. Le catalogue comprend 73 872 combinaisons après adaptation de la superposition tresses/bandeau.

## Rendu et vérifications visuelles

Les dessins complets sont livrés dans `src/assets/players/clubhouse/`, avec 128 cellules sources et dix modules de tête face/dos. Le compositeur conserve les quatre orientations et les gestes existants. Les numéros sont reposés à l’endroit, dans le masque de maillot. Les doigts ont un masque séparé ; aucun ballon n’est incorporé aux personnages.

Le ballon du match reste l’objet physique unique. Le contrôle et le rendu partagent les repères de main, l’échelle et le miroir. Le dribble descend jusqu’au parquet, remonte vers la reprise et conserve sa phase au démarrage, au freinage et au changement d’orientation. Sur place, les pixels des appuis restent identiques sur les huit images. En déplacement, la cadence suit la distance parcourue et le même cycle d’appuis.

Le contre conserve son cône de contact et son tirage de réussite. Un masque du bras dessiné est préparé avec chaque pose ; son orientation visuelle rejoint la balle dans le cône du jeu. La vérification du contre témoin au pas 15461 mesure le raccord entre le point de main affiché et le ballon, sans forcer sa réussite.

La pose debout étalon de 195 cm mesure **34 pixels logiques peints**, à comparer aux environ 35 de la référence en 640 × 360. Les gabarits de 175 à 222 cm mesurés vont de 32 à 37,5 pixels ; le #45 de cette carrière fait 185 cm. Les captures utilisent la projection et la caméra de match, sans agrandissement particulier du joueur.

Chaque franchise possède un écusson détaillé 64 × 64 et une variante compacte 32 × 32. Boston reprend le guerrier et New York le lion couronné ; les trente identifiants et palettes canoniques sont conservés. Les variantes compactes sont utilisées dans les petites listes et le HUD. Le catalogue reste consultable à `?branding`.

## Preuves et reproduction

[Franchise](validation/clubhouse/franchise.png) · [Équipe](validation/clubhouse/equipe.png) · [Contrat](validation/clubhouse/contrat.png) · [Atelier](validation/clubhouse/atelier.png) · [Mobile](validation/clubhouse/mobile.png) · [Écussons](validation/clubhouse/ecussons.png)

[Dribble sur place, déplacement, changement de direction, arrêt et tir du #45](validation/clubhouse/45-dribble-tir.mp4) · [Contre réel en match](validation/clubhouse/contre-match-reel.mp4) · [Comparaison à la référence](validation/clubhouse/comparaison.png)

Les deux prises sont capturées par `canvas.captureStream(30)` dans des matchs GM entrés depuis Clubhouse, puis encodées à 30 images/s sans accélération. La première utilise des entrées scriptées pour isoler les gestes du #45, avec les autres joueurs sans commande pendant ce témoin. La seconde suit les dix IA : le contre est celui du **#15 de New York**, avec une réussite calculée par le moteur. Les vidéos sont muettes, la capture portant sur le canvas ; l’audio du jeu est conservé.

Commandes utilisées, avec Vite sur le port 5173 pour les scripts navigateur :

```sh
npm run build
npm run lint
npm test
npx tsx scripts/validate-branding.ts
npx tsx scripts/validate-gameplay.ts --output=/tmp/hoopsim-clubhouse/gameplay.json
npx tsx scripts/validate-coaching.ts --output=/tmp/hoopsim-clubhouse/coaching.json
npx tsx scripts/validate-management.ts --output=/tmp/hoopsim-clubhouse/management.json
python scripts/validate-clubhouse-art.py
python scripts/smoke-clubhouse.py
python scripts/capture-clubhouse-ui.py
python scripts/smoke-guided-ux.py
python scripts/smoke-ui.py
python scripts/capture-clubhouse.py --block-step 15462
```

Les scripts navigateur nécessitent Playwright Python, Chromium et, pour les vidéos, FFmpeg. Les sources graphiques peuvent être réassemblées avec Pillow via `prepare-clubhouse-assets.py` et `prepare-clubhouse-crests.py` ; cette étape ne fait pas partie du build normal.

Les régressions couvrent : ancien chargement, personnalisation puis rechargement et match réel, annulation, quota de stockage, vrai transfert, changement de saison, prolongation depuis deux points d’entrée, refus, confirmation et retrait de tâche, aucun contrat éligible, marché fermé, offre CPU acceptée/refusée, permutation de titulaires, enregistrement à 240 minutes, tactiques, pages et clavier à 1440/768/390 px. Le compositeur est contrôlé sur 2 016 poses/gabarits/orientations : absence de découpe, contacts à moins de 1,84 pixel logique de matière peinte, appuis fixes sur place. Les campagnes de gestion couvrent 11 767 matchs et neuf transitions de saison ; les campagnes Phaser vérifient scores/feuilles, positions finies, rotations et fins de match.

Le test IA historique de la graine 4 reste exécuté. Une seconde graine avec des lancers réels complète ce scénario : avec les nouveaux points de lâcher, la graine 4 peut se terminer sans faute sur tir. Aucune faute artificielle ni modification de probabilité n’a été ajoutée pour faire passer cette vérification.

## Écarts à connaître

Les dessins sont des réinterprétations des références, avec des contours adaptés à la grille du jeu ; ce ne sont pas des extractions de la vidéo montée. Les poses communes de freinage, pivot, interception, réception au sol et contre de l’autre main réemploient certains dessins complets. Les règles et états du moteur distinguent toujours ces actions ; leur différence visuelle peut être examinée dans les outils d’animation et dans les prises.

L’ancien laboratoire des dix designs reste accessible pour comparaison. L’éditeur d’apparence et le match utilisent les nouveaux modules Clubhouse. La préparation initiale des vingt joueurs a été mesurée à environ 30 secondes dans cet environnement cloud après réduction du travail du masque des doigts ; elle reste une attente visible avec progression. Le temps de préparation du roster et le mode worker sont exposés par l’inspecteur `?atelier` ; aucune composition synchrone n’est autorisée lors de l’entrée d’un remplaçant. Les accès de témoin aux entrées exactes et au monde sont limités au développement et à cette URL de diagnostic.
