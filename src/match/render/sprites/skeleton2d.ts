/**
 * Squelette des joueurs du rendu 2D : les articulations sont posées par des angles à chaque image
 * (`Pose2D`), dans le repère du corps (x : droite du joueur, y : devant, z : haut ; unités : pixels
 * avant projection), puis tournées selon la position (diagonale bas ou haut, toujours tourné vers
 * la droite ; vers la gauche, l'image est retournée) et projetées à plat avec une légère plongée.
 * Pur, sans Phaser.
 */
import type { Expression } from '../../../assets/sprites/heads';
import { buildFor, type Heading } from './rig';
import { add, lerp, normalize, rotX, rotY, rotZ, scale, sub, type Vec3 } from './vec3';

/** Plongée de la caméra (rad) : le pied le plus loin est dessiné un peu plus haut. */
export const PITCH_2D = 0.3;

/** Mesures du corps (px avant projection), proportions arcade-athlétiques : tête ~1/4, grands bras et jambes. */
export interface Build2D {
  /** Hauteur de la cheville au-dessus de la semelle, pied à plat. */
  ankleZ: number;
  shin: number;
  thigh: number;
  /** Demi-écart des hanches. */
  hipW: number;
  /** Demi-largeur de la taille et des épaules (torse en V). */
  waistW: number;
  shoulderW: number;
  /** Demi-épaisseur du torse (devant / dos). */
  chestDepth: number;
  /** Hauteurs au-dessus du bassin : taille, épaules, base du cou. */
  waistZ: number;
  shoulderZ: number;
  neckZ: number;
  upperArm: number;
  foreArm: number;
  hand: number;
  /** Chaussure : devant et derrière la cheville. */
  footLen: number;
  heelLen: number;
  /** Demi-largeurs des membres, qui s'affinent : cuisse > genou > mollet > cheville, épaule > coude > avant-bras > poignet. */
  r: {
    shorts: number;
    shortsHem: number;
    knee: number;
    calf: number;
    ankle: number;
    deltoid: number;
    biceps: number;
    elbow: number;
    forearm: number;
    wrist: number;
    palm: number;
    neck: number;
    shoe: number;
  };
}

const AILIER: Build2D = {
  ankleZ: 2.4,
  shin: 9.0,
  thigh: 7.6,
  hipW: 2.6,
  waistW: 3.7,
  shoulderW: 7.4,
  chestDepth: 3.0,
  waistZ: 1.2,
  shoulderZ: 11.2,
  neckZ: 12.4,
  upperArm: 7.0,
  foreArm: 6.0,
  hand: 3.4,
  footLen: 5.6,
  heelLen: 1.6,
  r: {
    shorts: 3.2,
    shortsHem: 2.6,
    knee: 1.9,
    calf: 2.25,
    ankle: 1.2,
    deltoid: 2.2,
    biceps: 1.85,
    elbow: 1.3,
    forearm: 1.5,
    wrist: 1.0,
    palm: 1.5,
    neck: 1.6,
    shoe: 1.7,
  },
};

/** Mesures selon la taille et la corpulence ; la tête ne change jamais. Meneur ≈ −3 px, pivot ≈ +3 px. */
export function build2D(heightCm: number, heavy: boolean): Build2D {
  const build = buildFor(heightCm);
  let b: Build2D = { ...AILIER, r: { ...AILIER.r } };
  if (build === 'meneur') b = { ...b, shin: 8.0, thigh: 6.8, shoulderZ: 10.4, neckZ: 11.6, upperArm: 6.4, foreArm: 5.5 };
  if (build === 'pivot') b = { ...b, shin: 10.0, thigh: 8.4, shoulderZ: 12.0, neckZ: 13.2, shoulderW: 8.0, waistW: 4.0, upperArm: 7.6, foreArm: 6.5 };
  if (heavy) {
    b = { ...b, waistW: b.waistW + 1.2, shoulderW: b.shoulderW + 0.6, chestDepth: b.chestDepth + 0.6, hipW: b.hipW + 0.4 };
    b.r = { ...b.r, shorts: b.r.shorts + 0.4, shortsHem: b.r.shortsHem + 0.3, calf: b.r.calf + 0.3, biceps: b.r.biceps + 0.25, forearm: b.r.forearm + 0.2 };
  }
  return b;
}

/** Jambe : cuisse vers l'avant (`hip`, rad), genou plié vers l'arrière (`knee`), pointe relevée (`foot`), écart (`out`). */
export interface Leg2D {
  hip: number;
  knee: number;
  foot?: number;
  out?: number;
}

