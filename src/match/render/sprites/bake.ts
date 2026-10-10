import type Phaser from 'phaser';
import type { Appearance } from './appearance';
import { colorsFor, composeFrame, SHEET_VIEWS, slotColor, type Facing, type Heading, type Kit, type SlotColors } from './compose';
import { ANIMATIONS, bodyDims, FRAME, FRAMES, framesFor, type AnimationName, type BodyDims } from './rig';
import type { TeamRamp } from '../../../assets/palette';
import type { SlotCanvas, Slot } from './canvas';

export interface BakedPlayer {
  /**
   * Clé de la texture (feuille de sprites) : 4 blocs de 19 images (diagonale bas droite, bas
   * gauche, haut droite, haut gauche ; voir `sheetIndex`). Animations : voir `animationKey`.
   */
  key: string;
  /** Centre du ballon tenu pour chaque image de la feuille, ou null. */
  anchors: ({ x: number; y: number } | null)[];
  dims: BodyDims;
}

export interface BakeOptions {
  primary: TeamRamp;
  secondary: TeamRamp;
  kit?: Kit;
  /** Rejouer le tir et le dunk en boucle (scène `?style`). */
  loopAll?: boolean;
}

/**
 * Clé d'animation d'un joueur cuit, selon son orientation et sa vue (jamais de retournement : le
 * numéro resterait en miroir) : `${key}:${nom}`, puis `:up` en diagonale haut, puis `:left` vers la gauche.
 */
export function animationKey(key: string, name: AnimationName, facing: Facing, heading: Heading = 'down'): string {
  return `${key}:${name}${heading === 'up' ? ':up' : ''}${facing === 'left' ? ':left' : ''}`;
}

/** Nombre d'images d'une feuille : 19 images dans chacun des 4 blocs (2 diagonales, 2 orientations). */
const SHEET_FRAMES = FRAMES.length * SHEET_VIEWS.length;

/**
 * Position d'une image dans la texture : une rangée par bloc (19 images). En une seule bande, une
 * feuille trop longue dépasserait la taille maximale d'une texture (souvent 8 192, parfois
 * 4 096 px) et s'afficherait en noir.
 */
export function sheetCell(index: number): { x: number; y: number } {
  return { x: (index % FRAMES.length) * FRAME.width, y: Math.floor(index / FRAMES.length) * FRAME.height };
}
/** Taille de la texture d'une feuille (px). */
export const SHEET_SIZE = { width: FRAMES.length * FRAME.width, height: SHEET_VIEWS.length * FRAME.height } as const;

/** Horloge en millisecondes (injectée dans les tests). */
export type Clock = () => number;
const now: Clock = () => performance.now();

/**
 * Feuille d'un joueur en cours de cuisson. Les images sont composées une par une dans un tampon
 * de pixels RGBA (pur, sans Phaser) : `step` en compose dans un budget de temps, pour cuire le banc
 * en tâche de fond sans faire sauter d'image ; `finish` termine d'un trait, puis crée la texture
 * (une rangée par bloc, voir `sheetCell`) et les animations. Les couleurs (peau, cheveux, équipe) sont posées ici.
 */
export class SheetBaker {
  readonly key: string;
  readonly look: Appearance;
  readonly options: BakeOptions;
  readonly dims: BodyDims;
  readonly width = SHEET_SIZE.width;
  readonly height = SHEET_SIZE.height;
  readonly pixels: Uint8ClampedArray;
  readonly anchors: BakedPlayer['anchors'] = [];
  private readonly colors: SlotColors;
  private next = 0;

  constructor(key: string, look: Appearance, options: BakeOptions) {
    this.key = key;
    this.look = look;
    this.options = options;
    this.dims = bodyDims(look.heightCm, look.heavy);
    this.colors = colorsFor(look, options.primary, options.secondary);
    this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
  }

  get done(): boolean {
    return this.next >= SHEET_FRAMES;
  }

  /** Compose des images tant que le budget (ms) n'est pas épuisé, au moins une ; vrai quand la feuille est complète. */
  step(budgetMs: number, clock: Clock = now): boolean {
    const start = clock();
    do this.composeNext();
    while (!this.done && clock() - start < budgetMs);
    return this.done;
  }

  private composeNext(): void {
    if (this.done) return;
    const index = this.next++;
    const view = SHEET_VIEWS[Math.floor(index / FRAMES.length)];
    const frame = framesFor(view.heading)[index % FRAMES.length];
    const { canvas, ball } = composeFrame(this.look, frame, this.dims, this.options.kit, view.facing, view.heading);
    const cell = sheetCell(index);
    canvas.forEach((x, y, slot) => {
      const color = slotColor(slot, this.colors);
      const k = ((cell.y + y) * this.width + cell.x + x) * 4;
      this.pixels[k] = (color >> 16) & 0xff;
      this.pixels[k + 1] = (color >> 8) & 0xff;
      this.pixels[k + 2] = color & 0xff;
      this.pixels[k + 3] = 255;
    });
    this.anchors.push(ball);
  }

