/**
 * Rendu 2D des joueurs, style 5 (« rétro peint ») : une seule silhouette continue, peinte dans un
 * seul calque à partir du squelette (`skeleton2d.ts`), puis un contour doux autour de tout le corps.
 * - Formes : membres qui s'affinent (cuisse > genou > mollet > cheville, épaule > coude >
 *   avant-bras > poignet), torse en V avec cou et trapèzes, maillot et short posés par-dessus
 *   comme du tissu (emmanchures, short sous le genou), mains en moufle, chaussures un peu grandes.
 * - Modelé peint, 5 tons par matière (reflet, clair, base, ombre, ombre profonde), lumière en haut
 *   à gauche : le ton dépend de la distance au bord éclairé (gauche, haut) et au bord sombre
 *   (droite, bas) de chaque pièce ; ombre portée (ton 3) sous ce qui passe devant ; les pièces du
 *   côté éloigné sont un ton plus sombres. À l'intérieur, aucune ligne de contour.
 * - Contour doux : le ton le plus profond de la matière voisine (peau, cheveux, maillot…).
 * - Tête assemblée par le système de pièces (`src/assets/characters/`), posée au cou ; numéro
 *   reposé à l'endroit.
 * Vers la gauche, l'image est retournée (comme dans un jeu 2D), puis le numéro est reposé.
 * Même cadre et même format que `composeFrame` (rig.ts), pour la feuille de `SheetBaker`.
 */
import type { Expression as CharacterExpression } from '../../../assets/characters/types';
import { composeHead } from '../../../assets/characters/composeHead';
import { drawJerseyNumber, JERSEY_DIGIT_HEIGHT, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import type { Expression } from '../../../assets/sprites/heads';
import { characterOf, type Appearance } from './appearance';
import { SlotCanvas, slotOf, type Slot } from './canvas';
import type { Facing, Kit } from './compose';
import { FRAME, type Heading } from './rig';
import { build2D, joints2D, PITCH_2D, project2D, type Pose2D, type Screen } from './skeleton2d';
import type { Vec3 } from './vec3';

type Material = 'skin' | 'jersey' | 'trim' | 'sock' | 'shoe' | 'sole';

/** Emplacements de couleur par matière, du plus clair au plus sombre (5 tons, voir `paintedColors.ts`). */
export const TONES: Record<Material, readonly [Slot, Slot, Slot, Slot, Slot]> = {
  skin: ['1', '5', '2', '3', '4'],
  jersey: ['a', 'p', 'P', 'q', 'Q'],
  trim: ['v', 's', 'S', 't', 'T'],
  sock: ['x', 'w', 'w', 'y', 'Y'],
  shoe: ['z', 'Z', 'G', 'j', 'J'],
  sole: ['x', 'w', 'w', 'y', 'Y'],
};

/** Ton le plus profond de chaque matière de la tête : il sert de contour doux. */
const HEAD_DEEP: Partial<Record<Slot, Slot>> = Object.fromEntries([
  ...['r', 'h', 'H', 'D', 'E', '0'].map((s) => [s, 'E']),
  ...['f', 'b', 'B', 'F'].map((s) => [s, 'F']),
  ...['c', 'C', 'd', 'K'].map((s) => [s, 'K']),
]);

/** Expressions du jeu → expressions des pièces du visage. */
const CHARACTER_EXPRESSION: Record<Expression, CharacterExpression> = { neutre: 'neutre', concentree: 'neutre', joyeuse: 'joie' };

/** Une pièce de la silhouette : sa forme à l'écran, sa matière, son groupe d'ombrage et sa profondeur. */
interface Part {
  /** Groupe d'ombrage : les bords et les ombres portées se calculent entre groupes (bras, jambe, torse…). */
  group: string;
  /** Pièce du côté éloigné de la caméra : un ton plus sombre. */
  far: boolean;
  /** Ordre de dessin : plus grand = plus près de la caméra (dessiné après). */
  near: number;
  material: Material;
  /** Bande d'ombre (px) le long du bord opposé à la lumière. */
  shadow: number;
  inside: (x: number, y: number) => boolean;
  box: { x0: number; x1: number; y0: number; y1: number };
}

interface Disc {
  x: number;
  y: number;
  r: number;
}

/** Membre effilé : suite de cercles reliés, le rayon varie linéairement d'un point à l'autre. */
function taper(points: Disc[]): Pick<Part, 'inside' | 'box'> {
  const box = {
    x0: Math.floor(Math.min(...points.map((p) => p.x - p.r))) - 1,
    x1: Math.ceil(Math.max(...points.map((p) => p.x + p.r))) + 1,
    y0: Math.floor(Math.min(...points.map((p) => p.y - p.r))) - 1,
    y1: Math.ceil(Math.max(...points.map((p) => p.y + p.r))) + 1,
  };
  const inside = (px: number, py: number) => {
    const x = px + 0.5;
    const y = py + 0.5;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
      const r = a.r + (b.r - a.r) * t;
      const ex = x - (a.x + dx * t);
      const ey = y - (a.y + dy * t);
      if (ex * ex + ey * ey <= r * r) return true;
    }
    return false;
  };
  return { inside, box };
}

