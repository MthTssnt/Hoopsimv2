/**
 * Têtes du rendu 2D (`figure2d.ts`), dessins originaux, d'après la technique de sprites de RPG en
 * pixel-art choisie par Matheo (technique seulement : ni dessins ni proportions repris).
 * - Crâne et visage : 11 rangées, tournés vers la droite (vers la gauche, l'image est retournée).
 *   Le haut du crâne est commun à toutes les formes ; la mâchoire varie (normale, carrée, fine,
 *   ronde, large). Peau presque plate : base (2) et ombre (3) sous la ligne des cheveux, sur le côté
 *   et sous la mâchoire ; détails du visage en tons de peau (1 lumière, 3 ombre, 4 ombre foncée),
 *   blanc cassé (w) et couleur la plus foncée des cheveux (E, sourcils). Le noir (n) est réservé aux
 *   pupilles.
 * - Coiffures (`hairs2d.ts`) : masses de mèches dessinées à la main, une vue de face et une de dos ;
 *   elles se posent sur le haut du crâne, commun à toutes les formes, donc sur toutes les têtes.
 * - Options combinables : bandeau (couleur secondaire de l'équipe), pilosité faciale.
 * Le contour coloré (ton le plus foncé de chaque matière) est posé par `figure2d`.
 */
import type { Appearance } from '../../match/render/sprites/appearance';
import type { Heading } from '../../match/render/sprites/rig';
import type { Expression } from './heads';
import { HAIRS_2D, type Hair2D } from './hairs2d';

type Point = readonly [number, number];

/** Expressions du visage : celles du jeu, plus l'effort (ou le cri) et la déception. */
export type FaceExpression = Expression | 'effort' | 'decu';
export const FACE_EXPRESSIONS: readonly FaceExpression[] = ['neutre', 'concentree', 'joyeuse', 'effort', 'decu'];

// ---------------------------------------------------------------------------------------------
// Crâne et visage

/** Formes de tête (mâchoire), même nombre que `HEADS` : la base est la mâchoire normale. */
export const SHAPES_2D = ['normale', 'carree', 'fine', 'ronde', 'large'] as const;
type Shape = (typeof SHAPES_2D)[number];

/**
 * Silhouette du crâne de 3/4 face (« x ») : arcade (rangée 5), creux de l'œil (6), nez qui dépasse
 * d'1 px (rangée 8, colonne 11), bouche (9), menton (10). Les rangées 0-7 sont communes.
 */
const SKULL_TOP = ['...xxxxx....', '..xxxxxxxx..', '.xxxxxxxxxx.', '.xxxxxxxxxx.', '.xxxxxxxxxx.', '.xxxxxxxxxx.', '.xxxxxxxxx..', '.xxxxxxxxxx.'];
const JAWS: Readonly<Record<Shape, readonly string[]>> = {
  normale: ['..xxxxxxxxxx', '...xxxxxxxx.', '.....xxxxx..'],
  carree: ['.xxxxxxxxxxx', '..xxxxxxxxx.', '...xxxxxxx..'],
  fine: ['..xxxxxxxxxx', '....xxxxxxx.', '......xxxx..'],
  ronde: ['.xxxxxxxxxxx', '..xxxxxxxxx.', '....xxxxx...'],
  large: ['xxxxxxxxxxxx', '.xxxxxxxxxx.', '...xxxxxxx..'],
};

function skullRows(shape: Shape, heading: Heading): string[] {
  const top = shape === 'large' || shape === 'ronde' ? SKULL_TOP.map((r, y) => (y >= 3 ? 'x' + r.slice(1) : r)) : [...SKULL_TOP];
  const rows = [...top, ...JAWS[shape]];
  if (heading === 'down') return rows;
  // De 3/4 dos : pas de nez ni de creux de l'œil ; la joue et la mâchoire bordent la droite.
  return rows.map((r, y) => (y === 6 ? r.slice(0, 10) + 'x' + r.slice(11) : y === 8 ? r.slice(0, 11) + '.' : r));
}

/** Traits qui varient d'un joueur à l'autre, visibles à l'échelle du match (plusieurs pixels à la fois). */
export interface FaceTraits {
  /** Œil rond (2×2), étroit (2×1) ou à paupière lourde. */
  eyes: 'rond' | 'etroit' | 'lourd';
  /**
   * Rangée des yeux : 6 (hauts) ou 7 ; colonne de l'œil proche : 5 (écartés) ou 6 (rapprochés).
   * L'œil rond (2 rangées) est toujours en 7, pour garder la peau entre sourcil, œil et frange.
   */
  eyeY: 6 | 7;
  eyeX: 5 | 6;
  brows: 'fin' | 'epais';
  nose: 'fin' | 'large';
  mouth: 'fine' | 'pleine';
}

