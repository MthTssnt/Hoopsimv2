import { describe, expect, it } from 'vitest';
import { generateAppearance, normalizeAppearance, type PlayerAppearance } from './appearance';
import { composeHead } from './composeHead';
import { CATEGORIES, partIds, partOf, REGISTRY, type Category } from './registry';
import { EXPRESSIONS, VIEWS, type Grid, type View } from './types';

const BASE: PlayerAppearance = {
  version: 1,
  headShape: 'normale',
  skin: 'mat',
  ears: 'normales',
  eyes: 'points',
  brows: 'doux',
  nose: 'bouton',
  mouth: 'fine',
  facialHair: null,
  hair: 'ebouriffe',
  colors: { hair: 'brun', facialHair: 'brun', eyes: 'brun-fonce', accessory: 'equipe' },
  accessories: [],
};

/** Applique une pièce d'une catégorie à l'apparence de base. */
function withPart(category: Category, id: string, base: PlayerAppearance = BASE): PlayerAppearance {
  switch (category) {
    case 'headShapes':
      return { ...base, headShape: id };
    case 'noses':
      return { ...base, nose: id };
    case 'mouths':
      return { ...base, mouth: id };
    case 'accessories':
      return { ...base, accessories: [id] };
    default:
      return { ...base, [category]: id };
  }
}

/** Emplacements permis par catégorie (voir `types.ts`). */
const ALLOWED: Record<Category, string> = {
  headShapes: 'x',
  ears: '15234',
  eyes: 'inw15234',
  brows: 'DE',
  noses: '15234',
  mouths: '15234w',
  facialHair: 'fbBF',
  hair: 'rhHDE03',
  accessories: 'cCdK',
};

function grids(category: Category, part: unknown): Grid[] {
  const p = part as Record<string, unknown>;
  if (category === 'headShapes') return VIEWS.map((v) => ({ at: [0, 0], rows: partOf('headShapes', (p as { id: string }).id).views[v].skull }));
  const out: Grid[] = [];
  const walk = (v: unknown) => {
    if (v && typeof v === 'object') {
      if ('rows' in v && 'at' in v) out.push(v as Grid);
      else Object.values(v).forEach(walk);
    }
  };
  walk(p.views ?? p.expressions ?? p.grid);
  if (p.grid) walk(p.grid);
  if (p.loose) walk(p.loose);
  return out;
}

const pixelsOf = (rows: readonly string[]) => rows.flatMap((r, y) => [...r].map((c, x) => [x, y, c] as const)).filter(([, , c]) => c !== '.');
const diff = (a: readonly string[], b: readonly string[]) => {
  let n = Math.abs(a.length - b.length) * 8;
  for (let y = 0; y < Math.min(a.length, b.length); y++) for (let x = 0; x < Math.max(a[y].length, b[y].length); x++) if ((a[y][x] ?? '.') !== (b[y][x] ?? '.')) n++;
  return n;
};

