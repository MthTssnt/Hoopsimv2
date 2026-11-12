export const MOTIONS = [
  { id: 'idle', label: 'À l’arrêt', count: 4, ms: 1000, loop: true },
  { id: 'run', label: 'Course', count: 8, ms: 600, loop: true },
  { id: 'dribble', label: 'Dribble en course', count: 8, ms: 600, loop: true },
  { id: 'dribbleIdle', label: 'Dribble sur place', count: 8, ms: 600, loop: true },
  { id: 'jumpShot', label: 'Tir en suspension', count: 4, ms: 800, loop: false },
  { id: 'layup', label: 'Layup', count: 4, ms: 800, loop: false },
  { id: 'dunk', label: 'Dunk', count: 4, ms: 800, loop: false },
  { id: 'block', label: 'Contre — main forte', count: 4, ms: 650, loop: false },
  { id: 'blockOff', label: 'Contre — autre main', count: 4, ms: 650, loop: false },
  { id: 'rebound', label: 'Rebond', count: 4, ms: 800, loop: false },
  { id: 'tipoff', label: 'Entre-deux', count: 4, ms: 700, loop: false },
  { id: 'pass', label: 'Passe à deux mains', count: 4, ms: 600, loop: false },
  { id: 'lobPass', label: 'Passe lobée', count: 4, ms: 700, loop: false },
  { id: 'catch', label: 'Réception de passe', count: 4, ms: 600, loop: false },
  { id: 'freeThrow', label: 'Lancer franc', count: 4, ms: 1100, loop: false },
  { id: 'landing', label: 'Réception au sol', count: 4, ms: 500, loop: false },
  { id: 'steal', label: 'Interception', count: 4, ms: 500, loop: false },
  { id: 'offBalance', label: 'Déséquilibre', count: 4, ms: 650, loop: false },
] as const;
export type MotionId = (typeof MOTIONS)[number]['id'];
export interface Point { x: number; y: number }
export interface MotionPose { height: number; ball: Point | null; palm: Point | null; contact: boolean }

/** Phase libre du rebond, entre le dernier contact descendant et la reprise dans la paume. */
export function dribbleFlightY(frame: number, releaseY: number, catchY: number, floorY: number): number | null {
  if (frame <= 1 || frame >= 6) return null;
  if (frame <= 4) {
    const t = (frame - 1) / 3;
    return releaseY + (floorY - releaseY) * t * t;
  }
  const t = (frame - 4) / 2;
  return floorY - (floorY - catchY) * (2 * t - t * t);
}

/** Même trajectoire à l'atelier et en match ; interpoler la balle sans interpoler les pixels du corps. */
export function dribbleBallAt(phase: number, anchors: readonly (Point | null)[], floorY: number): Point | null {
  const frame = ((phase % 1 + 1) % 1) * 8, index = Math.floor(frame), t = frame - index;
  const a = anchors[index], b = anchors[(index + 1) % 8];
  if (!a || !b) return a ?? b ?? null;
  const release = anchors[1], caught = anchors[6];
  const flight = release && caught ? dribbleFlightY(frame, release.y, caught.y, floorY) : null;
  // Pendant le vol, x rejoint la paume au lieu de suivre les marqueurs supprimés du ballon.
  const k = Math.max(0, Math.min(1, (frame - 1) / 5));
  return { x: flight !== null && release && caught ? release.x + (caught.x - release.x) * k : a.x + (b.x - a.x) * t,
    y: flight ?? a.y + (b.y - a.y) * t };
}
