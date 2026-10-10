/**
 * Joueur du style en volumes (15 quinquies) : squelette, volumes, poses et rendu en emplacements
 * de couleur. Proportions exagérées (grosse tête, grosses mains et chaussures, membres épais),
 * ombrage en tons nets, contour coloré (ombre profonde de la matière voisine), visage de 3/4 posé
 * sur la tête. Le haut et le bas du corps se posent séparément (`AthletePose`), ce qui permet de
 * combiner un geste des bras avec un cycle de jambes.
 */
import { HAIR_RAMPS, PALETTE, SKIN_RAMPS, teamRamp5, type Ramp5 } from '../../../assets/palette';
import type { Expression } from '../../../assets/sprites/heads';
import { drawJerseyNumber, jerseyNumberWidth } from '../../../assets/sprites/jerseyDigits';
import { buildFor } from './rig';
import { SlotCanvas, type Slot } from './canvas';
import { add, cameraVectors, dot, normalize, project, rasterize, rotX, rotY, rotZ, scale, sub, type Camera, type Frame3D, type Material, type Primitive, type Vec3 } from './volume';

/** Cadre d'une image : le point au sol sous le joueur est en (originX, groundY) ; 4 rangées sous le sol pour le pied qui avance vers la caméra. */
export const ATHLETE_FRAME = { width: 56, height: 68, originX: 28, groundY: 63 } as const;
/** Inclinaison de la caméra des sprites (rad). */
export const ATHLETE_PITCH = 0.42;

export type AthleteHair = 'court' | 'afro' | 'tresses';
export type AthleteHeading = 'down' | 'up';
export type AthleteFacing = 'right' | 'left';

/** Mesures du corps (px du modèle, avant projection). */
export interface AthleteBuild {
  ankleZ: number;
  shin: number;
  thigh: number;
  hipW: number;
  pelvis: Vec3;
  chest: Vec3;
  chestZ: number;
  neckZ: number;
  shoulderW: number;
  shoulderZ: number;
  upperArm: number;
  foreArm: number;
  legR: number;
  shinR: number;
  armR: number;
  foreR: number;
  handR: number;
  footLen: number;
  footR: number;
  headR: number;
}

const AILIER: AthleteBuild = {
  ankleZ: 3.2,
  shin: 6.4,
  thigh: 6.8,
  hipW: 3.2,
  pelvis: [6.2, 4.2, 3.8],
  chest: [7.6, 4.8, 7.0],
  chestZ: 7.6,
  neckZ: 12.6,
  shoulderW: 6.8,
  shoulderZ: 11.6,
  upperArm: 5.6,
  foreArm: 4.8,
  legR: 3.0,
  shinR: 2.4,
  armR: 2.3,
  foreR: 2.0,
  handR: 2.4,
  footLen: 7.6,
  footR: 2.2,
  headR: 7.4,
};

/** Mesures selon la taille et la corpulence : la tête ne change jamais. */
export function athleteBuild(heightCm: number, heavy: boolean): AthleteBuild {
  const build = buildFor(heightCm);
  let b: AthleteBuild = { ...AILIER };
  if (build === 'meneur') b = { ...b, shin: 5.6, thigh: 6.0, chest: [7.4, 4.7, 6.6], chestZ: 7.2, neckZ: 12.0, shoulderZ: 11.0 };
  if (build === 'pivot') b = { ...b, shin: 7.6, thigh: 8.0, chest: [8.2, 5.0, 7.4], chestZ: 8.0, neckZ: 13.2, shoulderZ: 12.2, shoulderW: 7.4, pelvis: [6.6, 4.4, 4.0] };
  if (heavy) b = { ...b, chest: [b.chest[0] + 1, b.chest[1] + 0.6, b.chest[2]], pelvis: [b.pelvis[0] + 0.8, b.pelvis[1] + 0.4, b.pelvis[2]], shoulderW: b.shoulderW + 0.8, legR: b.legR + 0.3, shinR: b.shinR + 0.2, armR: b.armR + 0.25 };
  return b;
}

/** Jambe : cuisse vers l'avant (`hip`, rad), genou plié vers l'arrière (`knee`), pointe du pied relevée (`foot`), écart (`out`). */
export interface LegPose {
  hip: number;
  knee: number;
  foot?: number;
  out?: number;
}

