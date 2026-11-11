# Direction artistique — HoopSim

## Designs validés

Les dix personnages des planches bleu/blanc et ivoire/bordeaux restent les références officielles.
Leurs visages, coiffures, teints, tenues, accessoires et gabarits font foi. Les quatre planches
`team-*` et `actions-*` sont conservées comme références originales.

La première révision animée, composée de membres tournés séparément et réduite dans une image
de 640×360, a été refusée : silhouettes différentes des prototypes et détails illisibles.
Cette technique et ses pièces ne sont plus utilisées.

## Animations validées

Les nouvelles poses sont des **personnages entiers dessinés**, dans le style des références,
stockés dans `src/assets/players/painted/`. Aucune articulation ou tête n'est reconstruite en
code. Chaque design possède 84 images de face et 84 de dos : 4 pour l'arrêt et chacun des
14 gestes, 8 pour la course et chacun des deux dribbles. Les vues gauche sont des miroirs du
personnage entier ; le vrai numéro est reposé ensuite à l'endroit.

Les découpes suivent les silhouettes opaques réelles. Elles ne supposent pas des rangées de
hauteur constante dans les planches générées. Le torse sert de repère horizontal et les pieds
de repère vertical : une main tendue ne déplace pas tout le joueur dans sa case. Les textures
rognées gardent le même cadre logique de 96×96, pied à la ligne 84, et de larges marges. La
cuisson refuse une silhouette qui touche le bord, y compris pour les grands gabarits.

Le dessin conserve deux pixels natifs par unité logique jusqu'au rendu du match : sortie
1280×720 pour une vue logique de 640×360. La taille à l'écran, les distances et le cadrage
restent identiques. Les joueurs mesurent 39 à 51 unités logiques, soit 78 à 102 pixels natifs.
Le portrait conserve également ce détail. Ne pas réduire à nouveau les personnages à 40 pixels
puis les agrandir : les détails des yeux, des doigts et des vêtements seraient perdus.

## Ballon et phases du monde

Le ballon reste séparé du personnage. Les emplacements de contact viennent des repères peints
avec chaque pose. Pendant le dribble, une seule phase de 600 ms commande la foulée, le bras
et le ballon. Entre le lâcher descendant et la reprise dans la paume, une trajectoire libre
atteint le parquet. Le calque de doigts provient du personnage complet, à sa position réelle,
et reste devant le ballon. Les autres gestes suivent les phases du saut, du lâcher, de la
passe et de la réception du monde ; la physique et les résultats ne dépendent pas du dessin.

Ballon orange chaud, coutures sombres, reflet et six rotations en 20×20 natifs pour un diamètre
logique de 10. Parquet d'érable peint, raquettes et bandes bleu nuit, lignes ivoire et accents
or. Ombres, anneau de contrôle, jauge et annonces restent indépendants des sprites.

## Atelier

L'onglet **Animations** du GM et `?anims` utilisent les mêmes images et repères que le match.
Choix des 18 animations, des 10 designs, de quatre orientations, de la taille et de la
corpulence ; lecture ×0,25 à ×2, pause et avance image par image. La référence validée est
visible à côté de la pose. `?style` ouvre le catalogue des dix joueurs.

Matheo a validé les captures réelles et les animations le 11 novembre 2026, puis demandé
leur publication sur `main`. Provenance : `src/assets/CREDITS.md`.
