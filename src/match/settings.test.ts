import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, keyLabel, rebind } from './input/bindings';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('paramètres du match', () => {
  it('reprend les valeurs par défaut si rien n’est sauvegardé ou si la sauvegarde est illisible', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{pas du json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });

  it('garde les champs valides et remplace les autres', () => {
    const saved = JSON.stringify({
      shotMode: 'realPct',
      shotSpeed: 'turbo',
      level: 'college',
      camera: 'steps',
      bindings: { shoot: { code: 74, label: 'J' }, up: { code: 'Z' } },
    });
    const s = parseSettings(saved);
    expect(s.shotMode).toBe('realPct');
    expect(s.shotSpeed).toBe(DEFAULT_SETTINGS.shotSpeed);
    expect(s.level).toBe('college');
    expect(s.camera).toBe('steps');
    expect(s.bindings.shoot).toEqual({ code: 74, label: 'J' });
    expect(s.bindings.up).toEqual(DEFAULT_BINDINGS.up);
    // Réglages sauvegardés avant la passe : les nouvelles touches prennent leur valeur par défaut.
    expect(s.bindings.pass).toEqual(DEFAULT_BINDINGS.pass);
    expect(s.bindings.steal).toEqual(DEFAULT_BINDINGS.steal);
    // Sauvegarde d'avant le 5 contre 5 : quart-temps de 3 min ; une durée hors liste aussi.
    expect(s.quarterMinutes).toBe(3);
    expect(parseSettings(JSON.stringify({ quarterMinutes: 5 })).quarterMinutes).toBe(5);
    expect(parseSettings(JSON.stringify({ quarterMinutes: 7 })).quarterMinutes).toBe(3);
  });

  it('ZQSD + Espace par défaut, E passe, A interception', () => {
    const b = DEFAULT_SETTINGS.bindings;
    expect([b.up.label, b.left.label, b.down.label, b.right.label, b.shoot.label]).toEqual(['Z', 'Q', 'S', 'D', 'Espace']);
    expect([b.pass.label, b.steal.label]).toEqual(['E', 'A']);
  });

  it('échange deux actions quand on réutilise une touche déjà prise', () => {
    const next = rebind(DEFAULT_BINDINGS, 'shoot', DEFAULT_BINDINGS.up);
    expect(next.shoot).toEqual(DEFAULT_BINDINGS.up);
    expect(next.up).toEqual(DEFAULT_BINDINGS.shoot);
  });

  it('nomme les touches lisiblement', () => {
    expect(keyLabel(' ')).toBe('Espace');
    expect(keyLabel('z')).toBe('Z');
    expect(keyLabel('ArrowLeft')).toBe('←');
  });
});
