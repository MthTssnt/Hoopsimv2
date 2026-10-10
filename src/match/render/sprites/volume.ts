/**
 * Rendu des joueurs en volumes (15 quinquies) : le corps est fait de capsules, de sphères et
 * d'ellipsoïdes, lancés en rayons depuis une caméra orthographique de 3/4, puis ombrés en tons nets
 * (lumière en haut à gauche) et cernés d'un contour coloré. Le résultat est une image en
 * emplacements de couleur (`SlotCanvas`), recolorée à la cuisson comme les autres sprites. Pur,
 * sans Phaser.
 */

export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));
/** Rotation autour de l'axe vertical (z). */
export const rotZ = (a: Vec3, t: number): Vec3 => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t), a[2]];
/** Rotation autour de l'axe x (pencher vers l'avant : y monte vers z). */
export const rotX = (a: Vec3, t: number): Vec3 => [a[0], a[1] * Math.cos(t) - a[2] * Math.sin(t), a[1] * Math.sin(t) + a[2] * Math.cos(t)];
/** Rotation autour de l'axe y. */
export const rotY = (a: Vec3, t: number): Vec3 => [a[0] * Math.cos(t) + a[2] * Math.sin(t), a[1], -a[0] * Math.sin(t) + a[2] * Math.cos(t)];

/** Matières du joueur : chacune a sa rampe de tons et son ombre profonde (contour). */
export type Material = 'skin' | 'jersey' | 'trim' | 'sock' | 'shoe' | 'sole' | 'hair';

/** Un volume du corps. `group` sépare les pièces (bras, jambe…) pour les contours intérieurs. */
export interface Primitive {
  kind: 'sphere' | 'capsule' | 'ellipsoid';
  /** Centre (sphère, ellipsoïde) ou première extrémité (capsule). */
  a: Vec3;
  /** Seconde extrémité (capsule). */
  b?: Vec3;
  /** Rayon (sphère, capsule). */
  r: number;
  /** Demi-axes (ellipsoïde), le long de `axes`. */
  radii?: Vec3;
  axes?: readonly [Vec3, Vec3, Vec3];
  material: Material | ((p: Vec3, n: Vec3) => Material);
  group: string;
  /** Faux : ce point de la surface n'existe pas, le rayon passe (zones de cheveux). */
  mask?: (p: Vec3, n: Vec3) => boolean;
}

/** Caméra orthographique : x écran = X, y écran = Y·sin(tangage) − Z·cos(tangage) (Y vers la caméra). */
export interface Camera {
  width: number;
  height: number;
  /** Colonne de l'origine (pieds du joueur). */
  originX: number;
  /** Rangée du sol sous l'origine. */
  groundY: number;
  /** Inclinaison de la vue (rad) : 0 = de côté, plus = vu d'en haut. */
  pitch: number;
}

export interface Frame3D {
  readonly width: number;
  readonly height: number;
  /** Matière du pixel, ou null. */
  material: (Material | null)[];
  /** Ton 0 (reflet) à 3 (ombre) ; -1 : vide. */
  tone: Int8Array;
  depth: Float32Array;
  group: string[];
}

/** Direction de la lumière (en haut à gauche, un peu de face). */
export const LIGHT: Vec3 = normalize([-0.62, 0.5, 0.78]);
/** Seuils d'éclairement des tons 0 (reflet), 1 (clair) et 2 (base) ; en dessous : 3 (ombre). */
export const TONE_STEPS = [0.82, 0.48, 0.06] as const;

export function cameraVectors(pitch: number) {
  const forward: Vec3 = [0, -Math.cos(pitch), -Math.sin(pitch)];
  const up: Vec3 = [0, -Math.sin(pitch), Math.cos(pitch)];
  return { forward, up, right: [1, 0, 0] as Vec3 };
}

/** Projette un point du monde à l'écran (pixel, non arrondi) et donne sa profondeur. */
export function project(p: Vec3, cam: Camera): { x: number; y: number; depth: number } {
  const { forward, up } = cameraVectors(cam.pitch);
  return { x: p[0] + cam.originX, y: -dot(p, up) + cam.groundY, depth: dot(p, forward) };
}