/** Visages types (le joueur en reçoit un, d'après son apparence). */
export const FACE_TRAITS: readonly FaceTraits[] = [
  { eyes: 'etroit', eyeY: 7, eyeX: 6, brows: 'fin', nose: 'fin', mouth: 'fine' },
  { eyes: 'rond', eyeY: 7, eyeX: 5, brows: 'epais', nose: 'large', mouth: 'pleine' },
  { eyes: 'lourd', eyeY: 7, eyeX: 5, brows: 'epais', nose: 'large', mouth: 'fine' },
  { eyes: 'rond', eyeY: 7, eyeX: 6, brows: 'fin', nose: 'fin', mouth: 'pleine' },
  { eyes: 'etroit', eyeY: 6, eyeX: 5, brows: 'epais', nose: 'fin', mouth: 'pleine' },
  { eyes: 'lourd', eyeY: 6, eyeX: 6, brows: 'fin', nose: 'large', mouth: 'pleine' },
];

type Pixel = readonly [number, number, string];

/**
 * Traits du visage (diagonale bas), exagérés comme dans un jeu d'arcade : sourcils (E) séparés de
 * l'œil et de la frange par la peau ; yeux en blanc cassé + pupille ; nez en ombrage ; bouche en
 * ombre foncée ; pommette éclairée.
 */
function faceFeatures(t: FaceTraits, e: FaceExpression): Pixel[] {
  const px: Pixel[] = [];
  const { eyeX: x, eyeY: y } = t;
  // Modelé et nez.
  px.push([x - 1, y + 1, '1'], [10, 7, '1'], [10, 9, '3']);
  if (t.nose === 'large') px.push([10, 8, '3'], [9, 9, '3'], [11, 9, '2']);
  // Yeux (l'œil éloigné, colonne 9, est plus étroit).
  const eyes: Pixel[] =
    e === 'joyeuse'
      ? [[x, y, '4'], [x + 1, y, '4'], [x + 1, y - 1, '4'], [9, y, '4'], [9, y - 1, '4']]
      : e === 'effort'
        ? [...(y >= 7 ? ([[x, y - 1, 'w'], [x + 1, y - 1, 'w'], [9, y - 1, 'w']] as Pixel[]) : []), [x, y, 'w'], [x + 1, y, 'n'], [9, y, 'w'], [10, y, 'n']]
        : e === 'concentree'
          ? [[x, y - 1, '3'], [x + 1, y - 1, '3'], [x, y, 'w'], [x + 1, y, 'n'], [9, y - 1, '3'], [9, y, 'n']]
          : t.eyes === 'rond'
            ? [[x, y - 1, 'w'], [x + 1, y - 1, '2'], [x, y, 'w'], [x + 1, y, 'n'], [9, y - 1, '2'], [9, y, 'n']]
            : t.eyes === 'lourd'
              ? [[x, y - 1, '4'], [x + 1, y - 1, '4'], [x, y, 'w'], [x + 1, y, 'n'], [9, y - 1, '4'], [9, y, 'n']]
              : [[x, y - 1, '3'], [x + 1, y - 1, '3'], [x, y, 'w'], [x + 1, y, 'n'], [9, y, 'n']];
  px.push(...eyes);
  // Sourcils : rangée de base 2 au-dessus de l'œil (une rangée de peau entre les deux).
  const b = t.eyes === 'rond' && e !== 'concentree' && e !== 'joyeuse' ? y - 3 : y - 2;
  // Le sourcil épais s'allonge vers le nez (jamais sur la patte, colonne 4).
  const near = t.brows === 'epais' ? [5, 6, 7] : [x, x + 1];
  const far = t.brows === 'epais' ? [8, 9] : [9];
  // Sourcils relevés : jamais au-dessus de la rangée 4 (la frange s'arrête en 2, une rangée de peau entre les deux).
  const up = (r: number) => Math.max(4, r);
  const brows: Point[] =
    e === 'concentree'
      ? [...near.map((c): Point => [c, b]), [x + 2, b + 1], [8, b + 1], [9, b]]
      : e === 'joyeuse'
        ? [...near.map((c, i): Point => [c, i === 0 ? b : up(b - 1)]), ...far.map((c): Point => [c, up(b - 1)])]
        : e === 'effort'
          ? [...near.map((c): Point => [c, up(y - 4)]), ...far.map((c): Point => [c, up(y - 4)])]
          : e === 'decu'
            ? [...near.map((c, i): Point => [c, i === near.length - 1 ? up(b - 1) : b]), [8, up(b - 1)], [9, b]]
            : [...near.map((c): Point => [c, b]), ...far.map((c): Point => [c, b])];
  for (const [bx, by] of brows) px.push([bx, by, 'E']);
  // Bouche (rangée 9) en ombre foncée de la peau ; lèvre plus claire dessous pour les lèvres pleines.
  const lip = t.mouth === 'pleine';
  const mouths: Record<FaceExpression, Pixel[]> = {
    neutre: lip ? [[6, 9, '4'], [7, 9, '4'], [8, 9, '4'], [7, 10, '1']] : [[6, 9, '4'], [7, 9, '4']],
    concentree: [[5, 9, '4'], [6, 9, '4'], [7, 9, '4'], [8, 9, '4']],
    joyeuse: [[5, 8, '4'], [6, 9, 'w'], [7, 9, 'w'], [8, 9, 'w'], [9, 8, '4'], [7, 10, '4']],
    effort: [[6, 9, '4'], [7, 9, '4'], [6, 10, '4'], [7, 10, '4'], [8, 9, 'w']],
    decu: [[5, 10, '4'], [6, 9, '4'], [7, 9, '4'], [8, 10, '4']],
  };
  px.push(...mouths[e]);
  return px;
}

