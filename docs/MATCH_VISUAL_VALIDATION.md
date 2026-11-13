# Validation du rendu en match — graine 8126

## Planches témoins du 13 novembre 2026

Reprise réelle sur `work` à partir de `a9f1291`, et non `e101c11` : les trois commits
locaux décrits dans la demande n'ont pas été retrouvés (branches, reflog, objets Git et
branches distantes consultées). Les résultats historiques ci-dessous restent historiques.
En particulier, `?court&seed=8126&watch&atelier` ne fournit pas l'inspecteur de pas physique
dans cette version. Une sauvegarde des lots absents est nécessaire pour reprendre leurs
contacts explicites, leur suivi au pas et leurs outils de preuve sans les réinventer.

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
