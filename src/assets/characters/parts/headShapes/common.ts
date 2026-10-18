/**
 * Éléments communs aux formes de tête (crâne de 12×11) : le haut du crâne est le même pour toutes
 * les formes, ce qui permet à chaque coiffure d'aller sur chaque forme ; seules la mâchoire, la
 * largeur des joues et la nuque changent.
 */
import type { Anchors, HeadShapeView } from '../../types';

/** Haut du crâne (8 rangées), commun à toutes les formes. */
export const SKULL_TOP: readonly string[] = [
  '...xxxxx....',
  '..xxxxxxxx..',
  '.xxxxxxxxxx.',
  '.xxxxxxxxxx.',
  '.xxxxxxxxxx.',
  '.xxxxxxxxxx.',
  '.xxxxxxxxx..',
  '.xxxxxxxxxx.',
];

/** Joues larges : le crâne déborde d'une colonne à l'arrière à partir de la rangée 3. */
export function wideCheeks(rows: readonly string[]): string[] {
  return rows.map((r, y) => (y >= 3 && y <= 7 ? 'x' + r.slice(1) : r));
}

/** De dos : le haut du crâne (joue du côté de la course pleine), puis une nuque étroite et centrée. */
export function backSkull(top: readonly string[], nape: readonly string[] = BACK_NAPE): string[] {
  return [...top.map((r, y) => (y === 6 ? r.slice(0, 10) + 'x' + r.slice(11) : r)), ...nape];
}

export const BACK_NAPE: readonly string[] = ['..xxxxxxxx..', '...xxxxxx...', '....xxxx....'];

/** Ancrages en diagonale bas (de face, tourné vers la droite). */
export const ANCHORS_DOWN: Anchors = {
  eyeNear: [6, 6],
  eyeFar: [9, 6],
  browNear: [6, 4],
  browFar: [9, 4],
  nose: [10, 8],
  mouth: [7, 9],
  cheek: [6, 8],
  earNear: [3, 5],
  earFar: [3, 5],
  hairline: [3, 0],
  chin: [7, 10],
  neck: [5, 9],
};

/** Ancrages en diagonale haut (de dos) : le visage est masqué, ses ancrages restent pour le repère. */
export const ANCHORS_UP: Anchors = {
  ...ANCHORS_DOWN,
  earNear: [11, 5],
  earFar: [0, 5],
  chin: [6, 10],
};

/** Zone du visage : colonnes 5 à 9 dès la rangée 3 (les sourcils peuvent monter jusqu'à la rangée 3). */
export const FACE_ZONE: HeadShapeView['face'] = { x0: 5, x1: 9, y0: 3 };

export function shapeViews(down: readonly string[], up: readonly string[]): Record<'down' | 'up', HeadShapeView> {
  return {
    down: { skull: down, anchors: ANCHORS_DOWN, face: FACE_ZONE },
    up: { skull: up, anchors: ANCHORS_UP, face: FACE_ZONE },
  };
}
