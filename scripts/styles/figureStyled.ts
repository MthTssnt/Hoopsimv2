/**
 * Rendu des planches de styles (prototype, hors du jeu) : la même géométrie que `figure2d.ts`
 * (squelette, poses, pièces du corps, tête posée au cou), mais le nombre de tons, l'ombrage, le
 * contour, la palette et la tête dépendent du style. Sortie en couleurs (pas en emplacements).
 * Cadre plus grand que celui du jeu (64×70, sol en 66) pour les contours épais.
 */
import { HAIR_RAMPS, mixColor, PALETTE, shadeColor, SKIN_TONES, type TeamRamp } from '../../src/assets/palette';
import { headGrid2D } from '../../src/assets/sprites/heads2d';
import { drawJerseyNumber, jerseyNumberWidth } from '../../src/assets/sprites/jerseyDigits';
import type { Appearance } from '../../src/match/render/sprites/appearance';
import { colors2D } from '../../src/match/render/sprites/compose';
import type { Heading } from '../../src/match/render/sprites/rig';
import { build2D, joints2D, PITCH_2D, project2D, type Pose2D, type Screen } from '../../src/match/render/sprites/skeleton2d';
import type { Vec3 } from '../../src/match/render/sprites/vec3';
import { headGrid25, type Expr4, type FaceKit } from './head25';

export const FRAME_S = { width: 64, height: 70, centerX: 32, groundY: 66 } as const;

type Material = 'skin' | 'jersey' | 'trim' | 'sock' | 'shoe' | 'sole';

export interface StyleDef {
  id: string;
  name: string;
  /** Tête à ~25 % (crâne 12×11, kit de visage du style) ou tête actuelle (~33 %, visage du jeu). */
  head: '25' | '33';
  kit: FaceKit | null;
  /** Tons par matière. */
  tones: 2 | 3 | 5;
  /** Ombrage : bords (lumière à gauche, bande d'ombre à droite), ombre franche, modelé. */
  shading: 'edge' | 'hard' | 'painted';
  outline: 'tinted' | 'dark' | 'black' | 'soft';
  /** Épaisseur du contour extérieur (px). */
  outlineWidth: 1 | 2;
  /** Traits noirs entre une pièce et celle qui passe devant (bras devant le maillot). */
  innerLines?: boolean;
  /** Saturation des couleurs (1 = palette du jeu). */
  saturation?: number;
  /** Ombres tirées vers le bleu-violet, reflets chauds (rétro peint). */
  coolShadows?: boolean;
  /** Ombre franche sur le côté du visage (graphique BD). */
  faceShadow?: boolean;
  /** Opacité de l'ombre au sol. */
  groundShadow: number;
  /** Ombre plus profonde que la palette (0 = palette du jeu), pour une ombre franche. */
  shadowDepth?: number;
}

export interface Look extends Appearance {
  expression?: Expr4;
}

export interface ColorImage {
  width: number;
  height: number;
  px: Int32Array;
  get(x: number, y: number): number;
}

function image(width: number, height: number): ColorImage {
  const px = new Int32Array(width * height).fill(-1);
  return { width, height, px, get: (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? -1 : px[y * width + x]) };
}

// ------------------------------------------------------------------------------------------------
// Couleurs

function saturate(c: number, k: number): number {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(l + (v - l) * k)));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

/** Rampe d'une matière dans le style : du plus clair au plus sombre, `tones` couleurs. */
function ramp(style: StyleDef, light: number, base: number, shadow: number): number[] {
  const s = (c: number) => (style.saturation ? saturate(c, style.saturation) : c);
  if (style.tones === 2) return [s(base), s(style.shadowDepth ? mixColor(shadow, 0x140a24, style.shadowDepth) : shadow)];
  if (style.tones === 3) return [s(light), s(base), s(shadow)];
  // 5 tons : reflet chaud, clair, base, ombre et ombre profonde tirées vers le violet.
  return [mixColor(light, 0xffe6b8, 0.5), mixColor(light, base, 0.35), base, mixColor(shadow, 0x5a4aa0, 0.35), mixColor(shadeColor(shadow, 0.66), 0x34246e, 0.45)].map(s);
}

interface Palette {
  ramps: Record<Material | 'hair' | 'skinHead', number[]>;
  /** Contour d'une matière. */
  outline: (m: Material | 'hair' | 'skinHead') => number;
  head: (slot: string) => number;
}

