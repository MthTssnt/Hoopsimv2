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
 * Crâne de 3/4 face (« x »), 17 colonnes sur 16 rangées : front (rangées 3-4, sous la frange),
 * sourcils (5), yeux (7-9), nez en bosse d'1 px (rangée 10, colonne 16), bouche (12), menton (15).
 * Les rangées 0-10 sont communes à toutes les formes ; la mâchoire (11-15) varie.
 */
const SKULL_TOP = [
  '.....xxxxxxx.....',
  '...xxxxxxxxxxx...',
  '..xxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxxx',
];
const JAWS: Readonly<Record<Shape, readonly string[]>> = {
  normale: ['.xxxxxxxxxxxxxxx.', '..xxxxxxxxxxxxxx.', '...xxxxxxxxxxxx..', '.....xxxxxxxxxx..', '.......xxxxxxx...'],
  carree: ['xxxxxxxxxxxxxxxx.', '.xxxxxxxxxxxxxxx.', '..xxxxxxxxxxxxxx.', '...xxxxxxxxxxxx..', '.....xxxxxxxxxx..'],
  fine: ['.xxxxxxxxxxxxxxx.', '...xxxxxxxxxxxxx.', '.....xxxxxxxxxx..', '.......xxxxxxxx..', '.........xxxxx...'],
  ronde: ['xxxxxxxxxxxxxxxx.', '.xxxxxxxxxxxxxxx.', '..xxxxxxxxxxxxx..', '....xxxxxxxxxx...', '......xxxxxxx....'],
  large: ['xxxxxxxxxxxxxxxx.', 'xxxxxxxxxxxxxxxx.', '.xxxxxxxxxxxxxx..', '...xxxxxxxxxxxx..', '.....xxxxxxxxx...'],
};

/** Rangées du crâne : sourcils, haut et bas des yeux, nez, bouche (diagonale bas). */
const BROW_Y = 5;
const EYE_Y = 7;
const NOSE_Y = 10;
const MOUTH_Y = 12;

function skullRows(shape: Shape, heading: Heading): string[] {
  const rows = [...SKULL_TOP, ...JAWS[shape]];
  if (heading === 'down') return rows;
  // De 3/4 dos : pas de nez ni de creux de l'œil ; la joue et la mâchoire bordent la droite.
  return rows.map((r, y) => (y === 6 ? r.slice(0, 15) + 'x' + r.slice(16) : y === NOSE_Y ? r.slice(0, 16) + '.' : r));
}

/** Traits qui varient d'un joueur à l'autre, visibles à l'échelle du match. */
export interface FaceTraits {
  /** Œil en amande (coins arrière en peau) ou rond (blanc plein). */
  eyes: 'amande' | 'rond';
  /** Sourcils fins (1 rangée) ou épais (2 rangées côté nez). */
  brows: 'fin' | 'epais';
  /** Bosse du nez seule, ou bosse et ombre sous le nez. */
  nose: 'fin' | 'large';
  mouth: 'fine' | 'pleine';
}

/** Visages types (le joueur en reçoit un, d'après son apparence). */
export const FACE_TRAITS: readonly FaceTraits[] = [
  { eyes: 'amande', brows: 'fin', nose: 'fin', mouth: 'fine' },
  { eyes: 'rond', brows: 'epais', nose: 'large', mouth: 'pleine' },
  { eyes: 'amande', brows: 'epais', nose: 'large', mouth: 'fine' },
  { eyes: 'rond', brows: 'fin', nose: 'fin', mouth: 'pleine' },
  { eyes: 'amande', brows: 'epais', nose: 'fin', mouth: 'pleine' },
  { eyes: 'rond', brows: 'fin', nose: 'large', mouth: 'fine' },
];

type Pixel = readonly [number, number, string];

/** Colonnes des yeux : l'œil proche (3 de large) à l'arrière, l'œil éloigné (2 de large) près du profil. */
const NEAR_EYE = [8, 9, 10] as const;
const FAR_EYE = [12, 13] as const;

