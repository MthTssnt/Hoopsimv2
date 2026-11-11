/** Inventaire des seules planches officielles conservées dans le dépôt. */
import { COURT_DESIGNS } from '../src/assets/players/courtDesigns';
import { OFFICIAL_LAYOUT } from '../src/match/render/sprites/layout';
console.log('Designs officiels :', COURT_DESIGNS.flat().map((design) => design.name).join(', '));
console.log(`${OFFICIAL_LAYOUT.framesPerBlock} poses × 4 orientations par joueur. Catalogue : ?style ; match : ?court.`);
