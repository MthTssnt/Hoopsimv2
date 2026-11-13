import measured from '../../../assets/players/painted/contacts.json';
import { FRAME } from './views';

export interface PoseContact {
  ball: { x: number; y: number } | null;
  palm: { x: number; y: number } | null;
  contact: boolean;
  behind: boolean;
  /** Native cropped-source scanlines: [y, x, length]. No color guess at runtime. */
  fingers: number[][];
}
export const POSE_CONTACTS: { file: string; frames: PoseContact[] }[] = measured;

/** Source logical coordinates -> rendered logical coordinates, shared by mask/anchors/tests. */
export function contactPoint(point: { x: number; y: number }, sx: number, sy: number, mirror: boolean) {
  const x = FRAME.centerX + (point.x - 40) * sx;
  return { x: mirror ? FRAME.width - x : x, y: FRAME.groundY + (point.y - 84) * sy };
}
