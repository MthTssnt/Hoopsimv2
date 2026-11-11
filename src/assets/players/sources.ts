import navy from './team-navy.png';
import ivory from './team-ivory.png';
import manifest from './painted/manifest.json';

export interface PaintedFrame {
  x: number; y: number; width: number; height: number; left: number; top: number;
  ball: { x: number; y: number } | null;
  number: { x: number; y: number };
  contact: boolean;
}
export interface PaintedAtlas { team: number; variant: number; heading: string; file: string; frames: PaintedFrame[] }
export const PAINTED_ATLASES: PaintedAtlas[] = manifest;
/** Repères logiques du dessin source, indépendants de la marge du cadre de rendu. */
export const PAINTED_ORIGIN = { x: 40, y: 84 } as const;
const urls = import.meta.glob<string>('./painted/*.png', { eager: true, query: '?url', import: 'default' });
/** Les personnages complets sont peints ; aucune pièce anatomique n'est tournée ou reconstruite. */
export const PLAYER_SOURCES: string[] = [navy, ivory, ...PAINTED_ATLASES.map((atlas) => urls[`./painted/${atlas.file}`])];
