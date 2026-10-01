/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * L'état tient dans un seul entier 32 bits, ce qui permet de sérialiser
 * la partie et de reprendre exactement la même séquence après un chargement.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  get state(): number {
    return this.s;
  }

  /** Nombre flottant dans [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Flottant dans [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Vrai avec la probabilité p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Loi normale (Box-Muller), tronquée à ±3 écarts-types. */
  normal(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-9);
    const v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sd * Math.max(-3, Math.min(3, z));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Tirage pondéré : `weights[i]` doit être >= 0. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return this.int(0, weights.length - 1);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return i;
      r -= w;
    }
    return weights.length - 1;
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
