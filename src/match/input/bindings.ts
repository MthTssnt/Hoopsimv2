/** Actions du joueur contrôlé et touches associées (codes clavier, comme Phaser). */
export type Action = 'up' | 'down' | 'left' | 'right' | 'shoot' | 'pass' | 'steal';

export const ACTIONS: Action[] = ['up', 'left', 'down', 'right', 'shoot', 'pass', 'steal'];

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Monter (vers le fond)',
  down: 'Descendre (vers soi)',
  left: 'Gauche',
  right: 'Droite',
  shoot: 'Tir / Saut',
  pass: 'Passe (défense : changer de joueur)',
  steal: 'Interception (incrément 9)',
};

export interface KeyBinding {
  /** Code clavier (`KeyboardEvent.keyCode`), celui qu'utilise Phaser. */
  code: number;
  /** Nom affiché. */
  label: string;
}

export type Bindings = Record<Action, KeyBinding>;

/** Touches classiques d'un clavier AZERTY : ZQSD + Espace, E passe, A interception (choix de Matheo). */
export const DEFAULT_BINDINGS: Bindings = {
  up: { code: 90, label: 'Z' },
  left: { code: 81, label: 'Q' },
  down: { code: 83, label: 'S' },
  right: { code: 68, label: 'D' },
  shoot: { code: 32, label: 'Espace' },
  pass: { code: 69, label: 'E' },
  steal: { code: 65, label: 'A' },
};

const NAMED_KEYS: Record<string, string> = {
  ' ': 'Espace',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Shift: 'Maj',
  Control: 'Ctrl',
  Enter: 'Entrée',
};

/** Nom lisible d'une touche à partir d'un événement clavier. */
export function keyLabel(key: string): string {
  if (NAMED_KEYS[key]) return NAMED_KEYS[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

/** Affecte une touche à une action ; si elle servait déjà ailleurs, les deux actions échangent. */
export function rebind(bindings: Bindings, action: Action, binding: KeyBinding): Bindings {
  const next = { ...bindings };
  const other = ACTIONS.find((a) => a !== action && bindings[a].code === binding.code);
  if (other) next[other] = bindings[action];
  next[action] = binding;
  return next;
}