/**
 * Traits du visage (diagonale bas), d'après les principes de la référence de Matheo : grands yeux
 * (blanc, iris de couleur « i », pupille « n »), sourcils francs de 3 px au ton le plus foncé des
 * cheveux (E), séparés de l'œil et de la frange par la peau ; bouche dessinée (intérieur « 4 »,
 * dents « w ») ; nez minimal ; peau en 2 tons, sans trait sombre à l'intérieur du visage.
 * Le joueur regarde dans le sens de la course : iris et pupilles du côté du profil.
 */
function faceFeatures(t: FaceTraits, e: FaceExpression): Pixel[] {
  const px: Pixel[] = [];
  const [a, b, c] = NEAR_EYE;
  const [f, g] = FAR_EYE;
  const y = EYE_Y;
  // Nez : bosse dans la silhouette (le crâne) et une ombre dessous.
  px.push([15, NOSE_Y + 1, '3']);
  if (t.nose === 'large') px.push([14, NOSE_Y + 1, '3'], [15, NOSE_Y, '3']);

  // Yeux.
  if (e === 'joyeuse') {
    // Yeux plissés en arc (^), au ton foncé de la peau.
    px.push([a, y + 2, '4'], [b, y + 1, '4'], [c, y + 1, '4'], [c + 1, y + 2, '4'], [f, y + 1, '4'], [g, y + 1, '4'], [g + 1, y + 2, '4']);
  } else {
    // Œil ouvert : blanc, iris (2 colonnes à l'œil proche, 1 à l'œil éloigné), pupille côté profil.
    const lid = e === 'concentree' || e === 'decu';
    const low = e === 'decu';
    const top = lid ? y + 1 : y;
    for (let yy = top; yy <= y + 2; yy++) {
      px.push([a, yy, 'w'], [b, yy, 'i'], [c, yy, 'i'], [f, yy, 'w'], [g, yy, 'i']);
    }
    const pupil = low ? y + 2 : e === 'effort' ? y + 1 : y + 1;
    px.push([c, pupil, 'n'], [g, pupil, 'n']);
    if (e === 'effort') {
      // Yeux écarquillés : le blanc tout autour de l'iris.
      px.push([b, y, 'w'], [c, y, 'w'], [b, y + 2, 'w'], [c, y + 2, 'w'], [g, y, 'w'], [g, y + 2, 'w'], [c, y + 1, 'i'], [b, y + 1, 'n'], [g, y + 1, 'n']);
    }
    if (lid) px.push([a, y, '3'], [b, y, '3'], [c, y, '3'], [f, y, '3'], [g, y, '3']);
    // Œil en amande : les coins arrière (haut et bas) restent en peau.
    else if (t.eyes === 'amande' && e !== 'effort') px.push([a, y, '2'], [a, y + 2, '2']);
  }

  // Sourcils : 3 px pour l'œil proche, 3 px pour l'œil éloigné (jusqu'au bord du profil).
  const B = BROW_Y;
  const near: Point[] = [[a, B], [b, B], [c, B]];
  const far: Point[] = [[f, B], [g, B], [g + 1, B]];
  let brows: Point[];
  switch (e) {
    case 'concentree':
      // Froncés : en pente vers le nez.
      brows = [[a, B], [b, B], [c, B + 1], [f, B + 1], [g, B], [g + 1, B]];
      break;
    case 'joyeuse':
      // Relevés en arc.
      brows = [[a, B], [b, B - 1], [c, B - 1], [f, B - 1], [g, B - 1], [g + 1, B]];
      break;
    case 'effort':
      // Très relevés.
      brows = [...near, ...far].map(([x]) => [x, B - 1] as Point);
      break;
    case 'decu':
      // En accent circonflexe : le bout côté nez relevé.
      brows = [[a, B + 1], [b, B], [c, B - 1], [f, B - 1], [g, B], [g + 1, B + 1]];
      break;
    default:
      brows = [...near, ...far];
  }
  // Sourcils épais : une rangée de plus au-dessus (le front garde une rangée de peau sous la frange).
  if (t.brows === 'epais' && e === 'neutre') brows.push([b, B - 1], [c, B - 1], [g, B - 1]);
  for (const [bx, by] of brows) px.push([bx, by, 'E']);

  // Bouche (rangée 12), décalée vers le profil : intérieur sombre (4), dents (w).
  const M = MOUTH_Y;
  const lip = t.mouth === 'pleine';
  const mouths: Record<FaceExpression, Pixel[]> = {
    neutre: [[10, M, '4'], [11, M, '4'], [12, M, '4'], ...(lip ? ([[13, M, '4'], [11, M + 1, '3']] as Pixel[]) : [])],
    concentree: [[9, M, '4'], [10, M, '4'], [11, M, '4'], [12, M, '4'], [13, M, '4']],
    joyeuse: [[9, M - 1, '4'], [10, M, 'w'], [11, M, 'w'], [12, M, 'w'], [13, M, 'w'], [14, M - 1, '4'], [10, M + 1, '4'], [11, M + 1, '4'], [12, M + 1, '4'], [13, M + 1, '4']],
    effort: [[10, M, 'w'], [11, M, 'w'], [12, M, 'w'], [9, M + 1, '4'], [10, M + 1, '4'], [11, M + 1, '4'], [12, M + 1, '4'], [13, M + 1, '4'], [10, M + 2, '4'], [11, M + 2, '4'], [12, M + 2, '4']],
    decu: [[10, M, '4'], [11, M, '4'], [12, M, '4'], [9, M + 1, '4'], [13, M + 1, '4']],
  };
  px.push(...mouths[e]);
  return px;
}