/** Bras : vers l'avant (`pitch`, rad ; ~2,8 = levé), écarté (`abd`), coude plié vers l'avant (`elbow`). */
export interface ArmPose {
  pitch: number;
  abd: number;
  elbow: number;
}

/** Ballon tenu : dans une main (dribble : `drop` de 0 = dans la main à 1 = au sol), à la poitrine ou au-dessus de la main. */
export type BallPose = { kind: 'hand'; hand: 0 | 1; drop: number } | { kind: 'chest' } | { kind: 'overhead'; hand: 0 | 1 };

/** Bas du corps : jambes, descente du bassin, envol. */
export interface LowerPose {
  legs: readonly [LegPose, LegPose];
  /** Descente du bassin (px) : jambes fléchies, écrasement à la réception. */
  bob?: number;
  /** Tout le corps au-dessus du sol (px) : foulée en suspension, saut. */
  lift?: number;
}

/** Haut du corps : bras, buste, ballon, visage. */
export interface UpperPose {
  arms: readonly [ArmPose, ArmPose];
  /** Buste penché vers l'avant (rad). */
  lean?: number;
  /** Épaules tournées (rad, vers la gauche du joueur si positif). */
  turn?: number;
  /** Le haut du corps monte ou descend en plus du bassin (px). */
  rise?: number;
  ball?: BallPose;
  expression?: Expression;
}

export interface AthleteLook {
  heightCm: number;
  heavy: boolean;
  hair: AthleteHair;
  number: number;
}

/** Ordre des jambes et des bras : [gauche du joueur, droite du joueur]. */
const SIDES = [-1, 1] as const;

/**
 * Angle du corps (rad) pour chaque position : le corps court à ~42° de l'horizontale (la foulée
 * se voit), vers la caméra en diagonale bas, vers le fond en diagonale haut.
 */
export function athleteYaw(heading: AthleteHeading, facing: AthleteFacing): number {
  const t = 0.84;
  const yaw = heading === 'down' ? -t : -(Math.PI - t);
  return facing === 'right' ? yaw : -yaw;
}

/** En diagonale bas, la tête se tourne un peu plus vers la caméra que le corps : le visage se voit de 3/4. */
export const HEAD_TO_CAMERA = 0.32;

interface Skeleton {
  prims: Primitive[];
  head: Vec3;
  /** Repère de la tête : avant, droite, haut (après penché et rotation). */
  fwd: Vec3;
  /** Avant du buste (le numéro). */
  bodyFwd: Vec3;
  side: Vec3;
  upv: Vec3;
  hands: [Vec3, Vec3];
  chest: Vec3;
  ball: Vec3 | null;
}

