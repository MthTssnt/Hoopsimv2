/**
 * Têtes du rendu 2D (`figure2d.ts`), dessins originaux : ~12 px de haut cheveux compris (~1/4 du
 * joueur), un peu plus hautes que larges, tournées vers la droite (vers la gauche, l'image entière
 * est retournée). Peau et cheveux en 3 tons, lumière en haut à gauche.
 *   1/2/3 peau claire/base/ombre · r/h/H cheveux reflet/base/ombre · n œil · w blanc (œil, dents)
 *   S couleur secondaire de l'équipe (bandeau)
 * - Silhouette du crâne et du visage dessinée à la main pour chaque forme : crâne arrondi en haut,
 *   mâchoire plus anguleuse en bas (angle de mâchoire, menton), profil lisible côté visage (arcade,
 *   nez qui dépasse d'1 px, lèvres, menton) ; tons posés d'une même règle pour toutes : joue et
 *   mâchoire côté ombre en ton foncé, dessous du menton (l'ombre continue sur le cou, `figure2d`).
 * - Petits yeux (1 px) ; les sourcils (1-2 px) et la bouche donnent l'expression.
 * - Coiffures calculées sur la forme du crâne : ligne d'implantation sur le front, pattes devant
 *   l'oreille, nuque (vue de dos) ; volume, texture et accessoires selon la coiffure.
 * - Pilosité faciale combinable avec toute tête : barbe courte, bouc, moustache, barbe de 3 jours.
 * Le contour vient du contour unique de toute la silhouette (pas de contour entre tête et cou).
 */
import type { Appearance } from '../../match/render/sprites/appearance';
import type { Heading } from '../../match/render/sprites/rig';
import type { Expression } from './heads';

type Point = readonly [number, number];

interface Shape2D {
  name: string;
  /**
   * Silhouette du crâne et du visage (« x »), en diagonale bas (de 3/4 face : profil à droite,
   * arcade, nez qui dépasse d'1 px, lèvres, menton) et en diagonale haut (de 3/4 dos : joue et
   * mâchoire à droite, nuque en bas). Les tons sont posés par `shadeSkull`.
   */
  down: readonly string[];
  up: readonly string[];
  /** Œil proche (diagonale bas) ; l'œil éloigné est 2 colonnes plus loin. */
  eye: Point;
  /** Bouche : premier pixel de la ligne des lèvres. */
  mouth: Point;
  /** Oreille proche : coin haut-gauche (2 × 3 px). */
  ear: Readonly<Record<Heading, Point>>;
  /** Dernière rangée couverte par les cheveux sur le front ; rangée de la ligne des cheveux sur la nuque (de dos). */
  hairline: number;
  nape: number;
  /** Point du cou sous le crâne : il se pose sur le haut du cou du squelette. */
  neck: Readonly<Record<Heading, Point>>;
}

/**
 * Repères communs (12 rangées) : cheveux sur les rangées 0-1, front, sourcils (3), paupière, yeux
 * (5), nez (pointe en 7), dessous du nez, bouche (9), menton, dessous de la mâchoire.
 */
const STANDARD = {
  eye: [6, 5],
  mouth: [7, 9],
  ear: { down: [2, 5], up: [6, 5] },
  hairline: 1,
  nape: 9,
  neck: { down: [4, 10], up: [4, 10] },
} as const;

/**
 * 5 morphologies (même ordre et même nombre que `HEADS`, donc la même répartition des joueurs) :
 * une seule ronde, puis mâchoire carrée, visage long et fin, visage large, menton pointu.
 * De 3/4 face, l'arrière du crâne déborde au-dessus de la nuque : l'angle de la mâchoire se
 * détache sous l'oreille.
 */
