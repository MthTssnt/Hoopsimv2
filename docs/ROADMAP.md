# Roadmap HoopSim

Légende : ✅ fait · 🔄 en cours · ⬜ à faire. Chaque phase laisse le jeu jouable et déployable.

## Phase 0 — Environnement ✅
- ✅ Phaser 4 ajouté, monté dans React, chargé à la demande (`?court` pour tester)
- ✅ CLAUDE.md, permissions Claude Code, .gitignore, docs de cadrage

## Phase 1 — Fondations du match ✅
- ✅ Notes Hoop Land rangées dans GAMEPLAY_SPEC.md (périmètre phase 1, décisions d'architecture, questions ouvertes)
- ✅ 1. ENGINE_VIEW_CONTRACT.md (version phase 1) + attributs détente, dunk arrêté, dunk en mouvement
- ✅ 2. Modèle de tir dans `engine/` (timing, contestation, mouvement, dunk, contre, faute)
- ✅ 3. Terrain à l'échelle réelle + physique du ballon (cercle, planche, rebond), démo sur `?court`
- ✅ 4. Joueur contrôlable, caméra, paramètres (touches, mode et vitesse de tir, niveau)
- ✅ 4b. Vue 3/4 en 480×270, terrain aux couleurs de l'équipe, joueurs à grosse tête (référence de Matheo)
- ✅ Style S1–S3. ART_DIRECTION.md, palette de 32 couleurs, sprites modulaires (6 gabarits, têtes, coiffures, peaux, animations), panier massif, arène, HUD, scène `?style`
- ✅ Noms originaux : retrait des noms de joueurs NBA réels, « Pistons Mécaniques » devient Détroit Gears (calibration identique)
- ✅ Décisions sur `?style` : cadrage de 384×216 / 18 px/m gardé, joueurs ×1,1, étiquettes au nom de famille
- ✅ Style S3b. `?style` en 640×360 à 30 px/m (même cadrage, 1,67× plus de pixels), sprites redessinés plus fins, plein écran (F)
- ✅ Style S3c. Numéros lisibles (police dédiée, jamais en miroir), gabarits accentués, oreille, étiquettes complètes, noms uniques dans la ligue, panier ancré, palette en debug
- ✅ Style S3d. Sprites refaits selon les règles chiffrées de Matheo (tête 14×14, torse 8, bras de 2 px cernés, gabarits −2/+3 rangées, visage de face, 3 expressions), retour en 480×270 à 22,5 px/m, vues gros plan et poses dans `?style`
- ✅ Correctif moteur : un rookie ne reprend plus l'identifiant d'un joueur actif (effectifs en double après 2 saisons) ; réparation des sauvegardes au chargement
- ✅ S3d validé (comparaison avec la planche v2 quand elle arrivera)
- ✅ Style S4. Style de `?style` appliqué au match : 22,5 px/m, mise à l'échelle entière et plein écran (F), arène du terrain entier (deux paniers, public tout autour), sprites cuits du rig avec ballon tenu dans la main, tableau de score et carte du joueur, debug masqué (H)
- ✅ S4b. Retours de Matheo sur S4 : appuis qui accrochent (freinage, virages, pas au rythme de la vitesse, rebond de course), saut en course ≤ ~2 m, ballon dribblé devant le corps, vue de dos en montant
- ✅ 5. Tir avec jauge + layup (jauge verticale, annonce du lâcher, tir forcé à l'atterrissage, layup en attaquant le cercle, points au tableau de score)
- ✅ 6. Dunk simple (simple appui dans la moitié de la raquette, prioritaire sur le layup ; smash vérifié par la physique ; accroche au cercle ; DUNK et secousse)
- ✅ 7a. 1 contre 1 contre l'IA (panier de droite, ressortie derrière l'arc, panier non valable, premier à 11) : contestation mesurée dans le tir et le dunk, IA qui attaque selon ses tendances, défend avec un temps de réaction et va au rebond, tableau de score, RESSORS / NON VALABLE, bandeau de fin
- ✅ 7b. Contre (main en l'air sur le ballon en montée, le moteur tranche), faute sur tout contact pendant le tir (ballon au tireur si raté), goaltending ; pose « contre », messages CONTRE / FAUTE / GOALTENDING ; IA qui contre et ne rentre plus dans le tireur

## Phase 2 — Vrai match 🔄
- ✅ Décisions de Matheo (contrôle, durée 4 × 3 min, fatigue + coach auto, lancers à la jauge, règles, touches E/A, Live Sim)
- ✅ 8. 3 contre 3 sur un panier : passes, coéquipiers IA (écartement, coupes, passes), défense d'équipe (duels, aide), changement de joueur contrôlé (`?court`, `&format=1|2|3`)
- ⬜ 9. Interception (touche A, lignes de passe) et pertes de balle
- ⬜ 10. 5 contre 5 sur terrain entier : chrono, shot clock, 8 s, retour en zone, hors-jeu, remises en jeu, entre-deux, mi-temps
- ⬜ 11. Fautes d'équipe, bonus, 6 fautes, lancers francs à la jauge
- ⬜ 12. Fatigue, remplacements automatiques, box score en direct, menu pause
- ⬜ 13. Match joué dans le GM (« Jouer », « Regarder », « Simuler »), enregistré par `simSeason`

## Phase 3 — DA et ressenti ⬜
- ✅ Direction artistique et sprites de base (chantier style S1–S4, voir phase 1)
- ⬜ Animations complètes, caméra, HUD final, sons

## Phase 4 — Gestion étendue ⬜
- ⬜ Agents libres, trades, college et recrutement

## Phase 5 — Modes ⬜
- ⬜ Carrière, GM, Commissioner

## Phase 6 — Ligues et sauvegarde ⬜
- ⬜ Format de ligue texte éditable, éditeur, export/import, IndexedDB