describe('registre des pièces', () => {
  it('chaque catégorie a 3 à 4 variantes au moins (13 coiffures), identifiants uniques', () => {
    for (const category of CATEGORIES) {
      const ids = partIds(category);
      expect(ids.length, category).toBeGreaterThanOrEqual(category === 'hair' ? 13 : 3);
      expect(new Set(ids).size, category).toBe(ids.length);
    }
  });

  it('les grilles sont rectangulaires et n’utilisent que les emplacements de leur catégorie', () => {
    for (const category of CATEGORIES) {
      for (const { part } of REGISTRY[category] as { part: { id: string } }[]) {
        for (const g of grids(category, part)) {
          for (const row of g.rows) {
            expect(row.length, `${category}/${part.id}`).toBe(g.rows[0].length);
            for (const c of row) expect(c === '.' || ALLOWED[category].includes(c), `${category}/${part.id} « ${c} »`).toBe(true);
          }
        }
      }
    }
  });

  it('yeux, sourcils et bouches : les 4 expressions, qui changent le visage', () => {
    for (const category of ['eyes', 'brows', 'mouths'] as const) {
      for (const id of partIds(category)) {
        const part = partOf(category, id);
        expect(Object.keys(part.expressions).sort(), `${category}/${id}`).toEqual([...EXPRESSIONS].sort());
        const faces = EXPRESSIONS.map((e) => composeHead(withPart(category, id), 'down', e).rows.join('/'));
        expect(new Set(faces).size, `${category}/${id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('chaque forme de tête définit ses ancrages dans les deux orientations, à l’intérieur du crâne pour le visage', () => {
    for (const id of partIds('headShapes')) {
      for (const view of VIEWS) {
        const { skull, anchors } = partOf('headShapes', id).views[view];
        if (view === 'down') for (const name of ['eyeNear', 'eyeFar', 'browNear', 'browFar', 'nose', 'mouth', 'cheek', 'chin', 'neck'] as const) expect(skull[anchors[name][1]]?.[anchors[name][0]], `${id} ${name}`).toBe('x');
        expect(skull[anchors.neck[1]]?.[anchors.neck[0]], `${id} ${view} cou`).toBe('x');
      }
    }
  });
});

describe('composition de la tête', () => {
  it('une catégorie changée à la fois : chaque variante se voit (au moins 3 pixels d’écart, de face)', () => {
    for (const category of CATEGORIES) {
      const ids = partIds(category);
      const heads = ids.map((id) => composeHead(withPart(category, id, category === 'ears' ? { ...BASE, hair: 'rase' } : BASE), 'down').rows);
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(diff(heads[i], heads[j]), `${category} ${ids[i]} / ${ids[j]}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('de dos, les pièces du visage sont masquées : yeux, sourcils, nez, bouche et expression ne changent rien', () => {
    const ref = composeHead(BASE, 'up').rows;
    for (const category of ['eyes', 'brows', 'noses', 'mouths'] as const) for (const id of partIds(category)) expect(composeHead(withPart(category, id), 'up').rows, `${category}/${id}`).toEqual(ref);
    for (const e of EXPRESSIONS) expect(composeHead(BASE, 'up', e).rows).toEqual(ref);
    expect(ref.join('')).not.toMatch(/[inw]/);
  });

  it('les sourcils ne sont jamais couverts par les mèches, sur toutes les formes et coiffures', () => {
    for (const shape of partIds('headShapes')) {
      for (const hair of partIds('hair')) {
        for (const brows of partIds('brows')) {
          for (const e of EXPRESSIONS) {
            const look = { ...BASE, headShape: shape, hair, brows };
            const head = composeHead(look, 'down', e);
            const bare = composeHead({ ...look, hair: 'chauve' }, 'down', e);
            // Pixels de sourcils de la tête chauve (même cadrage : on compare par rapport au cou).
            const at = (h: typeof head, x: number, y: number) => h.rows[y - bare.neck.y + h.neck.y]?.[x - bare.neck.x + h.neck.x];
            const browPx = pixelsOf(bare.rows).filter(([x, y, c]) => (c === 'D' || c === 'E') && composeHead({ ...look, hair: 'chauve', brows: partIds('brows').find((b) => b !== brows)! }, 'down', e).rows[y]?.[x] !== c);
            for (const [x, y, c] of browPx) expect(at(head, x, y), `${shape} ${hair} ${brows} ${e} ${x},${y}`).toBe(c);
          }
        }
      }
    }
  });

  it('la bouche passe devant la pilosité', () => {
    for (const facialHair of partIds('facialHair')) {
      for (const mouth of partIds('mouths')) {
        for (const e of EXPRESSIONS) {
          const shaved = composeHead({ ...BASE, mouth }, 'down', e);
          const bearded = composeHead({ ...BASE, mouth, facialHair }, 'down', e);
          const mouthPx = pixelsOf(shaved.rows).filter(([x, y, c]) => '4w'.includes(c) && composeHead({ ...BASE, mouth: partIds('mouths').find((m) => m !== mouth)! }, 'down', e).rows[y]?.[x] !== c);
          for (const [x, y, c] of mouthPx) expect(bearded.rows[y - shaved.neck.y + bearded.neck.y]?.[x - shaved.neck.x + bearded.neck.x], `${facialHair} ${mouth} ${e}`).toBe(c);
        }
      }
    }
  });

  it('la pilosité reste sur la peau et se voit de face (barbe et collier aussi de dos)', () => {
    for (const facialHair of partIds('facialHair')) {
      const down = composeHead({ ...BASE, facialHair }, 'down').rows.join('');
      expect((down.match(/[fbBF]/g) ?? []).length, facialHair).toBeGreaterThanOrEqual(3);
    }
    for (const facialHair of ['barbe', 'collier']) expect(composeHead({ ...BASE, hair: 'chauve', facialHair }, 'up').rows.join('')).toMatch(/[bB]/);
  });

  it('oreilles : visibles sous une coiffure courte, couvertes par une coiffure couvrante', () => {
    for (const view of VIEWS) {
      const short = composeHead({ ...BASE, hair: 'rase', ears: 'decollees' }, view).rows;
      expect(diff(short, composeHead({ ...BASE, hair: 'rase', ears: 'petites' }, view).rows), view).toBeGreaterThan(0);
      const covered = (ears: string) => composeHead({ ...BASE, hair: 'longs', ears }, view).rows;
      if (view === 'up') expect(covered('normales')).toEqual(covered('petites'));
    }
  });

  it('l’accessoire passe par-dessus les cheveux, découpé sur la tête', () => {
    for (const view of VIEWS) {
      for (const id of partIds('accessories')) {
        const rows = composeHead({ ...BASE, accessories: [id] }, view).rows;
        expect((rows.join('').match(/[cCdK]/g) ?? []).length, `${id} ${view}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('les pièces suivent les ancrages : une forme au menton plus bas descend la barbe', () => {
    const bottom = (shape: string) => {
      const h = composeHead({ ...BASE, headShape: shape, facialHair: 'barbe' }, 'down');
      return Math.max(...pixelsOf(h.rows).filter(([, , c]) => 'bB'.includes(c)).map(([, y]) => y)) - h.neck.y;
    };
    expect(bottom('longue')).toBe(bottom('normale') + 1);
  });

  it('déterministe, et en cache sans effet de bord', () => {
    const a = composeHead(BASE, 'down', 'joie');
    expect(composeHead({ ...BASE }, 'down', 'joie')).toEqual(a);
  });
});

describe('apparence sérialisable', () => {
  const seed = (i: number) => ({ id: `joueur-${i}`, age: 20 + (i % 15), skin: i % 4, hairColor: i % 5 });

  it('tirée de l’identifiant : même identifiant, même apparence ; pièces connues du registre', () => {
    for (let i = 0; i < 50; i++) {
      const a = generateAppearance(seed(i));
      expect(generateAppearance(seed(i))).toEqual(a);
      expect(normalizeAppearance(a, seed(i))).toEqual(a);
    }
  });

  it('JSON aller-retour sans perte ; une donnée abîmée est réparée pièce par pièce', () => {
    const a = generateAppearance(seed(3));
    expect(normalizeAppearance(JSON.parse(JSON.stringify(a)), seed(3))).toEqual(a);
    const edited = { ...a, hair: 'afro', eyes: 'inconnus', colors: { ...a.colors, eyes: 'violet' } };
    const fixed = normalizeAppearance(edited, seed(3));
    expect(fixed.hair).toBe('afro');
    expect(fixed.eyes).toBe(a.eyes);
    expect(fixed.colors.eyes).toBe(a.colors.eyes);
    expect(normalizeAppearance('n’importe quoi', seed(3))).toEqual(a);
    expect(normalizeAppearance({ ...a, facialHair: null }, seed(3)).facialHair).toBeNull();
  });

  it('variété : chaque pièce et chaque couleur sortent au tirage, au moins 95 % d’apparences distinctes', () => {
    const all = Array.from({ length: 600 }, (_, i) => generateAppearance({ id: `v-${i}`, age: 19 + (i % 18) }));
    const seen = (key: (a: PlayerAppearance) => string | null | string[]) => new Set(all.flatMap((a) => key(a) ?? []));
    expect(seen((a) => a.headShape).size).toBe(partIds('headShapes').length);
    expect(seen((a) => a.ears).size).toBe(partIds('ears').length);
    expect(seen((a) => a.eyes).size).toBe(partIds('eyes').length);
    expect(seen((a) => a.brows).size).toBe(partIds('brows').length);
    expect(seen((a) => a.nose).size).toBe(partIds('noses').length);
    expect(seen((a) => a.mouth).size).toBe(partIds('mouths').length);
    expect(seen((a) => a.facialHair).size).toBe(partIds('facialHair').length);
    expect(seen((a) => a.hair).size).toBe(partIds('hair').length);
    expect(seen((a) => a.accessories).size).toBe(partIds('accessories').length);
    expect(seen((a) => a.colors.eyes).size).toBe(5);
    expect(seen((a) => a.colors.hair).size).toBe(6);
    // Barbe grise sur cheveux bruns : la pilosité a sa propre couleur.
    expect(all.some((a) => a.facialHair && a.colors.facialHair !== a.colors.hair)).toBe(true);
    const shaved = all.filter((a) => !a.facialHair).length / all.length;
    expect(shaved).toBeGreaterThan(0.5);
    expect(new Set(all.slice(0, 200).map((a) => JSON.stringify(a))).size).toBeGreaterThanOrEqual(190);
  });

  it('les deux orientations se composent pour toute apparence tirée', () => {
    for (let i = 0; i < 40; i++) {
      const a = generateAppearance(seed(i));
      for (const view of ['down', 'up'] as View[]) {
        const h = composeHead(a, view);
        expect(h.rows.length).toBeGreaterThanOrEqual(10);
        expect(h.rows[h.neck.y]?.[h.neck.x]).toBeDefined();
      }
    }
  });
});