  /** Termine la feuille d'un trait, puis crée la texture et les animations du joueur. */
  finish(scene: Phaser.Scene): BakedPlayer {
    while (!this.done) this.composeNext();
    const { key } = this;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.createCanvas(key, this.width, this.height)!;
    const image = texture.context.createImageData(this.width, this.height);
    image.data.set(this.pixels);
    texture.putData(image, 0, 0);
    texture.refresh();
    for (let i = 0; i < SHEET_FRAMES; i++) {
      const cell = sheetCell(i);
      texture.add(i, 0, cell.x, cell.y, FRAME.width, FRAME.height);
    }

    for (const [name, def] of Object.entries(ANIMATIONS) as [AnimationName, (typeof ANIMATIONS)[AnimationName]][]) {
      SHEET_VIEWS.forEach(({ facing, heading }, v) => {
        const animKey = animationKey(key, name, facing, heading);
        if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
        // Durée de base = la plus courte ; les images plus longues ajoutent leur différence
        // (dans Phaser, la durée d'une image s'ajoute à la durée de base).
        const base = Math.min(...def.durations);
        scene.anims.create({
          key: animKey,
          frames: def.frames.map((frame, j) => ({ key, frame: v * FRAMES.length + frame, duration: def.durations[j] - base })),
          frameRate: 1000 / base,
          repeat: def.loop || this.options.loopAll ? -1 : 0,
          repeatDelay: def.loop ? 0 : 400,
        });
      });
    }
    return { key, anchors: this.anchors, dims: this.dims };
  }
}

/** Cuit toutes les images d'un joueur d'un trait (feuille, puis animations). */
export function bakePlayer(scene: Phaser.Scene, key: string, look: Appearance, options: BakeOptions): BakedPlayer {
  return new SheetBaker(key, look, options).finish(scene);
}

/** Ce qu'une file de cuisson fait avancer (une `SheetBaker`, ou un double dans les tests). */
export interface Stepper {
  step(budgetMs: number, clock?: Clock): boolean;
}

/**
 * File de cuisson en tâche de fond : un joueur après l'autre, dans un budget par image. `take`
 * sort un joueur de la file (fini ou non) pour le terminer d'un trait quand il entre en jeu.
 */
export class BakeQueue<T extends Stepper> {
  private items: { id: string; baker: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  has(id: string): boolean {
    return this.items.some((item) => item.id === id);
  }

  add(id: string, baker: T): void {
    if (!this.has(id)) this.items.push({ id, baker });
  }

  /** Retire `id` de la file et rend sa cuisson (à terminer d'un trait), ou null s'il n'y est pas. */
  take(id: string): T | null {
    const index = this.items.findIndex((item) => item.id === id);
    return index < 0 ? null : this.items.splice(index, 1)[0].baker;
  }

  /** Fait avancer la file dans le budget (ms) ; rend les cuissons terminées, dans l'ordre. */
  step(budgetMs: number, clock: Clock = now): { id: string; baker: T }[] {
    const start = clock();
    const finished: { id: string; baker: T }[] = [];
    while (this.items.length > 0) {
      const left = budgetMs - (clock() - start);
      if (left <= 0) break;
      const item = this.items[0];
      if (!item.baker.step(left, clock)) break;
      finished.push(this.items.shift()!);
    }
    return finished;
  }
}

/** Ombre ovale au sol, à la largeur du joueur. */
export function bakeShadow(scene: Phaser.Scene, key: string, width: number, height = 6): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.32);
  const rx = width / 2;
  const ry = height / 2;
  for (let y = 0; y < height; y++) {
    const dy = (y + 0.5 - ry) / ry;
    const half = Math.round(rx * Math.sqrt(1 - dy * dy));
    g.fillRect(Math.round(rx) - half, y, half * 2, 1);
  }
  g.generateTexture(key, width, height);
  g.destroy();
}

/** Pixels RGBA d'une liste d'images rangées en grille (`columns` par rangée), et la case de chacune. */
export function framesToPixels(
  canvases: readonly SlotCanvas[],
  colorOf: (slot: Slot) => number,
  columns: number,
): { width: number; height: number; pixels: Uint8ClampedArray; cells: { x: number; y: number }[] } {
  const fw = canvases[0].width;
  const fh = canvases[0].height;
  const cols = Math.min(columns, canvases.length);
  const width = cols * fw;
  const height = Math.ceil(canvases.length / cols) * fh;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const cells = canvases.map((_, i) => ({ x: (i % cols) * fw, y: Math.floor(i / cols) * fh }));
  canvases.forEach((canvas, i) => {
    const cell = cells[i];
    canvas.forEach((x, y, slot) => {
      const color = colorOf(slot);
      const k = ((cell.y + y) * width + cell.x + x) * 4;
      pixels[k] = (color >> 16) & 0xff;
      pixels[k + 1] = (color >> 8) & 0xff;
      pixels[k + 2] = color & 0xff;
      pixels[k + 3] = 255;
    });
  });
  return { width, height, pixels, cells };
}

/** Cuit une liste d'images (emplacements de couleur) en une texture en grille ; images nommées 0, 1, 2… */
export function bakeFrames(scene: Phaser.Scene, key: string, canvases: readonly SlotCanvas[], colorOf: (slot: Slot) => number, columns = 32): void {
  const { width, height, pixels, cells } = framesToPixels(canvases, colorOf, columns);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, height)!;
  const image = texture.context.createImageData(width, height);
  image.data.set(pixels);
  texture.putData(image, 0, 0);
  texture.refresh();
  cells.forEach((cell, i) => texture.add(i, 0, cell.x, cell.y, canvases[i].width, canvases[i].height));
}