function paletteFor(style: StyleDef, look: Look, primary: TeamRamp, secondary: TeamRamp): Palette {
  const skin = SKIN_TONES[look.skin];
  const hair = HAIR_RAMPS[look.hairColor];
  const c2 = colors2D(look, primary, secondary);
  const ramps: Palette['ramps'] = {
    skin: ramp(style, skin[0], skin[1], skin[2]),
    skinHead: ramp(style, skin[0], skin[1], skin[2]),
    jersey: ramp(style, primary[0], primary[1], primary[2]),
    trim: ramp(style, secondary[0], secondary[1], secondary[2]),
    sock: ramp(style, PALETTE.chalk, PALETTE.chalk, PALETTE.mist),
    shoe: ramp(style, PALETTE.mist, PALETTE.slate, PALETTE.ink),
    sole: ramp(style, PALETTE.chalk, PALETTE.chalk, PALETTE.mist),
    hair: ramp(style, hair[1], hair[2], hair[3]),
  };
  const deep = (m: keyof Palette['ramps']) => {
    const r = ramps[m];
    return r[r.length - 1];
  };
  const outline = (m: keyof Palette['ramps']) => {
    switch (style.outline) {
      case 'black':
        return 0x0a0a0c;
      case 'dark':
        return PALETTE.outline;
      case 'soft':
        return deep(m);
      case 'tinted':
        return mixColor(shadeColor(m === 'hair' ? hair[3] : deep(m), 0.45), 0x160c22, 0.45);
    }
  };
  const n = style.tones;
  const hr = ramps.hair;
  const sr = ramps.skinHead;
  const head = (slot: string): number => {
    switch (slot) {
      case '0':
        return mixColor(sr[0], 0xffffff, 0.35);
      case '1':
        return sr[0];
      case '2':
        return sr[n === 2 ? 0 : 1];
      case '3':
        return sr[n === 5 ? 3 : n - 1];
      case '4':
        return n === 5 ? sr[4] : c2.skinEdge!;
      case 'r':
        return n === 5 ? hr[0] : hr[0];
      case 'h':
        return n === 5 ? hr[1] : hr[0];
      case 'H':
        return n === 5 ? hr[2] : hr[n === 2 ? 0 : 1];
      case 'D':
        // En 2 tons, les mèches se fondent dans un aplat : seule la silhouette reste.
        return n === 5 ? hr[3] : n === 2 ? hr[0] : hr[n - 1];
      case 'E':
        return n === 5 ? hr[4] : n === 2 ? hr[1] : style.outline === 'black' ? 0x0a0a0c : shadeColor(hr[n - 1], 0.6);
      case 'w':
        return PALETTE.chalk;
      case 'n':
        return style.outline === 'black' ? 0x0a0a0c : PALETTE.outline;
      case 'i':
        return c2.iris!;
      case 'b':
        return c2.beard![0];
      case 'B':
        return c2.beard![1];
      case 's':
        return ramps.trim[0];
      case 'S':
        return ramps.trim[Math.min(1, n - 1)];
      default:
        return 0xff00ff;
    }
  };
  return { ramps, outline, head };
}

// ------------------------------------------------------------------------------------------------
// Géométrie (reprise de figure2d.ts)

interface Part {
  group: string;
  far: boolean;
  near: number;
  material: Material;
  shadow: number;
  inside: (x: number, y: number) => boolean;
  box: { x0: number; x1: number; y0: number; y1: number };
}
interface Disc {
  x: number;
  y: number;
  r: number;
}

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

// ------------------------------------------------------------------------------------------------
// Rendu

export interface StyledFigure {
  image: ColorImage;
  /** Paumes à l'écran (gauche, droite du joueur), image retournée comprise. */
  palms: [Screen, Screen];
}

