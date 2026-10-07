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

## Phase 2 — Vrai match ✅
- ✅ Décisions de Matheo (contrôle, durée 4 × 3 min, fatigue + coach auto, lancers à la jauge, règles, touches E/A, Live Sim)
- ✅ 8. 3 contre 3 sur un panier : passes, coéquipiers IA (écartement, coupes, passes), défense d'équipe (duels, aide), changement de joueur contrôlé (`?court`, `&format=1|2|3`)
- ✅ 9. Interception : vol sur le porteur avec A (faute de main trop près, déséquilibre si raté), passes interceptées ou déviées dans la ligne (au sol, bras allongé avec A, en sautant), pertes de balle notées ; IA qui tente des vols, coupe les lignes et évite les lignes occupées ; messages VOL / INTERCEPTION / DÉVIÉE
- ✅ 10. 5 contre 5 sur terrain entier (`?court`, demi-terrain avec `&format=1|2|3`) : entre-deux au saut, quart-temps (durée réglable), mi-temps et changement de panier, prolongation, chrono arrêté sur ballon mort, shot clock, sorties et remises (E), 8 s, retour en zone, 5 s, 24 s ; IA qui monte le ballon, se place à 5, revient en défense, défend par poste ; tableau de score vivant et bandeaux
- ✅ 11. Retours de Matheo sur le 10 : lancers francs à la jauge (2 ou 3 sur un tir raté selon la zone, 1 après un panier, remise sur faute hors tir), jauge toujours à côté du tireur (même après un rebond) et appui gardé en retombant, sauts sans ballon à la vitesse réelle, défense automatique du joueur contrôlé ; fautes d'équipe, bonus et 6 fautes faits avec le 12
- ✅ 12. Fatigue et rotation à l'échelle du match (énergie et coach de la simulation sortis dans `engine/rotation.ts`, `calibrate` identique), changements automatiques aux ballons morts (le remplaçant prend le corps et le contrôle), fautes d'équipe par période, bonus (2 lancers dès la 6e faute), élimination à 6 fautes, box score en direct (minutes, tirs, lancers, rebonds, passes décisives, interceptions, contres, pertes, fautes, +/-), carte du joueur vivante (énergie, PTS REB PD), messages BONUS / 6 FAUTES / CHANGEMENT, menu pause (Échap, P ou bouton) avec le box score
- ✅ 13. Match joué dans le GM : « Jouer », « Regarder » (×1, ×2, ×4) ou « Simuler » le match de ton équipe, en saison régulière et en playoffs ; `playGame` = `simulateGame` + `recordGame` (`calibrate` identique), le match joué enregistré par les mêmes fonctions (classement, stats, blessures, feuille) ; « Simuler la fin » (IA contre IA en accéléré, depuis l'état du match) ; arène du club qui reçoit, tenue extérieure quand les couleurs sont proches

## Phase 3 — DA et ressenti 🔄
- ✅ Direction artistique et sprites de base (chantier style S1–S4, voir phase 1)
- ✅ Décisions de Matheo : redesign des joueurs d'abord, puis poses et arbitre, sons synthétisés en code, caméra et HUD ; coach du match joué réglé pour moins de changements ; gestes avancés dans une phase à part
- 🔄 14. Redesign des joueurs et du ballon en 640×360 à 30 px/m sur `?style` (joueur standard de 43 px, tête 16×16, visage et coiffures redessinés, corps plus mince, ballon 8×8, vue avant / après) : à valider par Matheo
- ⬜ 15. Application au match en 640×360 (cadrage, ombres, anneau, étiquettes, messages, HUD, cuisson du banc)
- ⬜ 16. Poses complètes (passe, réception, vol, déséquilibre, défense, lancer, réception au sol, remise, célébration, déçu), arbitre, célébrations, coach du match joué
- ⬜ 17. Sons synthétisés en code (ballon, cercle, filet, planche, chaussures, sifflet, sirène, public), volume et coupure
- ⬜ 18. Caméra et HUD final (cadrage, transitions, tableau de score final, aides de touches, « remplir l'écran »)

## Phase 3 bis — Gestes avancés ⬜
- ⬜ Step back, euro step, floater, spin, alley-oop, self-lob, dunk 360 (touches à choisir avec Matheo)

## Phase 4 — Gestion étendue ⬜
- ⬜ Agents libres, trades, college et recrutement

## Phase 5 — Modes ⬜
- ⬜ Carrière, GM, Commissioner

## Phase 6 — Ligues et sauvegarde ⬜
- ⬜ Format de ligue texte éditable, éditeur, export/import, IndexedDB
