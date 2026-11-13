# Planches témoins — locomotion sans ballon

Deux nouvelles planches de 24 personnages entiers : `0-0-down.png` et `0-0-up.png`.
Identité témoin : **Afro, bandeau jaune**, tenue bleue, design 0 de l'équipe 0.
Générées le 13 novembre 2026 avec OpenAI image generation à partir de
`team-navy.png` et des deux atlas validés `painted/0-0-{down,up}.png`.
Le dos a également reçu la nouvelle planche de face comme référence.
Aucune pièce anatomique n'est assemblée ou tournée en code.

Chaque planche contient six séquences de quatre images : démarrage, freinage, pivot,
posture défensive, pas chassés, recul. Le miroir porte sur le personnage entier.
Ces candidats sont visibles dans `?anims&poses` ou l'onglet **Poses témoins** de l'atelier.
Ils ne remplacent pas les 84 poses officielles et ne sont pas activés en match.

`frames.json` contient les limites mesurées des silhouettes, avec deux pixels de marge.
Les séparations de rangées ont été examinées sur les images, pas déduites d'une grille
uniforme : y = 0, 246, 492, 737, 951, 1176, 1402. Colonnes : 0, 280, 560, 840, 1122.
Les limites utilisent alpha > 16 pour ignorer le bruit presque transparent de génération ;
les PNG originaux restent intacts, sans remplissage de trous ni nettoyage aveugle.

## Comparaison et limites

- Afro, bandeau, peau, tenue et bracelets restent reconnaissables de face et de dos.
- Les bras ouverts et le bassin bas distinguent les séquences défensives de la course.
- La prévisualisation emploie une échelle source fixe de 233 pixels de hauteur debout,
  les mêmes hauteurs cibles que `playerScale`, et +10 % en largeur pour la corpulence.
  Elle ne redimensionne pas chaque flexion à la hauteur d'un joueur debout.
- L'ancrage par le bas de la silhouette reste provisoire. Le pivot n'a pas encore de
  pied physique stable mesuré ; les pas chassés et le recul demandent une vérification
  de trajectoire. Le miroir ne démontre pas à lui seul la cohérence des appuis.
- Les cadences de 420/600/800 ms sont des cadences d'étude dans l'atelier, sans effet
  sur les commandes ou les timings du monde. Les gestes ponctuels s'arrêtent sur leur
  dernière pose, les cycles défensifs bouclent.
- Avant activation : repères de torse et d'appui explicites, contrôle des contours/halos
  à taille match, vérification en mouvement à ×1 puis déclinaison aux neuf autres designs.
- Les poses avec ballon, les contacts, la physique, la jauge et les probabilités n'ont
  pas été modifiés par ce lot.
