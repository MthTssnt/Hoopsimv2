# Direction artistique officielle — HoopSim

## Joueurs

Matheo a validé les dix designs des deux planches bleu/blanc et ivoire/bordeaux, puis demandé
leur utilisation officielle et le retrait de tous les anciens designs. Le rendu officiel est
chargé automatiquement dans le match du GM et sur `?court`. `?style` et `?anims` affichent le
catalogue de ces seuls joueurs.

La cible est le pixel-art de ses références : contour sombre net, grands yeux avec iris,
cheveux en mèches structurées, peau en tons chauds, corps athlétiques compacts, tenues à liserés
contrastés. La variété combine teints, coiffures, bandeaux, manches, poignets et genouillères,
silhouettes fines, élancées, trapues et larges. Aucun ancien rig ni ancien visage n'est conservé.

Les quatre planches officielles et leurs découpes sont dans `src/assets/players/`. Les sources
restent détaillées ; elles sont réduites sans lissage pour le match. Les joueurs font environ
39 à 51 pixels de haut selon leur taille réelle, dans un cadre de 64×80 qui laisse la place aux
bras levés. La largeur tient compte de la corpulence. Le numéro réel est reposé à l'endroit
après le miroir. Le ballon est toujours simulé et dessiné séparément. Le portrait du HUD est
issu de la tête du même joueur, pas d'un générateur de visages distinct.

## Poses et animations

Chaque design dispose de huit poses : arrêt face, arrêt dos, deux images de course, tir armé,
lâcher avec poignet cassé, passe à deux mains et saut bras levé. Elles sont assemblées dans
quatre blocs (diagonale bas/haut, droite/gauche). Les gestes suivent les phases et événements du
monde. Plusieurs gestes partagent encore des poses ; les transitions, le dribble et la course
de dos restent à enrichir dans ce style. Cette simplification visuelle ne change ni les
commandes, ni la jauge, ni la physique, ni les résultats du match.

Course et dribble restent sur un cycle de 600 ms, avec cadence bornée selon la vitesse. La main
forte du joueur est déterministe. Les tenues officielles sont pour l'instant fixes : bleu et
blanc pour l'équipe contrôlée, ivoire et bordeaux pour l'adversaire.

## Terrain, caméra et HUD

Le terrain et l'arène gardent la direction existante : résolution interne 640×360, 30 px/m,
profondeur comprimée à 0,66 et hauteur à 0,68. Le jeu reste en 3/4 avec mise à l'échelle entière,
pixels nets et plein écran par F. Deux paniers, parquet aux couleurs du club recevant, public
sur le pourtour, ombres au sol, anneau du joueur contrôlé, jauge de tir et annonces du match.

Le HUD affiche les scores et chronomètres, puis le portrait, le nom et les statistiques du
joueur contrôlé. Les noms restent dans les menus et le HUD, hors du terrain. Le menu pause
conserve le box score et l'option de simulation de la fin.

## Assets

`src/assets/CREDITS.md` précise la provenance des planches. Les anciens designs et leurs scènes
de comparaison sont retirés du dépôt courant ; leur historique Git reste consultable.
