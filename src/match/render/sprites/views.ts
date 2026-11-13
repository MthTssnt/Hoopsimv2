/** Cadre commun aux feuilles officielles : marge haute pour les bras levés. */
export const FRAME = { width: 96, height: 96, centerX: 48, groundY: 84 } as const;
export type Facing = 'right' | 'left';
export type Heading = 'down' | 'up';
export type AnimationName = 'idle' | 'run' | 'dribble' | 'dribbleIdle' | 'shoot' | 'dunk' | 'start' | 'brake' | 'pivot' | 'defense' | 'shuffle' | 'backpedal';
export const SHEET_VIEWS: readonly { facing: Facing; heading: Heading }[] = [
  { facing: 'right', heading: 'down' }, { facing: 'left', heading: 'down' },
  { facing: 'right', heading: 'up' }, { facing: 'left', heading: 'up' },
];
export const seenFromBehind = (heading: Heading): boolean => heading === 'up';

/** Détail natif du dessin ; les dimensions du terrain restent exprimées en pixels logiques. */
export const SPRITE_DETAIL = 2;