// ---------------------------------------------------------------------------------------------
// Pilosité faciale

/** Pilosité faciale, combinable avec toute tête et toute coiffure. */
export const FACIAL_HAIR_2D = ['aucune', 'barbe courte', 'bouc', 'moustache', 'barbe de 3 jours'] as const;

/**
 * Pilosité dans les tons de barbe (b clair, B ombre), qui tranchent toujours sur la peau (voir
 * `colors2D`) ; la barbe de 3 jours est l'ombre de la peau.
 */
function facialHair(kind: number, heading: Heading, skin: (x: number, y: number) => boolean): Pixel[] {
  const px: Pixel[] = [];
  const edge = (x: number, y: number) => !skin(x, y + 1) || !skin(x + 1, y);
  const tone = (x: number, y: number) => (kind === 4 ? '3' : edge(x, y) ? 'B' : 'b');
  if (heading === 'up') {
    // De dos, seul le bord de la mâchoire, côté course, se voit.
    if (kind === 1 || kind === 4) for (let y = 11; y <= 15; y++) for (let x = 11; x <= 16; x++) if (skin(x, y)) px.push([x, y, tone(x, y)]);
    return px;
  }
  if (kind === 1 || kind === 4) {
    // Joues, mâchoire et menton, reliés à la patte devant l'oreille.
    for (let y = 11; y <= 15; y++) for (let x = 0; x <= 16; x++) if (skin(x, y) && (y >= 12 || x <= 8)) px.push([x, y, tone(x, y)]);
    for (let y = 8; y <= 10; y++) if (skin(7, y)) px.push([7, y, kind === 4 ? '3' : 'b']);
  }
  // Moustache sous le nez.
  if (kind === 1 || kind === 3) px.push([10, 11, 'b'], [11, 11, 'b'], [12, 11, 'b'], [13, 11, 'B']);
  if (kind === 2) {
    px.push([10, 11, 'b'], [11, 11, 'b'], [12, 11, 'b'], [13, 11, 'B']);
    for (let y = 13; y <= 15; y++) for (let x = 9; x <= 13; x++) if (skin(x, y)) px.push([x, y, y === 15 || x === 13 ? 'B' : 'b']);
  }
  return px;
}

// ---------------------------------------------------------------------------------------------
// Coiffures (dessinées dans `hairs2d.ts`)

export { HAIRS_2D, type Hair2D } from './hairs2d';

// ---------------------------------------------------------------------------------------------
// Composition

