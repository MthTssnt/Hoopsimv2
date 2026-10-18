/** Petits calculs de vecteurs 3D (squelette des joueurs). Pur. */

export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));
/** Mélange linéaire de a (t = 0) vers b (t = 1). */
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
/** Rotation autour de l'axe vertical (z). */
export const rotZ = (a: Vec3, t: number): Vec3 => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t), a[2]];
/** Rotation autour de l'axe x (pencher vers l'avant : y monte vers z). */
export const rotX = (a: Vec3, t: number): Vec3 => [a[0], a[1] * Math.cos(t) - a[2] * Math.sin(t), a[1] * Math.sin(t) + a[2] * Math.cos(t)];
/** Rotation autour de l'axe y. */
export const rotY = (a: Vec3, t: number): Vec3 => [a[0] * Math.cos(t) + a[2] * Math.sin(t), a[1], -a[0] * Math.sin(t) + a[2] * Math.cos(t)];
