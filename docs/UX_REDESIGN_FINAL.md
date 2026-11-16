# Passe UX V3 — décisions, parcours guidés et aperçus rétro

## État de livraison

Les corrections fonctionnelles UX-0 à UX-4 et le demi-terrain UX-6 sont implémentés. UX-5 a fait l’objet d’une comparaison artistique : après les premières captures, le propriétaire a répondu « Aucune pour l’instant : affiner les aperçus », puis demandé de renforcer le caractère pixel art et jeu de basket. Les deux propositions ont été affinées. Le 16 novembre 2026, le propriétaire a demandé de pousser l’ensemble avec le style A pour le moment : Arcade TV est donc généralisé au management comme base provisoire, sans validation artistique définitive. UX-7 (restauration JSON facultative) est isolé dans un suivi motivé. UX-8 est validé automatiquement ; les sessions humaines novice/expérimenté restent à organiser.

## Lots et décisions

| Lot | Résultat concret | Vérification |
|---|---|---|
| UX-0 | Audit HEAD c2b1d7a, baseline propre, carte des parcours et captures avant aux trois largeurs | 464 tests, build et lint réussis ; `UX_TASK_FLOWS.md` |
| UX-1 | Destinations typées avec vue/ID ; carte contrat et fiche joueur vers le même éditeur ; offre ciblée | e2e prolongation en un clic et navigation dans le Marché déjà ouvert |
| UX-2 | Tâches dérivées de la ligue, trois visibles et accès Toutes ; reçus persistants de session ; états brouillon, confirmé, refusé, mémoire seulement | e2e signature/contrat futur, tâche retirée, refus et quota ; cinq nouveaux tests de tâches/routes |
| UX-3 | Lanceur d’actions, guide facultatif en cinq étapes et aide complète/discrète/désactivée | navigation via lanceur avec refus d’abandon de brouillon ; préférences dans `hoopsim.ui.v1`, sans changement de carrière |
| UX-4 | Cinq visible avant l’effectif ; même éditeur ; Recruter/Prolonger/Échanger ; cartes 12/page et tableau exhaustif ; finances repliées lors d’une négociation ciblée | e2e pagination, filtre conservé après fiche, mutations métier identiques |
| UX-5 | A Arcade TV / B Almanach sur les trois mêmes écrans et trois largeurs ; version affinée avec fonte pixel locale et illustration originale de salle | 18 captures de vrais écrans ; build et tests finaux ; style A choisi provisoirement, design à reprendre plus tard |
| UX-6 | Demi-terrain cohérent, six systèmes, placement/idée, passes/courses/écrans et poids du plan enregistré | 18 captures ; cinq joueurs et repères de basket ; aucune mutation après exploration |
| UX-7 | Pas d’import factice ; analyse des validations/rollback nécessaires | `UX_SAVE_RESTORE_FOLLOWUP.md` ; fonctionnalité non activée |
| UX-8 | Suite complète, smokes existants et nouveau smoke guidé, contrôle des commandes et chemins protégés | 469 tests, build et lint réussis ; sessions humaines non exécutées |

## Parcours réellement effectués

1. **Prolongation depuis l’accueil.** Une carrière générée par le moteur contient un joueur réellement éligible et une offre acceptable selon evaluateContract. Sa carte ouvre son éditeur en un clic. Un salaire invalide désactive la vérification, sans modifier la carrière. Après Vérifier puis Confirmer, le contrat courant reste identique, une extension future et une seule transaction sont présentes. La fiche affiche l’effet en 2027. La tâche disparaît de l’accueil.
2. **Fiche depuis Marché.** Recherche d’un autre joueur du club, ouverture de sa fiche et Prolonger : le même composant MarketTab, déjà monté, affiche Contrats avec son ID exact.
3. **Brouillon via lanceur.** Minutes modifiées sans enregistrement ; navigation demandée via Que voulez-vous faire ; refus de quitter. Le champ et la carrière sont conservés. Annuler rétablit le plan.
4. **Offre CPU.** Une proposition générée par runFrontOffices ouvre sa carte en premier. Refuser retire la proposition sans changer joueurs/équipes. Accepter après confirmation applique les transferts aux bons IDs. Les compteurs et reçus suivent le modèle réel.
5. **Aucune prolongation / playoffs.** Aucun agent libre n’est sélectionné arbitrairement. Les signatures fermées ont une raison visible et la vérification est indisponible.
6. **Quota pendant une signature.** Le stockage lève une véritable QuotaExceededError via son API. L’extension existe en mémoire et dans la fiche ; l’ancien contenu localStorage est inchangé. L’interface dit Appliqué en mémoire — sauvegarde échouée.
7. **Recrutement et reprise.** Refus de transfert sans mutation, échange unique, agent libre signé, prolongation différée, rechargement et historique. Un match physique après recrutement se termine avec des points cohérents.
8. **Développement et draft.** Focus sans progression instantanée ; exposition après sept journées ; vraie saison/playoffs ; entrée dans la draft par sa tâche sans consommer le choix ; rechargement sans rejeu ; deux choix humains ; saison 2027 et bilan archivés.
9. **Régression générale.** Menus à 1280/768/390, sauvegarde échouée/export/réessai, sauvegarde corrompue conservée, clavier Z/Q/S/D/E/A/Espace en match, pause/reprise, fin physique unique. Navigation de gestion à 1440/768/390, fiches/Escape, tactique enregistrée sans changer la rotation, statistiques complètes et outil Animations.

