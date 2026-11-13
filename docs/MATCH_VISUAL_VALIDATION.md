# Validation du rendu en match — graine 8126

## Reconstruction vérifiée du 13 novembre 2026

L'absence des anciens commits ne bloque plus l'implémentation. Les capacités sont
**reconstruites**, pas récupérées à l'identique : audit détaillé dans `RECONSTRUCTION.md`.
Cette section remplace le préalable de récupération cité dans le bilan du lot témoin.

- **355 tests dans 39 fichiers**, lint et build réussis. Les nouveaux tests vérifient
  les données explicites, les miroirs des repères, les raccords interruptibles,
  la direction des passes, le changement d'identité d'un corps et l'absence d'effet
  du suivi visuel sur la physique et les résultats.
- Chromium : **13 440 poses** contenues dans le cadre (dix designs, quatre orientations,
  180/220 cm et deux corpulences), 3 200 paires de repères symétriques, 6 720 paires
  de masques dont l'alpha est exactement symétrique. Il s'agit de contrôles structurels,
  pas d'une appréciation artistique exhaustive.
- Parité raster du compositeur worker et principal sur le témoin 220 cm corpulent :
  **zéro octet différent** dans l'atlas et les doigts.
- Préparation des **20 membres éligibles** de la graine 8126 avant le premier pas,
  worker et repli `sansWorker` réellement exécutés. Temps observé ~13–15 s en worker,
  ~12 s en repli sur cette machine ; l'interface affiche la progression.
- Rejeu de **600 pas à 1/120 s**, entrées identiques : mêmes positions, poses,
  possession, score, événements de filet et box score entre worker et repli.
  Le bouton de 1/60 s a été vérifié comme deux pas physiques.
- Match complet **4 × 3 min**, graine 8126, exécuté par l'inspecteur en blocs de pas :
  **126 279 pas**, 1 052,325 s simulées, **106–74**, box score **106–74** ;
  dix joueurs utilisés par équipe, 48 versions de cinq et **zéro cuisson à l'entrée**.
  Traversées physiques : 57 à gauche et 57 à droite (indépendantes des paniers accordés).
  Ce parcours accéléré est une validation fonctionnelle, pas une preuve de fluidité.
- Essais réellement affichés à ×1/×2/×4 sur les graines **31 et 919**, essai clavier
  sur 8126, vues 1280×720 et 1920×1080, atelier « Phases du match » et « Planches sources ».
  Aucun événement JavaScript `pageerror` dans le parcours.
- Audio : contexte initialement verrouillé, activé après clic ; nœuds de sons ballon,
  appuis, fer, planche et filet lancés pendant le jeu. Coupure vérifiée sans nouvelle
  émission ; réglages sauvegardés compatibles avec les anciennes sauvegardes.
  Le caractère sonore reste à écouter et affiner, sans validation artistique revendiquée.
- Mesures Phaser en jeu affiché headless : ~**50,6 et 54,4 FPS**, plus longue image
  récente ~30 et 31,7 ms. **60 FPS stables ne sont pas démontrés.**

Preuves nouvelles sous `/workspace/hoopsim-evidence/reconstruction/` :
`validation.json`, `art-validation.json`, `inputs-8126.json`, captures du match et
de l'atelier ; scripts `validate.py` et `validate_art.py`. Les anciennes captures
ne sont pas utilisées comme preuve des reconstructions.

Les versions réutilisables des contrôles sont commitées dans
`scripts/validate-reconstruction.py` et `scripts/validate-player-art.py`.
Avec Vite lancé sur le port 5173, Chromium et Playwright Python installés :
`python scripts/validate-reconstruction.py`, puis `python scripts/validate-player-art.py`.
Elles écrivent leurs résultats dans `/tmp/hoopsim-reconstruction` ; définir
`HOOPSIM_EVIDENCE_DIR` pour conserver un autre répertoire. Aucune dépendance ajoutée
au projet JavaScript. `match-8126-x1.mp4` est un extrait de huit secondes à vitesse
réelle, **sans piste audio** ; il ne constitue pas une comparaison avec les commits perdus.

Pour tester : ouvrir `?court&seed=8126&watch&atelier`, lire puis figer, avancer de
1/60 s, choisir le joueur et afficher les repères. Exporter les entrées pour une
comparaison au même pas. Ajouter `&sansWorker` pour vérifier le repli. Dans `?anims`,
comparer « Phases du match » à « Planches sources ». Dans Paramètres, essayer volume
et coupure après un clic. Les nouvelles poses témoins restent accessibles via
`?anims&poses`, sans activation en match.

## Planches témoins du 13 novembre 2026