/** Enveloppe convexe de points à l'écran (pour le torse, le maillot, le short, la chaussure). */
function hull(points: { x: number; y: number }[]): Pick<Part, 'inside' | 'box'> {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const poly = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const box = {
    x0: Math.floor(Math.min(...poly.map((p) => p.x))) - 1,
    x1: Math.ceil(Math.max(...poly.map((p) => p.x))) + 1,
    y0: Math.floor(Math.min(...poly.map((p) => p.y))) - 1,
    y1: Math.ceil(Math.max(...poly.map((p) => p.y))) + 1,
  };
  const inside = (px: number, py: number) => {
    const q = { x: px + 0.5, y: py + 0.5 };
    for (let i = 0; i < poly.length; i++) if (cross(poly[i], poly[(i + 1) % poly.length], q) < 0) return false;
    return poly.length >= 3;
  };
  return { inside, box };
}

export interface Figure2D {
  canvas: SlotCanvas;
  /** Coin haut-gauche du numéro, ou null (arbitre). */
  numberAt: { x: number; y: number } | null;
  /** Paumes à l'écran [gauche du joueur, droite du joueur] (image retournée comprise) : point d'accroche du ballon. */
  palms: [Screen, Screen];
}

/**
 * Rend une image du joueur : squelette posé, pièces peintes de l'arrière vers l'avant dans un seul
 * calque, ombrage à plat, tête, contour unique, puis miroir et numéro.
 */
export function renderFigure2D(look: Appearance, pose: Pose2D, heading: Heading, facing: Facing = 'right', kit: Kit = 'team'): Figure2D {
  const painted = paintFigure(look, pose, heading, kit);
  return finishFigure(painted, facing === 'left' ? painted.canvas.mirrored() : painted.canvas, look, facing, kit);
}

/** Les deux orientations d'une image, peintes une seule fois : vers la gauche, c'est le miroir (numéro reposé à l'endroit). */
export function renderFigure2DBoth(look: Appearance, pose: Pose2D, heading: Heading, kit: Kit = 'team'): Record<Facing, Figure2D> {
  const painted = paintFigure(look, pose, heading, kit);
  // Le miroir d'abord : l'image vers la droite reçoit ensuite son numéro sur place.
  const left = finishFigure(painted, painted.canvas.mirrored(), look, 'left', kit);
  return { right: finishFigure(painted, painted.canvas, look, 'right', kit), left };
}

interface Painted {
  /** Silhouette vers la droite, contour compris, sans numéro. */
  canvas: SlotCanvas;
  /** Point de la poitrine (ou du dos) où se centre le numéro. */
  chest: Screen;
  palms: [Screen, Screen];
}