/** Boîte à l'écran d'un volume (pixels), pour ne tester que les volumes utiles. */
function screenBox(pr: Primitive, cam: Camera): { x0: number; x1: number; y0: number; y1: number } {
  const pts = pr.kind === 'capsule' ? [pr.a, pr.b!] : [pr.a];
  const r = pr.kind === 'ellipsoid' ? Math.max(...pr.radii!) : pr.r;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    const s = project(p, cam);
    x0 = Math.min(x0, s.x - r);
    x1 = Math.max(x1, s.x + r);
    y0 = Math.min(y0, s.y - r);
    y1 = Math.max(y1, s.y + r);
  }
  return { x0: Math.floor(x0) - 1, x1: Math.ceil(x1) + 1, y0: Math.floor(y0) - 1, y1: Math.ceil(y1) + 1 };
}

/** Volume préparé pour des rayons parallèles : les termes qui ne dépendent pas du pixel sont calculés une fois. */
interface Prepared {
  pr: Primitive;
  box: { x0: number; x1: number; y0: number; y1: number };
  // Capsule : ba = b - a, |ba|², ba·f, |ba|² - (ba·f)².
  ba?: Vec3;
  baba?: number;
  bard?: number;
  ca?: number;
  // Ellipsoïde : direction du rayon dans le repère de la sphère unité, et |ld|².
  ld?: Vec3;
  la?: number;
}

/** Plus petit t > 0 du rayon o + t·f (f unitaire) sur la sphère (c, r), ou -1. */
function sphereT(ox: number, oy: number, oz: number, f: Vec3, c: Vec3, r: number): number {
  const x = ox - c[0];
  const y = oy - c[1];
  const z = oz - c[2];
  const b = x * f[0] + y * f[1] + z * f[2];
  const h = b * b - (x * x + y * y + z * z - r * r);
  return h < 0 ? -1 : -b - Math.sqrt(h);
}

function hitT(p: Prepared, ox: number, oy: number, oz: number, f: Vec3): number {
  const pr = p.pr;
  if (pr.kind === 'sphere') return sphereT(ox, oy, oz, f, pr.a, pr.r);
  if (pr.kind === 'capsule') {
    const a = pr.a;
    const ba = p.ba!;
    const oax = ox - a[0];
    const oay = oy - a[1];
    const oaz = oz - a[2];
    const baoa = ba[0] * oax + ba[1] * oay + ba[2] * oaz;
    const rdoa = f[0] * oax + f[1] * oay + f[2] * oaz;
    const oaoa = oax * oax + oay * oay + oaz * oaz;
    const baba = p.baba!;
    const bard = p.bard!;
    const ca = p.ca!;
    const b = baba * rdoa - baoa * bard;
    const c = baba * oaoa - baoa * baoa - pr.r * pr.r * baba;
    const h = b * b - ca * c;
    if (h < 0) return -1;
    if (ca > 1e-9) {
      const t = (-b - Math.sqrt(h)) / ca;
      const y = baoa + t * bard;
      if (y > 0 && y < baba) return t;
      return sphereT(ox, oy, oz, f, y <= 0 ? a : pr.b!, pr.r);
    }
    const t1 = sphereT(ox, oy, oz, f, a, pr.r);
    const t2 = sphereT(ox, oy, oz, f, pr.b!, pr.r);
    return t1 < 0 ? t2 : t2 < 0 ? t1 : Math.min(t1, t2);
  }
  const c = pr.a;
  const ax = pr.axes!;
  const rr = pr.radii!;
  const x = ox - c[0];
  const y = oy - c[1];
  const z = oz - c[2];
  const l0 = (x * ax[0][0] + y * ax[0][1] + z * ax[0][2]) / rr[0];
  const l1 = (x * ax[1][0] + y * ax[1][1] + z * ax[1][2]) / rr[1];
  const l2 = (x * ax[2][0] + y * ax[2][1] + z * ax[2][2]) / rr[2];
  const ld = p.ld!;
  const b = l0 * ld[0] + l1 * ld[1] + l2 * ld[2];
  const h = b * b - p.la! * (l0 * l0 + l1 * l1 + l2 * l2 - 1);
  return h < 0 ? -1 : (-b - Math.sqrt(h)) / p.la!;
}