Reprise réelle sur `work` à partir de `a9f1291`, et non `e101c11` : les trois commits
locaux décrits dans la demande n'ont pas été retrouvés (branches, reflog, objets Git et
branches distantes consultées). Les résultats historiques ci-dessous restent historiques.
En particulier, `?court&seed=8126&watch&atelier` ne fournit pas l'inspecteur de pas physique
dans cette version initiale. Les contacts, le suivi au pas et les outils ont depuis été
réimplémentés sur autorisation explicite ; voir le bilan de reconstruction ci-dessus.

Nouveaux dessins disponibles dans `?anims&poses`, ou **Poses témoins** depuis `?anims` :

1. Choisir démarrage, freinage, pivot, défense, pas chassés ou recul.
2. Comparer la pose à l'identité validée à taille match, puis à ×3.
3. Vérifier les quatre orientations, 180/200/220 cm et les deux corpulences.
4. Lire à ×1 puis ×0,25, mettre en pause et avancer les quatre images.
5. Déplier les deux planches sources pour examiner les 48 dessins originaux.

Ce lot ajoute des images candidates, pas seulement un sélecteur. Il ne remplace aucune
pose du match. Le calage provisoire au bas de la silhouette ne valide pas un pied d'appui
ni l'absence de glissement. Le pivot et le recul doivent être examinés dans une trajectoire
avant déclinaison aux dix designs et activation. Les gabarits et miroirs de l'atelier
ne constituent pas une nouvelle validation des contacts avec ballon.

Les artefacts de cette reprise sont isolés sous
`/workspace/hoopsim-evidence/2026-11-13-witness/` ; ne pas les confondre avec les captures
historiques citées plus bas. Le script `validate.py` utilise le Chromium système et
Playwright Python ; le ffmpeg système est accessible à Playwright via
`PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` (lien local, aucune dépendance
ajoutée au dépôt). Les vidéos du match montrent uniquement la base actuelle : aucune
comparaison avant/après en match des nouveaux dessins n'est revendiquée.

Vérification de code de ce lot : **348 tests dans 37 fichiers**, lint et build réussis.
Avertissement Vite non bloquant sur le chunk Phaser. Aucun changement du moteur ou des
paramètres de réussite : calibration non relancée pour ce lot.

Contrôles Chromium de cette reprise : **576 cas** (6 gestes × 4 images × 4 orientations ×
3 tailles × 2 corpulences), silhouettes visibles et contenues dans le cadre. Captures
`witness-normal.png` et `witness-detail.png` examinées face à la référence : identité
reconnaissable, posture basse lisible ; ancrage et continuité dynamique restent à établir.
Lecture des six gestes à ×1 dans `poses-temoins-x1.webm` ; `validation.webm` conserve
le parcours complet. Aucun événement `pageerror` durant les contrôles.

Match de base réellement ouvert sur les trois URL demandées, avec essai clavier,
pause et vues 1280×720 / 1920×1080. Pause disponible, mais avance de 1/60 s absente
sur cette base. Pas de match complet, de trois graines ni de nouvelle validation
des dix designs dans ce lot. Aucun rejeu avant/après déterministe revendiqué.

Mesure limitée pendant le vrai match spectateur ×1, Chromium headless **avec enregistrement** :
233 callbacks `requestAnimationFrame` sur 5 015,7 ms (~46,5/s), intervalle médian 16,7 ms,
95e centile 33,4 ms. C'est une mesure de cadence navigateur, pas une mesure instrumentée
des rendus Phaser ; elle **ne démontre pas 60 FPS stables**. Les nouveaux atlas ne sont
chargés qu'à l'ouverture du comparateur et n'ont pas été ajoutés au rendu du match.

## Rejouer

Depuis le dépôt : `npm ci`, puis `npm run dev`. Dans le navigateur local :

- `?court&seed=8126` : 5 contre 5 jouable ; ZQSD, Espace tenu/relâché pour le tir,
  E pour la passe ou le changement de défenseur, A pour l’interception.
- `?court&seed=8126&watch` : les dix joueurs à l’IA, boutons ×1/×2/×4. Recharger pour
  repartir de l’entre-deux. Comparer à ×1 avant de ralentir les gestes dans l’atelier.
- `?anims` : sélectionner le geste, mettre en pause, puis avancer image par image ;
  vérifier face/dos × droite/gauche, les dix designs et les tailles 180/220 cm avec/sans
  corpulence forte. Les contacts et le nettoyage utilisent le même code que le match.

Pour les arrêts et demi-tours : tenir D, relâcher, puis tenir Q ; recommencer en portant le
ballon. Pour l’enchaînement réception/course/tir, passer avec E puis avancer et tirer dès la
prise. Le mode spectateur vérifie les remises, transitions d’équipe et changements de sens
à la mi-temps. La reproductibilité dépend de la graine **et des mêmes entrées au même pas**.

## Changements et réglages