export function renderStyled(style: StyleDef, look: Look, pose: Pose2D, heading: Heading, facing: 'right' | 'left', primary: TeamRamp, secondary: TeamRamp): StyledFigure {
  const pal = paletteFor(style, look, primary, secondary);
  const W = FRAME_S.width;
  const H = FRAME_S.height;
  const b = build2D(look.heightCm, look.heavy);
  const J = joints2D(b, pose, heading);
  const lift = (pose.lift ?? 0) * Math.cos(PITCH_2D);
  const sole = Math.max(...J.shoes.flat().map((p) => project2D(p, 0, 0).y)) + lift;
  const S = (p: Vec3): Screen => project2D(p, FRAME_S.centerX, FRAME_S.groundY - sole);
  const disc = (p: Vec3, r: number): Disc => ({ ...S(p), r });
  const nearOf = (...ps: Vec3[]) => ps.reduce((n, p) => n + S(p).near, 0) / ps.length;
  const parts: Part[] = [];
  const add = (p: Omit<Part, 'shadow'> & { shadow?: number }) => parts.push({ shadow: 1, ...p });
  for (const i of [0, 1] as const) {
    const far = i === 0;
    const legNear = nearOf(J.knees[i], J.ankles[i]);
    add({ group: `leg${i}`, far, near: legNear, material: 'skin', ...taper([disc(J.knees[i], b.r.knee), disc(J.calves[i], b.r.calf), disc(J.ankles[i], b.r.ankle)]) });
    add({ group: `leg${i}`, far, near: legNear + 0.01, material: 'sock', ...taper([disc(J.sockTops[i], b.r.ankle + 0.35), disc(J.ankles[i], b.r.ankle + 0.25)]) });
    add({ group: `foot${i}`, far, near: legNear + 0.02, material: 'shoe', ...hull(J.shoes[i].map(S)) });
    add({ group: far ? 'shorts-far' : 'shorts', far, near: nearOf(J.hips[i], J.shortsHems[i]) + 0.03, material: 'jersey', shadow: 2, ...taper([disc(J.hips[i], b.r.shorts), disc(J.shortsHems[i], b.r.shortsHem)]) });
    add({
      group: `arm${i}`,
      far,
      near: nearOf(J.shoulders[i], J.elbows[i], J.wrists[i]),
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
  add({ group: 'shorts', far: false, near: nearOf(J.pelvis), material: 'jersey', shadow: 2, ...hull(J.shorts.map(S)) });
  const torsoNear = nearOf(J.neckBase, J.chestFront, J.chestBack) + 0.05;
  add({ group: 'shorts', far: false, near: torsoNear + 0.03, material: 'trim', ...taper(J.waistband.map((p) => disc(p, 0.55))) });
  add({ group: 'torso', far: false, near: torsoNear, material: 'skin', shadow: 2, ...hull(J.torso.map(S)) });
  add({ group: 'torso', far: false, near: torsoNear + 0.01, material: 'skin', ...taper([disc(J.neckBase, b.r.neck + 0.3), disc(J.neckTop, b.r.neck)]) });
  add({ group: 'torso', far: false, near: torsoNear + 0.02, material: 'jersey', ...hull(J.jersey.map(S)) });
  add({ group: 'torso', far: false, near: torsoNear + 0.03, material: 'skin', ...hull([...J.collar.map(S), S(J.neckBase)]) });
  add({ group: 'torso', far: false, near: torsoNear + 0.04, material: 'trim', ...taper(J.collar.map((p) => disc(p, 0.5))) });

  const owner = new Int16Array(W * H).fill(-1);
  const order = parts.map((_, k) => k).sort((a, c) => parts[a].near - parts[c].near);
  for (const k of order) {
    const p = parts[k];
    for (let y = Math.max(0, p.box.y0); y <= Math.min(H - 1, p.box.y1); y++) for (let x = Math.max(0, p.box.x0); x <= Math.min(W - 1, p.box.x1); x++) if (p.inside(x, y)) owner[y * W + x] = k;
  }
  // Pointes et trous d'un pixel.
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && owner[y * W + x] >= 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const count = +filled(x + 1, y) + +filled(x - 1, y) + +filled(x, y + 1) + +filled(x, y - 1);
        if (owner[i] >= 0 && count <= 1) owner[i] = -1;
        else if (owner[i] < 0 && count === 4) owner[i] = owner[(y - 1) * W + x];
      }
    }
  }
  const groupIds = new Map<string, number>();
  const gid = parts.map((p) => groupIds.get(p.group) ?? groupIds.set(p.group, groupIds.size).get(p.group)!);
  const grp = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H || owner[y * W + x] < 0 ? -1 : gid[owner[y * W + x]]);
  const castsOn = (x: number, y: number, g: number, near: number) => {
    const j = x < 0 || y < 0 ? -1 : owner[y * W + x];
    return j >= 0 && gid[j] !== g && parts[j].near > near;
  };

  // Ombrage : un indice de ton (0 = le plus clair) selon le style.
  const n = style.tones;
  const img = image(W, H);
  const kind: (Material | 'hair' | 'skinHead' | null)[] = Array.from({ length: W * H }, () => null);
  // Étendue horizontale de chaque groupe par rangée (ombre franche).
  const span = new Map<string, [number, number]>();
  if (style.shading === 'hard') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const g = grp(x, y);
      if (g < 0) continue;
      const key = `${g},${y}`;
      const s = span.get(key);
      span.set(key, s ? [Math.min(s[0], x), Math.max(s[1], x)] : [x, x]);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = owner[y * W + x];
      if (k < 0) continue;
      const p = parts[k];
      const g = gid[k];
      const differs = (dx: number, dy: number) => grp(x + dx, y + dy) !== g;
      const cast = castsOn(x, y - 1, g, p.near) || castsOn(x - 1, y, g, p.near) || castsOn(x - 1, y - 1, g, p.near);
      let t: number;
      if (style.shading === 'painted') {
        // Modelé : distance au bord éclairé (gauche, haut) et au bord sombre (droite, bas).
        let dl = 0;
        while (dl < 6 && !differs(-dl - 1, 0) && !differs(0, -dl - 1)) dl++;
        let dd = 0;
        while (dd < 6 && !differs(dd + 1, 0) && !differs(0, dd + 1)) dd++;
        const f = dd / Math.max(1, dl + dd);
        t = dd === 0 ? 4 : f < 0.3 ? 3 : dl === 0 ? 1 : f > 0.7 ? 1 : 2;
        if (dl === 0 && dd > 1) t = 0;
        if (cast) t = Math.max(t, 3);
        if (p.far) t = Math.min(4, t + 1);
      } else if (style.shading === 'hard') {
        const [x0, x1] = span.get(`${g},${y}`)!;
        const shadow = x > x0 + (x1 - x0) * 0.55 || differs(0, 1) || cast || p.far;
        t = shadow ? 1 : 0;
      } else {
        let shade = differs(1, 0) || differs(1, 1) || differs(0, 1);
        for (let d = 2; d <= p.shadow && !shade; d++) shade = differs(d, 0);
        t = shade ? 2 : differs(-1, 0) || differs(0, -1) ? 0 : 1;
        if (cast) t = 2;
        if (p.far) t = Math.min(2, t + 1);
        if (n === 2) t = t === 2 ? 1 : 0;
      }
      const m: Material = p.material === 'shoe' && differs(0, 1) ? 'sole' : p.material;
      const r = pal.ramps[m];
      img.px[y * W + x] = r[Math.min(r.length - 1, t)];
      kind[y * W + x] = m;
      // Traits intérieurs (cartoon) : là où une pièce plus proche passe devant.
      if (style.innerLines && (castsOn(x, y - 1, g, p.near) || castsOn(x - 1, y, g, p.near) || castsOn(x + 1, y, g, p.near) || castsOn(x, y + 1, g, p.near))) img.px[y * W + x] = 0x0a0a0c;
    }
  }

  // Tête posée au cou.
  const expr = look.expression ?? 'neutre';
  const exprGame = ({ neutre: 'neutre', joie: 'joyeuse', cri: 'effort', decu: 'decu' } as const)[expr];
  const head = style.head === '25' ? headGrid25(look, heading, expr, style.kit) : headGrid2D(look, heading, exprGame);
  const neck = S(J.neckTop);
  const hx = Math.round(neck.x) - head.anchor.x;
  const hy = Math.round(neck.y) - head.anchor.y;
  const headBottom: number[] = [];
  // Ombre franche sur le côté du visage (BD) : la moitié côté profil, sous la ligne des yeux.
  const faceCols = head.rows.map((r) => [r.search(/[1234]/), r.length - 1 - [...r].reverse().join('').search(/[1234]/)]);
  head.rows.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++) {
      const c = row[gx];
      if (c === '.') continue;
      const x = hx + gx;
      const y = hy + gy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = owner[y * W + x];
      if (k >= 0 && parts[k].near > neck.near + 0.6 && parts[k].group.startsWith('arm')) continue;
      let color = pal.head(c);
      const isHair = 'rhHDE'.includes(c);
      if (style.faceShadow && heading === 'down' && c === '2' && gx > faceCols[gy][0] + (faceCols[gy][1] - faceCols[gy][0]) * 0.72) color = pal.head('3');
      if (style.shading === 'painted' && c === '2') {
        // Modelé du visage : reflet chaud en haut à gauche de la peau, violet le long du bord droit.
        const [l, r] = faceCols[gy];
        if (gx <= l + 1 && gy < head.rows.length * 0.6) color = pal.ramps.skinHead[1];
        if (gx >= r - 1) color = pal.ramps.skinHead[3];
      }
      img.px[y * W + x] = color;
      kind[y * W + x] = isHair ? 'hair' : 'skinHead';
      headBottom[x] = Math.max(headBottom[x] ?? -1, y);
    }
  });
  headBottom.forEach((bottom, x) => {
    const i = (bottom + 1) * W + x;
    const m = kind[i];
    if (bottom + 1 < H && m && m !== 'hair' && m !== 'skinHead' && m !== 'sole') img.px[i] = pal.ramps[m][pal.ramps[m].length - 1];
  });
  // Trous d'un pixel entre la tête et les épaules.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (img.get(x, y) >= 0) continue;
    if (img.get(x - 1, y) >= 0 && img.get(x + 1, y) >= 0 && img.get(x, y + 1) >= 0 && img.get(x, y - 1) >= 0) {
      img.px[y * W + x] = img.get(x, y - 1);
      kind[y * W + x] = kind[(y - 1) * W + x];
    }
  }
  // Contour extérieur, de l'épaisseur du style, à la couleur de la matière voisine.
  for (let ring = 0; ring < style.outlineWidth; ring++) {
    const edges: [number, number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (img.get(x, y) >= 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        if (img.get(x + dx, y + dy) < 0) continue;
        const m = kind[(y + dy) * W + x + dx] ?? 'skin';
        edges.push([x, y, pal.outline(m)]);
        kind[y * W + x] = m;
        break;
      }
    }
    for (const [x, y, c] of edges) img.px[y * W + x] = c;
  }
  // Numéro, à l'endroit, et miroir vers la gauche.
  let out = img;
  if (facing === 'left') {
    out = image(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.px[y * W + x] = img.px[y * W + (W - 1 - x)];
  }
  const chest = S(heading === 'down' ? J.chestFront : J.chestBack);
  const cx = facing === 'left' ? W - 1 - chest.x : chest.x;
  const nx = Math.round(cx - jerseyNumberWidth(look.number) / 2);
  const ny = Math.round(chest.y - 3);
  const jersey = new Set(pal.ramps.jersey);
  drawJerseyNumber(look.number, nx, ny, (x, y) => {
    const c = out.get(x, y);
    if (jersey.has(c)) out.px[y * W + x] = c === pal.ramps.jersey[pal.ramps.jersey.length - 1] ? pal.ramps.trim[pal.ramps.trim.length - 1] : pal.ramps.trim[Math.min(1, pal.ramps.trim.length - 1)];
  });
  const palms = [S(J.palms[0]), S(J.palms[1])] as [Screen, Screen];
  if (facing === 'left') palms.forEach((p, i) => (palms[i] = { ...p, x: W - 1 - p.x }));
  return { image: out, palms };
}

