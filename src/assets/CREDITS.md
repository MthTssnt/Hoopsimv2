# Crédits des assets

| Fichiers | Source | Auteur | Usage |
| --- | --- | --- | --- |
| `src/assets/players/team-navy.png`, `team-ivory.png` | Déclinaisons des références fournies et validées par l'utilisateur | OpenAI image generation pour HoopSim | Designs officiels (10 joueurs) |
| `src/assets/players/actions-navy.png`, `actions-ivory.png` | Gestes des mêmes designs validés | OpenAI image generation pour HoopSim | Poses officielles de basket |
| `src/assets/palette.ts`, `src/assets/sprites/arena.ts`, `jerseyDigits.ts`, `src/match/render/arena/`, polices et HUD | Assets originaux dessinés en code | Équipe HoopSim | Propres au projet |
| `src/assets/court/maple.png` | Texture originale d'érable en lattes | OpenAI image generation pour HoopSim | Parquet du match |
| `src/assets/court/ball-spin.png` | Planche originale de six vues de ballon | OpenAI image generation pour HoopSim | Ballon du match et atelier |
| `src/assets/players/painted/*.png`, `manifest.json` | Poses entières redessinées depuis les dix designs validés, puis découpées avec leurs repères | OpenAI image generation pour HoopSim, intégration HoopSim | Animations validées (84 poses × 2 vues × 10 designs) |
| `src/assets/players/locomotion/0-0-{down,up}.png` | Nouveaux dessins entiers depuis le joueur officiel « Afro, bandeau jaune » et ses atlas face/dos | OpenAI image generation pour HoopSim, 13 novembre 2026 | 48 poses témoins sans ballon, candidates dans l'atelier ; non activées en match |
| `src/assets/players/clubhouse/sources/*.png`, `body.png`, `heads.png`, `manifest.json` | Références Clubhouse fournies par l’utilisateur (sprite #45, cinq portraits, poses et vidéo). Poses entières, têtes interchangeables, découpage et repères mesurés ; aucun ballon incorporé | OpenAI image generation pour HoopSim, intégration HoopSim, 16 novembre 2026 | Nouveau rendu Clubhouse en match, portraits et atelier ; 160 cellules sources front/dos (128 initiales + 32 de fidélité) |
| `src/assets/branding/clubhouse-sources/crests.png`, `teams/*.svg`, `teams/small/*.svg` | Créations originales ; guerrier Boston et lion couronné New York guidés par les références Clubhouse ; palettes des 30 identifiants existants | OpenAI image generation pour HoopSim, intégration et conversion pixel SVG HoopSim, 16 novembre 2026 | 30 écussons × 2 niveaux de détail, gestion et HUD Phaser |


### Fidélité Clubhouse (passe du 16 novembre 2026)

- `players/clubhouse/reference/sprite-45.png` et `portrait-45.png` : copies exactes des dessins 02 et 03 du kit Clubhouse fourni par l’utilisateur ; le rendu retire seulement le fond de présentation connecté et les fragments de cadre.
- `players/clubhouse/sources/dribble-fidelity.png` : planche originale générée pour cette passe à partir des références fournies (32 poses, face/dos et sur place/en déplacement). Atlas préparé avec `scripts/prepare-clubhouse-fidelity.py`.
- Boston et New York : intérieur illustré conservé, contour pixel SVG nettoyé avec `scripts/clean-clubhouse-pilot-crests.py`, palettes officielles inchangées.
