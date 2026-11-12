/** Déformation en mètres, indépendante de la cadence de rendu et du score accordé. */
export function netShape(elapsed: number, dunk = false): { drop: number; flare: number; sway: number } {
  if (elapsed < 0 || elapsed >= 1.1) return { drop: 0.48, flare: 0.62, sway: 0 };
  const strength = dunk ? 1.5 : 1;
  const pulse = Math.sin(Math.PI * Math.min(1, elapsed / 0.22));
  const settle = elapsed < 0.22 ? 0 : Math.sin((elapsed - 0.22) * 25) * Math.exp(-(elapsed - 0.22) * 6);
  return { drop: 0.48 + strength * (0.23 * pulse + 0.05 * settle),
    flare: 0.62 + strength * (0.36 * pulse + 0.08 * settle), sway: strength * 0.065 * settle };
}
