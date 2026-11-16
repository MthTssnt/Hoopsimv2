# Parcours UX V3 — audit à HEAD c2b1d7a

État initial propre, 30 franchises et 26 commandes UI du store. Baseline : 464 tests, build/lint réussis. Sources métier : store, gamePlan, transactions, economy, development. Aucun changement moteur/Phaser prévu.

| Tâche | Avant (actions de navigation) | Correction |
|---|---|---|
| Prolonger depuis une alerte | Alerte → marché/recherche → Contrats → choisir joueur (3 choix, pas de cible directe) | Carte du joueur → éditeur prérempli (1 clic) |
| Prolonger depuis fiche | Aucun accès ; fermeture puis recherche dans Marché | Fiche → Prolonger son contrat → même éditeur ciblé |
| Voir une offre | Texte sans lien, marché → Transferts → rechercher la carte | Carte → offre ciblée en premier |
| Modifier le cinq | Équipe → Rotation → choix → enregistrer | Cinq visible en premier, Modifier → éditeur unique |
| Préparer un match | Bureau → préparation, sans résumé complet du playbook | Accès conservé, plan enregistré/validité explicites |

Les nombres mesurent le chemin offert par l’UI, pas un temps de découverte novice. Une observation avec une personne débutante et une expérimentée reste nécessaire.

La navigation `ManagementDestination` est de présentation : elle sélectionne sous-vue et ID sans appeler une commande métier. Une requête explicite peut ouvrir un contrat même dans le Marché déjà monté. Les liens ne reposent pas sur des clics DOM simulés.
