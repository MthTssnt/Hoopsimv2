/**
 * Tête à ~25 % de la hauteur du joueur (crâne 12×11), prototype des planches de styles.
 * Les traits du visage ne sont pas codés en dur : chaque style fournit un « kit » (yeux, sourcils,
 * nez, bouche, une variante par expression), posé par rapport aux ancrages du crâne. De dos, le
 * visage est masqué ; la nuque est étroite et centrée, les cheveux couvrent l'arrière du crâne.
 * Grille en emplacements de couleur (comme `heads2d.ts`) : 1-4 peau, 0 reflet du crâne, r h H D E
 * cheveux, w blanc, n pupille, i iris, b B barbe, s S bandeau.
 */
import type { Heading } from '../../src/match/render/sprites/rig';
import { HAIRS_25 } from './hairs25';

export type Expr4 = 'neutre' | 'joie' | 'cri' | 'decu';
export const EXPRESSIONS_4: readonly Expr4[] = ['neutre', 'joie', 'cri', 'decu'];

/** Pixel relatif à un ancrage : [dx, dy, emplacement]. */
export type Px = readonly [number, number, string];

/** Traits d'un style ; chaque pièce donne ses pixels par expression, relatifs à son ancrage. */
export interface FaceKit {
  eyes: Record<Expr4, { near: readonly Px[]; far: readonly Px[] }>;
  brows: Record<Expr4, { near: readonly Px[]; far: readonly Px[] }>;
  nose: readonly Px[];
  mouth: Record<Expr4, readonly Px[]>;
}

/** Ancrages du crâne 12×11 en diagonale bas (repère du crâne). */
export const ANCHORS_25 = {
  nearEye: [6, 6],
  farEye: [9, 6],
  nearBrow: [6, 4],
  farBrow: [9, 4],
  nose: [10, 8],
  mouth: [7, 9],
  neck: [5, 9],
} as const;

const SHAPES = ['normale', 'carree', 'fine', 'ronde', 'large'] as const;
const SKULL_TOP = ['...xxxxx....', '..xxxxxxxx..', '.xxxxxxxxxx.', '.xxxxxxxxxx.', '.xxxxxxxxxx.', '.xxxxxxxxxx.', '.xxxxxxxxx..', '.xxxxxxxxxx.'];
const JAWS: Record<(typeof SHAPES)[number], readonly string[]> = {
  normale: ['..xxxxxxxxxx', '...xxxxxxxx.', '.....xxxxx..'],
  carree: ['.xxxxxxxxxxx', '..xxxxxxxxx.', '...xxxxxxx..'],
  fine: ['..xxxxxxxxxx', '....xxxxxxx.', '......xxxx..'],
  ronde: ['.xxxxxxxxxxx', '..xxxxxxxxx.', '....xxxxx...'],
  large: ['xxxxxxxxxxxx', '.xxxxxxxxxx.', '...xxxxxxx..'],
};
/** De dos : nuque étroite et centrée sous le crâne. */
const BACK_LOW = ['..xxxxxxxx..', '...xxxxxx...', '....xxxx....'];

function skullRows(shape: number, heading: Heading): string[] {
  const name = SHAPES[shape % SHAPES.length];
  if (heading === 'up') return [...SKULL_TOP.map((r, y) => (y === 6 ? r.slice(0, 10) + 'x' + r.slice(11) : r)), ...BACK_LOW];
  const top = name === 'large' || name === 'ronde' ? SKULL_TOP.map((r, y) => (y >= 3 ? 'x' + r.slice(1) : r)) : SKULL_TOP;
  return [...top, ...JAWS[name]];
}

export interface Look25 {
  head: number;
  hair: number;
  facialHair?: number;
  headband?: boolean;
}

export interface HeadGrid {
  rows: string[];
  anchor: { x: number; y: number };
}

const PAD_X = 4;
const PAD_Y = 7;
const W = 21;
const H = 26;
const HAIR = 'rhHDE';