function skeleton(b: AthleteBuild, lower: LowerPose, upper: UpperPose, hair: AthleteHair, headYaw: number): Skeleton {
  const prims: Primitive[] = [];
  const pelvis: Vec3 = [0, 0, b.ankleZ + b.thigh + b.shin - 0.4 - (lower.bob ?? 0)];
  // Jambes.
  SIDES.forEach((side, i) => {
    const L = lower.legs[i];
    const hip = add(pelvis, [side * b.hipW, 0, -0.6]);
    const d1 = rotX(rotY([0, 0, -1], -side * (L.out ?? 0.06)), L.hip);
    const knee = add(hip, scale(d1, b.thigh));
    const d2 = rotX(rotY([0, 0, -1], -side * (L.out ?? 0.06)), L.hip - L.knee);
    const ankle = add(knee, scale(d2, b.shin));
    const footDir = rotX([0, 1, 0], L.foot ?? 0);
    const toe = add(ankle, scale(footDir, b.footLen - 2.4));
    const heel = add(ankle, scale(footDir, -1.3));
    const down = rotX([0, 0, -1], L.foot ?? 0);
    const group = `leg${i}`;
    // Short ample sur le haut de la cuisse, puis la peau, la chaussette, la chaussure.
    prims.push({ kind: 'capsule', a: add(hip, [0, 0, 0.6]), b: add(hip, scale(d1, b.thigh * 0.8)), r: b.legR + 0.9, material: 'jersey', group });
    prims.push({ kind: 'capsule', a: hip, b: knee, r: b.legR, material: 'skin', group });
    prims.push({ kind: 'capsule', a: knee, b: ankle, r: b.shinR, material: (p) => (dot(sub(p, knee), d2) > b.shin - 2.4 ? 'sock' : 'skin'), group });
    prims.push({
      kind: 'capsule',
      a: add(heel, scale(down, 0.7)),
      b: add(toe, scale(down, 0.7)),
      r: b.footR,
      material: (p) => (dot(sub(p, ankle), down) > 1.6 ? 'sole' : 'shoe'),
      group: `foot${i}`,
    });
  });
  // Bassin (short) et haut du corps (penché, tourné autour du bassin).
  const turn = upper.turn ?? 0;
  const lean = upper.lean ?? 0;
  const rise: Vec3 = [0, 0, upper.rise ?? 0];
  const pose = (p: Vec3): Vec3 => add(add(pelvis, rotX(rotZ(sub(p, pelvis), turn), lean)), rise);
  const dir = (v: Vec3): Vec3 => rotX(rotZ(v, turn), lean);
  const fwd = dir([0, 1, 0]);
  const side = dir([1, 0, 0]);
  const upv = dir([0, 0, 1]);
  prims.push({
    kind: 'ellipsoid',
    a: add(pelvis, [0, 0, 0.6]),
    r: 0,
    radii: b.pelvis,
    axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    material: (p) => (p[2] - pelvis[2] > b.pelvis[2] * 0.62 ? 'trim' : 'jersey'),
    group: 'pelvis',
  });
  const chest = pose(add(pelvis, [0, 0, b.chestZ]));
  prims.push({
    kind: 'ellipsoid',
    a: chest,
    r: 0,
    radii: b.chest,
    axes: [side, fwd, upv],
    material: (p) => {
      const u = sub(p, chest);
      const x = dot(u, side) / b.chest[0];
      const z = dot(u, upv) / b.chest[2];
      // Col (devant et dos) et emmanchures : couleur secondaire.
      if (z > 0.8) return 'trim';
      if (Math.abs(x) > 0.86 && z > 0.05) return 'trim';
      return 'jersey';
    },
    group: 'torso',
  });
  const neck = pose(add(pelvis, [0, 0, b.neckZ]));
  // Bras.
  const hands: Vec3[] = [];
  SIDES.forEach((s, i) => {
    const A = upper.arms[i];
    const shoulder = pose(add(pelvis, [s * b.shoulderW, 0, b.shoulderZ]));
    const d1 = dir(rotX(rotY([0, 0, -1], -s * A.abd), A.pitch));
    const elbow = add(shoulder, scale(d1, b.upperArm));
    const d2 = dir(rotX(rotY([0, 0, -1], -s * A.abd), A.pitch + A.elbow));
    const wrist = add(elbow, scale(d2, b.foreArm));
    const hand = add(wrist, scale(d2, b.handR * 0.55));
    hands.push(hand);
    const group = `arm${i}`;
    prims.push({ kind: 'sphere', a: shoulder, r: b.armR + 0.5, material: 'skin', group });
    prims.push({ kind: 'capsule', a: shoulder, b: elbow, r: b.armR, material: 'skin', group });
    prims.push({ kind: 'capsule', a: elbow, b: wrist, r: b.foreR, material: 'skin', group });
    prims.push({ kind: 'sphere', a: hand, r: b.handR, material: 'skin', group: `hand${i}` });
  });
  // Cou et tête : sphère, nez, oreilles, cheveux.
  const R = b.headR;
  const head = add(neck, add(scale(upv, R * 0.86), scale(fwd, 0.7)));
  // La tête tourne seule (vers la caméra) : son avant et son côté propres.
  const hf = rotZ(fwd, headYaw);
  const hs = rotZ(side, headYaw);
  prims.push({ kind: 'capsule', a: add(neck, scale(upv, -1.2)), b: add(neck, scale(upv, 1.4)), r: 2.3, material: 'skin', group: 'neck' });
  prims.push({ kind: 'sphere', a: head, r: R, material: 'skin', group: 'head' });
  prims.push({ kind: 'sphere', a: add(head, add(scale(hf, R + 0.1), scale(upv, -1.6))), r: 1.5, material: 'skin', group: 'head' });
  for (const s of SIDES) prims.push({ kind: 'sphere', a: add(head, add(scale(hs, s * (R - 0.5)), add(scale(hf, -0.6), scale(upv, -0.8)))), r: 1.6, material: 'skin', group: 'head' });
  prims.push(...hairPrims(hair, head, R, hf, hs, upv));
  // Ballon tenu.
  let ball: Vec3 | null = null;
  const bp = upper.ball;
  if (bp?.kind === 'hand') {
    const h = hands[bp.hand];
    const inHand = add(h, [0, 0, -(b.handR + 3.6)]);
    const floor: Vec3 = [h[0], h[1], 4];
    ball = add(scale(inHand, 1 - bp.drop), scale(floor, bp.drop));
  } else if (bp?.kind === 'chest') {
    ball = add(scale(add(hands[0], hands[1]), 0.5), scale(fwd, 2.4));
  } else if (bp?.kind === 'overhead') {
    ball = add(hands[bp.hand], scale(upv, b.handR + 3.4));
  }
  return { prims, head, fwd: hf, side: hs, upv, bodyFwd: fwd, hands: [hands[0], hands[1]], chest, ball };
}

