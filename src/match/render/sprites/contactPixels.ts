/** Les repères magenta n'appartiennent à aucun des dix designs. */
export function markerPixel(r: number, g: number, b: number): boolean {
  return r > 100 && b > 80 && g < Math.min(r, b) * 0.55;
}
export function skinPixel(r: number, g: number, b: number): boolean {
  return r > 65 && g > 32 && r > g * 1.13 && g > b * 1.16 && r < g * 2.8;
}

/** Nettoyage natif : poussière détachée, repères résiduels, micro-trous fermés du détourage. */
export function cleanPose(data: Uint8ClampedArray, width: number, height: number): void {
  const seen = new Uint8Array(width * height);
  for (let i = 0; i < seen.length; i++) {
    if (markerPixel(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) data[i * 4 + 3] = 0;
  }
  // Une composante de 1–3 pixels, sans liaison au corps, est un débris de l'ancien marqueur.
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] < 128) continue;
    const component = [start]; seen[start] = 1;
    for (let j = 0; j < component.length; j++) {
      const i = component[j], x = i % width, y = Math.floor(i / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, n = ny * width + nx;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || seen[n] || data[n * 4 + 3] < 128) continue;
        seen[n] = 1; component.push(n);
      }
    }
    if (component.length <= 3) for (const i of component) data[i * 4 + 3] = 0;
  }
}

/** Réparer uniquement les lacunes d'un pixel encadrées par la même matière, autour du contact. */
export function repairContact(data: Uint8ClampedArray, width: number, height: number, cx: number, cy: number): void {
  const source = data.slice();
  for (let y = Math.max(1, Math.floor(cy - 13)); y < Math.min(height - 1, cy + 13); y++) for (let x = Math.max(1, Math.floor(cx - 13)); x < Math.min(width - 1, cx + 13); x++) {
    const i = (y * width + x) * 4;
    if (source[i + 3] > 0 || Math.hypot(x - cx, y - cy) > 13) continue;
    for (const [a, b] of [[i - 4, i + 4], [i - width * 4, i + width * 4]]) {
      if (source[a + 3] < 220 || source[b + 3] < 220) continue;
      const diff = Math.max(...[0, 1, 2].map((c) => Math.abs(source[a + c] - source[b + c])));
      if (diff > 18) continue;
      // Pas de pont entre deux doigts ni de fermeture d'un contour ouvert : au moins trois voisins.
      const neighbors = [i - 4, i + 4, i - width * 4, i + width * 4].filter((n) => source[n + 3] > 220);
      if (neighbors.length >= 3) { data.set(source.subarray(a, a + 4), i); break; }
    }
  }
}

/** Masque circulaire de peau : ni carré de maillot, ni bras pendant le vol du dribble. */
export function handMask(data: Uint8ClampedArray, width: number, height: number, cx: number, cy: number, radius: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data.length);
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, Math.ceil(cx + radius)); x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > radius) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      let keep = skinPixel(data[i], data[i + 1], data[i + 2]);
      // Conserver le trait d'encre immédiatement contigu aux doigts, sans étendre la peau.
      if (!keep && Math.max(data[i], data[i + 1], data[i + 2]) < 48) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const n = (ny * width + nx) * 4;
          if (data[n + 3] > 128 && skinPixel(data[n], data[n + 1], data[n + 2])) keep = true;
        }
      }
      if (keep) output.set(data.subarray(i, i + 4), i);
    }
  }
  return output;
}
