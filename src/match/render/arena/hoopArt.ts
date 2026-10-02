import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import { BACKBOARD, RIM_RADIUS, type Hoop } from '../../physics/court';
import { fillEllipse, fillPolygon, pixelLine, pixelPolyline, type Point } from '../pixelDraw';
import { artPx } from '../artConfig';
import type { ArtProjection } from './artProjection';
import type { TeamLook } from './draw';

/** Socle et poteau derrière la ligne de fond (m vers l'extérieur). */
const STAND = { padFrom: 0.3, padTo: 1.0, padHalfDepth: 0.55, padHeight: 1.05, pole: 0.65, poleTop: 3.75 } as const;
/** Décalage horizontal (m par m de profondeur) qui fait voir la planche de biais plutôt que de chant. */
const BOARD_SLANT = 0.5;
/**
 * Le cercle est dessiné plus grand que le cercle physique, pour être lisible à côté d'un ballon
 * de 8 px. La physique garde le vrai rayon : un ballon qui passe dedans passe aussi dans le dessin.
 */
export const RIM_DRAW_SCALE = 1.35;
/** Hauteur de la poutre qui relie le poteau à la planche (m), au milieu de la planche. */
const BEAM_Z = BACKBOARD.bottom + 0.6;

/**
 * Panier massif vu de 3/4. Renvoie deux calques : derrière le ballon (ombres, socle, poteau,
 * poutre, planche, moitié arrière du cercle) et devant (filet, moitié avant du cercle).
 * La planche est dessinée en biais pour l'effet de profondeur ; la physique la garde droite.
 */
