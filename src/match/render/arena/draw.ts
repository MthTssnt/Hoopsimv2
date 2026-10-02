import type Phaser from 'phaser';
import { PALETTE, teamRamp, type TeamRamp } from '../../../assets/palette';
import type { TeamSeed } from '../../../engine/teamsData';

/** Couleur d'un caractère de grille, ou null pour « transparent ». */
export type ColorOf = (char: string) => number | null;

/**
 * Dessine une grille de pixels dans un Graphics, avec un contour d'un pixel autour de la
 * silhouette (couleur `outline`, ou aucun contour si null).
 */
export function drawGrid(
  g: Phaser.GameObjects.Graphics,
  grid: readonly string[],
  x: number,
  y: number,
  colorOf: ColorOf,
  options: { flip?: boolean; outline?: number | null } = {},
): void {
  const h = grid.length;
  const w = Math.max(...grid.map((row) => row.length));
  const color = (gx: number, gy: number): number | null => {
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
    const row = grid[gy];
    const char = row[options.flip ? row.length - 1 - gx : gx];
    return char === undefined ? null : colorOf(char);
  };
  const outline = options.outline === undefined ? PALETTE.outline : options.outline;
  if (outline !== null) {
    g.fillStyle(outline);
    for (let gy = -1; gy <= h; gy++) {
      for (let gx = -1; gx <= w; gx++) {
        if (color(gx, gy) !== null) continue;
        if (color(gx - 1, gy) !== null || color(gx + 1, gy) !== null || color(gx, gy - 1) !== null || color(gx, gy + 1) !== null) {
          g.fillRect(x + gx, y + gy, 1, 1);
        }
      }
    }
  }
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const c = color(gx, gy);
      if (c !== null) g.fillStyle(c).fillRect(x + gx, y + gy, 1, 1);
    }
  }
}

/** Habillage d'une équipe : rampes primaire et secondaire, noms. */
export interface TeamLook {
  primary: TeamRamp;
  secondary: TeamRamp;
  abbr: string;
  name: string;
  city: string;
}

/** Écart minimal entre maillot et couleur secondaire pour que numéros et noms restent lisibles. */
const MIN_TRIM_CONTRAST = 130;

export function teamLook(team: TeamSeed): TeamLook {
  const primary = teamRamp(team.colors.primary);
  let secondary = teamRamp(team.colors.secondary);
  // Secondaire trop proche du maillot (ex. orange et brun) : craie, ou encre sur un maillot clair.
  if (colorDistance(secondary[1], primary[1]) < MIN_TRIM_CONTRAST) {
    secondary = teamRamp(luminance(primary[1]) > 160 ? PALETTE.ink : PALETTE.chalk);
  }
  return {
    primary,
    secondary,
    abbr: team.abbr,
    name: team.name,
    city: team.city,
  };
}

/** Luminance perçue (0-255). */
function luminance(color: number): number {
  return 0.299 * ((color >> 16) & 0xff) + 0.587 * ((color >> 8) & 0xff) + 0.114 * (color & 0xff);
}

/** Distance entre deux couleurs (0-441). */
export function colorDistance(a: number, b: number): number {
  const d = (s: number) => ((a >> s) & 0xff) - ((b >> s) & 0xff);
  return Math.hypot(d(16), d(8), d(0));
}

/** Équipe adverse lisible : la première dont le maillot tranche avec celui de l'équipe à domicile. */
export function contrastingTeam(home: TeamSeed, teams: readonly TeamSeed[], start: number): TeamSeed {
  const homeColor = teamRamp(home.colors.primary)[1];
  for (let i = 0; i < teams.length; i++) {
    const candidate = teams[(start + i) % teams.length];
    if (candidate.id !== home.id && colorDistance(teamRamp(candidate.colors.primary)[1], homeColor) > 140) return candidate;
  }
  return teams.find((t) => t.id !== home.id) ?? home;
}
