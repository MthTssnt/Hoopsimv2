/** Étiquette de nom à l'écran : centre horizontal, haut, largeur et hauteur (px). */
export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Écarte les étiquettes qui se chevauchent (joueurs côte à côte) : chaque paire se repousse à
 * l'horizontale, chacune de son côté, en pixels entiers. Quelques passes suffisent à 6 joueurs.
 */
export function spreadLabels(boxes: LabelBox[], passes = 4): void {
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (Math.abs(a.y - b.y) > Math.max(a.height, b.height)) continue;
        const overlap = (a.width + b.width) / 2 + 1 - Math.abs(a.x - b.x);
        if (overlap <= 0) continue;
        const side = b.x > a.x || (b.x === a.x && j > i) ? 1 : -1;
        a.x -= side * Math.floor(overlap / 2);
        b.x += side * Math.ceil(overlap / 2);
        moved = true;
      }
    }
    if (!moved) return;
  }
}
