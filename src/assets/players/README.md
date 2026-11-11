# Designs officiels des joueurs

Les dix designs validés par Matheo sont désormais l'unique rendu, aussi bien dans les matchs
lancés depuis le GM que sur `?court`. Aucun paramètre de rendu n'est nécessaire. Les anciens
rigs, pièces de visages, rendus 2D/volumes et scènes de comparaison sont supprimés.

- `team-navy.png`, `team-ivory.png` : cinq designs par tenue, arrêt face/dos et deux poses de course.
- `actions-navy.png`, `actions-ivory.png` : les mêmes joueurs, tir armé, lâcher, passe et saut bras levé.
- `courtDesigns.ts`, `actions.ts` : découpes mesurées des planches irrégulières.
- `sources.ts` : chargement des quatre sources, uniquement pour un match ou le catalogue `?style`.

Chaque joueur garde sa famille au cours du match et des remplacements. Taille et corpulence
adaptent l'échelle ; numéro réel posé après le miroir, ballon physique séparé des PNG. Le
portrait du HUD est extrait du même design. La main forte reste déterministe.

La feuille cuite utilise un cadre de 64×80 et huit poses par orientation. Les états de tir,
passe, layup, dunk, contre et rebond choisissent une pose appropriée du nouveau style. Certaines
poses sont partagées entre plusieurs gestes. La course de dos et le dribble ont encore une
animation simplifiée ; la physique, la jauge, les passes, fautes et statistiques fonctionnent
normalement. Les tenues officielles sont bleu/blanc et ivoire/bordeaux : la recoloration par
franchise pourra être ajoutée ensuite.

Les sources ont été générées pour HoopSim avec OpenAI image generation à partir des références
fournies et validées par l'utilisateur. Voir `src/assets/CREDITS.md`.
