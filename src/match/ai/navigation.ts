import type { MatchWorld } from '../world/MatchWorld';
import { bodyRadius } from '../world/bodyContacts';

/** Local clearance scoring with deterministic passing sides, retaining the intended destination. */
export function navigate(world: MatchWorld, index: number, target: { x: number; y: number }, full: boolean) {
  const body = world.players[index];
  let goalX = Math.max(0.35, Math.min(world.court.length - 0.35, target.x));
  if (world.full?.frontcourt && world.holder === index) {
    const direction = -world.attackHoop(world.team[index]).toCourt;
    goalX = direction > 0 ? Math.max(goalX, world.court.length / 2 + 0.8) : Math.min(goalX, world.court.length / 2 - 0.8);
  }
  const dx = goalX - body.pos.x, dy = Math.max(0.35, Math.min(world.court.width - 0.35, target.y)) - body.pos.y, distance = Math.hypot(dx, dy);
  if (distance < 0.08) return { x: 0, y: 0, jump: false };
  const angle = Math.atan2(dy, dx), look = Math.min(distance, 1.6), radius = bodyRadius(body);
  let best = { x: dx / distance, y: dy / distance, score: -Infinity };
  for (const turn of [0, 0.5, -0.5, 1, -1, 1.4, -1.4]) {
    const ux = Math.cos(angle + turn), uy = Math.sin(angle + turn);
    let penalty = 0;
    for (let j = 0; j < world.players.length; j++) {
      if (j === index) continue;
      const other = world.players[j], ox = other.pos.x - body.pos.x, oy = other.pos.y - body.pos.y;
      const along = ox * ux + oy * uy;
      if (along < -0.1 || along > look + 0.3) continue;
      const clearance = Math.abs(ox * uy - oy * ux), wanted = radius + bodyRadius(other) + 0.16;
      if (clearance < wanted) penalty += (wanted - clearance) * (1.8 - Math.min(1.4, Math.max(0, along))) * 3;
    }
    const tx = body.pos.x + ux * look, ty = body.pos.y + uy * look;
    if (world.full?.frontcourt && world.holder === index) {
      const direction = world.attackHoop(world.team[index]).toCourt * -1;
      if ((tx - world.court.length / 2) * direction < 0.45) penalty += 8;
    }
    if (tx < 0.35 || tx > world.court.length - 0.35 || ty < 0.35 || ty > world.court.width - 0.35) penalty += 2;
    const score = Math.cos(turn) - penalty - (turn < 0 ? 0.002 : 0);
    if (score > best.score) best = { x: ux, y: uy, score };
  }
  const speed = full ? 1 : Math.min(1, distance / 0.8);
  return { x: best.x * speed, y: best.y * speed, jump: false };
}