// ---------------------------------------------------------------------------------------------
// Pilosité faciale

/** Pilosité faciale, combinable avec toute tête et toute coiffure. */
export const FACIAL_HAIR_2D = ['aucune', 'barbe courte', 'bouc', 'moustache', 'barbe de 3 jours'] as const;

function facialHair(kind: number, heading: Heading, skin: (x: number, y: number) => boolean): Pixel[] {
  const px: Pixel[] = [];
  const under = (x: number, y: number) => !skin(x, y + 1);
  if (heading === 'up') {
    // De dos, seul le bord de la mâchoire, côté course, se voit.
    if (kind === 1 || kind === 4) for (let y = 8; y <= 10; y++) for (let x = 8; x <= 11; x++) if (skin(x, y)) px.push([x, y, kind === 4 ? '3' : under(x, y) ? 'D' : 'H']);
    return px;
  }
  if (kind === 1 || kind === 4) {
    // Mâchoire et menton, reliés à la patte devant l'oreille.
    for (let y = 8; y <= 10; y++) for (let x = 2; x <= 11; x++) if (skin(x, y) && !(y === 8 && x >= 9)) px.push([x, y, kind === 4 ? '3' : under(x, y) ? 'D' : 'H']);
    for (const y of [6, 7]) if (skin(4, y)) px.push([4, y, kind === 4 ? '3' : 'H']);
  }
  if (kind === 1 || kind === 3) px.push([6, 8, 'D'], [7, 8, 'D'], [8, 8, 'D']);
  if (kind === 2) px.push([6, 8, 'D'], [7, 8, 'D'], [5, 9, 'H'], [9, 9, 'H'], [6, 10, 'H'], [7, 10, 'D'], [8, 10, 'H']);
  return px;
}

// ---------------------------------------------------------------------------------------------
// Coiffures (dessinées dans `hairs2d.ts`)

export { HAIRS_2D, type Hair2D } from './hairs2d';

// ---------------------------------------------------------------------------------------------
// Composition

/** Marge de la grille composée autour du crâne (volume des coiffures au-dessus, cheveux longs dessous). */
const PAD_X = 3;
const PAD_Y = 7;
const SIZE_W = 19;
const SIZE_H = 26;

export interface Head2D {
  rows: string[];
  /** Point du cou dans `rows` : il se pose sur le haut du cou du squelette. */
  anchor: { x: number; y: number };
}

export interface HeadLook extends Pick<Appearance, 'head' | 'hair'> {
  /** Indice dans `FACIAL_HAIR_2D` (0 : aucune). */
  facialHair?: number;
  /** Indice dans `FACE_TRAITS` (par défaut : celui de la forme de tête). */
  face?: number;
  /** Bandeau aux couleurs de l'équipe, par-dessus n'importe quelle coiffure. */
  headband?: boolean;
}

const HAIR_CHARS = 'rhHDE';
const cache = new Map<string, Head2D>();

