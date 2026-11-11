# CLAUDE.md — HoopSim

## Vision
HoopSim est un jeu de basket rétro dans le navigateur, dans l'esprit de Hoop Land :
matchs 2D en pixel-art jouables au clavier/manette + couche de gestion sur plusieurs saisons
(college → pro), avec trois façons de jouer : Carrière (un joueur), GM/Franchise (une équipe),
Commissioner (toute la ligue). Tout match peut aussi être simulé.
Aujourd'hui le jeu est un GM fonctionnel (voir README.md) ; il manque la partie jouable.

## Règles non négociables
- Reproduire les MÉCANIQUES et le ressenti de Hoop Land, jamais ses assets : sprites,
  palette exacte, polices, UI, nom, logos, noms de joueurs/équipes restent originaux.
- Aucun vrai joueur, aucune équipe ou marque NBA/NCAA.
- Les repos de référence sont de l'inspiration d'architecture. Ne jamais copier de code
  d'un repo sans licence permissive vérifiée (zengm n'est PAS open source).
- Ne pas casser le moteur de simulation existant ni la calibration (`npm run calibrate`).

## Stack & environnement
- Vite + React 19 + TypeScript, Vitest, oxlint. Déploiement Vercel auto depuis GitHub
  (MthTssnt/hoopsimv2). Le code doit builder tel quel (`npm run build`).
- Match jouable : **Phaser 4**, monté dans React via `src/match/PhaserGame.tsx` et chargé
  à la demande (chunk séparé). Menus/gestion : React.
- **Avant d'écrire du code Phaser, lire le skill correspondant dans
  `node_modules/phaser/skills/<sujet>/SKILL.md`**. Phaser 4 diffère de Phaser 3.
- Joueurs : seuls les dix designs officiels de `src/assets/players/` sont autorisés. Le rendu
  commun est `src/match/render/sprites/bake.ts`, utilisé par défaut dans tous les matchs ;
  `?style` et `?anims` présentent ces seuls designs. Ne pas réintroduire les anciens rigs,
  visages modulaires ou rendus en volumes. Voir `docs/ART_DIRECTION.md`.
- Je suis derrière un VPN en Chine : git/npm peuvent échouer (ENOTFOUND). Registry npm
  configuré côté machine (registry.npmmirror.com), PAS dans le repo. Minimiser les
  dépendances ; toute nouvelle dépendance doit être justifiée.

## Architecture
Existant (à préserver) :
```
src/engine/   moteur pur TS, sans React/DOM — rng (mulberry32, seedé), types, generate,
              ratings, coach, schedule, simGame (possession par possession), simSeason,
              playoffs, offseason, stats ; tests dans engine.test.ts
src/state/store.ts   état de partie + sauvegarde locale
src/ui/       interface React (onglets, GameViewer, modales)
scripts/calibrate.ts vérification des moyennes de la ligue
```
À construire :
```
src/match/    rendu + contrôle du match (Phaser)
  config.ts       résolution interne 640×360, 30 px/m, projection 3/4 (valeurs de render/artConfig.ts)
  PhaserGame.tsx  pont React ⇄ Phaser
  scenes/         MatchScene, HudScene, StyleScene (`?style`, planche de la DA)
  render/         arène, panier, sprites officiels, HUD, projection, caméra
  input/          clavier + Gamepad API, mapping configurable
  ai/             IA des joueurs non contrôlés
  physics/        trajectoire du ballon, cercle, planche
src/assets/   sprites originaux ou packs sous licence (voir CREDITS.md)
docs/         GAMEPLAY_SPEC.md (fait foi), ENGINE_VIEW_CONTRACT.md, ROADMAP.md
```
Principe : `engine/` décide (résultats, stats, probabilités à partir des attributs),
`match/` affiche et transmet les inputs. Un match joué et un match simulé produisent le
même box score, enregistré par les mêmes fonctions de `simSeason`.
Test du rendu en local ou sur Vercel : ajouter `?court` à l'URL (match) ou `?style` (DA).

## Références (lire, ne pas copier)
- github.com/rBrown1405/Basketball-game — moteur sans DOM / vue Canvas, jauge de tir clutch.
- github.com/RomanDivkovic/basketballdynasty — découpage modulaire d'un moteur TS.
- github.com/NateWritesCode/basketball-simulator — simulateur TS calé sur du play-by-play réel.
- github.com/zengm-games/zengm — saison/draft/trades (inspiration uniquement).
- Wiki Hoop Land (Fandom) — modes et progression.

## Direction artistique
- Pixel-art, résolution interne 640×360 à 30 px/m, `pixelArt: true`, mise à l'échelle entière
  (F : plein écran ; ×3 en 1080p, ×2 dans une fenêtre).
- Sprites, décor et HUD selon `docs/ART_DIRECTION.md` (règles chiffrées des sprites : font foi).
- Vue plongeante de 3/4 (profondeur et hauteur écrasées ~2/3), toute la profondeur du terrain
  à l'écran, joueurs à grosse tête : cadrage repris de la capture de référence de Matheo,
  avec nos propres dessins, couleurs, polices et HUD.
- Décors originaux dessinés en code ; joueurs officiels dans `src/assets/players/`, provenance dans CREDITS.md.
- Tout asset externe : licence notée dans `src/assets/CREDITS.md`.

## Qualité
- Tests Vitest pour toute logique de `engine/` et la physique ; déterminisme par seed.
- Après chaque tâche : `npm run build`, `npm run test`, `npm run lint` doivent passer ;
  `npm run calibrate` si le moteur a changé.
- 60 fps visés. Aucune logique de jeu dans les composants React.

## Façon de travailler
- Toujours proposer un plan avant de coder une phase et attendre ma validation.
- Petits incréments ; finir chaque tâche en me disant exactement quoi tester sur la preview.
- Mettre à jour `docs/ROADMAP.md` en fin de session.
- Si une info de gameplay manque dans `docs/GAMEPLAY_SPEC.md`, me demander plutôt que deviner.