/** Bras : vers l'avant (`pitch`, rad ; ~2,8 = levé), écarté (`abd`), coude plié vers l'avant (`elbow`), poignet (`wrist`). */
export interface Arm2D {
  pitch: number;
  abd: number;
  elbow: number;
  wrist?: number;
}

/** Bas du corps : jambes, descente du bassin, envol. */
export interface Lower2D {
  /** [gauche du joueur, droite du joueur]. */
  legs: readonly [Leg2D, Leg2D];
  /** Descente du bassin (px) en plus de la flexion des jambes. */
  bob?: number;
  /** Tout le corps au-dessus du sol (px) : suspension, saut. */
  lift?: number;
  /**
   * Bassin tourné vers la caméra (rad, ≤ `TWIST_2D`), les épaules ne bougent pas : à l'arrêt, les
   * pieds s'écartent de face au lieu d'être l'un derrière l'autre.
   */
  face?: number;
}

/** Haut du corps : bras, buste, écrasement / étirement, expression. */
export interface Upper2D {
  /** [gauche du joueur, droite du joueur]. */
  arms: readonly [Arm2D, Arm2D];
  /** Buste penché vers l'avant (rad). */
  lean?: number;
  /** Épaules tournées (rad, vers la gauche du joueur si positif). */
  turn?: number;
  /** Écrasement (< 0) ou étirement (> 0) du torse, en px. */
  stretch?: number;
  /**
   * Épaules tournées vers le jeu (rad, ≤ `TWIST_2D`) : elles annulent la contre-rotation vers la
   * caméra, et le geste (tir, passe, vol) part vers le panier ou le receveur, de côté, au lieu de
   * partir vers la caméra (où un bras tendu se raccourcit et passe devant le visage).
   */
  square?: number;
  /** Le haut du corps monte ou descend en plus du bassin (px) : respiration. */
  rise?: number;
  expression?: Expression;
}

export type Pose2D = Lower2D & Upper2D;

/** Articulations d'une image, dans le monde (après la position et la mise au sol). */
export interface Joints {
  pelvis: Vec3;
  hips: [Vec3, Vec3];
  knees: [Vec3, Vec3];
  /** Centre du mollet (décalé vers l'arrière de la jambe). */
  calves: [Vec3, Vec3];
  ankles: [Vec3, Vec3];
  /** Points de la chaussure (enveloppe), par pied. */
  shoes: [Vec3[], Vec3[]];
  /** Haut de la chaussette, par jambe. */
  sockTops: [Vec3, Vec3];
  /** Ourlet du short, par jambe. */
  shortsHems: [Vec3, Vec3];
  /** Enveloppe du torse (peau, trapèzes compris) et du maillot. */
  torso: Vec3[];
  jersey: Vec3[];
  /** Encolure du maillot (gauche, bas, droite). */
  collar: [Vec3, Vec3, Vec3];
  /** Enveloppe du short (bassin) et sa ceinture (gauche, devant, droite). */
  shorts: Vec3[];
  waistband: [Vec3, Vec3, Vec3];
  shoulders: [Vec3, Vec3];
  biceps: [Vec3, Vec3];
  elbows: [Vec3, Vec3];
  forearms: [Vec3, Vec3];
  wrists: [Vec3, Vec3];
  palms: [Vec3, Vec3];
  fingertips: [Vec3, Vec3];
  neckBase: Vec3;
  neckTop: Vec3;
  /** Point de la poitrine (ou du dos) où se pose le numéro. */
  chestFront: Vec3;
  chestBack: Vec3;
  /** Axes du haut du corps dans le monde : avant, droite, haut. */
  fwd: Vec3;
  side: Vec3;
  up: Vec3;
}

const DOWN: Vec3 = [0, 0, -1];

/**
 * Rotation du bassin et des jambes par rapport à la caméra (rad) : ~63° vers la droite, pour que
 * les foulées se voient en biais.
 */
export const TURN_2D = 1.1;
/**
 * Les épaules se contre-tournent vers la caméra (rad) : le torse paraît presque de face (ou de dos)
 * et le numéro reste lisible. C'est un choix de dessin, comme dans les jeux 2D en 3/4.
 */
export const TWIST_2D = 0.5;

/**
 * Angle du corps (rad) : tourné vers la droite, vers la caméra (diagonale bas) ou vers le fond
 * (diagonale haut). Dans les deux cas, le côté droit du joueur est le plus proche.
 */
export function yaw2D(heading: Heading): number {
  return heading === 'down' ? -(Math.PI - TURN_2D) : -TURN_2D;
}