function paintFigure(look: Appearance, pose: Pose2D, heading: Heading, kit: Kit): Painted {
  const b = build2D(look.heightCm, look.heavy);
  const J = joints2D(b, pose, heading);
  // Calage au sol à l'écran : la semelle la plus basse (le pied le plus proche) touche la rangée
  // du sol, comme le rig actuel ; `lift` la soulève.
  const lift = (pose.lift ?? 0) * Math.cos(PITCH_2D);
  const sole = Math.max(...J.shoes.flat().map((p) => project2D(p, 0, 0).y)) + lift;
  const S = (p: Vec3): Screen => project2D(p, FRAME.centerX, FRAME.groundY - sole);
  const disc = (p: Vec3, r: number): Disc => {
    const s = S(p);
    return { x: s.x, y: s.y, r };
  };
  const nearOf = (...ps: Vec3[]) => ps.reduce((n, p) => n + S(p).near, 0) / ps.length;
  // Côté éloigné : tourné vers la droite, c'est toujours la gauche du joueur (en diagonale bas
  // comme en diagonale haut, on voit son côté droit).
  const farSide = 0;
  const parts: Part[] = [];
  const add = (p: Omit<Part, 'shadow'> & { shadow?: number }) => parts.push({ shadow: 1, ...p });

  for (const i of [0, 1] as const) {
    const far = i === farSide;
    const legNear = nearOf(J.knees[i], J.ankles[i]);
    add({ group: `leg${i}`, far, near: legNear, material: 'skin', ...taper([disc(J.knees[i], b.r.knee), disc(J.calves[i], b.r.calf), disc(J.ankles[i], b.r.ankle)]) });
    add({ group: `leg${i}`, far, near: legNear + 0.01, material: 'sock', ...taper([disc(J.sockTops[i], b.r.ankle + 0.35), disc(J.ankles[i], b.r.ankle + 0.25)]) });
    add({ group: `foot${i}`, far, near: legNear + 0.02, material: 'shoe', ...hull(J.shoes[i].map(S)) });
    // Le short est une seule pièce de tissu avec la jambe proche ; la jambe éloignée s'en détache par l'ombre.
    add({ group: far ? 'shorts-far' : 'shorts', far, near: nearOf(J.hips[i], J.shortsHems[i]) + 0.03, material: 'jersey', shadow: 2, ...taper([disc(J.hips[i], b.r.shorts), disc(J.shortsHems[i], b.r.shortsHem)]) });
    const armNear = nearOf(J.shoulders[i], J.elbows[i], J.wrists[i]);
    add({
      group: `arm${i}`,
      far: i === farSide,
      near: armNear,
      material: 'skin',
      ...taper([
        disc(J.shoulders[i], b.r.deltoid),
        disc(J.biceps[i], b.r.biceps),
        disc(J.elbows[i], b.r.elbow),
        disc(J.forearms[i], b.r.forearm),
        disc(J.wrists[i], b.r.wrist),
        disc(J.palms[i], b.r.palm),
        disc(J.fingertips[i], b.r.wrist),
      ]),
    });
  }
  const pelvisNear = nearOf(J.pelvis);
  add({ group: 'shorts', far: false, near: pelvisNear, material: 'jersey', shadow: 2, ...hull(J.shorts.map(S)) });
  const torsoNear = nearOf(J.neckBase, J.chestFront, J.chestBack) + 0.05;
  // Ceinture du short par-dessus le bas du maillot (maillot rentré).
  add({ group: 'shorts', far: false, near: torsoNear + 0.03, material: 'trim', ...taper(J.waistband.map((p) => disc(p, 0.55))) });
  add({ group: 'torso', far: false, near: torsoNear, material: 'skin', shadow: 2, ...hull(J.torso.map(S)) });
  add({ group: 'torso', far: false, near: torsoNear + 0.01, material: 'skin', ...taper([disc(J.neckBase, b.r.neck + 0.3), disc(J.neckTop, b.r.neck)]) });
  add({ group: 'torso', far: false, near: torsoNear + 0.02, material: 'jersey', ...hull(J.jersey.map(S)) });
  // Encolure : la peau du cou, bordée du liseré.
  add({ group: 'torso', far: false, near: torsoNear + 0.03, material: 'skin', ...hull([...J.collar.map(S), S(J.neckBase)]) });
  add({ group: 'torso', far: false, near: torsoNear + 0.04, material: 'trim', ...taper(J.collar.map((p) => disc(p, 0.5))) });

  // Peinture de l'arrière vers l'avant, dans un seul calque ; on garde la boîte de la silhouette
  // pour ne parcourir qu'elle ensuite.
  const W = FRAME.width;
  const H = FRAME.height;
  const owner = new Int16Array(W * H).fill(-1);
  const order = parts.map((_, k) => k).sort((a, c) => parts[a].near - parts[c].near);
  const box: { x0: number; x1: number; y0: number; y1: number } = { x0: W, x1: -1, y0: H, y1: -1 };
  for (const k of order) {
    const p = parts[k];
    for (let y = Math.max(0, p.box.y0); y <= Math.min(H - 1, p.box.y1); y++) {
      for (let x = Math.max(0, p.box.x0); x <= Math.min(W - 1, p.box.x1); x++) {
        if (!p.inside(x, y)) continue;
        owner[y * W + x] = k;
        box.x0 = Math.min(box.x0, x);
        box.x1 = Math.max(box.x1, x);
        box.y0 = Math.min(box.y0, y);
        box.y1 = Math.max(box.y1, y);
      }
    }
  }
  cleanSilhouette(owner, W, H, box);

  // Modelé peint. Les groupes sont numérotés : un bord est un voisin d'un autre groupe (ou vide).
  const groupIds = new Map<string, number>();
  const gid = parts.map((p) => groupIds.get(p.group) ?? groupIds.set(p.group, groupIds.size).get(p.group)!);
  const groups = new Int16Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) if (owner[i] >= 0) groups[i] = gid[owner[i]];
  const differs = (x: number, y: number, g: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : groups[y * W + x]) !== g;
  // Tableaux creux : seules les cases de la silhouette sont écrites (pas d'allocation du cadre entier).
  const slots: Slot[] = [];
  const material: (Material | null)[] = [];
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const k = owner[y * W + x];
      if (k < 0) continue;
      const p = parts[k];
      const g = gid[k];
      const tone = paintedTone(x, y, g, p, differs, castsOn(owner, W, x, y - 1, g, gid, parts, p.near) || castsOn(owner, W, x - 1, y, g, gid, parts, p.near) || castsOn(owner, W, x - 1, y - 1, g, gid, parts, p.near));
      // Semelle : la rangée du bas de la chaussure, en blanc.
      const m = p.material === 'shoe' && differs(x, y + 1, g) ? 'sole' : kit === 'referee' && (p.material === 'jersey' || p.material === 'trim') ? 'jersey' : p.material;
      slots[y * W + x] = TONES[m][tone];
      material[y * W + x] = m;
    }
  }

  // Tête assemblée par le système de pièces, posée au cou : devant le corps, sauf là où une pièce
  // plus proche passe devant (bras levé).
  const head = composeHead(characterOf(look), heading, CHARACTER_EXPRESSION[pose.expression ?? 'neutre']);
  const neck = S(J.neckTop);
  const headNear = neck.near + 0.6;
  const hx = Math.round(neck.x) - head.neck.x;
  const hy = Math.round(neck.y) - head.neck.y;
  const headBottom: number[] = [];
  // Pixels de la tête : ton de contour de leur matière (cheveux, peau, pilosité, accessoire).
  const headDeep: Slot[] = [];
  head.rows.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++) {
      const slot = slotOf(row[gx]);
      if (!slot) continue;
      const x = hx + gx;
      const y = hy + gy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = owner[y * W + x];
      if (k >= 0 && parts[k].near > headNear && parts[k].group.startsWith('arm')) continue;
      slots[y * W + x] = slot;
      material[y * W + x] = null;
      headDeep[y * W + x] = HEAD_DEEP[slot] ?? '4';
      headBottom[x] = Math.max(headBottom[x] ?? -1, y);
    }
  });
  // Ombre portée de la tête (sous le menton et la mâchoire) : le pixel du cou, des trapèzes ou du
  // col juste dessous passe à l'ombre profonde ; elle relie la tête au cou, sans contour entre les deux.
  headBottom.forEach((bottom, x) => {
    const i = (bottom + 1) * W + x;
    const m = material[i];
    if (bottom + 1 < H && m && m !== 'sole' && slots[i]) slots[i] = TONES[m][4];
  });

  // Un seul contour autour de toute la silhouette ; avant, les trous d'un pixel entre la tête et
  // les épaules sont bouchés (ton du pixel du dessus).
  const canvas = new SlotCanvas(W, H);
  slots.forEach((slot, i) => canvas.set(i % W, Math.floor(i / W), slot));
  const top = Math.max(1, Math.min(box.y0, hy));
  for (let y = top; y <= box.y1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (canvas.get(x, y) !== null) continue;
      const above = canvas.get(x, y - 1);
      if (above && canvas.get(x - 1, y) && canvas.get(x + 1, y) && canvas.get(x, y + 1)) {
        canvas.set(x, y, above);
        material[y * W + x] = material[(y - 1) * W + x];
        headDeep[y * W + x] = headDeep[(y - 1) * W + x];
      }
    }
  }
  softOutline(canvas, (x, y) => {
    const m = material[y * W + x];
    return m ? TONES[m][4] : (headDeep[y * W + x] ?? '4');
  });
  if (kit === 'referee') stripeReferee(canvas, material);
  return { canvas, chest: S(heading === 'down' ? J.chestFront : J.chestBack), palms: [S(J.palms[0]), S(J.palms[1])] };
}