export const SHAPES_2D: readonly Shape2D[] = [
  {
    name: 'ronde',
    ...STANDARD,
    down: ['...xxxx....', '..xxxxxxx..', '.xxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxx..', 'xxxxxxxxxx.', 'xxxxxxxxxxx', '.xxxxxxxxx.', '.xxxxxxxx..', '..xxxxxxx..', '...xxxxx...'],
    up: ['...xxxx....', '..xxxxxxx..', '.xxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', '.xxxxxxxxx.', '.xxxxxxxx..', '..xxxxxxx..', '...xxxxx...'],
  },
  {
    name: 'carree',
    ...STANDARD,
    down: ['...xxxx....', '..xxxxxxx..', '.xxxxxxxxx.', '.xxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxx..', 'xxxxxxxxxx.', '.xxxxxxxxxx', '..xxxxxxxx.', '..xxxxxxx..', '..xxxxxxxx.', '...xxxxxx..'],
    up: ['...xxxx....', '..xxxxxxx..', '.xxxxxxxxx.', '.xxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', '.xxxxxxxxx.', '..xxxxxxxx.', '..xxxxxxxx.', '..xxxxxxxx.', '...xxxxxx..'],
  },
  {
    name: 'longue',
    eye: [5, 5],
    mouth: [6, 10],
    ear: { down: [1, 6], up: [5, 6] },
    hairline: 1,
    nape: 10,
    neck: { down: [4, 11], up: [4, 11] },
    down: ['...xxx.....', '..xxxxxx...', '.xxxxxxxx..', '.xxxxxxxx..', 'xxxxxxxxx..', 'xxxxxxxx...', 'xxxxxxxxx..', '.xxxxxxxx..', '.xxxxxxxxx.', '..xxxxxxx..', '..xxxxxx...', '..xxxxxxx..', '...xxxxx...'],
    up: ['...xxx.....', '..xxxxxx...', '.xxxxxxxx..', '.xxxxxxxx..', 'xxxxxxxxx..', 'xxxxxxxxx..', 'xxxxxxxxx..', '.xxxxxxxx..', '.xxxxxxxx..', '..xxxxxxx..', '..xxxxxxx..', '..xxxxxx...', '...xxxx....'],
  },
  {
    name: 'large',
    ...STANDARD,
    eye: [7, 5],
    mouth: [8, 9],
    ear: { down: [2, 5], up: [7, 5] },
    down: ['....xxxxx...', '..xxxxxxxx..', '.xxxxxxxxxx.', 'xxxxxxxxxxx.', 'xxxxxxxxxxx.', 'xxxxxxxxxx..', 'xxxxxxxxxxx.', 'xxxxxxxxxxxx', 'xxxxxxxxxxx.', '.xxxxxxxxx..', '.xxxxxxxxxx.', '..xxxxxxxx..'],
    up: ['....xxxxx...', '..xxxxxxxx..', '.xxxxxxxxxx.', 'xxxxxxxxxxx.', 'xxxxxxxxxxx.', 'xxxxxxxxxxx.', 'xxxxxxxxxxx.', 'xxxxxxxxxxx.', 'xxxxxxxxxxx.', '.xxxxxxxxxx.', '.xxxxxxxxxx.', '..xxxxxxxx..'],
  },
  {
    name: 'pointue',
    ...STANDARD,
    mouth: [6, 9],
    down: ['...xxxx....', '..xxxxxxx..', '.xxxxxxxxx.', '.xxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxx..', 'xxxxxxxxxx.', '.xxxxxxxxxx', '..xxxxxxxx.', '...xxxxxx..', '....xxxxxx.', '......xxx..'],
    up: ['...xxxx....', '..xxxxxxx..', '.xxxxxxxxx.', '.xxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', 'xxxxxxxxxx.', '.xxxxxxxxx.', '..xxxxxxxx.', '...xxxxxxx.', '....xxxxx..', '.....xxx...'],
  },
];

/**
 * Tons de peau posés sur la silhouette (lumière en haut à gauche) : bord éclairé en haut à gauche
 * du crâne et pommette ; joue et mâchoire côté ombre (à droite, sous l'œil), dessous de la mâchoire
 * et du menton, angle de la mâchoire derrière, sous l'oreille ; le bout du nez reste éclairé.
 */
function shadeSkull(shape: Shape2D, heading: Heading, x: number, y: number): string {
  const rows = shape[heading];
  const at = (cx: number, cy: number) => (rows[cy]?.[cx] ?? '.') === 'x';
  const [ex, ey] = shape.eye;
  const [, ay] = shape.ear[heading];
  const left = rows[y].indexOf('x');
  const right = rows[y].lastIndexOf('x');
  const noseTip = heading === 'down' && x === right && x >= Math.max(...rows.map((r) => r.lastIndexOf('x')));
  if (y > ey && !at(x, y + 1)) return '3';
  if (y > ey && x === right && !noseTip) return '3';
  if (y >= ay + 3 && x === left) return '3';
  if (heading === 'up' && y >= 3 && x === right) return '3';
  if (y <= ey && (!at(x - 1, y) || (!at(x, y - 1) && x < ex))) return '1';
  if (heading === 'down' && y === ey + 1 && (x === ex - 1 || x === ex - 2)) return '1';
  if (heading === 'up' && y < ay && x <= 3) return '1';
  return '2';
}