function hairPrims(hair: AthleteHair, head: Vec3, R: number, fwd: Vec3, side: Vec3, upv: Vec3): Primitive[] {
  const rel = (p: Vec3) => normalize(sub(p, head));
  const local = (p: Vec3) => {
    const n = rel(p);
    return { f: dot(n, fwd), s: dot(n, side), u: dot(n, upv) };
  };
  // Ligne des cheveux : haut et arrière du crâne, front dégagé.
  const scalp = (p: Vec3, forehead: number, face = 0.5) => {
    const { f, u } = local(p);
    return u > 0.16 - 0.6 * Math.max(0, -f) && !(f > face && u < forehead);
  };
  if (hair === 'afro') {
    // Volume rond au-dessus et derrière la tête ; le visage reste dégagé.
    return [{ kind: 'sphere', a: add(head, add(scale(upv, 2.2), scale(fwd, -1.6))), r: R + 2.2, material: 'hair', group: 'head', mask: (p) => scalp(p, 0.62, 0.22) }];
  }
  if (hair === 'tresses') {
    // Tresses plaquées : des rangs de cheveux d'avant en arrière, la peau du crâne entre eux.
    return [
      {
        kind: 'sphere',
        a: add(head, scale(fwd, -0.3)),
        r: R + 0.5,
        material: 'hair',
        group: 'head',
        mask: (p) => {
          if (!scalp(p, 0.42)) return false;
          const { s } = local(p);
          return Math.abs(((s * 4.2 + 10.5) % 1) - 0.5) > 0.14;
        },
      },
    ];
  }
  return [{ kind: 'sphere', a: add(head, add(scale(upv, 0.5), scale(fwd, -0.4))), r: R + 0.6, material: 'hair', group: 'head', mask: (p) => scalp(p, 0.45) }];
}

/** Emplacements de chaque matière, du reflet à l'ombre, puis l'ombre profonde (contour). */
const RAMP_SLOTS: Record<Material, { tones: readonly [Slot, Slot, Slot, Slot]; deep: Slot }> = {
  skin: { tones: ['0', '1', '2', '3'], deep: '4' },
  jersey: { tones: ['a', 'p', 'P', 'q'], deep: 'Q' },
  trim: { tones: ['s', 's', 'S', 't'], deep: 'T' },
  sock: { tones: ['w', 'w', 'm', 'G'], deep: 'k' },
  sole: { tones: ['w', 'w', 'm', 'G'], deep: 'k' },
  shoe: { tones: ['G', 'G', 'k', 'k'], deep: 'o' },
  hair: { tones: ['r', 'h', 'H', 'D'], deep: 'E' },
};

/** Ordre de préférence du contour quand un pixel vide touche plusieurs matières. */
const OUTLINE_PRIORITY: readonly Material[] = ['shoe', 'sole', 'hair', 'jersey', 'trim', 'skin', 'sock'];

export interface AthleteFrame {
  canvas: SlotCanvas;
  /** Centre du ballon tenu (pixel du cadre) et s'il passe devant le corps, ou null. */
  ball: { x: number; y: number; front: boolean } | null;
}

