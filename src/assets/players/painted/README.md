# Planches de personnages complets

`contacts.json` a été reconstruit le 13 novembre 2026 à partir des repères et du
rendu conservés : 1 680 entrées (ballon, paume, contact, occultation), 525 masques
de doigts décrits par lignes de pixels dans le rectangle source. Le rendu lit ces
données explicites et applique au masque la même échelle et le même miroir qu'au
personnage entier. Les mentions de mesure automatique ci-dessous décrivent la
base historique utilisée pour cette reconstruction, pas une redétection en match.

20 atlas : deux vues (face/dos) pour chacun des cinq designs des deux tenues. Chaque atlas
contient les 84 images de `MOTIONS`, dans l'ordre de `MOTION_FRAMES` : arrêt 4, course 8,
dribble 8, dribble sur place 8, puis 14 gestes de 4 images. Ne pas supposer une grille régulière.

`manifest.json` décrit les rectangles exacts, leur décalage dans le dessin de base et les repères
peints du ballon et du maillot. Le dessin de base est de 160×192 pixels natifs, torse à x=80,
pied à y=168 : deux pixels par unité logique, repère logique (40,84). Le cadre de rendu plus
large (192×192 natifs) conserve une marge pour les grands gabarits. Le repère source est exporté
par `PAINTED_ORIGIN` ; il ne doit pas être confondu avec le centre du cadre de rendu.

Les images sont des personnages peints entiers, sans ballon incrusté. Les marqueurs de ballon
ont servi à mesurer les contacts puis ont été retirés des pixels. La phase libre du dribble est
calculée dans `motion.ts`, avec un rebond au parquet ; les contacts gardent les repères dessinés.
Le numéro réel est ajouté au rendu. Les vues gauche sont produites en miroir avant ce numéro.

Les sources détaillées ont été générées pour HoopSim à partir des références validées de
`team-navy.png` et `team-ivory.png`. Elles ont été contrôlées par silhouettes connexes, sans
couper les poses aux frontières supposées des rangées. Les atlas livrés sont autonomes :
aucun outil de génération ni script externe n'est nécessaire au lancement du jeu.


Au chargement, `motionArt.ts` met en cache une version nettoyée de chaque rectangle natif :
restes magenta et poussières connexes de 1–3 pixels retirés, micro-trous fermés réparés
près des repères. Les PNG sources restent les références archivées. Les contacts manquants
des extensions et réceptions sont mesurés sur les mains dessinées, puis le masque de doigts
exclut le maillot. Le même chemin sert au match et à l’atelier ; aucun lissage n’est appliqué.
