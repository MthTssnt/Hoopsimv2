/**
 * Emplacements de couleur d'un sprite. Les grilles et le rig dessinent avec ces symboles ;
 * la couleur réelle n'est choisie qu'au moment de la cuisson (peau, cheveux, équipe…).
 *   o contour · 1/2/3 peau claire/base/ombre · r/h/H cheveux reflet/base/ombre
 *   p/P/q équipe primaire claire/base/sombre · s/S/t équipe secondaire claire/base/sombre
 *   k encre (chaussures) · w craie (semelles, chaussettes, blanc des yeux) · n pupille
 */
export type Slot = 'o' | '1' | '2' | '3' | 'r' | 'h' | 'H' | 'p' | 'P' | 'q' | 's' | 'S' | 't' | 'k' | 'w' | 'n';

const SLOT_LIST: readonly Slot[] = ['o', '1', '2', '3', 'r', 'h', 'H', 'p', 'P', 'q', 's', 'S', 't', 'k', 'w', 'n'];
const SLOTS = new Set<string>(SLOT_LIST);
/** Code d'un emplacement dans le tampon (0 = transparent). */
const CODE = Object.fromEntries(SLOT_LIST.map((slot, i) => [slot, i + 1])) as Record<Slot, number>;

/** Lit un caractère de grille : « . » (ou espace) = transparent ; « e » = blanc de l'œil (w). */
export function slotOf(char: string): Slot | null {
  if (char === 'e') return 'w';
  return SLOTS.has(char) ? (char as Slot) : null;
}

export interface StampOptions {
  /** Ne peindre que là où le tampon contient déjà quelque chose (coiffures collées au crâne). */
  clip?: boolean;
  /** Retourne une grille horizontalement. */
  flip?: boolean;
  /** Remplace un symbole par un autre (ex. maillot rayé de l'arbitre). */
  remap?: (slot: Slot, x: number, y: number) => Slot;
}

/**
 * Tampon de pixels indexé sur les emplacements de couleur. Il garde la boîte de ses pixels
 * peints : contour, recopie et parcours ne visitent qu'elle (un calque de bras ne parcourt pas
 * tout le cadre).
 */
export class SlotCanvas {
  readonly width: number;
  readonly height: number;
  private readonly px: Uint8Array;
  // Boîte des pixels peints (jamais rétrécie : un pixel effacé la laisse telle quelle).
  private left = Infinity;
  private right = -1;
  private top = Infinity;
  private bottom = -1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.px = new Uint8Array(width * height);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Slot | null {
    if (!this.inside(x, y)) return null;
    const code = this.px[y * this.width + x];
    return code ? SLOT_LIST[code - 1] : null;
  }

  set(x: number, y: number, slot: Slot | null): void {
    if (!this.inside(x, y)) return;
    if (slot === null) {
      this.px[y * this.width + x] = 0;
      return;
    }
    this.px[y * this.width + x] = CODE[slot];
    if (x < this.left) this.left = x;
    if (x > this.right) this.right = x;
    if (y < this.top) this.top = y;
    if (y > this.bottom) this.bottom = y;
  }

  rect(x: number, y: number, w: number, h: number, slot: Slot): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, slot);
  }

  /** Pose une grille (tableau de chaînes) avec son coin haut-gauche en (x, y). */
  stamp(grid: readonly string[], x: number, y: number, options: StampOptions = {}): void {
    grid.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        const slot = slotOf(row[options.flip ? row.length - 1 - gx : gx]);
        if (!slot) continue;
        const px = x + gx;
        const py = y + gy;
        if (options.clip && !this.get(px, py)) continue;
        this.set(px, py, options.remap ? options.remap(slot, px, py) : slot);
      }
    });
  }

  /** Trait épais (membre) : un carré de `thickness` pixels tamponné le long d'une ligne. */
  line(x0: number, y0: number, x1: number, y1: number, thickness: number, slot: Slot): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((thickness - 1) / 2);
    for (;;) {
      this.rect(x - off, y - off, thickness, thickness, slot);
      if (x === tx && y === ty) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Entoure la silhouette d'un pixel de contour (voisinage à 4). Les pixels déjà en contour ne
   * sont pas entourés à leur tour : un calque déjà cerné ne prend pas un second trait.
   */
  outline(slot: Slot = 'o'): void {
    if (this.right < 0) return;
    const edges: [number, number][] = [];
    const fill = (x: number, y: number) => {
      const v = this.get(x, y);
      return v !== null && v !== slot;
    };
    const x1 = Math.min(this.width - 1, this.right + 1);
    const y1 = Math.min(this.height - 1, this.bottom + 1);
    for (let y = Math.max(0, this.top - 1); y <= y1; y++) {
      for (let x = Math.max(0, this.left - 1); x <= x1; x++) {
        if (this.px[y * this.width + x]) continue;
        if (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1)) edges.push([x, y]);
      }
    }
    for (const [x, y] of edges) this.set(x, y, slot);
  }

  /** Recopie par-dessus les pixels peints d'un autre tampon de même taille (calque). */
  composite(layer: SlotCanvas): void {
    layer.forEach((x, y, slot) => this.set(x, y, slot));
  }

  /** Copie retournée horizontalement (x devient largeur - 1 - x). */
  mirrored(): SlotCanvas {
    const out = new SlotCanvas(this.width, this.height);
    this.forEach((x, y, slot) => out.set(this.width - 1 - x, y, slot));
    return out;
  }

  /** Copie décalée de (dx, dy) ; ce qui sort du tampon est perdu. */
  shifted(dx: number, dy: number): SlotCanvas {
    const out = new SlotCanvas(this.width, this.height);
    this.forEach((x, y, slot) => out.set(x + dx, y + dy, slot));
    return out;
  }

  /** Boîte englobante des pixels peints, ou null si le tampon est vide. */
  bounds(): { left: number; right: number; top: number; bottom: number } | null {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    this.forEach((x, y) => {
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    });
    return left === Infinity ? null : { left, right, top, bottom };
  }

  /** Parcourt les pixels peints, rangée par rangée. */
  forEach(fn: (x: number, y: number, slot: Slot) => void): void {
    for (let y = Math.max(0, this.top); y <= this.bottom; y++) {
      for (let x = Math.max(0, this.left); x <= this.right; x++) {
        const code = this.px[y * this.width + x];
        if (code) fn(x, y, SLOT_LIST[code - 1]);
      }
    }
  }
}