/** Tête composée : crâne, cheveux, oreilles, visage, pilosité, bandeau. Mise en cache (une par variante). */
export function headGrid2D(look: HeadLook, heading: Heading, expression: FaceExpression = 'neutre'): Head2D {
  const shape = SHAPES_2D[look.head % SHAPES_2D.length];
  const hair = HAIRS_2D[look.hair % HAIRS_2D.length];
  const facial = (look.facialHair ?? 0) % FACIAL_HAIR_2D.length;
  const face = FACE_TRAITS[(look.face ?? look.head) % FACE_TRAITS.length];
  const key = `${shape}|${hair.name}|${facial}|${JSON.stringify(face)}|${look.headband ? 1 : 0}|${heading}|${heading === 'down' ? expression : ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const made = composeHead(shape, hair, face, facial, !!look.headband, heading, expression);
  cache.set(key, made);
  return made;
}

function composeHead(shape: Shape, hair: Hair2D, face: FaceTraits, facial: number, headband: boolean, heading: Heading, expression: FaceExpression): Head2D {
  const g: string[][] = Array.from({ length: SIZE_H }, () => Array.from({ length: SIZE_W }, () => '.'));
  const get = (x: number, y: number) => g[y + PAD_Y]?.[x + PAD_X] ?? '.';
  const set = (x: number, y: number, ch: string) => {
    if (y + PAD_Y >= 0 && y + PAD_Y < SIZE_H && x + PAD_X >= 0 && x + PAD_X < SIZE_W) g[y + PAD_Y][x + PAD_X] = ch;
  };
  const rows = skullRows(shape, heading);
  const skull = (x: number, y: number) => (rows[y]?.[x] ?? '.') === 'x';
  const isSkin = (x: number, y: number) => get(x, y) !== '.' && '1234'.includes(get(x, y));

  // Peau à plat : ombre sur le côté et sous la mâchoire, et sur la joue côté ombre (vue de dos).
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== 'x') return;
      const left = row.indexOf('x');
      const right = row.lastIndexOf('x');
      const shade = (y >= 8 && (x === left || !skull(x, y + 1) || (x === right && !(heading === 'down' && y === 8)))) || (heading === 'up' && x === right && y >= 4);
      set(x, y, shade ? '3' : '2');
    }),
  );

  // Oreilles : de face, l'oreille proche à l'arrière du visage ; de dos, l'oreille proche côté course
  // et le bord de l'oreille éloignée qui dépasse à gauche. Posées par-dessus les cheveux, sauf
  // quand la coiffure tombe dessus.
  const ears = () => {
    if (heading === 'down') for (const [x, y, ch] of [[3, 5, '2'], [3, 6, '3'], [4, 6, '2'], [3, 7, '3']] as const) set(x, y, ch);
    else {
      for (const [x, y, ch] of [[9, 5, '2'], [9, 6, '3'], [10, 5, '2'], [10, 6, '3']] as const) set(x, y, ch);
      for (const y of [5, 6]) set(rows[y].indexOf('x') - 1, y, y === 5 ? '2' : '3');
    }
  };
  if (hair.coversEars) ears();

  // Cheveux, puis ombre de la ligne des cheveux sur la peau juste dessous.
  const view = hair[heading];
  view.rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && set(view.at[0] + x, view.at[1] + y, ch)));
  if (!hair.coversEars) ears();
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < 12; x++) if (get(x, y) === '2' && get(x, y - 1) !== '.' && HAIR_CHARS.includes(get(x, y - 1))) set(x, y, '3');

  // Visage, pilosité.
  if (heading === 'down') {
    const features = faceFeatures(face, expression);
    const mouth = features.filter(([, y, ch]) => y >= 8 && (ch === '4' || ch === 'w'));
    for (const [x, y, ch] of features) if (skull(x, y) || isSkin(x, y)) set(x, y, ch);
    if (facial) for (const [x, y, ch] of facialHair(facial, heading, isSkin)) if (!mouth.some(([mx, my]) => mx === x && my === y)) set(x, y, ch);
  } else if (facial) for (const [x, y, ch] of facialHair(facial, heading, isSkin)) set(x, y, ch);

  // Bandeau : deux rangées sur le haut du front, tout autour de la tête.
  if (headband) {
    for (let x = -3; x < 13; x++) {
      if (get(x, 1) !== '.') set(x, 1, 's');
      if (get(x, 2) !== '.') set(x, 2, 'S');
    }
  }

  // Grille ramenée à ses rangées peintes (moins de travail pour le rendu), point du cou.
  const used = g.map((r) => r.some((c) => c !== '.'));
  const top = used.indexOf(true);
  const bottom = used.lastIndexOf(true);
  return { rows: g.slice(top, bottom + 1).map((r) => r.join('')), anchor: { x: 5 + PAD_X, y: 9 + PAD_Y - top } };
}