/** Marge de la grille composée autour du crâne (volume des coiffures au-dessus, cheveux longs dessous). */
const PAD_X = 5;
const PAD_Y = 10;
const SIZE_W = 28;
const SIZE_H = 36;
/** Point du cou dans le repère du crâne : il se pose sur le haut du cou du squelette. */
const NECK: Point = [8, 13];
/** Colonnes du visage (diagonale bas) : la frange s'y arrête à la rangée 2. */
const FACE_X = 7;
const FRINGE_Y = 2;

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
  const isSkin = (x: number, y: number) => get(x, y) !== '.' && '23'.includes(get(x, y));

  // Peau en 2 tons, à plat : ombre sur le côté et sous la mâchoire (lumière en haut à gauche), et sur
  // la joue qui tourne (vue de dos).
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== 'x') return;
      const left = row.indexOf('x');
      const right = row.lastIndexOf('x');
      const shade = (y > NOSE_Y && (x === left || !skull(x, y + 1) || x === right)) || (heading === 'up' && x === right && y >= 4);
      set(x, y, shade ? '3' : '2');
    }),
  );

  // Oreilles : de face, l'oreille proche à l'arrière du visage (pavillon en ombre) ; de dos,
  // l'oreille proche côté course et le bord de l'oreille éloignée qui dépasse à gauche. Posées
  // par-dessus les cheveux, sauf quand la coiffure tombe dessus.
  const ears = () => {
    if (heading === 'down') for (const [x, y, ch] of [[4, 7, '2'], [5, 7, '2'], [4, 8, '2'], [5, 8, '3'], [4, 9, '2'], [5, 9, '3'], [4, 10, '3'], [5, 10, '2'], [6, 8, '3'], [6, 9, '3']] as const) set(x, y, ch);
    else {
      for (const [x, y, ch] of [[12, 7, '2'], [13, 7, '2'], [12, 8, '3'], [13, 8, '2'], [12, 9, '3'], [13, 9, '2'], [13, 10, '3'], [11, 8, '3'], [11, 9, '3']] as const) set(x, y, ch);
      for (const y of [7, 8, 9]) set(rows[y].indexOf('x') - 1, y, y === 7 ? '2' : '3');
    }
  };
  if (hair.coversEars) ears();

  // Cheveux ; de face, la frange s'arrête au-dessus du front (une rangée de peau avant les sourcils).
  const view = hair[heading];
  view.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const hx = view.at[0] + x;
      const hy = view.at[1] + y;
      if (ch === '.' || (heading === 'down' && hx >= FACE_X && hy > FRINGE_Y && hy <= MOUTH_Y + 3 && skull(hx, hy))) return;
      set(hx, hy, ch);
    }),
  );
  if (!hair.coversEars) ears();
  // Ombre de la ligne des cheveux sur la peau juste dessous.
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < 17; x++) if (get(x, y) === '2' && HAIR_CHARS.includes(get(x, y - 1)) && get(x, y - 1) !== '.') set(x, y, '3');

  // Visage, pilosité.
  if (heading === 'down') {
    const features = faceFeatures(face, expression);
    const mouth = features.filter(([, y, ch]) => y >= MOUTH_Y - 1 && (ch === '4' || ch === 'w'));
    if (facial) for (const [x, y, ch] of facialHair(facial, heading, isSkin)) set(x, y, ch);
    for (const [x, y, ch] of features) if (skull(x, y) && (get(x, y) === '.' || !HAIR_CHARS.includes(get(x, y)) || y >= BROW_Y)) set(x, y, ch);
    // La bouche passe devant la barbe ; les lèvres pleines restent dans la barbe.
    for (const [x, y, ch] of mouth) set(x, y, ch);
  } else if (facial) for (const [x, y, ch] of facialHair(facial, heading, isSkin)) set(x, y, ch);

  // Bandeau : deux rangées sur le haut du front, tout autour de la tête.
  if (headband) {
    for (let x = -PAD_X; x < SIZE_W - PAD_X; x++) {
      if (get(x, 1) !== '.') set(x, 1, 's');
      if (get(x, 2) !== '.') set(x, 2, 'S');
    }
  }

  // Grille ramenée à ses rangées peintes (moins de travail pour le rendu), point du cou.
  const used = g.map((r) => r.some((c) => c !== '.'));
  const top = used.indexOf(true);
  const bottom = used.lastIndexOf(true);
  return { rows: g.slice(top, bottom + 1).map((r) => r.join('')), anchor: { x: NECK[0] + PAD_X, y: NECK[1] + PAD_Y - top } };
}
