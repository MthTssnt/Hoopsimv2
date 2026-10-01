# Roadmap HoopSim

Légende : ✅ fait · 🔄 en cours · ⬜ à faire. Chaque phase laisse le jeu jouable et déployable.

## Phase 0 — Environnement ✅
- ✅ Phaser 4 ajouté, monté dans React, chargé à la demande (`?court` pour tester)
- ✅ CLAUDE.md, permissions Claude Code, .gitignore, docs de cadrage

## Phase 1 — Fondations du match 🔄
- ✅ Notes Hoop Land rangées dans GAMEPLAY_SPEC.md (périmètre phase 1, décisions d'architecture, questions ouvertes)
- ✅ 1. ENGINE_VIEW_CONTRACT.md (version phase 1) + attributs détente, dunk arrêté, dunk en mouvement
- ✅ 2. Modèle de tir dans `engine/` (timing, contestation, mouvement, dunk, contre, faute)
- ✅ 3. Terrain à l'échelle réelle + physique du ballon (cercle, planche, rebond), démo sur `?court`
- ✅ 4. Joueur contrôlable, caméra, paramètres (touches, mode et vitesse de tir, niveau)
- ⬜ 5. Tir avec jauge + layup
- ⬜ 6. Dunk simple
- ⬜ 7a. 1 contre 1 : IA attaque/défense + possession
- ⬜ 7b. Contre, goaltending, fautes

## Phase 2 — Vrai match ⬜
- ⬜ 5v5, passes, défense, IA de base, changement de joueur contrôlé
- ⬜ Règles : chrono, shot clock, fautes, lancers francs
- ⬜ Box score enregistré comme un match simulé

## Phase 3 — DA et ressenti ⬜
- ⬜ Sprites et animations, caméra, HUD, sons

## Phase 4 — Gestion étendue ⬜
- ⬜ Agents libres, trades, college et recrutement

## Phase 5 — Modes ⬜
- ⬜ Carrière, GM, Commissioner

## Phase 6 — Ligues et sauvegarde ⬜
- ⬜ Format de ligue texte éditable, éditeur, export/import, IndexedDB
