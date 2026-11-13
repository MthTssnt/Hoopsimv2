import type { Court } from '../physics/court';
import type { PlayerBody } from './player';

export function bodyRadius(body: PlayerBody): number {
  return Math.max(0.29, Math.min(0.43, 0.34 + (body.athlete.weightKg - 90) * 0.0012));
}

/** Mass and planted feet resist displacement; only closing normal velocity is stopped. */
export function resolveBodies(players: readonly PlayerBody[], court: Court, anchor: number | null): void {
  const inverse = (body: PlayerBody, i: number) => i === anchor ? 0 : 1 / (body.athlete.weightKg *
    (1 + body.athlete.attrs.strength / 150) * (Math.hypot(body.vel.x, body.vel.y) < 0.2 && !body.airborne ? 1.8 : 1));
  for (let iteration = 0; iteration < 3; iteration++) for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j];
    if (a.pos.z > b.pos.z + b.athlete.heightCm / 100 || b.pos.z > a.pos.z + a.athlete.heightCm / 100) continue;
    const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, distance = Math.hypot(dx, dy);
    const overlap = bodyRadius(a) + bodyRadius(b) - distance;
    if (overlap <= 0) continue;
    const nx = distance > 1e-6 ? dx / distance : 1, ny = distance > 1e-6 ? dy / distance : 0;
    const ia = inverse(a, i), ib = inverse(b, j), total = ia + ib;
    if (!total) continue;
    const push = Math.min(0.06, Math.max(0, overlap - 0.002)) / total;
    a.pos.x -= nx * push * ia; a.pos.y -= ny * push * ia;
    b.pos.x += nx * push * ib; b.pos.y += ny * push * ib;
    const closing = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
    if (closing < 0) {
      const impulse = -closing / total;
      a.vel.x -= nx * impulse * ia; a.vel.y -= ny * impulse * ia;
      b.vel.x += nx * impulse * ib; b.vel.y += ny * impulse * ib;
    }
    for (const body of [a, b]) {
      body.pos.x = Math.max(-1.5, Math.min(court.length + 1.5, body.pos.x));
      body.pos.y = Math.max(-1.5, Math.min(court.width + 1.5, body.pos.y));
    }
  }
}
