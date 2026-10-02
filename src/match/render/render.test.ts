import { describe, expect, it } from 'vitest';
import { createNewGame, TEAM_SEEDS } from '../../engine';
import { DEPTH_SCALE, HEIGHT_SCALE, PIXELS_PER_METER, VIEW_WIDTH, WORLD_HEIGHT, WORLD_MARGIN, WORLD_WIDTH } from '../config';
import { COURT_LENGTH, COURT_WIDTH, RIM_HEIGHT } from '../physics/court';
import { drawSmallText, drawText, hasGlyph, hasSmallGlyph, normalizeText, smallTextWidth, textWidth } from './pixelFont';
import { MATCH_PROJECTION, project } from './projection';

describe('projection 3/4', () => {
  it('écrase la profondeur et la hauteur d’environ 2/3 par rapport à la longueur', () => {
    const origin = project(10, 5, 0);
    expect(project(11, 5, 0).x - origin.x).toBe(PIXELS_PER_METER);
    expect(project(10, 6, 0).y - origin.y).toBeCloseTo(DEPTH_SCALE * PIXELS_PER_METER, 9);
    expect(origin.y - project(10, 5, 1).y).toBeCloseTo(HEIGHT_SCALE * PIXELS_PER_METER, 9);
  });

  it('à 22,5 px/m : toute la profondeur du terrain en ~226 px, le cercle à ~47 px du sol', () => {
    expect(PIXELS_PER_METER).toBe(22.5);
    expect(project(0, COURT_WIDTH).y - project(0, 0).y).toBeCloseTo(226.3, 0);
    expect(project(5, 5, 0).y - project(5, 5, RIM_HEIGHT).y).toBeCloseTo(46.7, 0);
    // 480 px de large : ~21 m de terrain visibles, comme dans `?style`.
    expect(VIEW_WIDTH / PIXELS_PER_METER).toBeCloseTo(21.3, 1);
  });

  it('donne au terrain et aux paniers la projection exacte du monde', () => {
    for (const [x, y, z] of [[0, 0, 0], [14.3, 7.6, 0], [26.4, 7.6, 3.05], [-2, -1.6, 0]]) {
      expect(MATCH_PROJECTION.project(x, y, z)).toEqual(project(x, y, z));
    }
    // Le monde contient tout le terrain et ses marges.
    expect(project(COURT_LENGTH + WORLD_MARGIN, COURT_WIDTH + WORLD_MARGIN).x).toBeLessThanOrEqual(WORLD_WIDTH);
    expect(project(COURT_LENGTH + WORLD_MARGIN, COURT_WIDTH + WORLD_MARGIN).y).toBeLessThanOrEqual(WORLD_HEIGHT + 1e-9);
  });
});

describe('police pixel', () => {
  it('a un glyphe pour chaque caractère des noms d’équipes et de joueurs', () => {
    const names = [
      ...TEAM_SEEDS.flatMap((t) => [t.city, t.name, t.abbr]),
      ...Object.values(createNewGame('bos', 3).players).map((p) => `${p.firstName.charAt(0)}. ${p.lastName}`),
    ];
    const missing = new Set<string>();
    for (const name of names) for (const char of normalizeText(name)) if (!hasGlyph(char)) missing.add(char);
    expect([...missing]).toEqual([]);
  });

  it('a un petit glyphe 3×5 pour chaque nom de famille généré, à la largeur annoncée', () => {
    const names = Object.values(createNewGame('bos', 3).players).map((p) => p.lastName);
    const missing = new Set<string>();
    for (const name of names) for (const char of normalizeText(name)) if (!hasSmallGlyph(char)) missing.add(char);
    expect([...missing]).toEqual([]);
    expect(smallTextWidth('AB')).toBe(7);
    expect(smallTextWidth('MW')).toBe(11);
    let right = 0;
    drawSmallText({ fillRect: (x) => void (right = Math.max(right, x + 1)) }, 'HAYES', 0, 0);
    expect(right).toBe(smallTextWidth('HAYES'));
  });

  it('ramène les accents à la lettre de base et mesure le texte', () => {
    expect(normalizeText('Détroit Nouvelle-Orléans')).toBe('DETROIT NOUVELLE-ORLEANS');
    expect(textWidth('AB')).toBe(11);
    expect(textWidth('AB', 2)).toBe(22);
  });

  it('dessine à l’horizontale comme à la verticale, dans la même emprise', () => {
    const pixels = (rotate: 0 | 90 | -90) => {
      const set: string[] = [];
      drawText({ fillRect: (x, y) => void set.push(`${x},${y}`) }, 'HI', 0, 0, 1, rotate);
      return set;
    };
    const flat = pixels(0);
    const down = pixels(90);
    const up = pixels(-90);
    expect(down.length).toBe(flat.length);
    expect(up.length).toBe(flat.length);
    const maxY = (list: string[]) => Math.max(...list.map((p) => Number(p.split(',')[1])));
    // Le texte vertical occupe la longueur du texte horizontal (dernière colonne du « I » vide).
    expect(maxY(down)).toBeLessThanOrEqual(textWidth('HI') - 1);
    expect(maxY(down)).toBeGreaterThan(textWidth('H'));
  });
});
