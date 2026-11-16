# Couverture fonctionnelle UI — version réelle

Branche initiale : `work`. Lots management 0–6 présents. Moteur, store, matchs et sprites gelés, aucune exception prévue. Les contrôles ci-dessous restent reliés aux commandes originales.

Navigation : Bureau → préparation ; Équipe → effectif / rotation / tactiques / développement ; Marché → joueurs / transferts / contrats / draft ; Ligue → calendrier / classement / stats / playoffs / histoire. Outils dans Menu.

## Inventaire des commandes (références source avant travaux)

| Origine | Commande inchangée | Destination | Vérification |
|---|---|---|---|
| `src/ui/App.tsx` | `advanceOneDay` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `clearWatched` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `deleteSave` | Menu / Partie | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `finishLiveMatch` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `load` | Menu / Partie | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `retrySave` | Menu / Partie | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `simulateDays` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `simulateRestOfSeason` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/App.tsx` | `simulateToNextUserGame` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/MatchButtons.tsx` | `advanceOneDay` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/MatchButtons.tsx` | `startLiveMatch` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/NewGameScreen.tsx` | `newGame` | Menu / Partie | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/ScheduleTab.tsx` | `showBoxScore` | Ligue / résultats | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/Dashboard.tsx` | `showBoxScore` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/Dashboard.tsx` | `simulateToNextUserGame` | Bureau / préparation / progression | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/TacticsTab.tsx` | `setGamePlan` | Équipe / Tactiques | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/MarketTab.tsx` | `offerContract` | Marché / joueurs, transferts, contrats | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/MarketTab.tsx` | `proposeTrade` | Marché / joueurs, transferts, contrats | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/MarketTab.tsx` | `respondTradeProposal` | Marché / joueurs, transferts, contrats | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/MarketTab.tsx` | `setFrontOffice` | Marché / joueurs, transferts, contrats | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/MarketTab.tsx` | `setTradeStatus` | Marché / joueurs, transferts, contrats | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/CoachingEditor.tsx` | `setGamePlan` | Équipe / Rotation / Avancé | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/DevelopmentTab.tsx` | `advanceDraft` | Équipe / Développement ou Marché / Draft | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/DevelopmentTab.tsx` | `delegateDraft` | Équipe / Développement ou Marché / Draft | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/DevelopmentTab.tsx` | `launchSeason` | Équipe / Développement ou Marché / Draft | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/DevelopmentTab.tsx` | `prepareDraft` | Équipe / Développement ou Marché / Draft | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/DevelopmentTab.tsx` | `selectRookie` | Équipe / Développement ou Marché / Draft | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/DevelopmentTab.tsx` | `setTraining` | Équipe / Développement ou Marché / Draft | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/PlanLibrary.tsx` | `deletePlanVariant` | Équipe / Rotation / Avancé | suite moteur/store + parcours navigateur lié au composant |
| `src/ui/tabs/PlanLibrary.tsx` | `savePlanVariant` | Équipe / Rotation / Avancé | suite moteur/store + parcours navigateur lié au composant |

## Contrôles de présentation à conserver

| Écran | Fonctions sans commande store | Nouveau chemin |
|---|---|---|
| Effectif | tri note/points/rebonds/passes/minutes/âge/poste, toutes les colonnes, fiche joueur | Équipe / Effectif / tableau complet |
| Rotation | cinq, minutes, actif, rôles, presets, verrouillage minutes, distribution, substitutions, fin serrée, fautes, closing five, variantes 8 plans | Équipe / Rotation + Avancé |
| Tactiques | six attaques, défenses codées, créateur, six paramètres, poids et descriptions systèmes, scouting | Équipe / Tactiques + Avancé / Systèmes |
| Marché | recherche, club/libres, poste, âge, salaire, potentiel, valeur, liste transferts, projet, sélection 3 contre 3, aperçu salaires/valeurs, rôles et durée contrat | Marché / sous-vues + Plus de filtres |
| Développement | focus, conseil, reset, jours, filtres prospects, recommandation, résultats draft, bilans saison | Équipe / Développement et Marché / Draft |
| Ligue | calendrier résultats, tris/périodes stats, conférences, playoffs, histoire, fiches équipes/joueurs, box score et analyse tactique | Ligue / sous-vues |
| Outils | animations intégrées, ?anims, ?style, ?court | Menu / Outils et liens initiaux |

Les validations restent validateGamePlan, evaluateTrade, evaluateContract, draftDecision et celles du store. Aucun nouveau calcul économique. Les cas invalides restent couverts par les suites existantes ; les chemins UI font l’objet du smoke de refonte.

## Scénarios et validateurs reliés aux domaines

| Commandes / contrôles | Validation métier inchangée | Preuve automatisée exécutée |
|---|---|---|
| Nouvelle carrière, chargement, export, quota, retrySave | store + saveBackup | `scripts/smoke-release.py` (quota réel, export et contenu corrompu conservé) |
| Rotation : cinq, actifs, minutes, rôles, verrouillage, distribution, closing five, fautes, substitutions | `validateGamePlan`, `eligibleIds`, `distributeMinutes`, `distributeRemaining` | `src/engine/gamePlan.test.ts`, `src/engine/coaching.test.ts`, `scripts/smoke-ui.py` (brouillon, annulation, sauvegarde) |
| Variantes : nom, mémoriser, sélection, charger, supprimer, 8 emplacements | `repairGamePlan`, `savePlanVariant`, `deletePlanVariant` | `src/engine/gamePlan.test.ts` ; bibliothèque conservée dans les deux éditeurs |
| Attaque, défense, créateur, 6 paramètres, poids des systèmes | `validateGamePlan`, `playSuitability` | `src/engine/coaching/tactics.test.ts`, `scripts/smoke-ui.py` (sauvegarde attaque/défense/rythme, rotation préservée) |
| Scouting, mini-terrain | `scoutLineup` et descriptions `PLAYS` ; schéma étiqueté pédagogique | `src/engine/coaching/tactics.test.ts` ; capture tactiques desktop/mobile |
| Recherche et filtres du marché, statuts et projet | `playerValue`, `tradeStatus`, `setFrontOffice`, `setTradeStatus` | `src/engine/management/market.test.ts`, `scripts/smoke-market.py` (recherche agents libres) |
| Sélection sortants/entrants, max 3, aperçu, offre, refus/acceptation CPU, journal | `evaluateTrade`, `marketOpen`, `proposeTrade`, `respondTradeProposal` | `src/engine/management/market.test.ts`, `scripts/smoke-market.py` (refus sans mutation, transfert unique, journal après reload) |
| Salaire, durée, rôle promis, signature et prolongation | `evaluateContract`, budget sur années, `offerContract` | `src/engine/management/market.test.ts`, `scripts/smoke-market.py` (salaire invalide, signature, prolongation différée) |
| Focus, aide, équilibré, journées et bilans | `recommendTraining`, `setTraining` | `src/engine/development/development.test.ts`, `scripts/smoke-development.py` (aucun gain au clic, exposition après 7 jours) |
| Préparer, consulter prospects, filtre poste, conseil, sélection, passer, déléguer, choix CPU, résultats, lancement | `draftDecision`, `recommendedProspect` et commandes draft existantes | `src/engine/development/development.test.ts`, `scripts/smoke-development.py` (deux choix humains, reload, saison 2027) |
| Préparation, jouer, regarder, simuler et rapport | store / MatchSetup existant / finishLiveMatch inchangé | `scripts/smoke-release.py` (clavier, pause, fin physique), `scripts/smoke-market.py` (Regarder et résultat physique après recrutement) |
| Avance 1 jour, prochain match, 7 jours, fin saison et playoffs | mêmes commandes de progression | `scripts/smoke-development.py` (saison et playoffs réels), `scripts/smoke-release.py` |
| Calendrier, classements, stats, playoffs, histoire et fiches | sélecteurs moteur existants et showBoxScore/openPlayer/openTeam | suite moteur de 464 tests ; `scripts/smoke-ui.py` (navigation, vue complète, ouverture fiche, responsive) |
| Branding | registre UI par id puis fallback abbr, aucune migration | `scripts/validate-branding.ts` (30/30 palettes/assets), `scripts/smoke-ui.py` (images réellement chargées) |
| Outils Animations et liens ?anims/?style/?court | chemins d’origine préservés | `scripts/smoke-ui.py` (Menu → Outils → Animations) ; points d’entrée main.tsx inchangés hors nouvelle galerie |

Les tests moteur valident les invariants, les smokes valident les interactions citées ; cela ne signifie pas que chaque combinaison de filtre et chaque curseur a été cliqué séparément. Les commandes et contrôles non réécrits restent présents, avec les mêmes handlers. Vérification de diff : aucune suppression de commande store d’origine (26/26).

## Passe UX V3 — liens de tâches et état des décisions

La couverture ci-dessus reste valable. Aucune commande de management n’a été supprimée. Les identifiants/attributs persistants, les 30 franchises, les logos et toutes les règles sont inchangés.

| Entrée de tâche | Destination exacte | Preuve V3 |
|---|---|---|
| Carte Contrat de [joueur] | Marché / Contrats / playerId prérempli | smoke-guided-ux : signature réelle, saison d’effet, disparition de la tâche |
| Fiche joueur / Prolonger | même destination, y compris si Marché est déjà monté | smoke-guided-ux : même page et ID exact |
| Carte offre CPU | Marché / Transferts / proposalId, carte ciblée en premier | smoke-guided-ux : refus sans modification d’effectif et acceptation avec changement d’équipe |
| Lanceur / Choisir mon cinq | éditeur de rotation existant | smoke-guided-ux : garde du brouillon et annulation ; smoke-ui : enregistrer |
| Lanceur / Changer tactiques | éditeur unique et plan enregistré | smoke-ui : sauvegarde des paramètres et rotation inchangée |
| Carte de draft | Saison / Draft, curseur courant | smoke-development : entrée depuis la tâche sans avancer le curseur |
| Recruter / Prolonger / Échanger | mêmes opérations et validateurs, choix explicites | smoke-market : refus, échange unique, signature et prolongation différée |
| Cartes de recherche | 12 résultats/page, tableau détaillé et tous filtres conservés | smoke-guided-ux + smoke-market ; fiche en surimpression conserve la recherche |
| Décision confirmée/refusée | reçu de session persistant ; contrat signé relu depuis player.extension | smoke-guided-ux : confirmation et quota en échec distingués |
| Aide / guide | préférences séparées `hoopsim.ui.v1`, sans mutation de carrière | inspection et smoke de navigation/brouillon |
| Six systèmes | terrain pédagogique, placements/idées, poids du plan réellement enregistré | captures de 6 × 3 largeurs ; stockage inchangé après exploration |
| Retour d’une nouvelle carrière | contexte UI et reçu précédents réinitialisés | effet limité aux états de présentation, aucun appel métier |

Le style A (Arcade TV) est désormais le défaut provisoire, sur demande du propriétaire le 16 novembre 2026. La comparaison B reste disponible via `ux-style=almanac`. La restauration JSON reste un lot séparé décrit dans `UX_SAVE_RESTORE_FOLLOWUP.md` ; elle n’est pas déclarée livrée.
