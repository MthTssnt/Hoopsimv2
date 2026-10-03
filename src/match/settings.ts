import type { ShotMode, ShotSpeed } from '../engine/shot';
import { ACTIONS, DEFAULT_BINDINGS, type Bindings } from './input/bindings';
import type { CourtLevel } from './physics/court';

/** Caméra : zoom continu, ou par paliers (pour juger le scintillement du pixel-art). */
export type CameraMode = 'free' | 'steps';

export interface MatchSettings {
  bindings: Bindings;
  shotMode: ShotMode;
  shotSpeed: ShotSpeed;
  level: CourtLevel;
  camera: CameraMode;
  /** Durée d'un quart-temps sur terrain entier (min de chrono réel). */
  quarterMinutes: number;
}

/** Durées de quart-temps proposées (min). */
export const QUARTER_MINUTES = [1, 2, 3, 5, 8, 12] as const;

export const DEFAULT_SETTINGS: MatchSettings = {
  bindings: DEFAULT_BINDINGS,
  shotMode: 'timing',
  shotSpeed: 'normal',
  level: 'pro',
  camera: 'free',
  quarterMinutes: 3,
};

const STORAGE_KEY = 'hoopsim.match.settings.v1';

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Relit des paramètres sauvegardés : tout champ absent ou invalide reprend sa valeur par défaut. */
export function parseSettings(raw: string | null): MatchSettings {
  let data: Partial<Record<keyof MatchSettings, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object') data = parsed as typeof data;
  } catch {
    /* sauvegarde illisible : valeurs par défaut */
  }
  const savedBindings = (data.bindings && typeof data.bindings === 'object' ? data.bindings : {}) as Partial<Bindings>;
  const bindings = { ...DEFAULT_BINDINGS };
  for (const action of ACTIONS) {
    const b = savedBindings[action];
    if (b && typeof b.code === 'number' && typeof b.label === 'string') bindings[action] = { code: b.code, label: b.label };
  }
  return {
    bindings,
    shotMode: pick(data.shotMode, ['timing', 'realPct'], DEFAULT_SETTINGS.shotMode),
    shotSpeed: pick(data.shotSpeed, ['slow', 'normal', 'fast'], DEFAULT_SETTINGS.shotSpeed),
    level: pick(data.level, ['pro', 'college'], DEFAULT_SETTINGS.level),
    camera: pick(data.camera, ['free', 'steps'], DEFAULT_SETTINGS.camera),
    quarterMinutes: (QUARTER_MINUTES as readonly unknown[]).includes(data.quarterMinutes) ? (data.quarterMinutes as number) : DEFAULT_SETTINGS.quarterMinutes,
  };
}

export function loadSettings(): MatchSettings {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseSettings(null);
  }
}

export function saveSettings(settings: MatchSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* stockage indisponible (navigation privée…) : réglages gardés pour la session seulement */
  }
}
