/**
 * Poses du rendu 2D (`figure2d.ts`) : angles des articulations image par image.
 * Mécanique juste, poses clés exagérées : course penchée vers l'avant (jamais vers l'arrière),
 * bras opposés aux jambes, coudes à ~90°, rebond du corps, écrasement / étirement de 1-2 px.
 * Pur, sans Phaser.
 */
import type { Arm2D, Leg2D, Pose2D } from './skeleton2d';

export interface Frame2D {
  pose: Pose2D;
  ms: number;
}

export type Anim2D = 'idle' | 'run';

/** Arrêt : posture athlétique (pieds à la largeur des épaules, genoux fléchis, buste un peu penché), respiration d'1 px. */
function idle(): Frame2D[] {
  const legs: [Leg2D, Leg2D] = [
    { hip: 0.42, knee: 0.85, out: 0.3 },
    { hip: 0.38, knee: 0.8, out: 0.3 },
  ];
  const arms = (breath: number): [Arm2D, Arm2D] => [
    { pitch: 0.16 - breath * 0.05, abd: 0.18, elbow: 0.4 },
    { pitch: 0.18 - breath * 0.05, abd: 0.24, elbow: 0.55 },
  ];
  return [0, 1].map((breath) => ({
    pose: { legs, arms: arms(breath), lean: 0.14, stretch: breath ? 1 : 0, face: 0.45 },
    ms: 400,
  }));
}

/**
 * Une foulée (4 phases) pour la jambe d'appui et la jambe libre : contact (talon devant), amorti
 * (genou qui absorbe, corps au plus bas), passage (genou libre qui monte), envol (poussée, genou
 * haut). L'autre foulée échange les jambes.
 */
const STRIDE: readonly { support: Leg2D; swing: Leg2D; bob: number; lift: number; stretch: number }[] = [
  // contact
  { support: { hip: 0.62, knee: 0.22, foot: 0.12 }, swing: { hip: -0.5, knee: 1.35, foot: -0.55 }, bob: 0, lift: 0, stretch: 0 },
  // amorti
  { support: { hip: 0.3, knee: 0.85, foot: 0 }, swing: { hip: -0.15, knee: 2.0, foot: -0.75 }, bob: 1.2, lift: 0, stretch: -0.9 },
  // passage
  { support: { hip: -0.05, knee: 0.5, foot: -0.05 }, swing: { hip: 0.65, knee: 1.95, foot: -0.4 }, bob: 0.3, lift: 0, stretch: 0 },
  // envol
  { support: { hip: -0.55, knee: 0.3, foot: -0.85 }, swing: { hip: 1.0, knee: 1.45, foot: -0.1 }, bob: 0, lift: 1.6, stretch: 0.9 },
];

/** Course : 8 images (deux foulées), 45 ms chacune : le cycle de 360 ms des sprites actuels. */
function run(): Frame2D[] {
  const lean = 0.32;
  return Array.from({ length: 8 }, (_, f) => {
    const s = STRIDE[f % 4];
    // Foulée 1 : la jambe droite (1) est en appui ; foulée 2 : la gauche.
    const right = f < 4;
    const legs: [Leg2D, Leg2D] = right ? [s.swing, s.support] : [s.support, s.swing];
    // Bras opposés aux jambes, avec une image de retard (suivi) : le bras gauche est devant quand
    // la jambe droite pose le talon.
    const phase = ((f - 1) / 8) * Math.PI * 2;
    const swing = Math.cos(phase);
    const arm = (k: number): Arm2D => ({ pitch: 0.2 + 0.85 * k, abd: 0.14, elbow: 1.45 + 0.25 * k });
    const arms: [Arm2D, Arm2D] = [arm(swing), arm(-swing)];
    return {
      pose: { legs, arms, lean, turn: -0.06 * swing, bob: s.bob, lift: s.lift, stretch: s.stretch },
      ms: 45,
    };
  });
}

export function poses2D(anim: Anim2D): Frame2D[] {
  return anim === 'idle' ? idle() : run();
}
