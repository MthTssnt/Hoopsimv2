export type ArtCanvas = HTMLCanvasElement | OffscreenCanvas;
export type ArtSource = HTMLImageElement | ImageBitmap;

export function artCanvas(width: number, height: number): ArtCanvas {
  if (typeof document === 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}
