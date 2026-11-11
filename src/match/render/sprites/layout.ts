/** Disposition commune des 84 poses officielles, déclinées dans quatre orientations. */
import { SHEET_VIEWS, type Facing, type Heading, type AnimationName } from './views';
import { MOTIONS, type MotionId } from './motion';

export interface AnimationDef {
  frames: readonly number[];
  durations: readonly number[];
  loop: boolean;
}

/**
 * Gestes : chacun a ses propres images, jouées selon l'état du monde (phase du saut, temps
 * écoulé depuis la passe…), jamais par une horloge fixe.
 * - `jumpShot` : ramassage, montée, lâcher (col de cygne), retombée ;
 * - `layup` : deuxième appui, envol (genou côté main forte), extension vers le cercle, après le lâcher ;
 * - `dunk` : ramassage, armé derrière la tête, smash, accroche au cercle ;
 * - `block` / `blockOff` : impulsion, verticalité d'une main (la main forte, ou l'autre) ;
 * - `rebound` : deux mains hautes, ballon sous le menton ;
 * - `tipoff` : un bras tendu au maximum ;
 * - `pass` : armé à la poitrine, bras tendus pouces vers le bas ;
 * - `lobPass` : ballon au-dessus de la tête, bras qui fouettent ;
 * - `catch` : mains en cible devant la poitrine ;
 * - `freeThrow` : mise en place, point de déclenchement, lâcher sur la pointe des pieds, bras tenu ;
 * - `landing` : genoux fléchis à la réception ;
 * - `steal` : main tendue basse vers le ballon, bras qui revient ;
 * - `offBalance` : buste rejeté, bras écartés, un pied levé.
 */
export type Gesture =
  | 'jumpShot'
  | 'layup'
  | 'dunk'
  | 'block'
  | 'blockOff'
  | 'rebound'
  | 'tipoff'
  | 'pass'
  | 'lobPass'
  | 'catch'
  | 'freeThrow'
  | 'landing'
  | 'steal'
  | 'offBalance';

export const GESTURES: readonly Gesture[] = ['jumpShot', 'layup', 'dunk', 'block', 'blockOff', 'rebound', 'tipoff', 'pass', 'lobPass', 'catch', 'freeThrow', 'landing', 'steal', 'offBalance'];

/** Chaque geste dispose de quatre images originales complètes. */
export const GESTURE_STEPS = Object.fromEntries(GESTURES.map((g) => [g, 4])) as Record<Gesture, number>;

export interface SheetLayout {
  framesPerBlock: number;
  animations: Readonly<Record<AnimationName, AnimationDef>>;
  /** Images de chaque geste dans le bloc, dans l'ordre de ses étapes (`GESTURE_STEPS`). */
  gestures: Readonly<Record<Gesture, readonly number[]>>;
}

/** Toutes les images sont distinctes dans la feuille : aucune animation n'emprunte celles d'une autre. */
export const RUN_CYCLE_MS = 600;
export const MOTION_FRAMES: { motion: MotionId; frame: number }[] = [];
export const MOTION_INDICES = {} as Record<MotionId, number[]>;
for (const motion of MOTIONS) {
  MOTION_INDICES[motion.id] = [];
  for (let frame = 0; frame < motion.count; frame++) {
    MOTION_INDICES[motion.id].push(MOTION_FRAMES.length);
    MOTION_FRAMES.push({ motion: motion.id, frame });
  }
}
const animation = (id: MotionId): AnimationDef => {
  const def = MOTIONS.find((m) => m.id === id)!;
  return { frames: MOTION_INDICES[id], durations: Array.from({ length: def.count }, () => def.ms / def.count), loop: def.loop };
};
export const OFFICIAL_LAYOUT: SheetLayout = {
  framesPerBlock: MOTION_FRAMES.length,
  animations: { idle: animation('idle'), run: animation('run'), dribble: animation('dribble'), dribbleIdle: animation('dribbleIdle'), shoot: animation('jumpShot'), dunk: animation('dunk') },
  gestures: Object.fromEntries(GESTURES.map((g) => [g, MOTION_INDICES[g]])) as Record<Gesture, number[]>,
};

/** Image d'un geste à l'étape `step` (bornée à la dernière). */
export function gestureFrame(layout: SheetLayout, gesture: Gesture, step: number): number {
  const frames = layout.gestures[gesture];
  return frames[Math.min(frames.length - 1, Math.max(0, step))];
}

/** Indice d'une image dans la feuille : bloc de la position, puis image dans le bloc. */
export function sheetIndexIn(layout: SheetLayout, frame: number, facing: Facing, heading: Heading): number {
  const block = SHEET_VIEWS.findIndex((v) => v.facing === facing && v.heading === heading);
  return block * layout.framesPerBlock + frame;
}

/** Nombre d'images d'une feuille (4 blocs). */
export function sheetFrameCount(layout: SheetLayout): number {
  return layout.framesPerBlock * SHEET_VIEWS.length;
}