/** Numéro posé sur l'image (déjà retournée vers la gauche), à l'endroit, seulement sur le maillot visible. */
const digits = { height: JERSEY_DIGIT_HEIGHT, width: jerseyNumberWidth, draw: drawJerseyNumber };

function finishFigure({ chest, palms }: Painted, canvas: SlotCanvas, look: Appearance, facing: Facing, kit: Kit): Figure2D {
  const W = canvas.width;
  const mirror = facing === 'left';
  let numberAt: Figure2D['numberAt'] = null;
  if (kit === 'team') {
    const cx = mirror ? W - 1 - chest.x : chest.x;
    const x = Math.round(cx - digits.width(look.number) / 2);
    const y = Math.round(chest.y - digits.height / 2);
    numberAt = { x, y };
    digits.draw(look.number, x, y, (px, py) => {
      // Sur le maillot seulement : ombre profonde → ombre profonde de la couleur secondaire, sinon son clair.
      const under = canvas.get(px, py);
      if (under === 'a' || under === 'p' || under === 'P' || under === 'q') canvas.set(px, py, 's');
      else if (under === 'Q') canvas.set(px, py, 'T');
    });
  }
  const flip = (p: Screen): Screen => (mirror ? { ...p, x: W - 1 - p.x } : p);
  return { canvas, numberAt, palms: [flip(palms[0]), flip(palms[1])] };
}

