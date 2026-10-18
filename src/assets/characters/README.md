# Personnages : système de pièces (style 5, « rétro peint »)

Une tête est assemblée à partir de pièces, une par catégorie. Tout est en données pures
(grilles de pixels), posé par rapport aux ancrages de la forme de tête : jamais en coordonnées
absolues.

```
types.ts        types communs (grilles, ancrages, pièces, expressions)
colors.ts       identifiants de couleur et rampe de 5 tons du style (paintedRamp)
registry.ts     registre : une ligne par pièce, poids au tirage
appearance.ts   PlayerAppearance (sérialisable), tirage déterministe, réparation (normalize)
composeHead.ts  compositeur : ordre de dessin fixe, masques, modelé
parts/<catégorie>/<id>.ts   une pièce par fichier
```

## Tirage (pour l'instant)

Les joueurs générés ne reçoivent que **les visages de la planche du style 5** (étape 1) : yeux en
points, sourcils doux, nez bouton, bouche fine, oreilles normales, les cinq formes de tête de la
planche, barbe, bouc ou moustache, bandeau aux couleurs de l'équipe. Les autres pièces ont un
poids 0 dans `registry.ts` : elles restent disponibles (éditeur, apparences sauvegardées) et
reviendront au tirage avec le travail sur les visages.

`PlayerAppearance.dominantHand` (droite ou gauche, ~12 % de gauchers) dit la main qui dribble et
qui tire (rendu seulement, voir `src/match/render/sprites/sheet2d.ts`).

## Catégories

| Catégorie | Dossier | Ancrage | Orientations |
| --- | --- | --- | --- |
| Forme de tête | `headShapes/` | (définit les ancrages) | silhouette de face et de dos |
| Oreilles | `ears/` | `earNear` (+ `earFar` de dos) | face et dos |
| Yeux | `eyes/` | `eyeNear`, `eyeFar` | face (masqués de dos) |
| Sourcils | `brows/` | `browNear`, `browFar` | face (masqués de dos) |
| Nez | `noses/` | `nose` | face (masqué de dos) |
| Bouche | `mouths/` | `mouth` | face (masquée de dos) |
| Pilosité faciale | `facialHair/` | `mouth` | face et dos |
| Cheveux (2 calques) | `hair/` | `hairline` | face et dos, arrière et avant |
| Accessoires | `accessories/` | `hairline` | face et dos |

Yeux, sourcils et bouche fournissent **les 4 expressions** (neutre, joie, cri, déçu) : une
expression est une variante de ces pièces, jamais une tête à part. Le jeu passe « joyeuse » →
joie, « neutre » et « concentrée » → neutre.

## Ordre de dessin (fixe)

1. cheveux arrière · 2. tête (peau) · 3. oreilles · 4. pilosité · 5. nez · 6. bouche · 7. yeux ·
8. sourcils · 9. cheveux avant · 10. accessoires

Recouvrements gérés par des masques (pas de cas particuliers par pièce) :
- de dos, nez, bouche, yeux et sourcils sont masqués ;
- les pièces du visage et la pilosité ne se posent que sur la tête (sauf un nez `outside`, dont
  la bosse dépasse du profil) ;
- la bouche et le nez passent devant la pilosité ;
- les mèches avant n'entrent jamais dans la zone du visage de la forme (`face` : colonnes 5-9
  dès la rangée 3), sauf une frange déclarée (`fringeRow`) : les sourcils et les yeux ne sont
  jamais couverts ;
- les mèches (avant et arrière) ne couvrent l'oreille que si la coiffure est `coversEars` ;
- un accessoire `wrap` est découpé sur la tête déjà peinte (cheveux compris).

## Couleurs

Les grilles n'utilisent que des emplacements de couleur, recolorés à la cuisson avec les rampes
de 5 tons (reflet chaud, clair, base, ombre violette, ombre profonde) :

| Matière | Emplacements | Couleur |
| --- | --- | --- |
| Peau | `1` reflet · `5` clair · `2` base · `3` ombre · `4` ombre profonde | teint |
| Cheveux (et sourcils) | `r` `h` `H` `D` `E` | couleur des cheveux |
| Pilosité | `f` `b` `B` `F` | sa propre couleur (barbe grise sur cheveux bruns) |
| Yeux | `i` iris · `n` pupille · `w` blanc | couleur des yeux |
| Accessoire | `c` `C` `d` `K` | couleur de l'accessoire (« equipe » : couleur secondaire) |

L'ombre profonde de chaque matière sert de contour (contour doux du style 5).

## Ajouter une pièce

1. **Créer le fichier** `parts/<catégorie>/<id>.ts`, en copiant une pièce voisine. L'`id` est
   le nom du fichier : c'est lui qui est sauvegardé, ne plus le changer ensuite.
2. **Dessiner les grilles** par rapport à l'ancrage de la catégorie (`grid([dx, dy], ...rangées)`,
   coin haut-gauche en `ancrage + [dx, dy]`), avec les seuls emplacements de la catégorie :
   - yeux, sourcils, bouche : les **4 expressions** ;
   - oreilles, pilosité, cheveux, accessoires : la vue **de face** (`down`) et **de dos** (`up`) ;
   - cheveux : calque `back` (derrière la tête) et calque `front` (mèches, frange) ;
   - sourcils : rester dans la zone du visage (colonnes 5-9, rangées 3 à 5).
3. **Ajouter une ligne** dans `registry.ts` (import + entrée de la liste, avec un poids au tirage
   si besoin).
4. **Vérifier** : `npm run test` (le test des pièces contrôle emplacements, expressions, masques et
   qu'une variante se distingue des autres d'au moins 3 pixels), puis la planche :
   `npx tsx scripts/characters-planche.ts planche.png` (la nouvelle pièce y apparaît dans la rangée
   de sa catégorie, à ×8 et à l'échelle du match ×3).

Une nouvelle **forme de tête** définit sa silhouette de face et de dos et ses ancrages (voir
`headShapes/common.ts`) ; elle garde le haut du crâne commun (`SKULL_TOP`) pour que toutes les
coiffures s'y posent.
