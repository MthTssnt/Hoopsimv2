/**
 * Registre des pièces : une ligne par pièce. Ajouter une pièce = ajouter son fichier dans
 * `parts/<catégorie>/` puis une ligne ici (voir README.md). L'ordre de chaque liste est celui
 * de l'éditeur ; `weight` règle la fréquence au tirage des joueurs générés (absent : 1).
 *
 * Pour l'instant, le tirage ne donne que les visages de la planche du style 5 (étape 1) : les
 * autres pièces ont un poids 0. Elles restent disponibles (éditeur, apparences sauvegardées) et
 * reviendront au tirage avec le travail sur les visages.
 */
import type { AccessoryPart, EarsPart, FacialHairPart, HairPart, HeadShapePart, MouthPart, NosePart, PairPart } from './types';
import { carree } from './parts/headShapes/carree';
import { fine as headFine } from './parts/headShapes/fine';
import { large as headLarge } from './parts/headShapes/large';
import { longue } from './parts/headShapes/longue';
import { normale } from './parts/headShapes/normale';
import { ronde } from './parts/headShapes/ronde';
import { decollees } from './parts/ears/decollees';
import { normales } from './parts/ears/normales';
import { petites } from './parts/ears/petites';
import { lourds } from './parts/eyes/lourds';
import { points } from './parts/eyes/points';
import { ronds } from './parts/eyes/ronds';
import { vifs } from './parts/eyes/vifs';
import { arques } from './parts/brows/arques';
import { courts } from './parts/brows/courts';
import { doux } from './parts/brows/doux';
import { epais } from './parts/brows/epais';
import { aquilin } from './parts/noses/aquilin';
import { bouton } from './parts/noses/bouton';
import { droit } from './parts/noses/droit';
import { large as noseLarge } from './parts/noses/large';
import { fine as mouthFine } from './parts/mouths/fine';
import { large as mouthLarge } from './parts/mouths/large';
import { pleine } from './parts/mouths/pleine';
import { barbe } from './parts/facialHair/barbe';
import { bouc } from './parts/facialHair/bouc';
import { collier } from './parts/facialHair/collier';
import { moustache } from './parts/facialHair/moustache';
import { afro } from './parts/hair/afro';
import { chauve } from './parts/hair/chauve';
import { chignon } from './parts/hair/chignon';
import { crete } from './parts/hair/crete';
import { degrade } from './parts/hair/degrade';
import { dreadlocks } from './parts/hair/dreadlocks';
import { ebouriffe } from './parts/hair/ebouriffe';
import { longs } from './parts/hair/longs';
import { miLongs } from './parts/hair/mi-longs';
import { pics } from './parts/hair/pics';
import { queue } from './parts/hair/queue';
import { rase } from './parts/hair/rase';
import { tresses } from './parts/hair/tresses';
import { bandeau } from './parts/accessories/bandeau';
import { bandeauFin } from './parts/accessories/bandeau-fin';
import { bandeauNoue } from './parts/accessories/bandeau-noue';

export interface Entry<T> {
  part: T;
  weight?: number;
}

export const REGISTRY = {
  headShapes: [{ part: normale, weight: 3 }, { part: carree, weight: 2 }, { part: headFine, weight: 2 }, { part: ronde, weight: 1.5 }, { part: headLarge, weight: 1.5 }, { part: longue, weight: 0 }] as Entry<HeadShapePart>[],
  ears: [{ part: normales }, { part: petites, weight: 0 }, { part: decollees, weight: 0 }] as Entry<EarsPart>[],
  eyes: [{ part: points }, { part: ronds, weight: 0 }, { part: vifs, weight: 0 }, { part: lourds, weight: 0 }] as Entry<PairPart>[],
  brows: [{ part: doux }, { part: epais, weight: 0 }, { part: arques, weight: 0 }, { part: courts, weight: 0 }] as Entry<PairPart>[],
  noses: [{ part: bouton }, { part: droit, weight: 0 }, { part: noseLarge, weight: 0 }, { part: aquilin, weight: 0 }] as Entry<NosePart>[],
  mouths: [{ part: mouthFine }, { part: pleine, weight: 0 }, { part: mouthLarge, weight: 0 }] as Entry<MouthPart>[],
  facialHair: [{ part: barbe, weight: 3 }, { part: bouc, weight: 2 }, { part: moustache, weight: 1 }, { part: collier, weight: 0 }] as Entry<FacialHairPart>[],
  hair: [
    { part: ebouriffe },
    { part: pics },
    { part: chignon },
    { part: queue },
    { part: miLongs },
    { part: longs },
    { part: afro },
    { part: dreadlocks },
    { part: tresses },
    { part: degrade },
    { part: rase },
    { part: chauve },
    { part: crete },
  ] as Entry<HairPart>[],
  accessories: [{ part: bandeau }, { part: bandeauFin, weight: 0 }, { part: bandeauNoue, weight: 0 }] as Entry<AccessoryPart>[],
};

export type Category = keyof typeof REGISTRY;
export const CATEGORIES = Object.keys(REGISTRY) as Category[];

type PartOf<C extends Category> = (typeof REGISTRY)[C][number]['part'];

/** Pièce d'une catégorie par son identifiant (la première de la liste si l'identifiant est inconnu). */
export function partOf<C extends Category>(category: C, id: string): PartOf<C> {
  const list = REGISTRY[category] as Entry<PartOf<C>>[];
  return (list.find((e) => e.part.id === id) ?? list[0]).part;
}

export function hasPart(category: Category, id: string): boolean {
  return (REGISTRY[category] as Entry<{ id: string }>[]).some((e) => e.part.id === id);
}

export function partIds(category: Category): string[] {
  return (REGISTRY[category] as Entry<{ id: string }>[]).map((e) => e.part.id);
}

/** Pièces que le tirage peut donner (poids non nul). */
export function drawnIds(category: Category): string[] {
  return (REGISTRY[category] as Entry<{ id: string }>[]).filter((e) => (e.weight ?? 1) > 0).map((e) => e.part.id);
}
