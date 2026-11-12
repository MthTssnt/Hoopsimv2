# Validation du rendu en match — graine 8126

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