Les smokes utilisent des contextes Chromium et des carrières de test isolés, pas la carrière du navigateur personnel. Les fixtures déterministes sont des données de test ; aucun avantage ou faux événement n’est ajouté au produit.

## Preuves

- [Smoke guidé](ux/logs/UX-8-guided.log)
- [Marché et match après recrutement](ux/logs/UX-8-market.log)
- [Développement, draft et saison suivante](ux/logs/UX-8-development.log)
- [Sauvegardes et match au clavier](ux/logs/UX-8-release.log)
- [Navigation et options avancées](ux/logs/UX-8-ui.log)
- [469 tests](ux/logs/UX-8-test.log), [build](ux/logs/UX-8-build.log), [lint](ux/logs/UX-8-lint.log)
- [30 marques](ux/logs/UX-8-branding.log), [26/26 commandes et chemins protégés](ux/logs/UX-8-protected-contract.log)
- [Éditeur atteint depuis l’alerte](ux/flows/extension-01-editor.png), [contrat signé dans la fiche](ux/flows/extension-02-signed.png)

## Comparaisons artistiques — style A provisoire actif

| Écran | A — Arcade TV 1993 | B — Almanach 1992 |
|---|---|---|
| Accueil | [Desktop](ux/previews/arcade-1440-Accueil.png) · [Mobile](ux/previews/arcade-390-Accueil.png) | [Desktop](ux/previews/almanac-1440-Accueil.png) · [Mobile](ux/previews/almanac-390-Accueil.png) |
| Équipe | [Desktop](ux/previews/arcade-1440-Equipe.png) · [Mobile](ux/previews/arcade-390-Equipe.png) | [Desktop](ux/previews/almanac-1440-Equipe.png) · [Mobile](ux/previews/almanac-390-Equipe.png) |
| Contrats | [Desktop](ux/previews/arcade-1440-Contrats.png) · [Mobile](ux/previews/arcade-390-Contrats.png) | [Desktop](ux/previews/almanac-1440-Contrats.png) · [Mobile](ux/previews/almanac-390-Contrats.png) |

Les captures 768 px sont aussi dans le même dossier. Les deux propositions partagent la même carrière, le même joueur et les mêmes actions. La fonte Press Start 2P (SIL OFL) est locale et utilisée par le style provisoire ; les illustrations sont éditables dans generate-ux-preview-art.py, séparées des sprites protégés. Aucun logo ni nom/couleur de franchise n’est modifié.

## Six systèmes tactiques

[Lecture libre](ux/tactics/390-default.png) · [Five-Out](ux/tactics/390-fiveOut.png) · [Horns](ux/tactics/390-horns.png) · [High Pick & Roll](ux/tactics/390-highPickRoll.png) · [Entrée au poste](ux/tactics/390-postEntry.png) · [Isolation](ux/tactics/390-isolation.png).

Les versions 768 et 1440 px sont dans `ux/tactics`. Convention unique : panier en haut, attaque depuis le bas. Proportions graphiques 50 × 47 pieds, panier à 5,25 pieds, raquette 16 pieds, lancers à 19 pieds, arc à 23,75 pieds et corners distincts. Ce n’est pas un moteur de collision ni une modification du terrain Phaser. Les poids actifs sont lus depuis le plan enregistré, même si le brouillon tactique diffère.

## Préservation et limites

Aucune modification de src/engine, src/match, src/state, src/assets/players, src/assets/branding, package.json ou package-lock.json. Les 26 commandes store de la gestion restent présentes, avec les mêmes règles. Aucune nouvelle simulation ni migration de carrière. Les nouvelles préférences et reçus sont de présentation ; un reçu n’est pas un historique persistant et ne remplace jamais la fiche/transaction réelle. Les reçus et le contexte sont réinitialisés lors d’un changement de carrière.

Le style A est actif provisoirement ; une future révision graphique reste prévue. Les tests humains décrits dans [le protocole](UX_ACCEPTANCE_SESSIONS.md) ne sont pas déclarés effectués. L’accessibilité contrôlée dans Chromium (clavier, focus, Escape, responsive) n’est pas une certification WCAG ni un audit multi-navigateur/lecteur d’écran. Les objectifs de découverte en quelques secondes restent à mesurer.

La restauration JSON est volontairement séparée selon l’option du plan V3, car une validation complète de fichier non fiable et un commit/rollback dédié sont nécessaires. Aucun bouton non fonctionnel n’est exposé. La compilation conserve l’avertissement de taille du bundle Phaser déjà présent.

## Reproduire

Serveur : `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.

Contrôles : `npm run build`, `npm test`, `npm run lint`, `npx tsx scripts/validate-branding.ts`, `python scripts/smoke-guided-ux.py`, `python scripts/smoke-market.py`, `python scripts/smoke-development.py`, `python scripts/smoke-release.py`, `python scripts/smoke-ui.py`. Les tests navigateur demandent Playwright Python et Chromium système, présents dans cet environnement. Leurs sorties courantes sont sous `/tmp/hoopsim-ux` et `/tmp/hoopsim-evidence`.

Pour comparer visuellement, ouvrir le jeu avec `ux-style=arcade` ou `ux-style=almanac`. Le style A est actif par défaut ; le paramètre Almanach conserve la comparaison. Aucun choix n’est écrit dans la carrière. Voir [le guide court](UX_USER_GUIDE.md), [les parcours](UX_TASK_FLOWS.md), [la charte des aperçus](UX_VISUAL_GUIDELINES.md) et [la future passe tactique en match](UX_FUTURE_MATCH_TACTICS.md).
