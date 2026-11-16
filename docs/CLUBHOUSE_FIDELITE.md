# HoopSim — passe de fidélité Clubhouse

Livraison du 16 novembre 2026. Priorités : #45 en match, portrait, accueil Franchise.

## Changements livrés

- **#45 debout** : dessin original du kit importé sans redessiner son visage, son maillot ni ses chaussures. Fond vert de présentation et fragments du cadre retirés au rendu. Maillot Boston en vert profond, liserés ivoire ; chaussures compactes.
- **Dribble** : 32 cellules supplémentaires face/dos, sur place/en déplacement ; avant-bras dessinés raccordés aux contacts existants de poussée et de reprise. Sur place, les deux appuis restent plantés. Le mouvement des jambes reprend pendant le déplacement et cesse après la décélération.
- **Portrait** : le #45 utilise le portrait original, avec détourage, fond clair et conservation de sa coiffure, de son bandeau et de sa barbe. Les options de l’atelier restent disponibles, avec brouillon, annulation et enregistrement.
- **Franchise** : navigation horizontale conservée, écusson du club dans l’en-tête, prochain match et décision directement en haut. Cartes du cinq sur fond clair, bandeaux verts, accès aux fiches. Le terrain à droite ouvre réellement la rotation. Aide et raccourcis restent accessibles sous les cartes.
- **Boston / New York** : suppression des pointes parasites et des trous du contour, liseré ivoire continu dans les SVG détaillés et compacts. Les noms, identifiants et palettes enregistrées des 30 franchises sont conservés.

Les contacts physiques du ballon reprennent les coordonnées antérieures. Cette passe ajuste les images autour de ces contacts. Les notes, contrats, effectifs, règles de match, probabilités et résultats de simulation ne sont pas modifiés par ces changements visuels.

## Comparaisons contrôlées

Dans `docs/validation/clubhouse-fidelity/` :

- `comparaison-45.png` : référence et véritable capture Phaser, **debout, trois-quarts face, vers la droite**. Même échelle de caméra, même agrandissement ×4 ; aucune mise à taille indépendante par boîte englobante. Pieds alignés dans deux fenêtres de 128 × 128 pixels de caméra. Le jeu conserve son ombre et son cercle de sélection. Le gabarit du joueur garde son élargissement de rendu de 4 %, indiqué dans les mesures.
- `comparaison-portrait.png` : même orientation et même grille de 96 × 96 pixels, avec loupe ×4 commune.
- `comparaison-franchise.png` : maquette et interface dans deux fenêtres identiques de **1 672 × 941 pixels**. Les noms, la date et la décision viennent de la carrière réelle ; ils ne sont pas remplacés par les textes fictifs de la maquette.
- `comparaison-echelle.json` : cadrage, coefficient appliqué à la référence, caméra et pose effective.
- `45-debout-match.png` et `45-debout.json` : image complète et état de match dont provient le recadrage.

Les PNG originaux du #45 sont conservés dans `src/assets/players/clubhouse/reference/` ; le cadrage Franchise du kit est livré comme `franchise-reference.png`.

## Parcours filmé et contrôles réels

Entrée par **Découvrir Clubhouse → Préparer le match → Jouer**, depuis une carrière Boston créée avec la graine 2861. Andre Fifita conserve son identifiant `pj`, son numéro 45 et ses caractéristiques. La possession est obtenue par le déroulement normal du match, puis les entrées de l’inspecteur de développement reproduisent les commandes de déplacement ; les autres joueurs reçoivent une entrée neutre pour faciliter l’observation. Aucune position du #45 ou du ballon, aucune attribution de possession et aucune pose ne sont imposées au monde physique.

`45-dribble-deplacement-arret.mp4` montre successivement le dribble sur place, le déplacement, puis l’arrêt. Après l’arrêt, la vitesse revient à zéro et le dribble continue sur place. `index.html` fournit une lecture avec commandes, chapitres, sous-titres descriptifs et loupe ×4 synchronisée. Extraire toute l’archive, puis ouvrir cette page pour conserver ses fichiers voisins.

Le MP4 est en H.264, 1 280 × 720, 30 images/s, format yuv420p, démarrage rapide. Il est issu d’une capture du canvas du vrai match à vitesse normale, sans correction de vitesse ni poses ajoutées au montage. Le navigateur cloud utilise le moteur Canvas pris en charge par Phaser ; la caméra, les dimensions et la physique du match restent celles du jeu. Les mesures détaillées de cadence et d’horloge sont dans `verification-video.json`.

Les images `dribble-cycle-reel.png` et `video-etapes-loupe.png` sont des extractions du MP4. Le contrôle inclut aussi la lecture effective du MP4 et l’accès au chapitre Arrêt dans Chromium. Les entrées et instantanés de match sont livrés dans les JSON associés.

## Régressions

- 479 tests automatisés sur 51 fichiers : réussite.
- Build TypeScript / Vite, lint et validation des 30 écussons : réussite.
- 2 016 compositions contrôlées : aucun débordement, appuis du dribble sur place identiques, écart maximal au contact peint inférieur à deux pixels logiques. Contrôle supplémentaire des 64 poses de dribble du #45 (face/dos, gauche/droite, sur place/course) : aucune partie du corps détachée.
- Parcours Clubhouse : modification d’apparence en brouillon → enregistrement → rechargement → annulation d’une nouvelle modification ; rotation permutée puis enregistrée à 240 minutes ; mobile 390 px ; entrée dans un véritable match avec l’apparence persistée et banc précalculé.
- Parcours management : prolongation depuis l’accueil et la fiche, offre refusée sans mutation, confirmation unique et contrat signé ; marché fermé ; échange accepté/refusé ; filtres conservés ; erreur de quota de sauvegarde signalée.
- Écrans de management à 1 440 / 768 / 390 px sans débordement horizontal du document ; tactiques avancées et statistiques accessibles.

Une exécution des tests lancée pendant plusieurs captures simultanées a dépassé le délai de 5 secondes d’un test IA. La suite complète relancée seule passe sans changer les tests ni leurs seuils. Les journaux de livraison conservent les validations finales.

## Reproduire

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Dans un autre terminal, avec Chromium, Playwright Python, Pillow et FFmpeg installés :

```sh
python scripts/validate-clubhouse-art.py
python scripts/capture-clubhouse-fidelity.py --canvas
python scripts/compare-clubhouse-fidelity.py
python scripts/view-clubhouse-fidelity.py
python scripts/check-clubhouse-video.py
python scripts/smoke-clubhouse.py
python scripts/smoke-guided-ux.py
python scripts/smoke-ui.py
npm run build
npm run lint
npm test
npx tsx scripts/validate-branding.ts
```

La comparaison utilise le dossier du kit fourni dans cet environnement : `/workspace/clubhouse-reference/references/`. Le dessin et le portrait originaux sont aussi dans les sources du projet. Pour régénérer l’atlas depuis les planches : `prepare-clubhouse-assets.py`, puis `prepare-clubhouse-fidelity.py`. Pour les écussons : `prepare-clubhouse-crests.py`, qui applique ensuite le nettoyage des deux pilotes.