export function drawHoopArt(scene: Phaser.Scene, proj: ArtProjection, hoop: Hoop, home: TeamLook): { back: Phaser.GameObjects.Graphics; front: Phaser.GameObjects.Graphics } {
  const P = (x: number, y: number, z = 0) => proj.project(x, y, z);
  const { rim, board, toCourt, baselineX } = hoop;
  const out = -toCourt;
  const back = scene.add.graphics();
  const front = scene.add.graphics();
  const ax = (m: number) => baselineX + out * m;
  const faceX = toCourt > 0 ? board.max.x : board.min.x;
  const slant = (y: number) => out * (y - rim.y) * BOARD_SLANT * proj.ppm;
  const rimR = RIM_RADIUS * RIM_DRAW_SCALE;

  // Ombres au sol, d'un seul tenant : socle, bande sous la poutre jusqu'au pied de la planche, cercle.
  back.fillStyle(PALETTE.outline, 0.26);
  const padShadow = P(ax((STAND.padFrom + STAND.padTo) / 2), rim.y + 0.25);
  fillEllipse(back, padShadow.x, padShadow.y, ((STAND.padTo - STAND.padFrom) / 2 + 0.3) * proj.ppm, (STAND.padHalfDepth + 0.3) * proj.depthPx);
  back.fillStyle(PALETTE.outline, 0.14);
  const beamShadowFrom = P(ax(STAND.pole), rim.y + 0.1);
  const beamShadowTo = P(faceX, rim.y + 0.1);
  back.fillRect(Math.min(beamShadowFrom.x, beamShadowTo.x), Math.round(beamShadowTo.y) - 1, Math.abs(beamShadowFrom.x - beamShadowTo.x), 3);
  const rimShadow = P(rim.x, rim.y);
  fillEllipse(back, rimShadow.x, rimShadow.y, rimR * proj.ppm, rimR * proj.depthPx);

  // Socle rembourré, cerné de sombre pour se détacher de la bande : dessus clair, face avant
  // ombrée, liseré de la couleur secondaire.
  const x0 = Math.min(ax(STAND.padFrom), ax(STAND.padTo));
  const x1 = Math.max(ax(STAND.padFrom), ax(STAND.padTo));
  const yN = rim.y + STAND.padHalfDepth;
  const yF = rim.y - STAND.padHalfDepth;
  const h = STAND.padHeight;
  const padTop = P(x0, yF, h);
  const padBottom = P(x1, yN, 0);
  const [left, top, right, bottom] = [padTop.x, padTop.y, padBottom.x, padBottom.y].map(Math.round);
  back.fillStyle(PALETTE.outline).fillRect(left - 1, top - 1, right - left + 3, bottom - top + 3);
  back.fillStyle(home.primary[0]);
  fillPolygon(back, [P(x0, yF, h), P(x1, yF, h), P(x1, yN, h), P(x0, yN, h)]);
  back.fillStyle(home.primary[2]);
  fillPolygon(back, [P(x0, yN, h), P(x1, yN, h), P(x1, yN, 0), P(x0, yN, 0)]);
  back.fillStyle(home.secondary[1]);
  pixelLine(back, P(x0, yN, h * 0.55), P(x1, yN, h * 0.55));

  // Poteau : manchon rembourré (cerné) puis métal, avec un chapeau au sommet.
  const pole = P(ax(STAND.pole), rim.y, STAND.padHeight);
  const poleTop = P(ax(STAND.pole), rim.y, STAND.poleTop);
  const px = Math.round(pole.x);
  const pyTop = Math.round(poleTop.y);
  const pw = artPx(3);
  const capH = artPx(4);
  back.fillStyle(PALETTE.outline).fillRect(px - pw - 1, pyTop - 1, 2 * pw + 2, Math.round(pole.y) - pyTop + 1);
  back.fillStyle(PALETTE.slate).fillRect(px - pw, pyTop, 2 * pw, Math.round(pole.y) - pyTop);
  back.fillStyle(PALETTE.silver).fillRect(px - pw, pyTop, Math.max(1, pw - 1), Math.round(pole.y) - pyTop);
  back.fillStyle(PALETTE.outline).fillRect(px - pw - 2, pyTop - capH, 2 * pw + 4, capH + 1);
  back.fillStyle(PALETTE.slate).fillRect(px - pw - 1, pyTop - capH + 1, 2 * pw + 2, capH - 1);
  const sleeveTop = P(ax(STAND.pole), rim.y, 2.3);
  const sw = artPx(5);
  const sy = Math.round(sleeveTop.y);
  back.fillStyle(PALETTE.outline).fillRect(px - sw - 1, sy - 1, 2 * sw + 2, Math.round(pole.y) - sy + 1);
  back.fillStyle(home.primary[1]).fillRect(px - sw, sy, 2 * sw, Math.round(pole.y) - sy);
  back.fillStyle(home.primary[0]).fillRect(px - sw, sy, artPx(3), Math.round(pole.y) - sy);
  back.fillStyle(home.secondary[1]).fillRect(px - sw, sy + artPx(3), 2 * sw, artPx(2));

  // Poutre (contour, reflet, métal) du sommet du poteau jusqu'au milieu de la planche, où elle
  // passe derrière le verre ; jambe de force en diagonale ; platine de fixation.
  const beamFrom = P(ax(STAND.pole), rim.y, STAND.poleTop - 0.1);
  const beamTo = P(faceX, rim.y, BEAM_Z);
  const beamRows = artPx(5) >= 5 ? [PALETTE.outline, PALETTE.silver, PALETTE.slate, PALETTE.slate, PALETTE.outline] : [PALETTE.outline, PALETTE.silver, PALETTE.slate, PALETTE.outline];
  beamRows.forEach((color, dy) => {
    back.fillStyle(color);
    pixelLine(back, { x: beamFrom.x, y: beamFrom.y + dy - 2 }, { x: beamTo.x, y: beamTo.y + dy - 2 });
  });
  const braceFrom = P(ax(STAND.pole), rim.y, STAND.poleTop - 1.05);
  const braceTo = { x: beamFrom.x + (beamTo.x - beamFrom.x) * 0.55, y: beamFrom.y + (beamTo.y - beamFrom.y) * 0.55 + 2 };
  const braceCols = artPx(4) >= 4 ? [PALETTE.outline, PALETTE.slate, PALETTE.slate, PALETTE.outline] : [PALETTE.outline, PALETTE.slate, PALETTE.outline];
  braceCols.forEach((color, dx) => {
    back.fillStyle(color);
    pixelLine(back, { x: braceFrom.x + dx - 2, y: braceFrom.y }, { x: braceTo.x + dx - 2, y: braceTo.y });
  });
  const plate = { x: Math.round(beamTo.x + out * artPx(4)), y: Math.round(beamTo.y) };
  back.fillStyle(PALETTE.outline).fillRect(plate.x - artPx(3), plate.y - artPx(6), 2 * artPx(3), 2 * artPx(6));
  back.fillStyle(PALETTE.slate).fillRect(plate.x - artPx(3) + 1, plate.y - artPx(6) + 1, 2 * artPx(3) - 2, 2 * artPx(6) - 2);

  // Planche transparente en perspective (biais exagéré pour montrer sa face) : tranche sombre,
  // verre, cadre craie, carré de visée, bas rembourré.
  const corner = (y: number, z: number): Point => {
    const p = P(faceX, y, z);
    return { x: p.x + slant(y), y: p.y };
  };
  const quad = [corner(board.min.y, board.max.z), corner(board.max.y, board.max.z), corner(board.max.y, board.min.z), corner(board.min.y, board.min.z)];
  back.fillStyle(PALETTE.ink);
  fillPolygon(back, quad.map((p) => ({ x: p.x + out * artPx(3), y: p.y + 1 })));
  back.fillStyle(PALETTE.glass, 0.85);
  fillPolygon(back, quad);
  back.fillStyle(PALETTE.chalk);
  pixelPolyline(back, [...quad, quad[0]]);
  pixelPolyline(back, [...quad, quad[0]].map((p) => ({ x: p.x - out, y: p.y })));
  const target = [corner(rim.y - 0.3, rim.z + 0.45), corner(rim.y + 0.3, rim.z + 0.45), corner(rim.y + 0.3, rim.z + 0.06), corner(rim.y - 0.3, rim.z + 0.06)];
  pixelPolyline(back, [...target, target[0]]);
  back.fillStyle(home.primary[1]);
  for (let dy = 0; dy < artPx(3); dy++) pixelLine(back, { x: quad[2].x, y: quad[2].y + dy }, { x: quad[3].x, y: quad[3].y + dy });

  // Cercle : support vers la planche, moitié arrière (sombre, derrière le ballon), moitié avant
  // épaisse (2 rangées orange + 1 sombre, devant), filet à mailles croisées.
  const ring = (from: number, to: number, r = rimR, dz = 0): Point[] => {
    const pts: Point[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = from + ((to - from) * i) / 24;
      pts.push(P(rim.x + Math.cos(a) * r, rim.y + Math.sin(a) * r, rim.z + dz));
    }
    return pts;
  };
  const shift = (pts: Point[], dy: number) => pts.map((p) => ({ x: p.x, y: p.y + dy }));
  back.fillStyle(PALETTE.slate);
  for (let dy = 0; dy < 2; dy++) pixelLine(back, { ...P(rim.x + out * rimR, rim.y, rim.z), y: P(0, rim.y, rim.z).y + dy }, { ...P(faceX, rim.y, rim.z), y: P(0, rim.y, rim.z).y + dy });
  back.fillStyle(PALETTE.orangeDark);
  pixelPolyline(back, ring(Math.PI, Math.PI * 2));
  pixelPolyline(back, shift(ring(Math.PI, Math.PI * 2), 1));

  const drop = 0.5;
  const strands = 12;
  front.fillStyle(PALETTE.chalk, 0.9);
  for (let i = 0; i <= strands; i++) {
    const a = (Math.PI * i) / strands;
    const upper = P(rim.x + Math.cos(a) * rimR, rim.y + Math.sin(a) * rimR, rim.z);
    for (const lean of [0.3, -0.3]) {
      const b = a + lean;
      if (b < 0 || b > Math.PI) continue;
      pixelLine(front, upper, P(rim.x + Math.cos(b) * rimR * 0.62, rim.y + Math.sin(b) * rimR * 0.62, rim.z - drop));
    }
  }
  pixelPolyline(front, ring(0, Math.PI, rimR * 0.8, -drop * 0.5));
  pixelPolyline(front, ring(0, Math.PI, rimR * 0.62, -drop));
  front.fillStyle(PALETTE.orangeDark);
  pixelPolyline(front, shift(ring(0, Math.PI), 2));
  front.fillStyle(PALETTE.orange);
  pixelPolyline(front, ring(0, Math.PI));
  pixelPolyline(front, shift(ring(0, Math.PI), 1));
  return { back, front };
}
