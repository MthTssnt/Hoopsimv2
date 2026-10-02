import type { ShotZone } from '../../engine/shot';
import { distanceToRim, isThreePoint, RIM_HEIGHT, type Court, type Hoop, type Vec3 } from '../physics/court';

/** Mesures du tir côté `match/` (valeurs provisoires, réglables). */
export const SHOT_FLOW = {
  /** Un tir pris à moins de cette distance du cercle (m) est un tir « près du cercle ». */
  rimRange: 2.5,
  /** Layup : le joueur attaque le cercle, à moins de cette distance (m)… */
  layupRange: 3,
  /** …en courant au moins à cette vitesse (m/s)… */
  layupMinSpeed: 2.5,
  /** …vers le cercle, à moins de cet angle de sa direction (degrés). */
  layupMaxAngle: 60,
  /** Le layup vise un point devant le cercle (m, côté terrain), jamais sous la planche. */
  layupFinish: 0.7,
  /** Élan d'un layup (m/s au plus) : le joueur finit son mouvement vers le cercle. */
  layupMaxSpeed: 4,
  /** Main qui lâche le ballon : au-dessus de la tête (fraction de la taille). */
  releaseHeight: 1.15,
  /** Un tir ne part jamais de derrière la planche ni de sous le cercle : écart minimal devant le cercle (m)… */
  minFront: 0.5,
  /** …quand le joueur est dans la largeur de la planche (demi-largeur + marge, m). */
  boardShadow: 1.1,
  /** Dunk : le joueur arrive au sommet à cette distance devant le cercle (m)… */
  dunkFinish: 0.35,
  /** …jamais plus près de la ligne de fond que ça, mesuré dans l'axe du terrain (m)… */
  dunkMinFront: 0.2,
  /** …avec un élan d'au plus (m/s). */
  dunkMaxSpeed: 6,
  /** Au sommet d'un dunk, la main dépasse le cercle d'au moins (m). */
  dunkClearance: 0.15,
  /** Accroché au cercle après un dunk réussi (s). */
  dunkHang: 0.3,
} as const;

/** Panier visé : le plus proche (au 7a, ce sera le panier attaqué). */
export function targetHoop(court: Court, x: number): Hoop {
  return x < court.length / 2 ? court.hoops.left : court.hoops.right;
}

/** Zone d'un tir pris depuis (x, y) : près du cercle, mi-distance ou 3 pts selon la ligne du niveau. */
export function shotZone(court: Court, hoop: Hoop, x: number, y: number): ShotZone {
  if (distanceToRim(hoop, x, y) <= SHOT_FLOW.rimRange) return 'rim';
  return isThreePoint(court, hoop, x, y) ? 'three' : 'mid';
}

/** Le joueur attaque-t-il le cercle (près de lui, en courant, dans sa direction) ? */
export function attacksRim(pos: Vec3, vel: Vec3, hoop: Hoop): boolean {
  const dx = hoop.rim.x - pos.x;
  const dy = hoop.rim.y - pos.y;
  const dist = Math.hypot(dx, dy);
  const speed = Math.hypot(vel.x, vel.y);
  if (dist > SHOT_FLOW.layupRange || speed < SHOT_FLOW.layupMinSpeed || dist < 1e-6) return false;
  const cos = (vel.x * dx + vel.y * dy) / (speed * dist);
  return cos >= Math.cos((SHOT_FLOW.layupMaxAngle * Math.PI) / 180);
}

/**
 * Point à `distance` du cercle sur la ligne joueur → cercle, ramené à au moins `minFront`
 * devant le cercle dans l'axe du terrain (venu de la ligne de fond, on finit quand même devant).
 */
function finishPoint(pos: Vec3, hoop: Hoop, distance: number, minFront: number): { x: number; y: number } {
  const { rim, toCourt } = hoop;
  const dx = pos.x - rim.x;
  const dy = pos.y - rim.y;
  const len = Math.hypot(dx, dy) || 1;
  let x = rim.x + (dx / len) * distance;
  const y = rim.y + (dy / len) * distance;
  if ((x - rim.x) * toCourt < minFront) x = rim.x + toCourt * minFront;
  return { x, y };
}

/** Point d'arrivée d'un layup : devant le cercle, sur la ligne joueur → cercle, côté terrain. */
export function layupFinish(pos: Vec3, hoop: Hoop): { x: number; y: number } {
  return finishPoint(pos, hoop, SHOT_FLOW.layupFinish, SHOT_FLOW.minFront);
}

/** Point atteint au sommet d'un dunk : tout près du cercle, côté terrain, jamais sous la planche. */
export function dunkFinish(pos: Vec3, hoop: Hoop): { x: number; y: number } {
  return finishPoint(pos, hoop, SHOT_FLOW.dunkFinish, SHOT_FLOW.dunkMinFront);
}

/** Hauteur de saut d'un dunk : la sienne, relevée si besoin pour que la main dépasse le cercle. */
export function dunkJumpHeight(jumpHeight: number, reach: number): number {
  return Math.max(jumpHeight, RIM_HEIGHT + SHOT_FLOW.dunkClearance - reach);
}

/**
 * Point de départ du ballon : la main au-dessus de la tête, ramenée devant le cercle si le
 * joueur est sous lui ou derrière la planche (aucune trajectoire n'en part).
 */
export function releasePoint(pos: Vec3, heightCm: number, hoop: Hoop, handDepth: number): Vec3 {
  const { rim, toCourt } = hoop;
  let x = pos.x;
  const y = pos.y + handDepth;
  const behind = (x - rim.x) * toCourt < SHOT_FLOW.minFront && Math.abs(y - rim.y) <= SHOT_FLOW.boardShadow;
  if (behind) x = rim.x + toCourt * SHOT_FLOW.minFront;
  return { x, y, z: pos.z + (heightCm / 100) * SHOT_FLOW.releaseHeight };
}
