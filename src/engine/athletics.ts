import type { Athlete } from './shot';

/**
 * Grandeurs physiques du match joué, déduites des attributs et du gabarit.
 * Valeurs provisoires, réglables ici (pas de mesures Hoop Land pour l'instant).
 */
export const ATHLETICS_TUNING = {
  /** Vitesse de course (m/s) d'un joueur moyen : 2 m, poids attendu, vitesse et force à 64. */
  run: { base: 6, speedSlope: 0.035, heightSlope: 0.012, extraKgSlope: 0.02, strengthSlope: 0.005, bounds: [4.5, 8] },
  /** Hauteur de saut (m) d'un joueur moyen, détente à 64. */
  jump: { base: 0.55, verticalSlope: 0.006, heightSlope: 0.002, extraKgSlope: 0.004, speedSlope: 0.001, bounds: [0.3, 1] },
  /** Hauteur de main bras levés, en proportion de la taille. */
  reachRatio: 1.33,
} as const;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Kilos au-dessus du poids attendu pour la taille. */
function extraKg(p: Athlete): number {
  return p.weightKg - (p.heightCm - 100) * 1.02;
}

/** Vitesse de course (m/s) : les petits et les légers vont plus vite, la force compense un peu. */
export function runSpeed(p: Athlete): number {
  const t = ATHLETICS_TUNING.run;
  const v =
    t.base +
    (p.attrs.speed - 64) * t.speedSlope -
    (p.heightCm - 200) * t.heightSlope -
    extraKg(p) * t.extraKgSlope +
    (p.attrs.strength - 64) * t.strengthSlope;
  return clamp(v, t.bounds[0], t.bounds[1]);
}

/** Hauteur de saut (m) : détente surtout, puis taille, poids et vitesse. */
export function jumpHeight(p: Athlete): number {
  const t = ATHLETICS_TUNING.jump;
  const h =
    t.base +
    (p.attrs.vertical - 64) * t.verticalSlope -
    (p.heightCm - 200) * t.heightSlope -
    extraKg(p) * t.extraKgSlope +
    (p.attrs.speed - 64) * t.speedSlope;
  return clamp(h, t.bounds[0], t.bounds[1]);
}

/** Hauteur de la main bras levés, pieds au sol (m). */
export function reach(p: Athlete): number {
  return (p.heightCm / 100) * ATHLETICS_TUNING.reachRatio;
}