/** Rend une image : squelette posé, volumes lancés en rayons, visage, contours, numéro. */
export function renderAthlete(look: AthleteLook, lower: LowerPose, upper: UpperPose, heading: AthleteHeading, facing: AthleteFacing): AthleteFrame {
  const b = athleteBuild(look.heightCm, look.heavy);
  const headYaw = heading === 'down' ? (facing === 'right' ? HEAD_TO_CAMERA : -HEAD_TO_CAMERA) : 0;
  const sk = skeleton(b, lower, upper, look.hair, headYaw);
  const yaw = athleteYaw(heading, facing);
  // Pieds au sol : le point le plus bas des semelles touche le sol, sauf en suspension (`lift`).
  let minZ = Infinity;
  for (const pr of sk.prims) {
    if (!pr.group.startsWith('foot')) continue;
    minZ = Math.min(minZ, pr.a[2] - pr.r, pr.b![2] - pr.r);
  }
  const shift: Vec3 = [0, 0, -minZ + (lower.lift ?? 0)];
  const world = (p: Vec3): Vec3 => rotZ(add(p, shift), yaw);
  const wdir = (v: Vec3): Vec3 => rotZ(v, yaw);
  const prims: Primitive[] = sk.prims.map((pr) => {
    const material = pr.material;
    const mask = pr.mask;
    const back = (p: Vec3): Vec3 => sub(rotZ(p, -yaw), shift);
    return {
      ...pr,
      a: world(pr.a),
      b: pr.b ? world(pr.b) : undefined,
      axes: pr.axes ? [wdir(pr.axes[0]), wdir(pr.axes[1]), wdir(pr.axes[2])] : undefined,
      material: typeof material === 'function' ? (p: Vec3, n: Vec3) => material(back(p), rotZ(n, -yaw)) : material,
      mask: mask ? (p: Vec3, n: Vec3) => mask(back(p), rotZ(n, -yaw)) : undefined,
    };
  });
  const cam: Camera = { width: ATHLETE_FRAME.width, height: ATHLETE_FRAME.height, originX: ATHLETE_FRAME.originX, groundY: ATHLETE_FRAME.groundY, pitch: ATHLETE_PITCH };
  const frame = rasterize(prims, cam);
  const slots = toSlots(frame);
  const W = frame.width;
  const { forward } = cameraVectors(cam.pitch);
  // Visage : yeux, sourcils et bouche posés sur la sphère de la tête, s'ils font face à la caméra.
  const headW = world(sk.head);
  const fwd = wdir(sk.fwd);
  const side = wdir(sk.side);
  const upv = wdir(sk.upv);
  const R = b.headR;
  const expression = upper.expression ?? 'neutre';
  const facePoint = (f: number, s: number, u: number) => add(headW, scale(normalize(add(add(scale(fwd, f), scale(side, s)), scale(upv, u))), R));
  const paint = (p: Vec3, slot: Slot) => {
    const n = normalize(sub(p, headW));
    if (dot(n, forward) > -0.2) return;
    const s = project(p, cam);
    const x = Math.floor(s.x);
    const y = Math.floor(s.y);
    if (x < 0 || y < 0 || x >= W || y >= frame.height) return;
    const i = y * W + x;
    if (frame.group[i] !== 'head' || frame.material[i] !== 'skin' || Math.abs(frame.depth[i] - s.depth) > 1.6) return;
    slots[i] = slot;
  };
  for (const s of SIDES) {
    const eye = facePoint(0.86, s * 0.4, 0.02);
    paint(eye, 'n');
    paint(add(eye, scale(upv, -1)), 'n');
    const browLift = expression === 'concentree' ? 1.6 : 2.2;
    const brow = add(eye, scale(upv, browLift));
    paint(brow, 'E');
    paint(add(brow, scale(side, s * 1)), 'E');
    if (expression === 'concentree') paint(add(brow, scale(add(scale(side, -s), scale(upv, -0.6)), 1)), 'E');
  }
  const mouth = expression === 'joyeuse' ? [-0.3, 0, 0.3] : [-0.12, 0.12];
  for (const k of mouth) paint(facePoint(0.86, k, expression === 'joyeuse' ? -0.42 - Math.abs(k) * 0.4 : -0.46), '4');
  // Numéro : sur la poitrine si elle fait face à la caméra, sinon dans le dos.
  const chestW = world(sk.chest);
  const bodyFwd = wdir(sk.bodyFwd);
  const front = dot(bodyFwd, forward) < 0;
  const numberPoint = add(chestW, add(scale(bodyFwd, (front ? 1 : -1) * b.chest[1] * 0.9), scale(upv, 0.6)));
  const np = project(numberPoint, cam);
  const nx = Math.round(np.x - jerseyNumberWidth(look.number) / 2);
  const ny = Math.round(np.y - 3);
  drawJerseyNumber(look.number, nx, ny, (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= frame.height) return;
    const i = y * W + x;
    if (frame.group[i] !== 'torso' || frame.material[i] !== 'jersey') return;
    const under = slots[i];
    slots[i] = under === 'q' ? 't' : under === 'P' ? 'S' : 's';
  });
  const canvas = new SlotCanvas(W, frame.height);
  slots.forEach((slot, i) => {
    if (slot) canvas.set(i % W, Math.floor(i / W), slot);
  });
  // Ballon : derrière le corps si, sous son disque, le corps est plus proche de la caméra que lui.
  let ball: AthleteFrame['ball'] = null;
  if (sk.ball) {
    const bs = project(world(sk.ball), cam);
    const bx = Math.round(bs.x);
    const by = Math.round(bs.y);
    let covered = 0;
    let hidden = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = bx + dx;
        const y = by + dy;
        if (dx * dx + dy * dy > 10 || x < 0 || y < 0 || x >= W || y >= frame.height) continue;
        const i = y * W + x;
        if (!frame.material[i]) continue;
        covered++;
        if (frame.depth[i] < bs.depth - 2) hidden++;
      }
    }
    ball = { x: bx, y: by, front: covered === 0 || hidden * 2 < covered };
  }
  return { canvas, ball };
}

