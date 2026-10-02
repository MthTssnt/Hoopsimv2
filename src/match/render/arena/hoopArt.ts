import type Phaser from 'phaser';
import { PALETTE } from '../../../assets/palette';
import { BACKBOARD, RIM_RADIUS, type Hoop } from '../../physics/court';
import { fillEllipse, fillPolygon, pixelLine, pixelPolyline, type Point } from '../pixelDraw';
import type { ArtProjection } from './artProjection';
import type { TeamLook } from './draw';

/** Socle et poteau derrière la ligne de fond (m vers l'extérieur). */
const STAND = { padFrom: 0.3, padTo: 1.0, padHalfDepth: 0.55, padHeight: 1.05, pole: 0.65, poleTop: 3.75 } as const;
/** Décalage horizontal (m par m de profondeur) qui fait voir la planche de biais plutôt que de chant. */
const BOARD_SLANT = 0.5;

/**
 * Panier massif vu de 3/4. Renvoie deux calques : derrière le ballon (ombre, socle, poteau,
 * planche, moitié arrière du cercle) et devant (filet, moitié avant du cercle).
 * La planche est dessinée en biais pour l'effet de profondeur ; la physique la garde droite.
 */
export function drawHoopArt(scene: Phaser.Scene, proj: ArtProjection, hoop: Hoop, home: TeamLook): { back: Phaser.GameObjects.Graphics; front: Phaser.GameObjects.Graphics } {
  const P = (x: number, y: number, z = 0) => proj.project(x, y, z);
  const { rim, board, toCourt, baselineX } = hoop;
  const out = -toCourt;
  const back = scene.add.graphics();
  const front = scene.add.graphics();
  const ax = (m: number) => baselineX + out * m;

  // Ombres au sol : socle, et planche + cercle (ovale allongé dans la profondeur, sous le panier).
  back.fillStyle(PALETTE.outline, 0.28);
  const padShadow = P(ax((STAND.padFrom + STAND.padTo) / 2), rim.y + 0.25);
  fillEllipse(back, padShadow.x, padShadow.y, ((STAND.padTo - STAND.padFrom) / 2 + 0.3) * proj.ppm, (STAND.padHalfDepth + 0.3) * proj.depthPx);
  back.fillStyle(PALETTE.outline, 0.1);
  const hoopShadow = P((rim.x + baselineX) / 2, rim.y + 0.3);
  fillEllipse(back, hoopShadow.x, hoopShadow.y, 0.45 * proj.ppm, 0.9 * proj.depthPx);

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

  // Poteau : manchon rembourré (cerné) puis métal ; bras en treillis jusqu'à la planche.
  const pole = P(ax(STAND.pole), rim.y, STAND.padHeight);
  const poleTop = P(ax(STAND.pole), rim.y, STAND.poleTop);
  const px = Math.round(pole.x);
  back.fillStyle(PALETTE.outline).fillRect(px - 4, Math.round(poleTop.y) - 1, 8, Math.round(pole.y - poleTop.y) + 1);
  back.fillStyle(PALETTE.slate).fillRect(px - 3, Math.round(poleTop.y), 6, Math.round(pole.y - poleTop.y));
  back.fillStyle(PALETTE.silver).fillRect(px - 3, Math.round(poleTop.y), 2, Math.round(pole.y - poleTop.y));
  const sleeveTop = P(ax(STAND.pole), rim.y, 2.3);
  back.fillStyle(PALETTE.outline).fillRect(px - 6, Math.round(sleeveTop.y) - 1, 12, Math.round(pole.y - sleeveTop.y) + 1);
  back.fillStyle(home.primary[1]).fillRect(px - 5, Math.round(sleeveTop.y), 10, Math.round(pole.y - sleeveTop.y));
  back.fillStyle(home.primary[0]).fillRect(px - 5, Math.round(sleeveTop.y), 3, Math.round(pole.y - sleeveTop.y));
  back.fillStyle(home.secondary[1]).fillRect(px - 5, Math.round(sleeveTop.y) + 3, 10, 2);
  const boardBackX = toCourt > 0 ? board.min.x : board.max.x;
  const armHigh = P(boardBackX, rim.y, BACKBOARD.bottom + 0.75);
  const armLow = P(boardBackX, rim.y, BACKBOARD.bottom + 0.25);
  back.fillStyle(PALETTE.slate);
  for (let dy = 0; dy < 3; dy++) pixelLine(back, { x: poleTop.x, y: poleTop.y + dy }, { x: armHigh.x, y: armHigh.y + dy });
  const strut = P(ax(STAND.pole), rim.y, STAND.poleTop - 0.9);
  for (let dy = 0; dy < 2; dy++) pixelLine(back, { x: strut.x, y: strut.y + dy }, { x: armLow.x, y: armLow.y + dy });

  // Planche transparente en perspective (biais exagéré pour montrer sa face) : cadre craie,
  // carré de visée, bas rembourré.
  const faceX = toCourt > 0 ? board.max.x : board.min.x;
  const corner = (y: number, z: number): Point => {
    const p = P(faceX, y, z);
    return { x: p.x + out * (y - rim.y) * BOARD_SLANT * proj.ppm, y: p.y };
  };
  const quad = [corner(board.min.y, board.max.z), corner(board.max.y, board.max.z), corner(board.max.y, board.min.z), corner(board.min.y, board.min.z)];
  back.fillStyle(PALETTE.ink);
  fillPolygon(back, quad.map((p) => ({ x: p.x + out * 3, y: p.y + 1 })));
  back.fillStyle(PALETTE.glass, 0.85);
  fillPolygon(back, quad);
  back.fillStyle(PALETTE.chalk);
  pixelPolyline(back, [...quad, quad[0]]);
  pixelPolyline(back, [...quad, quad[0]].map((p) => ({ x: p.x - out, y: p.y })));
  const target = [corner(rim.y - 0.3, rim.z + 0.45), corner(rim.y + 0.3, rim.z + 0.45), corner(rim.y + 0.3, rim.z + 0.06), corner(rim.y - 0.3, rim.z + 0.06)];
  pixelPolyline(back, [...target, target[0]]);
  back.fillStyle(home.primary[1]);
  for (let dy = 0; dy < 3; dy++) pixelLine(back, { x: quad[2].x, y: quad[2].y + dy }, { x: quad[3].x, y: quad[3].y + dy });

  // Cercle épais : moitié arrière derrière, moitié avant (2 rangs + ombre) devant ; filet.
  const ring = (from: number, to: number, r = RIM_RADIUS, dz = 0): Point[] => {
    const pts: Point[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = from + ((to - from) * i) / 18;
      pts.push(P(rim.x + Math.cos(a) * r, rim.y + Math.sin(a) * r, rim.z + dz));
    }
    return pts;
  };
  back.fillStyle(PALETTE.orange);
  pixelPolyline(back, ring(Math.PI, Math.PI * 2));
  back.fillStyle(PALETTE.slate);
  pixelLine(back, P(rim.x + out * RIM_RADIUS, rim.y, rim.z), P(faceX, rim.y, rim.z));
  pixelLine(back, P(rim.x + out * RIM_RADIUS, rim.y, rim.z - 0.06), P(faceX, rim.y, rim.z - 0.12));

  const drop = 0.45;
  front.fillStyle(PALETTE.chalk, 0.9);
  for (let i = 0; i <= 12; i++) {
    const a = (Math.PI * i) / 12;
    const upper = P(rim.x + Math.cos(a) * RIM_RADIUS, rim.y + Math.sin(a) * RIM_RADIUS, rim.z);
    const lowerA = P(rim.x + Math.cos(a + 0.35) * RIM_RADIUS * 0.6, rim.y + Math.sin(a + 0.35) * RIM_RADIUS * 0.6, rim.z - drop);
    pixelLine(front, upper, lowerA);
  }
  pixelPolyline(front, ring(0, Math.PI, RIM_RADIUS * 0.8, -drop * 0.5));
  pixelPolyline(front, ring(0, Math.PI, RIM_RADIUS * 0.6, -drop));
  front.fillStyle(PALETTE.orangeDark);
  pixelPolyline(front, ring(0, Math.PI).map((p) => ({ x: p.x, y: p.y + 3 })));
  pixelPolyline(front, ring(0, Math.PI).map((p) => ({ x: p.x, y: p.y + 2 })));
  front.fillStyle(PALETTE.orange);
  pixelPolyline(front, ring(0, Math.PI));
  pixelPolyline(front, ring(0, Math.PI).map((p) => ({ x: p.x, y: p.y + 1 })));
  return { back, front };
}