/** Tête seule (gros plans des expressions), dans les couleurs et le contour du style. */
export function headImage(style: StyleDef, look: Look, heading: Heading, primary: TeamRamp, secondary: TeamRamp): ColorImage {
  const pal = paletteFor(style, look, primary, secondary);
  const expr = look.expression ?? 'neutre';
  const exprGame = ({ neutre: 'neutre', joie: 'joyeuse', cri: 'effort', decu: 'decu' } as const)[expr];
  const head = style.head === '25' ? headGrid25(look, heading, expr, style.kit) : headGrid2D(look, heading, exprGame);
  const pad = style.outlineWidth + 1;
  const W = head.rows[0].length + pad * 2;
  const H = head.rows.length + pad * 2;
  const img = image(W, H);
  const kind: ('hair' | 'skinHead' | null)[] = Array.from({ length: W * H }, () => null);
  const faceCols = head.rows.map((r) => [r.search(/[1234]/), r.length - 1 - [...r].reverse().join('').search(/[1234]/)]);
  head.rows.forEach((row, gy) =>
    [...row].forEach((c, gx) => {
      if (c === '.') return;
      let color = pal.head(c);
      if (style.faceShadow && heading === 'down' && c === '2' && gx > faceCols[gy][0] + (faceCols[gy][1] - faceCols[gy][0]) * 0.72) color = pal.head('3');
      if (style.shading === 'painted' && c === '2') {
        const [l, r] = faceCols[gy];
        if (gx <= l + 1 && gy < head.rows.length * 0.6) color = pal.ramps.skinHead[1];
        if (gx >= r - 1) color = pal.ramps.skinHead[3];
      }
      img.px[(gy + pad) * W + gx + pad] = color;
      kind[(gy + pad) * W + gx + pad] = 'rhHDE'.includes(c) ? 'hair' : 'skinHead';
    }),
  );
  for (let ring = 0; ring < style.outlineWidth; ring++) {
    const edges: [number, number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (img.get(x, y) >= 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        if (img.get(x + dx, y + dy) < 0) continue;
        const m = kind[(y + dy) * W + x + dx] ?? 'skinHead';
        edges.push([x, y, pal.outline(m)]);
        kind[y * W + x] = m;
        break;
      }
    }
    for (const [x, y, c] of edges) img.px[y * W + x] = c;
  }
  return img;
}