/**
 * Pixels isolés : un pixel sans voisin (à 8) du même emplacement dans sa matière prend
 * l'emplacement le plus courant autour de lui (ombre profonde comprise).
 */
function despeckle(input: readonly (Slot | null)[], material: readonly (Material | null)[], W: number, H: number, x0: number, x1: number, y0: number, y1: number): (Slot | null)[] {
  // Sur place, en quelques passes : un pixel corrigé compte aussitôt pour ses voisins (deux pixels
  // isolés côte à côte ne s'échangent pas), et changer un pixel peut en isoler un autre.
  const slots = input.slice();
  for (let pass = 0; pass < 3; pass++) if (!despecklePass(slots, material, W, H, x0, x1, y0, y1)) break;
  return slots;
}

/** Une passe sur place ; vrai si un pixel a changé. */
function despecklePass(slots: (Slot | null)[], material: readonly (Material | null)[], W: number, H: number, x0: number, x1: number, y0: number, y1: number): boolean {
  const out = slots;
  let changed = false;
  const seen: Slot[] = [];
  const counts: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const m = material[i];
      if (!m) continue;
      seen.length = 0;
      counts.length = 0;
      let alone = true;
      for (let dy = -1; dy <= 1 && alone; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if ((!dx && !dy) || xx < 0 || xx >= W) continue;
          const j = yy * W + xx;
          if (material[j] !== m) continue;
          const sj = slots[j]!;
          if (sj === slots[i]) {
            alone = false;
            break;
          }
          const k = seen.indexOf(sj);
          if (k < 0) {
            seen.push(sj);
            counts.push(1);
          } else counts[k]++;
        }
      }
      if (!alone) continue;
      if (seen.length === 0) {
        // Bande d'un pixel entre deux matières : l'emplacement le plus courant autour, toutes matières.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = (y + dy) * W + x + dx;
            if ((!dx && !dy) || x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= H || !slots[j]) continue;
            const k = seen.indexOf(slots[j]!);
            if (k < 0) {
              seen.push(slots[j]!);
              counts.push(1);
            } else counts[k]++;
          }
        }
        if (seen.length === 0) continue;
      }
      let bestK = 0;
      for (let k = 1; k < seen.length; k++) if (counts[k] > counts[bestK]) bestK = k;
      out[i] = seen[bestK];
      changed = true;
    }
  }
  return changed;
}

