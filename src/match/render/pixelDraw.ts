import type { PixelTarget } from './pixelFont';

/** Tracés pixel par pixel, nets et sans anticrénelage, sur un Graphics ou tout autre tampon. */
export type Point = { x: number; y: number };

/** Ligne d'un pixel (Bresenham). */
export function pixelLine(g: PixelTarget, a: Point, b: Point): void {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function pixelPolyline(g: PixelTarget, points: Point[]): void {
  for (let i = 1; i < points.length; i++) pixelLine(g, points[i - 1], points[i]);
}

/** Remplit un polygone (convexe ou non), ligne de pixels par ligne de pixels. */
export function fillPolygon(g: PixelTarget, points: Point[]): void {
  const ys = points.map((p) => p.y);
  for (let y = Math.round(Math.min(...ys)); y <= Math.round(Math.max(...ys)); y++) {
    const xs: number[] = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    });
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) g.fillRect(Math.round(xs[k]), y, Math.max(1, Math.round(xs[k + 1]) - Math.round(xs[k])), 1);
  }
}

/** Ellipse pleine (rayons en px), ligne par ligne. */
export function fillEllipse(g: PixelTarget, cx: number, cy: number, rx: number, ry: number): void {
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    g.fillRect(Math.round(cx) - half, Math.round(cy) + dy, 2 * half, 1);
  }
}