/** Le pixel (x, y) appartient à une pièce d'un autre groupe, plus proche : elle porte son ombre (lumière en haut à gauche). */
function castsOn(owner: Int16Array, W: number, x: number, y: number, g: number, gid: readonly number[], parts: readonly Part[], near: number): boolean {
  if (x < 0 || y < 0) return false;
  const j = owner[y * W + x];
  return j >= 0 && gid[j] !== g && parts[j].near > near;
}

/**
 * Tête seule, entourée de son contour doux (portrait, planches) : la tête composée, avec une marge
 * d'un pixel pour le contour.
 */
export function headSprite(look: Appearance, heading: Heading, expression: CharacterExpression = 'neutre'): SlotCanvas {
  const head = composeHead(characterOf(look), heading, expression);
  const c = new SlotCanvas(head.rows[0].length + 2, head.rows.length + 2);
  head.rows.forEach((row, y) => [...row].forEach((ch, x) => c.set(x + 1, y + 1, slotOf(ch))));
  softOutline(c, (x, y) => HEAD_DEEP[c.get(x, y)!] ?? '4');
  return c;
}

/**
 * Ton de modelé (0 reflet → 4 ombre profonde) d'un pixel de la pièce `p` du groupe `g` : distance
 * au bord éclairé (gauche, haut) et au bord sombre (droite, bas) de son groupe. Bord sombre : ombre
 * profonde ; près du bord sombre : ombre ; bord éclairé : clair, ou reflet s'il y a de l'épaisseur ;
 * au milieu : base. Ombre portée : au moins l'ombre ; pièce éloignée : un ton plus sombre.
 */
