# Joueurs : références et animations

Les dix designs validés restent la seule famille visuelle autorisée.

- `team-navy.png`, `team-ivory.png` : références approuvées, cinq joueurs par tenue, face/dos/course.
- `actions-navy.png`, `actions-ivory.png` : références de gestes des mêmes joueurs.
- `courtDesigns.ts`, `actions.ts` : découpes mesurées de ces références.
- `painted/` : poses complètes validées pour les animations.
- `sources.ts` : sources du match et de l'atelier, chargées à la demande.

Les corps ne sont plus assemblés à partir de pièces. `painted/manifest.json` décrit les images
entières avec leurs repères de torse, de pied et de ballon. `motionArt.ts` place ces images sans
rotation de membre ; `bake.ts` les range dans un atlas rogné avec un cadre d'origine fixe.
Taille et corpulence adaptent le personnage entier. Le numéro est reposé après le miroir.
Le ballon possède sa propre trajectoire et sa propre texture.

84 images par design et par vue face/dos. Quatre orientations en match, course/dribbles en
8 images, autres gestes en 4. Le cadre est de 96×96 unités logiques, dessiné à double résolution.
Il conserve les marges pour les mains et les pieds des joueurs grands et corpulents.

L'onglet Animations du GM ou `?anims` permet de comparer les poses à la référence, au ralenti
ou image par image. `?style` ouvre les dix designs. Voir `docs/ART_DIRECTION.md` et les crédits.
