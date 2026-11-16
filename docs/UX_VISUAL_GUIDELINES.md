# Deux propositions rétro — affinées après retour utilisateur

Statut : le propriétaire a choisi le style A provisoirement le 16 novembre 2026. Arcade TV 1993 est désormais le style par défaut des écrans de management et de création de carrière. Le design reste à retravailler ultérieurement ; ce choix n’est pas une validation artistique définitive.

A / Arcade TV 1993 : fond cobalt #2356A5, panneaux ivoire #F6F0DE, scoreboard #173B73, typographie pixel pour affiches et signalétique. Illustration de salle avec public, panier, parquet et joueur original. Cartes à bandeau de franchise. Contrat présenté comme document sportif à vérifier.

B / Almanach 1992 : papier crème #F1E9D6, cartes #FFF9EC, encre #19263C et bleu nuit #182E50, filets doubles, bords parquet et illustration de salle aux tons papier. Même contenu et mêmes actions pour une comparaison loyale.

Les champs, corps de texte et chiffres restent lisibles en police système. La fonte Press Start 2P est locale, utilisée pour les titres et la signalétique, distribuée sous SIL OFL (voir `src/assets/ux-preview/fonts/OFL.txt`). Source : paquet npm `@fontsource/press-start-2p@5.3.0`, artefact téléchargé avec les vérifications npm conservées. Aucune dépendance npm ajoutée au projet. Sources des illustrations : `scripts/generate-ux-preview-art.py`. Aucune reprise de sprite de match ni de marque de club réelle.

Comparer les 18 captures sous `docs/ux/previews` : deux directions × Accueil / Équipe / Contrats × 390 / 768 / 1440. Les captures utilisent exactement la même carrière de test et le même joueur éligible. Le style A est actif sans paramètre d’URL. `?ux-style=almanac` conserve la comparaison B. Aucun champ de sauvegarde de carrière ne dépend de ce choix.

La prochaine passe artistique pourra remplacer cette base provisoire. Les styles sont centralisés dans `src/ui/managementTheme.css` et le choix par défaut dans `managementTheme.ts`. Les palettes canoniques et les 30 emblèmes de franchises restent protégés.
