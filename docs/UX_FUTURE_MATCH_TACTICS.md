# Futur chantier tactiques en match — aucune implémentation dans V3

Le demi-terrain actuel est pédagogique, avec les six PlayId réels et le poids du plan enregistré. Il ne trace ni une possession réelle ni une promesse d’exécution.

Pour la prochaine passe Phaser, auditer d’abord les événements effectivement disponibles. Les noms `playChosen`, `screenSet`, `cutStarted`, `pickAndRoll`, `defensiveSwitch` et `spacingAdjust` sont des besoins de conception, pas des événements supposés existants.

Objectif futur : rendre observables sélection de système, écran, coupe, renversement et adaptation défensive. Distinguer intention, exécution et interruption. Prévoir des repères facultatifs, désactivables, un rappel du plan en pause et un rapport mesuré. Tests futurs : comparer deux playbooks via événements réels et images du match, sans animation inventée ou modification cachée des probabilités.

Aucun changement de `src/match`, `src/engine`, `src/state` ou des sprites dans la passe UX V3.