/** Tons en emplacements, nettoyage des pixels isolés, contours intérieurs puis contour coloré. */
function toSlots(frame: Frame3D): (Slot | null)[] {
  const { width: W, height: H, material, depth, group } = frame;
  // Trous d'un pixel dans la silhouette (4 voisins peints) : bouchés par le voisin le plus proche de la caméra.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (material[i]) continue;
      const around = [i + 1, i - 1, i + W, i - W];
      if (!around.every((j) => material[j])) continue;
      const j = around.reduce((a, b) => (depth[b] < depth[a] ? b : a));
      material[i] = material[j];
      frame.tone[i] = frame.tone[j];
      depth[i] = depth[j];
      group[i] = group[j];
    }
  }
  const slots: (Slot | null)[] = material.map((m, i) => (m ? RAMP_SLOTS[m].tones[frame.tone[i]] : null));
  // Boîte des pixels peints (plus le contour).
  let x0 = W;
  let x1 = -1;
  let y0 = H;
  let y1 = -1;
  for (let i = 0; i < material.length; i++) {
    if (!material[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return slots;
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(W - 1, x1 + 1);
  y1 = Math.min(H - 1, y1 + 1);
  const cleaned = despeckle(slots, material, W, H, x0, x1, y0, y1);
  // Contours intérieurs : derrière une pièce plus proche, l'ombre profonde de cette pièce.
  const out = cleaned.slice();
  const near = (i: number, j: number) => material[j] !== null && group[j] !== group[i] && depth[j] < depth[i] - 1.6;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!material[i]) continue;
      let j = -1;
      if (x + 1 < W && near(i, i + 1)) j = i + 1;
      else if (x > 0 && near(i, i - 1)) j = i - 1;
      else if (y + 1 < H && near(i, i + W)) j = i + W;
      else if (y > 0 && near(i, i - W)) j = i - W;
      if (j >= 0) out[i] = RAMP_SLOTS[material[j]!].deep;
    }
  }
  // Second nettoyage : les contours intérieurs ont pu isoler des pixels.
  const final = despeckle(out, material, W, H, x0, x1, y0, y1);
  // Contour extérieur : l'ombre profonde de la matière voisine.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (material[i]) continue;
      let best: Material | null = null;
      let rank = Infinity;
      const consider = (j: number) => {
        const m = material[j];
        if (!m) return;
        const r = OUTLINE_PRIORITY.indexOf(m);
        if (r < rank) {
          rank = r;
          best = m;
        }
      };
      if (x + 1 < W) consider(i + 1);
      if (x > 0) consider(i - 1);
      if (y + 1 < H) consider(i + W);
      if (y > 0) consider(i - W);
      if (best) final[i] = RAMP_SLOTS[best as Material].deep;
    }
  }
  return final;
}

/** Couleurs réelles d'un joueur du style en volumes : rampes de 5 tons. */
export interface AthleteColors {
  skin: Ramp5;
  hair: Ramp5;
  primary: Ramp5;
  secondary: Ramp5;
}

export function athleteColors(skin: number, hairColor: number, primary: string | number, secondary: string | number): AthleteColors {
  return { skin: SKIN_RAMPS[skin], hair: HAIR_RAMPS[hairColor], primary: teamRamp5(primary), secondary: teamRamp5(secondary) };
}

export function athleteSlotColor(slot: Slot, c: AthleteColors): number {
  switch (slot) {
    case '0':
      return c.skin[0];
    case '1':
      return c.skin[1];
    case '2':
      return c.skin[2];
    case '3':
      return c.skin[3];
    case '4':
      return c.skin[4];
    case 'r':
      return c.hair[0];
    case 'h':
      return c.hair[1];
    case 'H':
      return c.hair[2];
    case 'D':
      return c.hair[3];
    case 'E':
      return c.hair[4];
    case 'a':
      return c.primary[0];
    case 'p':
      return c.primary[1];
    case 'P':
      return c.primary[2];
    case 'q':
      return c.primary[3];
    case 'Q':
      return c.primary[4];
    case 's':
      return c.secondary[1];
    case 'S':
      return c.secondary[2];
    case 't':
      return c.secondary[3];
    case 'T':
      return c.secondary[4];
    case 'w':
      return PALETTE.chalk;
    case 'm':
      return PALETTE.mist;
    case 'G':
      return PALETTE.slate;
    case 'k':
      return PALETTE.ink;
    case 'o':
    case 'n':
      return PALETTE.outline;
  }
}
