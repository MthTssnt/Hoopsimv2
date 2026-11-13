# Phases des gestes — état conservé et reconstruction

Document réécrit depuis le compte rendu de Matheo et le code présent.
Les propositions de l'ancien document sont inconnues ; aucune modification de fenêtre
verte, difficulté, probabilité ou temps physique n'est déduite de leur absence.

| Geste | Phases affichées | Priorité conservée/reconstruite |
| --- | --- | --- |
| Tir normal | Ramassage, montée, extension/lâcher, retombée | Monde : vol autour de 1,2 s, sommet à 0,6 s en vitesse normale ; extension visible 65 ms après lâcher |
| Layup / dunk | Ramassage, impulsion/armé, extension/smash, retombée/accroche | Physique existante ; accroche dunk de 0,3 s ; pas de raccord à travers le corps |
| Contre / rebond / entre-deux | Impulsion, montée, extension, absorption | Saut sans ballon sous gravité 9,81 m/s² selon attributs ; un exemple d'atelier de 0,76 s ne fixe pas tous les joueurs |
| Passe | Pose de lâcher immédiate puis suivi | Direction mémorisée à l'événement ; suivi au sol interrompu par déplacement après les premières 80 ms ; possession reprise prioritaire |
| Réception | Mains en cible, prise, retour au jeu | Anticipation de 150 ms, contrôle physique progressif de 180 ms ; même état pour prise et dessin, saut prioritaire |
| Atterrissage | Flexion puis redressement | Absorption de 120 ms avec ou sans ballon, même en course ; ne bloque pas la commande suivante |
| Dribble | Contact, descente libre, parquet, remontée, reprise | Phase partagée monde/bras/ballon et appuis ; aucune nouvelle collision ou probabilité |

Chaque pas de 1/120 s met à jour `GestureTracker` avant le choix de l'image.
Les sauts et gestes du ballon priment sur les raccords au sol. Les rythmes proposés
pour les nouvelles poses de démarrage/freinage/défense restent des cadences d'étude
dans le comparateur témoin, sans effet sur le monde.

Voir `?anims` : « Phases du match » utilise le sélecteur réel avec des situations
synthétiques ; « Planches sources » présente les dessins bruts. Vérifier ensuite
la vraie trajectoire dans `?court&seed=8126&watch&atelier`.

## États d’appuis activés le 13 novembre 2026

Démarrage, freinage, pivot, garde défensive, pas latéraux et recul possèdent un état
et une phase liés au mouvement réel. Les séquences emploient des personnages entiers
existants, sans assemblage anatomique. Elles ne sont pas la déclinaison graphique
validée des 48 dessins témoins. Un dunk libère l’action globale au smash et garde sa
récupération propre ; un nouveau porteur peut agir pendant cette récupération.