/** Normale de la surface au point p d'un volume. */
function normalAt(pr: Primitive, p: Vec3): Vec3 {
  if (pr.kind === 'sphere') return normalize(sub(p, pr.a));
  if (pr.kind === 'capsule') {
    const ba = sub(pr.b!, pr.a);
    const k = Math.max(0, Math.min(1, dot(sub(p, pr.a), ba) / dot(ba, ba)));
    return normalize(sub(p, add(pr.a, scale(ba, k))));
  }
  const u = sub(p, pr.a);
  const ax = pr.axes!;
  const rr = pr.radii!;
  const g: Vec3 = [dot(u, ax[0]) / (rr[0] * rr[0]), dot(u, ax[1]) / (rr[1] * rr[1]), dot(u, ax[2]) / (rr[2] * rr[2])];
  return normalize(add(add(scale(ax[0], g[0]), scale(ax[1], g[1])), scale(ax[2], g[2])));
}

/** Lance un rayon par pixel ; garde le volume le plus proche, sa matière et son ton. */
export function rasterize(prims: readonly Primitive[], cam: Camera): Frame3D {
  const { width: W, height: H } = cam;
  const n = W * H;
  const frame: Frame3D = {
    width: W,
    height: H,
    material: Array.from({ length: n }, () => null),
    tone: new Int8Array(n).fill(-1),
    depth: new Float32Array(n).fill(Infinity),
    group: Array.from({ length: n }, () => ''),
  };
  const { forward: f, up } = cameraVectors(cam.pitch);
  const prepared: Prepared[] = prims.map((pr) => {
    const p: Prepared = { pr, box: screenBox(pr, cam) };
    if (pr.kind === 'capsule') {
      const ba = sub(pr.b!, pr.a);
      const baba = dot(ba, ba);
      const bard = dot(ba, f);
      Object.assign(p, { ba, baba, bard, ca: baba - bard * bard });
    } else if (pr.kind === 'ellipsoid') {
      const ax = pr.axes!;
      const rr = pr.radii!;
      const ld: Vec3 = [dot(f, ax[0]) / rr[0], dot(f, ax[1]) / rr[1], dot(f, ax[2]) / rr[2]];
      Object.assign(p, { ld, la: dot(ld, ld) });
    }
    return p;
  });
  if (prepared.length === 0) return frame;
  const bx0 = Math.max(0, Math.min(...prepared.map((p) => p.box.x0)));
  const bx1 = Math.min(W - 1, Math.max(...prepared.map((p) => p.box.x1)));
  const by0 = Math.max(0, Math.min(...prepared.map((p) => p.box.y0)));
  const by1 = Math.min(H - 1, Math.max(...prepared.map((p) => p.box.y1)));
  const FAR = 500;
  for (let y = by0; y <= by1; y++) {
    const row = prepared.filter((p) => p.box.y0 <= y && p.box.y1 >= y);
    if (row.length === 0) continue;
    const sy = y + 0.5 - cam.groundY;
    for (let x = bx0; x <= bx1; x++) {
      const sx = x + 0.5 - cam.originX;
      // Origine du rayon : point de l'écran reculé de FAR le long de -f.
      const ox = sx - FAR * f[0];
      const oy = -sy * up[1] - FAR * f[1];
      const oz = -sy * up[2] - FAR * f[2];
      let bestT = Infinity;
      let best: Prepared | null = null;
      let bestN: Vec3 | null = null;
      for (let k = 0; k < row.length; k++) {
        const p = row[k];
        if (x < p.box.x0 || x > p.box.x1) continue;
        const t = hitT(p, ox, oy, oz, f);
        if (t <= 0 || t >= bestT) continue;
        if (p.pr.mask) {
          const hp: Vec3 = [ox + f[0] * t, oy + f[1] * t, oz + f[2] * t];
          const hn = normalAt(p.pr, hp);
          if (!p.pr.mask(hp, hn)) continue;
          bestN = hn;
        } else {
          bestN = null;
        }
        bestT = t;
        best = p;
      }
      if (!best) continue;
      const i = y * W + x;
      const hp: Vec3 = [ox + f[0] * bestT, oy + f[1] * bestT, oz + f[2] * bestT];
      const nrm = bestN ?? normalAt(best.pr, hp);
      const k = dot(nrm, LIGHT);
      const mat = best.pr.material;
      frame.material[i] = typeof mat === 'function' ? mat(hp, nrm) : mat;
      frame.tone[i] = k > TONE_STEPS[0] ? 0 : k > TONE_STEPS[1] ? 1 : k > TONE_STEPS[2] ? 2 : 3;
      frame.depth[i] = bestT - FAR;
      frame.group[i] = best.pr.group;
    }
  }
  return frame;
}