function paintedTone(x: number, y: number, g: number, p: Part, differs: (x: number, y: number, g: number) => boolean, cast: boolean): number {
  let dl = 0;
  while (dl < 6 && !differs(x - dl - 1, y, g) && !differs(x, y - dl - 1, g)) dl++;
  let dd = 0;
  while (dd < 6 && !differs(x + dd + 1, y, g) && !differs(x, y + dd + 1, g)) dd++;
  const f = dd / Math.max(1, dl + dd);
  let t = dd === 0 ? 4 : f < 0.3 ? 3 : dl === 0 ? 1 : f > 0.7 ? 1 : 2;
  if (dl === 0 && dd > 1) t = 0;
  if (cast) t = Math.max(t, 3);
  if (p.far) t = Math.min(4, t + 1);
  return t;
}

/**
 * Contour doux d'un pixel autour de la silhouette (voisinage à 4) : le ton le plus profond de la
 * matière du pixel peint voisin (`deepAt`), pris dans l'ordre droite, bas, gauche, haut. Là où la
 * tête touche le cou ou les épaules, il n'y a pas de vide, donc pas de contour entre les deux.
 */
export function softOutline(canvas: SlotCanvas, deepAt: (x: number, y: number) => Slot): void {
  const b = canvas.bounds();
  if (!b) return;
  const edges: [number, number, Slot][] = [];
  for (let y = Math.max(0, b.top - 1); y <= Math.min(canvas.height - 1, b.bottom + 1); y++) {
    for (let x = Math.max(0, b.left - 1); x <= Math.min(canvas.width - 1, b.right + 1); x++) {
      if (canvas.get(x, y) !== null) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        if (canvas.get(x + dx, y + dy) === null) continue;
        edges.push([x, y, deepAt(x + dx, y + dy)]);
        break;
      }
    }
  }
  for (const [x, y, slot] of edges) canvas.set(x, y, slot);
}

/** Pointes d'un pixel et trous d'un pixel de la silhouette : retirés et bouchés (bords propres), dans la boîte peinte. */
function cleanSilhouette(owner: Int16Array, W: number, H: number, box: { x0: number; x1: number; y0: number; y1: number }): void {
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && owner[y * W + x] >= 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) {
        const i = y * W + x;
        const count = +filled(x + 1, y) + +filled(x - 1, y) + +filled(x, y + 1) + +filled(x, y - 1);
        if (owner[i] >= 0 && count <= 1) owner[i] = -1;
        else if (owner[i] < 0 && count === 4) owner[i] = owner[(y - 1) * W + x];
      }
    }
  }
}

/** Arbitre : maillot rayé noir et blanc. */
function stripeReferee(canvas: SlotCanvas, material: readonly (Material | null)[]): void {
  canvas.forEach((x, y) => {
    if (material[y * canvas.width + x] === 'jersey') canvas.set(x, y, x % 2 === 0 ? 'w' : 'k');
  });
}

