/** Cadre commun aux feuilles officielles : marge haute pour les bras levés. */
export const FRAME = { width: 64, height: 80, centerX: 32, groundY: 79 } as const;
export type Facing = 'right' | 'left';
export type Heading = 'down' | 'up';
export type AnimationName = 'idle' | 'run' | 'dribble' | 'dribbleIdle' | 'shoot' | 'dunk';
export const SHEET_VIEWS: readonly { facing: Facing; heading: Heading }[] = [
  { facing: 'right', heading: 'down' }, { facing: 'left', heading: 'down' },
  { facing: 'right', heading: 'up' }, { facing: 'left', heading: 'up' },
];
export const seenFromBehind = (heading: Heading): boolean => heading === 'up';
