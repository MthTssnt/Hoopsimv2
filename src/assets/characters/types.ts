/**
 * Système de pièces des personnages (style 5, « rétro peint ») : types communs.
 *
 * Une tête se compose de pièces, une par catégorie (forme de tête, oreilles, yeux, sourcils, nez,
 * bouche, pilosité, cheveux, accessoires). Chaque pièce est une donnée pure : des grilles de
 * pixels posées par rapport à un ancrage de la forme de tête, jamais en coordonnées absolues.
 *
 * Repère : celui du crâne de la forme de tête, x vers le visage (le personnage regarde vers la
 * droite), y vers le bas. Une grille `{ at, rows }` a son coin haut-gauche à `ancrage + at`.
 *
 * Caractères des grilles : « . » transparent, sinon un emplacement de couleur (`Slot` de
 * `canvas.ts`), recoloré à la cuisson avec les rampes de 5 tons du style :
 *   peau     1 reflet · 5 clair · 2 base · 3 ombre · 4 ombre profonde (· 0 brillance du crâne)
 *   cheveux  r reflet · h clair · H base · D ombre · E ombre profonde
 *   pilosité f clair · b base · B ombre · F ombre profonde (rampe à part des cheveux)
 *   yeux     i couleur des yeux · n pupille · w blanc
 *   accessoire c clair · C base · d ombre · K ombre profonde
 */

/** Les deux orientations dessinées : diagonale bas (de face, 3/4) et diagonale haut (de dos, 3/4). */
export type View = 'down' | 'up';
export const VIEWS: readonly View[] = ['down', 'up'];

/** Expressions : des variantes des yeux, des sourcils et de la bouche, pas des têtes à part. */
export type Expression = 'neutre' | 'joie' | 'cri' | 'decu';
export const EXPRESSIONS: readonly Expression[] = ['neutre', 'joie', 'cri', 'decu'];

/** Grille posée par rapport à un ancrage : coin haut-gauche en `ancrage + at`. */
export interface Grid {
  readonly at: readonly [number, number];
  readonly rows: readonly string[];
}

export const EMPTY: Grid = { at: [0, 0], rows: [] };

/** Points d'ancrage d'une forme de tête, dans une orientation (repère du crâne). */
export interface Anchors {
  /** Œil proche de la caméra (le plus grand) et œil éloigné. */
  readonly eyeNear: readonly [number, number];
  readonly eyeFar: readonly [number, number];
  readonly browNear: readonly [number, number];
  readonly browFar: readonly [number, number];
  readonly nose: readonly [number, number];
  readonly mouth: readonly [number, number];
  /** Pommette éclairée (modelé de la peau). */
  readonly cheek: readonly [number, number];
  /** Oreille visible côté caméra ; de dos, l'oreille du côté de la course. */
  readonly earNear: readonly [number, number];
  /** Oreille de l'autre côté (seulement de dos ; de face elle est cachée par le crâne). */
  readonly earFar: readonly [number, number];
  /** Ligne d'implantation des cheveux (haut du crâne) : ancrage des cheveux et des accessoires. */
  readonly hairline: readonly [number, number];
  readonly chin: readonly [number, number];
  /** Haut du cou : la tête se pose là sur le corps. */
  readonly neck: readonly [number, number];
}

export type AnchorName = keyof Anchors;

/** Une forme de tête dans une orientation : silhouette (« x »), ancrages, zone du visage. */
export interface HeadShapeView {
  readonly skull: readonly string[];
  readonly anchors: Anchors;
  /**
   * Zone du visage : colonnes `x0`-`x1` à partir de la rangée `y0`, dans la silhouette. Les mèches
   * avant (sauf une frange déclarée) n'y entrent pas : elles ne couvrent jamais les sourcils ni les
   * yeux. Les sourcils restent dans cette zone.
   */
  readonly face: { readonly x0: number; readonly x1: number; readonly y0: number };
}

interface PartBase {
  /** Identifiant stable (sauvegardes, éditeur) : le nom du fichier. */
  readonly id: string;
  /** Nom affiché dans l'éditeur de personnage. */
  readonly name: string;
}

export interface HeadShapePart extends PartBase {
  readonly views: Readonly<Record<View, HeadShapeView>>;
}

/** Oreilles : de face, l'oreille proche ; de dos, les deux. */
export interface EarsPart extends PartBase {
  readonly views: { readonly down: { readonly near: Grid }; readonly up: { readonly near: Grid; readonly far: Grid } };
}

/** Yeux et sourcils : une paire (proche, éloigné) par expression, de face seulement (masqués de dos). */
export interface PairPart extends PartBase {
  readonly expressions: Readonly<Record<Expression, { readonly near: Grid; readonly far: Grid }>>;
}

/** Bouche : une grille par expression, de face seulement. */
export interface MouthPart extends PartBase {
  readonly expressions: Readonly<Record<Expression, Grid>>;
}

/** Nez, de face seulement. `outside` : la pièce peut dépasser de la silhouette (bosse du nez). */
export interface NosePart extends PartBase {
  readonly grid: Grid;
  readonly outside?: boolean;
}

/**
 * Pilosité faciale, posée à l'ancrage de la bouche et découpée sur la peau. Le composeur la
 * modèle (ombre sur le bord bas) ; la bouche passe devant.
 */
export interface FacialHairPart extends PartBase {
  readonly views: Readonly<Record<View, Grid>>;
}

/** Cheveux en deux calques : l'arrière (derrière la tête) et l'avant (mèches, frange). */
export interface HairLayers {
  readonly back: Grid;
  readonly front: Grid;
}

export interface HairPart extends PartBase {
  /** Grilles posées à l'ancrage de la ligne des cheveux. */
  readonly views: Readonly<Record<View, HairLayers>>;
  /** Les cheveux couvrent les oreilles (sinon l'oreille passe devant les mèches). */
  readonly coversEars?: boolean;
  /** Frange : les mèches avant peuvent entrer dans la zone du visage jusqu'à cette rangée (comprise). */
  readonly fringeRow?: number;
}

/**
 * Accessoire posé à l'ancrage de la ligne des cheveux. `wrap` : découpé sur la tête déjà peinte
 * (cheveux compris), puis modelé (bout droit de chaque rangée à l'ombre).
 */
export interface AccessoryPart extends PartBase {
  readonly views: Readonly<Record<View, Grid>>;
  readonly wrap?: boolean;
  /**
   * Pixels libres, sans découpe (pans d'un nœud) : posés par rapport au bout gauche de la dernière
   * rangée de l'accessoire découpé, là où il quitte la tête.
   */
  readonly loose?: Readonly<Record<View, Grid>>;
}

/** Grille d'une pièce de visage par expression, raccourci pour les fichiers de pièces. */
export function grid(at: readonly [number, number], ...rows: string[]): Grid {
  return { at, rows };
}
