/**
 * Registre des pièces : une ligne par pièce. Ajouter une pièce = ajouter son fichier dans
 * `parts/<catégorie>/` puis une ligne ici (voir README.md). L'ordre de chaque liste est celui
 * de l'éditeur ; `weights` règle la fréquence au tirage des joueurs générés (absent : 1).
 */
import type { AccessoryPart, EarsPart, FacialHairPart, HairPart, HeadShapePart, MouthPart, NosePart, PairPart } from './types';
import { carree } from './parts/headShapes/carree';
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
  headShapes: [{ part: normale, weight: 3 }, { part: carree, weight: 2 }, { part: longue, weight: 2 }, { part: ronde, weight: 1.5 }] as Entry<HeadShapePart>[],
  ears: [{ part: normales, weight: 4 }, { part: petites, weight: 2 }, { part: decollees, weight: 1 }] as Entry<EarsPart>[],
  eyes: [{ part: points, weight: 3 }, { part: ronds, weight: 2 }, { part: vifs, weight: 2 }, { part: lourds, weight: 1.5 }] as Entry<PairPart>[],
  brows: [{ part: doux, weight: 3 }, { part: epais, weight: 2 }, { part: arques, weight: 1.5 }, { part: courts, weight: 1.5 }] as Entry<PairPart>[],
  noses: [{ part: bouton, weight: 3 }, { part: droit, weight: 2 }, { part: noseLarge, weight: 2 }, { part: aquilin, weight: 1 }] as Entry<NosePart>[],
  mouths: [{ part: mouthFine, weight: 3 }, { part: pleine, weight: 2 }, { part: mouthLarge, weight: 1.5 }] as Entry<MouthPart>[],
  facialHair: [{ part: barbe, weight: 3 }, { part: bouc, weight: 2 }, { part: moustache, weight: 1 }, { part: collier, weight: 1.5 }] as Entry<FacialHairPart>[],
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
  accessories: [{ part: bandeau, weight: 3 }, { part: bandeauFin, weight: 2 }, { part: bandeauNoue, weight: 1 }] as Entry<AccessoryPart>[],
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
