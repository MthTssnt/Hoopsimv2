/**
 * Les 5 styles candidats (planches de l'étape 1, rien n'est branché dans le jeu).
 * Chaque style = des réglages de rendu (tons, ombrage, contour, palette) + un kit de visage
 * (yeux, sourcils, nez, bouche, avec leurs 4 expressions) posé sur les ancrages de la tête.
 */
import type { FaceKit, Px } from './head25';
import type { StyleDef } from './figureStyled';

const none: readonly Px[] = [];
const pair = (near: readonly Px[], far: readonly Px[]) => ({ near, far });

// Yeux communs : ^ plissé (joie), demi-fermé (déçu).
const JOY_EYES = pair([[-1, 1, 'n'], [0, 0, 'n'], [1, 1, 'n']], [[-1, 1, 'n'], [0, 0, 'n']]);
const SAD_EYES = pair([[0, 1, 'n'], [1, 1, 'n']], [[0, 1, 'n']]);
const SMILE: readonly Px[] = [[-1, -1, '4'], [0, 0, '4'], [1, 0, '4'], [2, -1, '4']];
const SHOUT: readonly Px[] = [[0, 0, '4'], [1, 0, '4'], [0, 1, '4'], [1, 1, '4']];
const FROWN: readonly Px[] = [[-1, 1, '4'], [0, 0, '4'], [1, 0, '4'], [2, 1, '4']];

/** 1. Rétro sobre : yeux 1×2 + 1 px de blanc, sourcil d'1 px, nez d'1 px d'ombre, bouche de 2 px. */
const RETRO: FaceKit = {
  eyes: {
    neutre: pair([[0, 0, 'n'], [0, 1, 'n'], [1, 0, 'w']], [[0, 0, 'n'], [0, 1, 'n']]),
    joie: JOY_EYES,
    cri: pair([[0, 0, 'n'], [0, 1, 'n'], [1, 0, 'w'], [1, 1, 'w']], [[0, 0, 'n'], [0, 1, 'n']]),
    decu: SAD_EYES,
  },
  brows: {
    neutre: pair([[0, 0, 'E']], [[0, 0, 'E']]),
    joie: pair([[0, -1, 'E']], [[0, -1, 'E']]),
    cri: pair([[0, -1, 'E'], [1, -1, 'E']], [[0, -1, 'E']]),
    decu: pair([[1, -1, 'E']], [[-1, -1, 'E']]),
  },
  nose: [[0, 0, '3']],
  mouth: { neutre: [[0, 0, '4'], [1, 0, '4']], joie: SMILE, cri: SHOUT, decu: FROWN },
};

/** 2. Iconique minimal : yeux 1×2 sombres sans blanc, pas de nez, bouche seulement pour les expressions. */
const ICON: FaceKit = {
  eyes: { neutre: pair([[0, 0, 'n'], [0, 1, 'n']], [[0, 0, 'n'], [0, 1, 'n']]), joie: JOY_EYES, cri: pair([[0, -1, 'n'], [0, 0, 'n'], [0, 1, 'n']], [[0, -1, 'n'], [0, 0, 'n'], [0, 1, 'n']]), decu: SAD_EYES },
  brows: { neutre: pair(none, none), joie: pair(none, none), cri: pair(none, none), decu: pair(none, none) },
  nose: none,
  mouth: { neutre: none, joie: SMILE, cri: SHOUT, decu: FROWN },
};

/** 4. Graphique BD : yeux en petits traits verticaux, sourcils marqués (3 px), ombre franche sur le côté du visage. */
const BD: FaceKit = {
  eyes: { neutre: pair([[0, 0, 'n'], [0, 1, 'n']], [[0, 0, 'n'], [0, 1, 'n']]), joie: JOY_EYES, cri: pair([[0, -1, 'n'], [0, 0, 'n'], [0, 1, 'n']], [[0, 0, 'n'], [0, 1, 'n']]), decu: SAD_EYES },
  brows: {
    neutre: pair([[-1, 0, 'E'], [0, 0, 'E'], [1, 0, 'E']], [[0, 0, 'E'], [1, 0, 'E']]),
    joie: pair([[-1, 0, 'E'], [0, -1, 'E'], [1, -1, 'E']], [[0, -1, 'E'], [1, 0, 'E']]),
    cri: pair([[-1, -1, 'E'], [0, -1, 'E'], [1, -1, 'E']], [[0, -1, 'E'], [1, -1, 'E']]),
    decu: pair([[-1, 0, 'E'], [0, 0, 'E'], [1, -1, 'E']], [[0, -1, 'E'], [1, 0, 'E']]),
  },
  nose: none,
  mouth: { neutre: [[0, 0, '4'], [1, 0, '4']], joie: SMILE, cri: SHOUT, decu: FROWN },
};

/** 5. Rétro peint : petits yeux, sourcils doux, visage modelé par la couleur (pommette, ombre du nez, lèvres). */
const PAINTED: FaceKit = {
  eyes: { neutre: pair([[0, 1, 'n']], [[0, 1, 'n']]), joie: pair([[-1, 1, 'n'], [0, 0, 'n']], [[0, 0, 'n']]), cri: pair([[0, 0, 'n'], [0, 1, 'n']], [[0, 0, 'n'], [0, 1, 'n']]), decu: pair([[0, 1, 'n'], [1, 1, '3']], [[0, 1, 'n']]) },
  brows: {
    neutre: pair([[0, 0, 'D'], [1, 0, 'D']], [[0, 0, 'D']]),
    joie: pair([[0, -1, 'D'], [1, -1, 'D']], [[0, -1, 'D']]),
    cri: pair([[0, -1, 'D'], [1, -1, 'D']], [[0, -1, 'D']]),
    decu: pair([[0, 0, 'D'], [1, -1, 'D']], [[-1, -1, 'D']]),
  },
  nose: [[0, 0, '3'], [-1, 1, '3'], [-4, 0, '1']],
  mouth: { neutre: [[0, 0, '3'], [1, 0, '3']], joie: [[-1, -1, '3'], [0, 0, '4'], [1, 0, '4'], [2, -1, '3']], cri: SHOUT, decu: [[-1, 1, '3'], [0, 0, '4'], [1, 0, '4'], [2, 1, '3']] },
};

export const STYLES: readonly StyleDef[] = [
  { id: 'retro', name: '1 RETRO SOBRE', head: '25', kit: RETRO, tones: 3, shading: 'edge', outline: 'tinted', outlineWidth: 1, groundShadow: 0.3 },
  { id: 'icone', name: '2 ICONIQUE MINIMAL', head: '25', kit: ICON, tones: 2, shading: 'edge', outline: 'dark', outlineWidth: 1, groundShadow: 0.3 },
  { id: 'cartoon', name: '3 CARTOON ARCADE', head: '33', kit: null, tones: 3, shading: 'edge', outline: 'black', outlineWidth: 2, innerLines: true, saturation: 1.35, groundShadow: 0.3 },
  { id: 'bd', name: '4 GRAPHIQUE BD', head: '25', kit: BD, tones: 2, shading: 'hard', outline: 'black', outlineWidth: 2, faceShadow: true, saturation: 1.15, shadowDepth: 0.4, groundShadow: 0.35 },
  { id: 'peint', name: '5 RETRO PEINT', head: '25', kit: PAINTED, tones: 5, shading: 'painted', outline: 'soft', outlineWidth: 1, coolShadows: true, groundShadow: 0.6 },
];
