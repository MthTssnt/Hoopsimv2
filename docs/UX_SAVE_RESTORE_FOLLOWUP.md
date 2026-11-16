# UX-7 — restauration JSON : lot isolé à poursuivre

Statut : non activée dans cette passe. L’export, le chargement local et les erreurs de sauvegarde restent opérationnels. Aucun bouton Importer factice n’est ajouté.

Le lot est facultatif dans le plan V3 (§14 et UX-7). L’audit montre que `migrateLeague` contrôle principalement la présence des équipes/joueurs puis répare les effectifs, plans et draft. Cette fonction n’est pas à elle seule un validateur complet d’un fichier JSON non fiable : calendrier, statistiques, contrats, références des box scores et structures imbriquées demandent une validation supplémentaire. `store.load` n’expose pas de transaction de remplacement avec prévisualisation ; remplacer localStorage puis appeler load serait une mauvaise solution de rollback.

À traiter dans un changement séparé et ciblé du store, sans changer les règles :

1. Plafond de taille annoncé (à mesurer avec des carrières de dix saisons), parse JSON, profondeur/nombre de nœuds bornés, rejet des clés de pollution de prototype.
2. Validation des types, nombres finis, phases, IDs et références ; ancienne sauvegarde migrée sur une copie indépendante, aucune saison ou opération rejouée.
3. Aperçu de franchise/saison/phase, export de secours et confirmation avant remplacement.
4. API de commit unique : mémoire remplacée uniquement après succès de validation. En cas de quota, conserver l’état en mémoire et signaler explicitement l’échec de persistance, avec Exporter/Réessayer.
5. Tests de fichiers actuels/anciens, draft en cours, erreurs structurelles et sémantiques, fichier trop gros, contenu malicieux, quota, rollback, refus pendant match/simulation.

Cette limite n’affecte pas les parcours de prolongation ni les identités graphiques. La restauration JSON n’est pas déclarée livrée.