/** Articulations posées et tournées ; le point le plus bas des semelles touche le sol (z = 0), plus `lift`. */
export function joints2D(b: Build2D, pose: Pose2D, heading: Heading): Joints {
  const pelvis: Vec3 = [0, 0, b.ankleZ + b.shin + b.thigh - (pose.bob ?? 0)];
  const pick = <T>(f: (side: -1 | 1, i: 0 | 1) => T): [T, T] => [f(-1, 0), f(1, 1)];

  // Jambes.
  const legs = pick((side, i) => {
    const L = pose.legs[i];
    const out = L.out ?? 0.06;
    const hip = add(pelvis, [side * b.hipW, 0, -0.4]);
    const d1 = rotX(rotY(DOWN, -side * out), L.hip);
    const knee = add(hip, scale(d1, b.thigh));
    const d2 = rotX(rotY(DOWN, -side * out), L.hip - L.knee);
    const ankle = add(knee, scale(d2, b.shin));
    // Arrière de la jambe, dans le plan de la foulée : le mollet y fait saillie.
    const back = normalize([0, d2[2], -d2[1]]);
    const calf = add(add(knee, scale(d2, b.shin * 0.32)), scale(back, 0.55));
    const f = rotX([0, 1, 0], L.foot ?? 0);
    const fd = rotX(DOWN, L.foot ?? 0);
    const s: Vec3 = [b.r.shoe, 0, 0];
    const sole = (along: number, up: number): Vec3 => add(add(ankle, scale(f, along)), scale(fd, b.ankleZ - up));
    const shoe = [
      sole(-b.heelLen, 0),
      sole(b.footLen, 0),
      sole(b.footLen - 0.3, 1.9),
      sole(b.footLen * 0.45, 2.6),
      sole(-b.heelLen * 0.6, 3.4),
      sole(-b.heelLen, 1.6),
    ].flatMap((p) => [add(p, s), sub(p, s)]);
    return { hip, knee, ankle, calf, shoe, sockTop: add(ankle, scale(d2, -2.4)), hem: add(hip, scale(d1, b.thigh * 1.04)) };
  });

  // Haut du corps : penché et tourné autour du bassin, écrasé ou étiré au-dessus de la taille.
  const stretch = pose.stretch ?? 0;
  // Contre-rotation des épaules : vers la caméra en diagonale bas, dos vers la caméra en diagonale haut.
  // `face` tourne le bassin du même côté, sans bouger les épaules ; `square` ramène les épaules vers le jeu.
  const towardCamera = heading === 'down' ? -1 : 1;
  const face = pose.face ?? 0;
  const turn = (pose.turn ?? 0) + towardCamera * (TWIST_2D - face - (pose.square ?? 0));
  const lean = pose.lean ?? 0;
  const rise: Vec3 = [0, 0, pose.rise ?? 0];
  const k = 1 + stretch / (b.neckZ - b.waistZ);
  const body = (x: number, y: number, z: number): Vec3 => {
    const zz = z > b.waistZ ? b.waistZ + (z - b.waistZ) * k : z;
    return add(add(pelvis, rotX(rotZ([x, y, zz], turn), -lean)), rise);
  };
  // rotX(·, −lean) : un `lean` positif amène le haut du corps vers l'avant (+y).
  const dir = (v: Vec3): Vec3 => rotX(rotZ(v, turn), -lean);
  const fwd = dir([0, 1, 0]);
  const side = dir([1, 0, 0]);
  const up = dir([0, 0, 1]);
  const D = b.chestDepth;
  const both = (x: number, y: number, z: number): Vec3[] => [body(-x, y, z), body(x, y, z), body(-x, -y, z), body(x, -y, z)];
  const torso = [
    ...both(b.waistW, D * 0.8, b.waistZ),
    ...both(b.waistW + 0.7, D, b.waistZ + 4.2),
    ...both(b.shoulderW - 1.0, D, b.shoulderZ - 3.0),
    ...both(b.shoulderW, D * 0.65, b.shoulderZ),
    ...both(2.0, D * 0.4, b.neckZ - 0.2),
  ];
  const jersey = [
    ...both(b.waistW + 0.4, D * 0.85, b.waistZ - 0.2),
    ...both(b.waistW + 0.9, D + 0.2, b.waistZ + 4.2),
    ...both(b.shoulderW - 1.5, D + 0.2, b.shoulderZ - 3.2),
    ...both(b.shoulderW - 2.3, D * 0.7, b.shoulderZ + 0.3),
    ...both(1.9, D * 0.5, b.neckZ - 0.6),
  ];
  const collar: [Vec3, Vec3, Vec3] = [body(-1.9, D * 0.55, b.neckZ - 0.6), body(0, D + 0.15, b.neckZ - 1.8), body(1.9, D * 0.55, b.neckZ - 0.6)];
  const shorts = [
    ...both(b.waistW + 0.6, D * 0.9, b.waistZ + 0.4),
    ...[-1, 1].flatMap((s) => [add(pelvis, [s * (b.hipW + 2.2), D * 0.9, -1.2]), add(pelvis, [s * (b.hipW + 2.2), -D * 0.9, -1.2])]),
    add(pelvis, [0, D * 0.6, -3.6]),
    add(pelvis, [0, -D * 0.6, -3.6]),
  ];
  const waistband: [Vec3, Vec3, Vec3] = [body(-(b.waistW + 0.6), D * 0.7, b.waistZ + 0.4), body(0, D * 0.95, b.waistZ + 0.4), body(b.waistW + 0.6, D * 0.7, b.waistZ + 0.4)];

  // Bras.
  const arms = pick((s, i) => {
    const A = pose.arms[i];
    const shoulder = body(s * (b.shoulderW - 0.7), 0, b.shoulderZ - 1.0);
    const d1 = dir(rotX(rotY(DOWN, -s * A.abd), A.pitch));
    const elbow = add(shoulder, scale(d1, b.upperArm));
    const d2 = dir(rotX(rotY(DOWN, -s * A.abd), A.pitch + A.elbow));
    const wrist = add(elbow, scale(d2, b.foreArm));
    const d3 = dir(rotX(rotY(DOWN, -s * A.abd), A.pitch + A.elbow + (A.wrist ?? 0)));
    return {
      shoulder,
      biceps: lerp(shoulder, elbow, 0.4),
      elbow,
      forearm: add(lerp(elbow, wrist, 0.38), scale(side, s * 0.25)),
      wrist,
      palm: add(wrist, scale(d3, b.hand * 0.45)),
      tip: add(wrist, scale(d3, b.hand)),
    };
  });

  const neckBase = body(0, 0.2, b.neckZ - 0.8);
  const neckTop = body(0, 0.5, b.neckZ + 1.0);
  const chestFront = body(0, D + 0.2, b.shoulderZ - 5.4);
  const chestBack = body(0, -(D + 0.2), b.shoulderZ - 5.4);

  // Monde : position (rotation verticale), puis mise au sol de la semelle la plus basse.
  const yaw = yaw2D(heading) + towardCamera * face;
  const turnW = (p: Vec3): Vec3 => rotZ(p, yaw);
  const allShoes = [...legs[0].shoe, ...legs[1].shoe].map(turnW);
  const ground = -Math.min(...allShoes.map((p) => p[2])) + (pose.lift ?? 0);
  const W = (p: Vec3): Vec3 => add(turnW(p), [0, 0, ground]);
  const pair = <T>(f: (k: 0 | 1) => T): [T, T] => [f(0), f(1)];
  return {
    pelvis: W(pelvis),
    hips: pair((k2) => W(legs[k2].hip)),
    knees: pair((k2) => W(legs[k2].knee)),
    calves: pair((k2) => W(legs[k2].calf)),
    ankles: pair((k2) => W(legs[k2].ankle)),
    shoes: pair((k2) => legs[k2].shoe.map(W)),
    sockTops: pair((k2) => W(legs[k2].sockTop)),
    shortsHems: pair((k2) => W(legs[k2].hem)),
    torso: torso.map(W),
    jersey: jersey.map(W),
    collar: collar.map(W) as [Vec3, Vec3, Vec3],
    shorts: shorts.map(W),
    waistband: waistband.map(W) as [Vec3, Vec3, Vec3],
    shoulders: pair((k2) => W(arms[k2].shoulder)),
    biceps: pair((k2) => W(arms[k2].biceps)),
    elbows: pair((k2) => W(arms[k2].elbow)),
    forearms: pair((k2) => W(arms[k2].forearm)),
    wrists: pair((k2) => W(arms[k2].wrist)),
    palms: pair((k2) => W(arms[k2].palm)),
    fingertips: pair((k2) => W(arms[k2].tip)),
    neckBase: W(neckBase),
    neckTop: W(neckTop),
    chestFront: W(chestFront),
    chestBack: W(chestBack),
    fwd: turnW(fwd),
    side: turnW(side),
    up: turnW(up),
  };
}

/** Point à l'écran (px non arrondis) et proximité de la caméra (plus grand = plus près). */
export interface Screen {
  x: number;
  y: number;
  near: number;
}

/**
 * Projection à plat (repère du monde : X vers la droite de l'écran, Y vers le fond, Z vers le
 * haut) : x = X ; y = sol − Z·cos(plongée) − Y·sin(plongée).
 */
export function project2D(p: Vec3, originX: number, groundY: number): Screen {
  const c = Math.cos(PITCH_2D);
  const s = Math.sin(PITCH_2D);
  return { x: originX + p[0], y: groundY - p[2] * c - p[1] * s, near: -p[1] * c + p[2] * s };
}