- Nettoyage dans les rectangles natifs avant changement de gabarit : marqueurs magenta,
  débris détachés de 1–3 pixels, micro-trous fermés près du ballon. Cache partagé à la cuisson.
  Les PNG archivés ne sont pas repeints ; les grandes lacunes anatomiques ne sont pas inventées.
- Points de contact manquants des extensions, passes et réceptions mesurés sur la main
  dessinée, y compris après miroir. Masque circulaire de peau et de contour au premier plan,
  sans recopie du carré de maillot ; buste devant le ballon dans les vues de dos.
- Course sans ballon liée à la distance au sol (cycle de deux appuis sur 3,4 m), phase conservée
  quand on tourne, sans avance du cycle en l’air ou à l’arrêt. Seuil de mouvement : 0,18 m/s ;
  orientation stable sous 0,5 m/s pour éviter les retournements pendant les petits freinages.
- Dribble : 600 ms à l’arrêt ; cadence liée à la course, minimum ×0,55. Balle continue entre
  les huit images, rebond au parquet et reprise dans la paume. Ce changement affecte aussi
  la position physique du dribble utilisée pour mesurer les vols, sans changer leurs probabilités.
- Lâcher : extension visible pendant 65 ms, passe directement dans la pose de départ du ballon,
  raccord par décalage décroissant du vol en 80 ms de temps de jeu. Pas de fondu pour les grands
  écarts ou les dunks ; prise directement dans la paume. Gestes synchronisés au temps du monde,
  y compris en mode spectateur accéléré. Une réception au sol n’interrompt plus une reprise rapide.
- Durées de saut conservées : sommet du tir normal à 0,6 s, vol de 1,2 s ; contre/rebond à
  gravité 9,81 m/s² (exemple de meneur, graine 8126 : vol de 0,764 s). Accroche dunk de 0,3 s.
  Jauge, résultats et probabilités de `engine/` inchangés.
- Parquet à longues lattes et grain discret ; bordures, médaillon, raquettes, demi-cercles et
  repères de rebond retravaillés. Paniers avec verre transparent, reflets et fixations.
- Filets indépendants : trois rangs de losanges, ouverture/étirement sur 220 ms,
  oscillation amortie jusqu’à 1,1 s, amplitude ×1,5 sur dunk. Événement physique de traversée,
  distinct du score accordé : ni un fer qui ressort, ni un goaltending sans traversée ne l’animent.

## Résultats observés

- Référence avant changement : 339 tests réussis ; lint et compilation réussis.
- Après changement : 348 tests dans 37 fichiers, lint et compilation réussis.
- Chromium : commandes réelles de déplacement, arrêt, demi-tour, passe et tir en 5v5 ;
  match regardé sur la même graine, sans erreur JavaScript.
- Vérification automatique de 6 720 poses/gabarits/orientations : aucun débordement du cadre
  natif et aucun contact absent dans les trois poses tenues du tir, layup et dunk.
  Ce contrôle structurel ne remplace pas une appréciation artistique de chaque image.
- Séquence regardée d’environ deux minutes : 6 layups, 2 dunks, 10 tirs en suspension,
  6 lancers, 19 passes, 34 atterrissages ; 2 traversées à gauche et 10 à droite ; phases
  de jeu, ballon mort, remise et lancers exercées. Aucun message d’erreur JavaScript.
- Match complet de quatre quarts de trois minutes, déroulé dans le navigateur avec les
  dix IA, rotations et périodes : fin atteinte, 106–74, après 1 052,33 secondes simulées,
  sans erreur JavaScript. Les deux gestes de contre ont été observés.
- Compilation : avertissement Vite existant sur la taille du bundle Phaser ; aucun échec.

## Captures et vidéo de cette session

Les artefacts sont dans `/workspace/hoopsim-evidence/` (hors dépôt) :

- `comparaison-8126.mp4` : 19 s, avant/après côte à côte, même graine et mêmes dimensions.
- `before/` et `after/` : match à zoom normal, atelier ; `after/` contient aussi le plan large,
  le match jouable et la fin du match complet.
- `after/validation.json` et `after/full-match.json` : compteurs et résultats du navigateur.
- `validate.cjs` : contrôle navigateur de cette session. Installer Playwright hors dépôt avec
  `npm install --prefix /tmp/hoopsim-browser --cache /tmp/hoopsim-npm-cache playwright`,
  lancer Vite sur le port 5173, puis `node /workspace/hoopsim-evidence/validate.cjs`.
  Il utilise `/usr/bin/chromium`. Aucun paquet de test navigateur ajouté au projet.

La vidéo est une comparaison en temps réel, pas un rejeu déterministe image par image :
le chargement et la cadence de capture produisent un léger écart temporel. Les captures
au zoom normal et dans l’atelier permettent de comparer plus précisément les contours.
Les grands manques éventuels dans les PNG sources demanderaient une retouche artistique
spécifique ; le nettoyage livré reste volontairement limité aux débris et micro-trous.