/** Oreille (2 × 3 px) : bord éclairé, creux sombre, lobe. De dos, on en voit l'arrière. */
const EAR: Readonly<Record<Heading, readonly string[]>> = {
  down: ['12', '13', '.3'],
  up: ['22', '32', '3.'],
};

/**
 * Sourcils et yeux, posés à partir de l'œil proche (colonne de l'œil − 1, rangée de l'œil − 3) :
 * l'œil est petit (1 px, un blanc pour l'œil proche), ce sont les sourcils (1-2 px, ton d'ombre des
 * cheveux) qui donnent l'expression ; la bouche change aussi (posée à partir de la bouche − 1).
 */
const FACES: Readonly<Record<Expression, { eyes: readonly string[]; mouth: readonly string[] }>> = {
  neutre: { eyes: ['', 'HH.H', '', '.n.n'], mouth: ['', '.33'] },
  concentree: { eyes: ['', 'H...', '.H.H', '.n.n'], mouth: ['', '333'] },
  joyeuse: { eyes: ['HH.H', '', '', '.n.n'], mouth: ['3', '.ww3'] },
};

type HairTexture = 'plain' | 'stubble' | 'rows' | 'fade';

interface Hair2D {
  name: string;
  /** Volume (px) au-dessus et derrière le crâne : 0 plaqué, 1 court, 2 afro. */
  volume: number;
  texture: HairTexture;
  /** Pas de cheveux (crâne rasé). */
  bald?: boolean;
  /** Frange : la ligne du front descend d'autant de rangées (bord irrégulier). */
  fringe?: number;
  /** Bandeau aux couleurs de l'équipe sur la ligne d'implantation. */
  band?: boolean;
  /** Chignon en haut, à l'arrière. */
  bun?: boolean;
  /** La coiffure va avec une barbe (comme la coiffure « barbe » de `heads.ts`). */
  beard?: boolean;
}

/** 10 coiffures (même ordre que `HAIRS`), calculées sur la forme du crâne. */
export const HAIRS_2D: readonly Hair2D[] = [
  { name: 'ras', volume: 0, texture: 'stubble' },
  { name: 'court', volume: 1, texture: 'plain' },
  { name: 'afro', volume: 2, texture: 'plain' },
  { name: 'tresses', volume: 0, texture: 'rows' },
  { name: 'chignon', volume: 1, texture: 'plain', bun: true },
  { name: 'bandeau', volume: 1, texture: 'plain', band: true },
  { name: 'chauve', volume: 0, texture: 'plain', bald: true },
  { name: 'frange', volume: 1, texture: 'plain', fringe: 1 },
  { name: 'degrade', volume: 0, texture: 'fade' },
  { name: 'barbe', volume: 0, texture: 'stubble', beard: true },
];

/** Pilosité faciale, combinable avec toute tête et toute coiffure. */
export const FACIAL_HAIR_2D = ['aucune', 'barbe courte', 'bouc', 'moustache', 'barbe de 3 jours'] as const;
export type FacialHair2D = number;

/** Marge de la grille composée autour du crâne (volume des coiffures, oreille éloignée). */
const PAD_X = 3;
const PAD_Y = 4;
const SIZE_W = 17;
const SIZE_H = 18;

export interface Head2D {
  rows: string[];
  /** Point du cou dans `rows` : il se pose sur le haut du cou du squelette. */
  anchor: { x: number; y: number };
}

export interface HeadLook extends Pick<Appearance, 'head' | 'hair'> {
  /** Indice dans `FACIAL_HAIR_2D` (0 : aucune). */
  facialHair?: FacialHair2D;
}

const cache = new Map<string, Head2D>();

