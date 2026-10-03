import { describe, expect, it } from 'vitest';
import { controlledInput, ShotButton, type ShooterState } from './control';

const ground: ShooterState = { airborne: false, holding: true, shooting: false };
const air: ShooterState = { airborne: true, holding: true, shooting: false };

describe('bouton Tir', () => {
  it('un appui au sol part tout de suite', () => {
    const b = new ShotButton();
    expect(b.step(true, true, ground)).toBe(true);
    expect(b.step(false, true, ground)).toBe(false);
  });

  it('un appui en l’air (retombée de rebond, ballon en main) part à l’atterrissage si Tir est tenu', () => {
    const b = new ShotButton();
    expect(b.step(true, true, air)).toBe(false);
    expect(b.step(false, true, air)).toBe(false);
    expect(b.step(false, true, ground)).toBe(true);
    expect(b.step(false, true, ground)).toBe(false);
  });

  it('relâché avant d’atterrir : rien', () => {
    const b = new ShotButton();
    b.step(true, true, air);
    expect(b.step(false, false, air)).toBe(false);
    expect(b.step(false, false, ground)).toBe(false);
  });

  it('un appui qui a servi à sauter (sans ballon) n’est pas gardé', () => {
    const b = new ShotButton();
    expect(b.step(true, true, { airborne: false, holding: false, shooting: false })).toBe(true);
    // Il prend le rebond en l'air et retombe, Tir toujours tenu : pas de tir surprise.
    expect(b.step(false, true, air)).toBe(false);
    expect(b.step(false, true, ground)).toBe(false);
  });

  it('en attente, mais retombé sans le ballon : rien tant qu’il ne l’a pas', () => {
    const b = new ShotButton();
    b.step(true, true, { airborne: true, holding: false, shooting: false });
    expect(b.step(false, true, { airborne: false, holding: false, shooting: false })).toBe(false);
    expect(b.step(false, true, ground)).toBe(true);
  });
});

describe('défense automatique', () => {
  const mine = { x: 0, y: 0, jump: false };
  const ai = { x: 0.6, y: -0.8, jump: true, steal: true };

  it('en défense, sans toucher aux commandes : le déplacement de l’IA, sans saut ni vol', () => {
    expect(controlledInput(mine, ai, true, true)).toEqual({ x: 0.6, y: -0.8, jump: false });
  });

  it('dès que tu touches une commande, ou en attaque : tes entrées', () => {
    const moving = { x: 1, y: 0, jump: false };
    expect(controlledInput(moving, ai, true, false)).toBe(moving);
    expect(controlledInput(mine, ai, false, true)).toBe(mine);
  });
});
