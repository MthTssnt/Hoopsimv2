import { describe, expect, it } from 'vitest';
import { createNewGame, TEAM_SEEDS } from '../../engine';
import { DEPTH_SCALE, HEIGHT_SCALE, PIXELS_PER_METER } from '../config';
import { COURT_WIDTH, RIM_HEIGHT } from '../physics/court';
import { drawText, hasGlyph, normalizeText, textWidth } from './pixelFont';
import { project, screenHeight } from './projection';

describe('projection 3/4', () => {
  it('écrase la profondeur et la hauteur d’environ 2/3 par rapport à la longueur', () => {
    const origin = project(10, 5, 0);
    expect(project(11, 5, 0).x - origin.x).toBe(PIXELS_PER_METER);
    expect(project(10, 6, 0).y - origin.y).toBeCloseTo(DEPTH_SCALE * PIXELS_PER_METER, 9);
    expect(origin.y - project(10, 5, 1).y).toBeCloseTo(HEIGHT_SCALE * PIXELS_PER_METER, 9);
  });

  it('montre toute la profondeur du terrain en ~200 px, le cercle à ~41 px du sol, un joueur de 2 m à ~27 px', () => {
    expect(project(0, COURT_WIDTH).y - project(0, 0).y).toBeCloseTo(201, 0);
    expect(screenHeight(RIM_HEIGHT)).toBeCloseTo(41.5, 0);
    expect(screenHeight(2)).toBeCloseTo(27.2, 0);
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