/** Tête composée : crâne et visage, cheveux, oreilles, traits, pilosité faciale. Mise en cache (une par variante). */
export function headGrid2D(look: HeadLook, heading: Heading, expression: Expression = 'neutre'): Head2D {
  const head = look.head % SHAPES_2D.length;
  const hairIndex = look.hair % HAIRS_2D.length;
  const facial = (look.facialHair ?? 0) % FACIAL_HAIR_2D.length;
  const key = `${head}|${hairIndex}|${facial}|${heading}|${heading === 'down' ? expression : ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const made = composeHead(SHAPES_2D[head], HAIRS_2D[hairIndex], facial, heading, expression);
  cache.set(key, made);
  return made;
}

function composeHead(shape: Shape2D, hair: Hair2D, facial: number, heading: Heading, expression: Expression): Head2D {
  const g: string[][] = Array.from({ length: SIZE_H }, () => Array.from({ length: SIZE_W }, () => '.'));
  const rows = shape[heading];
  // Accès en coordonnées du crâne (origine en haut à gauche du crâne).
  const get = (x: number, y: number) => g[y + PAD_Y]?.[x + PAD_X] ?? '.';
  const set = (x: number, y: number, ch: string) => {
    if (y + PAD_Y >= 0 && y + PAD_Y < SIZE_H && x + PAD_X >= 0 && x + PAD_X < SIZE_W) g[y + PAD_Y][x + PAD_X] = ch;
  };
  const skull = (x: number, y: number) => (rows[y]?.[x] ?? '.') === 'x';
  const stamp = (grid: readonly string[], ox: number, oy: number, map: (ch: string) => string = (ch) => ch) =>
    grid.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && set(ox + x, oy + y, map(ch))));
  const [ex, ey] = shape.eye;
  const [ax, ay] = shape.ear[heading];
  const [mx, my] = shape.mouth;

  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 'x' && set(x, y, shadeSkull(shape, heading, x, y))));

  // Cheveux : masque sur le crâne, puis volume autour, puis tons.
  if (!hair.bald) {
    const hairOn = (x: number, y: number) => hairMask(shape, hair, heading, x, y) && skull(x, y);
    const isHair = new Set<string>();
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (hairOn(x, y)) isHair.add(`${x},${y}`);
    // Volume : les cheveux courts épaississent seulement le haut du crâne (pas de casque) ;
    // l'afro gonfle aussi au-dessus et derrière, jusqu'au-dessus de l'oreille. Jamais devant le visage.
    for (let v = 1; v <= hair.volume; v++) {
      const ring: string[] = [];
      const lowest = hair.volume >= 2 ? ay : shape.hairline;
      // Cheveux courts : épaisseur à l'arrière et sur les côtés du dessus, pas au-dessus du crâne
      // (la tête garde ~1/4 du joueur) ; l'afro, lui, monte.
      for (let y = hair.volume >= 2 ? -v : 0; y <= lowest; y++) {
        for (let x = -v; x <= 12; x++) {
          if (skull(x, y) || isHair.has(`${x},${y}`)) continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => isHair.has(`${x + dx},${y + dy}`));
          const front = heading === 'down' ? x >= ex - 1 : x >= ax + 2;
          if (near && !(front && y > shape.hairline - 1)) ring.push(`${x},${y}`);
        }
      }
      ring.forEach((k) => isHair.add(k));
    }
    if (hair.bun) {
      const bx = heading === 'down' ? 1 : 3;
      for (const [dx, dy] of [[0, -2], [1, -2], [-1, -1], [0, -1], [1, -1], [2, -1]]) isHair.add(`${bx + dx},${dy - 1}`);
    }
    const hairAt = (x: number, y: number) => isHair.has(`${x},${y}`);
    for (const key of isHair) {
      const [x, y] = key.split(',').map(Number);
      set(x, y, hairTone(hair, hairAt, skull, x, y, ay));
    }
    if (hair.band) {
      // Bandeau : deux rangées sur la ligne d'implantation, tout autour de la tête.
      for (const key of isHair) {
        const [x, y] = key.split(',').map(Number);
        if (y === shape.hairline - 1 || y === shape.hairline) set(x, y, y === shape.hairline ? 'S' : 's');
      }
    }
  } else {
    // Crâne rasé : reflet sur le haut du crâne.
    for (const [x, y] of [[4, 0], [3, 1], [4, 1], [2, 2]] as const) if (skull(x, y)) set(x, y, '1');
  }

  // Visage (diagonale bas) : sourcils, yeux.
  const face = FACES[expression];
  if (heading === 'down') stamp(face.eyes, ex - 1, ey - 3);

  // Pilosité faciale (et coiffure « barbe »).
  const beard = hair.beard ? 1 : facial;
  if (beard) facialHair(shape, beard, heading, skull, get, set);

  // Oreilles, par-dessus les cheveux et la barbe ; de dos, l'oreille éloignée dépasse à gauche.
  stamp(EAR[heading], ax, ay);
  if (heading === 'up') {
    for (const y of [ay, ay + 1]) {
      const left = rows[y].indexOf('x');
      set(left - 1, y, y === ay ? '2' : '3');
    }
  }

  // Bouche, par-dessus la barbe.
  if (heading === 'down') stamp(face.mouth, mx - 1, my - 1);

  const [nx, ny] = shape.neck[heading];
  return { rows: g.map((row) => row.join('')), anchor: { x: nx + PAD_X, y: ny + PAD_Y } };
}

/** Pixels du crâne couverts par les cheveux : front, tempes et pattes devant l'oreille, arrière et nuque. */
function hairMask(shape: Shape2D, hair: Hair2D, heading: Heading, x: number, y: number): boolean {
  const [ex] = shape.eye;
  const [ax, ay] = shape.ear[heading];
  if (heading === 'down') {
    const front = ex - 1;
    // Front : ligne d'implantation (la frange descend, en dents de scie).
    if (x >= front) return y <= shape.hairline + (hair.fringe && (x - front) % 2 === 0 ? hair.fringe : 0);
    // Patte, juste devant l'oreille.
    if (x === front - 1) return y <= ay + 1;
    // Au-dessus de l'oreille.
    if (x >= ax) return y < ay;
    // Derrière l'oreille, jusqu'à la nuque.
    return y <= ay + 2;
  }
  // De dos : l'arrière du crâne jusqu'à la ligne de la nuque (un peu plus haute sur les côtés),
  // au-dessus de l'oreille, la patte devant l'oreille ; la joue reste en peau.
  if (x > ax + 2) return y <= shape.hairline + (hair.fringe ? 1 : 0);
  if (x === ax + 2) return y <= ay + 1;
  if (x >= ax) return y < ay;
  const side = x <= 1 || x >= ax - 1 ? 1 : 0;
  return y < shape.nape - side;
}

/** Ton d'un pixel de cheveux : reflet en haut à gauche, ombre en bas et à droite (et sur la ligne d'implantation), texture. */
function hairTone(hair: Hair2D, hairAt: (x: number, y: number) => boolean, skull: (x: number, y: number) => boolean, x: number, y: number, earY: number): string {
  const edgeLow = !hairAt(x, y + 1) || !hairAt(x + 1, y);
  const top = !hairAt(x, y - 1) && !skull(x, y - 1);
  // Rasé : aplat sans reflet, quelques points plus sombres (pas de damier).
  if (hair.texture === 'stubble') return edgeLow || (x * 2 + y) % 5 === 0 ? 'H' : 'h';
  if (hair.texture === 'rows') return top && x <= 4 ? 'r' : y % 2 === 0 ? 'h' : 'H';
  // Dégradé : le bas des côtés et de la nuque, plus court, passe au ton d'ombre.
  if (hair.texture === 'fade' && y >= earY - 1) return 'H';
  if (edgeLow) return 'H';
  if (top && x >= 1 && x <= 4) return 'r';
  return 'h';
}

/** Barbe courte, bouc, moustache, barbe de 3 jours : posées sur le bas du visage (côté visible de dos). */
function facialHair(
  shape: Shape2D,
  kind: number,
  heading: Heading,
  skull: (x: number, y: number) => boolean,
  get: (x: number, y: number) => string,
  set: (x: number, y: number, ch: string) => void,
): void {
  const [ex] = shape.eye;
  const [ax, ay] = shape.ear[heading];
  const [mx, my] = shape.mouth;
  const rows = shape[heading].length;
  const skin = (x: number, y: number) => skull(x, y) && '123'.includes(get(x, y));
  const paint = (x: number, y: number, ch: string) => skin(x, y) && set(x, y, ch);
  const tone = (x: number, y: number) => (skull(x, y + 1) ? 'h' : 'H');
  if (heading === 'up') {
    // De dos : seul le bord de la mâchoire, côté course, se voit.
    if (kind === 3) return;
    for (let y = ay + 2; y < rows; y++) for (let x = ax + 1; x < 12; x++) paint(x, y, kind === 4 ? (skull(x, y + 1) ? '3' : 'H') : tone(x, y));
    return;
  }
  const jaw = (x: number, y: number) => (y >= my - 1 && x >= ax) || (y >= ay + 2 && x >= ax + 1 && x < ex);
  if (kind === 1) {
    for (let y = ay + 1; y < rows; y++) for (let x = ax; x < 12; x++) if (jaw(x, y) || (x === ex - 2 && y >= ay)) paint(x, y, tone(x, y));
    for (let x = mx; x <= mx + 1; x++) paint(x, my - 1, 'H');
  } else if (kind === 2) {
    for (let y = my - 1; y < rows; y++) for (let x = mx - 1; x <= mx + 2; x++) if (y >= my || (x >= mx && x <= mx + 1)) paint(x, y, tone(x, y));
  } else if (kind === 3) {
    for (let x = mx; x <= mx + 2; x++) paint(x, my - 1, 'H');
  } else if (kind === 4) {
    for (let y = ay + 1; y < rows; y++) for (let x = ax; x < 12; x++) if (jaw(x, y)) paint(x, y, skull(x, y + 1) ? '3' : 'H');
  }
}
