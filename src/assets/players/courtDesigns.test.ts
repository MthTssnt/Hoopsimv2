/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COURT_DESIGNS, playerScale } from './courtDesigns';
import { ACTION_RECTS } from './actions';
import { OFFICIAL_LAYOUT } from '../../match/render/sprites/layout';
import { GESTURES, GESTURE_STEPS } from '../../match/render/sprites/layout';
import { FRAME } from '../../match/render/sprites/views';

describe('designs de joueurs sur le terrain', () => {
  it('chaque découpe est contenue dans son véritable PNG, y compris les rangées irrégulières', () => {
    ['team-navy.png', 'team-ivory.png'].forEach((name, team) => {
      const png = readFileSync(new URL(name, import.meta.url));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      expect(COURT_DESIGNS[team]).toHaveLength(5);
      for (const design of COURT_DESIGNS[team]) {
        expect(design.frames).toHaveLength(4);
        for (const rect of design.frames) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.width).toBeGreaterThan(0);
          expect(rect.height).toBeGreaterThan(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(width);
          expect(rect.y + rect.height).toBeLessThanOrEqual(height);
        }
      }
    });
  });

  it('tous les gabarits tiennent dans le cadre de jeu, sans couper les pieds ni les bras de course', () => {
    for (const design of COURT_DESIGNS.flat()) for (const heavy of [false, true]) for (const heightCm of [175, 186, 200, 212, 225]) {
      const scale = playerScale(heightCm, heavy, design);
      for (const rect of design.frames) {
        expect(Math.round(rect.width * scale.x), design.name).toBeLessThan(FRAME.width);
        expect(Math.round(rect.height * scale.y), design.name).toBeLessThan(FRAME.height);
      }
    }
    const design = COURT_DESIGNS[0][0];
    expect(playerScale(212, false, design).height).toBeGreaterThan(playerScale(186, false, design).height);
    expect(playerScale(200, true, design).x).toBeGreaterThan(playerScale(200, false, design).x);
    expect(playerScale(200, true, design).height).toBe(playerScale(200, false, design).height);
  });

  it('les poses de tir, passe et saut sont découpées dans leur PNG et tiennent dans le cadre', () => {
    for (const [team, name] of ['actions-navy.png', 'actions-ivory.png'].entries()) {
      const png = readFileSync(new URL(name, import.meta.url));
      for (const [variant, actions] of ACTION_RECTS[team].entries()) for (const rect of actions) {
        expect(rect.x + rect.width).toBeLessThanOrEqual(png.readUInt32BE(16));
        expect(rect.y + rect.height).toBeLessThanOrEqual(png.readUInt32BE(20));
        const scale = playerScale(225, true, COURT_DESIGNS[team][variant]);
        expect(Math.round(rect.width * scale.x)).toBeLessThan(FRAME.width);
        expect(Math.round(rect.height * scale.y)).toBeLessThan(FRAME.height);
      }
    }
  });

  it('les états du vrai match trouvent toujours une image dans la feuille de prévisualisation', () => {
    for (const animation of Object.values(OFFICIAL_LAYOUT.animations)) for (const frame of animation.frames) expect(frame).toBeLessThan(OFFICIAL_LAYOUT.framesPerBlock);
    for (const gesture of GESTURES) {
      expect(OFFICIAL_LAYOUT.gestures[gesture]).toHaveLength(GESTURE_STEPS[gesture]);
      for (const frame of OFFICIAL_LAYOUT.gestures[gesture]) expect(frame).toBeLessThan(OFFICIAL_LAYOUT.framesPerBlock);
    }
  });
});
