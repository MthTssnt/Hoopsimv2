# Reconstruction après perte des commits locaux — 13 novembre 2026

Les objets `d85dc11`, `5fea0f9` et `e101c11` n'ont pas été récupérés.
La base inspectée est `a9f1291`, suivie du lot témoin `44b2bf1`.
Sur instruction de Matheo, leur absence ne bloque plus le chantier : les capacités
décrites dans son compte rendu sont réimplémentées. Les nouveaux fichiers ne sont
pas présentés comme une restauration exacte de ces commits.

## Audit de la base retrouvée

| Capacité | État conservé | Reconstruction |
| --- | --- | --- |
| Dix identités et 1 680 poses entières | PNG, manifestes, dimensions natives, portraits et numéros présents | Aucun personnage remplacé ; les 48 poses candidates du lot témoin restent distinctes |
| Identités déterministes | `appearanceFor` déjà déterministe, mais la scène forçait un index selon l'ordre de cuisson | Suppression de cette attribution par ordre ; identifiant stable entre préparation, remplacement et équipe |
| Composition avant match | Titulaires préparés, remplaçants composés à leur entrée | Tous les membres éligibles préparés avant le premier pas ; worker OffscreenCanvas et compositeur commun au repli principal |
| Contacts | Repères partiels du manifeste et recherche de peau à la cuisson | `contacts.json`, 1 680 entrées et 525 masques natifs explicites ; transformation et miroir communs aux points et aux doigts |
| Rythme de course/dribble | Distance de foulée, phase de dribble et trajectoire libre présents | Conservés ; pas de nouveau rig ni de déplacement des collisions |
| Gestes | Choix des poses présent, suivi effectué une fois par image affichée | `GestureTracker` avance à chacun des pas physiques, y compris en simulation de fin ; âge nul au nouvel événement, direction de passe mémorisée |
| Enchaînements | Saut prioritaire, atterrissage court et raccord de ballon de 80 ms présents | Passe/réception au sol interruptibles par reprise de mouvement ; raccord du lâcher mesuré au pas physique, sans augmenter sa durée |
| Atelier | Poses brutes visibles, sélecteur du match absent de l'aperçu | Choix « Phases du match » passant par `spriteStateFor`, et « Planches sources » conservé |
| Inspecteur | Paramètre `atelier` sans effet | Pause initiale, lecture, avance de 1/60 s, repères, export des entrées réellement appliquées |
| Sons et réglages | Absents | Ballon, fer, planche, filet physique, appuis et premier sifflet synthétisés ; déverrouillage utilisateur, volume et coupure persistés |
| Règles, box score, sauts, filets | Présents | Conservés ; ajout d'observations d'impacts sans décision supplémentaire ni tirage aléatoire |

## Détails de reconstruction

### Préparation

La même fonction `composePlayer` produit le raster en worker et en repli principal.
`?sansWorker` force le repli pour la vérification. Les bitmaps sont transférés,
installés dans Phaser, puis fermés ; le worker est arrêté avant le coup d'envoi
ou au démontage. Aucun remplaçant n'est composé pendant une substitution :
un membre absent du cache provoque une erreur explicite, comptée dans `syncEntries`.
Le chargement affiche la progression et signale les erreurs.

### Contacts

Les nouvelles données sont **mesurées depuis le rendu conservé**, à échelle native,
avec ses repères et son nettoyage préexistants ; ce ne sont pas les annotations perdues.
Elles figent le résultat de cette mesure au lieu de redétecter une main selon sa couleur
pendant le match. Chaque entrée contient centre du ballon, paume, contact actif,
occultation face/dos et lignes de pixels des doigts dans le rectangle source.
Le masque est découpé à l'échelle native, puis reçoit exactement la transformation
de l'image complète, miroir compris. Les essais structurels ne remplacent pas
une retouche artistique des PNG ni une appréciation manuelle de chaque contact.

### Temps, inspecteur et rejeu

`WORLD_DT` vaut **1/120 s** dans cette base. Le bouton de 1/60 s exécute donc
deux vrais pas, chacun avec son suivi visuel. `?court&seed=8126&watch&atelier`
démarre figé au pas zéro. Les repères montrent pied, paume, centre peint et ballon physique.
Dans ce mode de développement, le match ne redémarre pas automatiquement à sa fin.

L'export contient graine, réglages, durée des périodes, setup GM le cas échéant,
pas physique et entrées de chaque joueur **après** sélection clavier/IA. Sa limite est
200 000 pas ; le champ `truncated` indique explicitement une capture incomplète.
`window.__hoopsim`, exposé uniquement avec `atelier`, permet une inspection reproductible :
`snapshot()`, `step(inputs)` (un pas de 1/120 s), `advance(n)` (au plus 3 600 pas),
`play(bool)` et `recording()`. Avancer en bloc n'est pas une mesure de FPS.

L'atelier de poses présente des situations synthétiques au même sélecteur ;
il ne prétend pas reproduire une vraie trajectoire à partir des seules planches.

### Audio

Les impacts sont observés depuis `stepBall`, la traversée du filet restant distincte
du panier accordé. Dribble et appuis suivent les phases/distances du monde. Les événements
sont consommés une fois, même après la rotation des listes bornées ; aucune rafale
n'est rejouée après activation du son. Le synthétiseur a son propre bruit déterministe,
ne consomme pas le RNG du match, limite les voix et ferme son contexte au démontage.
Les sons sont des premières versions à écouter et affiner ; public/banc et ambiance
complète restent un chantier artistique distinct.

## Validation

Les preuves nouvelles, résultats de tests, vidéos et limites sont consignés dans
`MATCH_VISUAL_VALIDATION.md`. Le total historique de 362 tests n'est pas utilisé comme
preuve de restauration : la suite actuelle et les nouveaux tests sont exécutés réellement.
Les nouvelles poses témoins ne sont pas encore activées en match ni déclinées aux dix designs.