/** Tête composée dans l'ordre : peau, oreilles (sous les cheveux longs), cheveux, oreilles, visage, pilosité, bandeau. */
export function headGrid25(look: Look25, heading: Heading, expression: Expr4, kit: FaceKit | null): HeadGrid {
  const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  const get = (x: number, y: number) => g[y + PAD_Y]?.[x + PAD_X] ?? '.';
  const set = (x: number, y: number, ch: string) => {
    if (y + PAD_Y >= 0 && y + PAD_Y < H && x + PAD_X >= 0 && x + PAD_X < W) g[y + PAD_Y][x + PAD_X] = ch;
  };
  const rows = skullRows(look.head, heading);
  const skull = (x: number, y: number) => rows[y]?.[x] === 'x';
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== 'x') return;
      const left = row.indexOf('x');
      const right = row.lastIndexOf('x');
      const shade = heading === 'down' ? y >= 8 && (x === left || !skull(x, y + 1) || (x === right && y > 8)) : !skull(x, y + 1);
      set(x, y, shade ? '3' : '2');
    }),
  );
  const hair = HAIRS_25[look.hair % HAIRS_25.length];
  const ears = () => {
    const px: readonly Px[] = heading === 'down' ? [[3, 5, '2'], [3, 6, '3'], [4, 6, '2'], [3, 7, '3']] : [[11, 5, '2'], [11, 6, '3'], [0, 5, '2'], [0, 6, '3']];
    for (const [x, y, ch] of px) set(x, y, ch);
  };
  if (hair.coversEars) ears();
  const view = hair[heading];
  view.rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && set(view.at[0] + x, view.at[1] + y, ch)));
  if (!hair.coversEars) ears();
  // Ombre de la ligne des cheveux sur la peau juste dessous.
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < 12; x++) if (get(x, y) === '2' && HAIR.includes(get(x, y - 1)) && get(x, y - 1) !== '.') set(x, y, '3');
  const isSkin = (x: number, y: number) => '1234'.includes(get(x, y)) && get(x, y) !== '.';
  // Visage (diagonale bas seulement) : chaque pièce posée à son ancrage.
  const mouthAt = new Set<string>();
  if (heading === 'down' && kit) {
    const A = ANCHORS_25;
    const place = (anchor: readonly [number, number], px: readonly Px[], tag?: Set<string>) => {
      for (const [dx, dy, ch] of px) {
        const x = anchor[0] + dx;
        const y = anchor[1] + dy;
        // Une pièce du visage ne se pose que sur la peau : la frange la masque (règle de l'étape 2).
        if (!(skull(x, y) || isSkin(x, y)) || (HAIR.includes(get(x, y)) && get(x, y) !== '.')) continue;
        set(x, y, ch);
        tag?.add(`${x},${y}`);
      }
    };
    place(A.nose, kit.nose);
    place(A.mouth, kit.mouth[expression], mouthAt);
    place(A.nearEye, kit.eyes[expression].near);
    place(A.farEye, kit.eyes[expression].far);
    place(A.nearBrow, kit.brows[expression].near);
    place(A.farBrow, kit.brows[expression].far);
  }
  // Pilosité : barbe courte (1), bouc (2), moustache (3) ; la bouche reste visible.
  const facial = look.facialHair ?? 0;
  if (facial) {
    const beard = (x: number, y: number) => {
      if (mouthAt.has(`${x},${y}`) || !isSkin(x, y)) return;
      set(x, y, !isSkin(x, y + 1) ? 'B' : 'b');
    };
    if (heading === 'up') {
      if (facial === 1) for (let y = 8; y <= 10; y++) for (let x = 8; x <= 11; x++) beard(x, y);
    } else {
      if (facial === 1) {
        for (let y = 8; y <= 10; y++) for (let x = 2; x <= 11; x++) if (!(y === 8 && x >= 9)) beard(x, y);
        for (const y of [6, 7]) beard(4, y);
      }
      if (facial === 2) for (const [x, y] of [[6, 10], [7, 10], [8, 10], [5, 9], [9, 9]] as const) beard(x, y);
      if (facial === 1 || facial === 3) for (const x of [6, 7, 8]) if (!mouthAt.has(`${x},8`)) set(x, 8, 'B');
    }
  }
  if (look.headband) {
    for (let x = -PAD_X; x < W - PAD_X; x++) {
      if (get(x, 1) !== '.') set(x, 1, 's');
      if (get(x, 2) !== '.') set(x, 2, 'S');
    }
  }
  const used = g.map((r) => r.some((c) => c !== '.'));
  const top = used.indexOf(true);
  const bottom = used.lastIndexOf(true);
  return { rows: g.slice(top, bottom + 1).map((r) => r.join('')), anchor: { x: ANCHORS_25.neck[0] + PAD_X, y: ANCHORS_25.neck[1] + PAD_Y - top } };
}
