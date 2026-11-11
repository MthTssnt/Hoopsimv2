/** Les deux planches ont des rangées de hauteurs différentes : découpes mesurées, pas de grille supposée. */
export interface SpriteRect { x: number; y: number; width: number; height: number }
export interface CourtDesign {
  name: string;
  frames: readonly SpriteRect[];
}
const row = (name: string, values: number[][]): CourtDesign => ({ name, frames: values.map(([x, y, width, height]) => ({ x, y, width, height })) });

export const COURT_DESIGNS: readonly (readonly CourtDesign[])[] = [
  [
    row('Afro, bandeau jaune', [[94,22,109,233],[362,21,110,234],[599,27,157,225],[881,27,170,228]]),
    row('Blond, manche blanche', [[89,286,114,234],[359,286,115,233],[584,290,180,221],[873,290,178,228]]),
    row('Tresses, silhouette élancée', [[91,546,113,288],[359,544,114,286],[563,548,210,275],[859,554,190,275]]),
    row('Rasé, barbe, genouillère', [[80,854,125,237],[351,854,124,237],[572,858,189,233],[857,860,190,234]]),
    row('Roux, épaules larges', [[65,1113,148,278],[338,1116,148,274],[561,1121,197,269],[844,1123,197,271]]),
  ],
  [
    row('Cheveux courts, bandeau blanc', [[93,31,110,228],[354,32,116,227],[598,34,168,223],[883,37,170,221]]),
    row('Dreadlocks, bandeau bordeaux', [[80,287,128,267],[340,289,131,263],[575,293,202,249],[865,296,200,256]]),
    row('Cheveux argentés, manche bordeaux', [[82,581,123,276],[350,579,123,277],[559,583,215,267],[853,582,209,272]]),
    row('Dégradé, barbe, gabarit trapu', [[79,879,133,224],[342,879,128,224],[573,880,185,223],[861,882,182,220]]),
    row('Chignon, grand gabarit', [[64,1121,151,273],[328,1126,151,268],[559,1125,205,267],[850,1130,215,263]]),
  ],
];

/** Hauteur tirée de la taille réelle ; la largeur garde la corpulence propre au dessin et au joueur. */
export function playerScale(heightCm: number, heavy: boolean, design: CourtDesign): { x: number; y: number; height: number } {
  const height = Math.round(Math.max(39, Math.min(51, 40 + (heightCm - 180) * 0.25)));
  const y = height / design.frames[0].height;
  return { x: y * (heavy ? 1.1 : 1), y, height };
}
