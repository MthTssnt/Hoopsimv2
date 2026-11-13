import { appearanceFor } from './sprites/appearance';
import { blockGesture, headingFor, nextHeading, PLAYER_VIEW_TUNING, spriteStateFor, type BodyView, type JumpKind, type SpriteState } from './playerView';
import type { Heading } from './sprites/views';
import type { MatchWorld, PassFlight, PlayKind, ShotRecord } from '../world/MatchWorld';
import { STEAL_FLOW } from '../world/steal';
const BLOCK_RANGE = 3;
export interface BodyClocks {
  id: string;
  direction: { x: number; y: number } | null;
  airborne: boolean;
  /** Temps de vol du saut en cours (s). */
  air: number;
  /** Geste du saut en cours (tir, layup, dunk), gardé jusqu'à l'atterrissage. */
  play: PlayKind | null;
  /** Saut sans ballon : contre, rebond ou entre-deux, décidé au décollage. */
  jumpKind: JumpKind | null;
  /** Temps depuis le lâcher pendant ce saut, l'atterrissage, la passe, la prise, le lâcher d'un lancer (s), ou null. */
  release: number | null;
  landing: number | null;
  pass: number | null;
  lob: boolean;
  caught: number | null;
  catching: boolean;
  freeThrow: number | null;
}

const newClocks = (): BodyClocks => ({ id: '', direction: null, airborne: false, air: 0, play: null, jumpKind: null, release: null, landing: null, pass: null, lob: false, caught: null, catching: false, freeThrow: null });
const tick = (t: number | null, dt: number) => (t === null ? null : t + dt);
export class GestureTracker {
  readonly world: MatchWorld;
  clocks: BodyClocks[] = [];
  headings: Heading[] = [];
  views: BodyView[] = [];
  states: SpriteState[] = [];
  private seenPass: object | null = null;
  private flyingPass: PassFlight | null = null;
  private seenShot: ShotRecord | null = null;
  constructor(world: MatchWorld) { this.world = world; this.advance(0); }
  advance(dt: number) {
    const world = this.world;
    while (this.clocks.length < world.players.length) this.clocks.push(newClocks());
    const pass = world.pass;
    world.players.forEach((body, i) => {
      if (this.clocks[i].id !== body.athlete.id) {
        this.clocks[i] = { ...newClocks(), id: body.athlete.id };
        this.headings[i] = 'down';
      }
      const c = this.clocks[i];
      c.pass = tick(c.pass, dt);
      c.landing = tick(c.landing, dt);
      c.caught = tick(c.caught, dt);
      c.freeThrow = tick(c.freeThrow, dt);
      if (c.freeThrow !== null && c.freeThrow * 1000 >= PLAYER_VIEW_TUNING.freeThrowHoldMs) c.freeThrow = null;
      // Réception : la passe arrive bientôt dans ses mains, ou vient d'y arriver.
      if (this.flyingPass && this.flyingPass.receiver === i && !pass && world.holder === i) c.caught = 0;
      const arriving = pass !== null && pass.receiver === i && (pass.time - pass.elapsed) * 1000 < PLAYER_VIEW_TUNING.catchMs;
      c.catching = !body.airborne && (arriving || (c.caught !== null && c.caught * 1000 < PLAYER_VIEW_TUNING.catchMs));
      if (body.airborne && !c.airborne) {
        // Décollage : tir, layup, dunk ; sinon entre-deux, contre près d'un tireur adverse en l'air, ou rebond.
        c.air = 0;
        c.release = null;
        c.landing = null;
        c.play = world.shot?.shooter === i ? world.shot.kind : null;
        c.jumpKind = c.play ? null : this.jumpKindFor(i);
      } else if (body.airborne) {
        c.air += dt;
        if (world.shot?.shooter === i) c.play = world.shot.kind;
      }
      if (body.airborne && (world.followThrough[i] ?? false)) c.release = c.release === null ? 0 : c.release + dt;
      if (!body.airborne && c.airborne) {
        c.landing = 0;
        c.play = null;
        c.jumpKind = null;
        c.release = null;
      }
      c.airborne = body.airborne;
    });
    // New events are set after aging; short passes cannot disappear between displayed frames.
    // Passe : le passeur prend la pose ; elle est lobée au-delà de `lobDistance`.
    if (pass && pass !== this.seenPass) {
      this.seenPass = pass;
      const from = world.players[pass.passer].pos;
      const c = this.clocks[pass.passer];
      c.pass = 0;
      c.direction = { x: pass.target.x - from.x, y: pass.target.y - from.y };
      c.lob = Math.hypot(pass.target.x - from.x, pass.target.y - from.y) > PLAYER_VIEW_TUNING.lobDistance;
    }

    if (world.lastShot !== this.seenShot) {
      this.seenShot = world.lastShot;
      if (world.lastShot?.kind === 'lancer') this.clocks[world.lastShot.shooter].freeThrow = 0;
    }
    this.flyingPass = pass;
    this.views = world.players.map((_, i) => this.read(i));
    this.states = this.views.map(spriteStateFor);
  }

  /** Saut sans ballon : entre-deux, contre (de la main en face de la main de tir adverse), ou rebond. */
  private jumpKindFor(index: number): JumpKind {
    const world = this.world;
    if (world.full?.phase === 'entre-deux') return 'tipoff';
    const me = world.players[index].pos;
    for (let j = 0; j < world.players.length; j++) {
      const other = world.players[j];
      if (world.team[j] === world.team[index] || !other.airborne || !(world.shot?.shooter === j || this.clocks[j]?.play)) continue;
      if (Math.hypot(other.pos.x - me.x, other.pos.y - me.y) > BLOCK_RANGE) continue;
      const hand = (k: number) => appearanceFor(world.players[k].athlete).dominantHand;
      return blockGesture(hand(j), hand(index));
    }
    return 'rebound';
  }

  private read(index: number): BodyView {
    const body = this.world.players[index], pos = body.pos;
    const shot = this.world.shot?.shooter === index ? this.world.shot : null;
    this.headings[index] ??= 'down';
    const speed = Math.hypot(body.vel.x, body.vel.y);
    // Le tireur fait face au panier, dans la vue du secteur de la direction du cercle.
    const towardRim = (rim: { x: number; y: number }) => ({ x: rim.x - pos.x, y: rim.y - pos.y });
    this.headings[index] = nextHeading(this.headings[index], body.vel, body.airborne, shot ? towardRim(shot.hoop.rim) : null);
    const clock = this.clocks[index];
    const holding = this.world.holder === index;
    // Lancer franc : le tireur fait face au cercle (mise en place, visée, lâcher).
    const ft = this.world.full?.phase === 'lancers' ? this.world.full.freeThrows : null;
    let freeThrow: BodyView['freeThrow'] = null;
    if (ft && ft.shooter === index && holding) freeThrow = { stage: ft.aim !== null ? 'aim' : 'setup' };
    else if (clock.freeThrow !== null && !body.airborne && !holding) freeThrow = { stage: 'after', since: clock.freeThrow };
    if (freeThrow) this.headings[index] = headingFor(towardRim(this.world.hoopFor(index).rim), this.headings[index]);
    // Passe et vol : tourné vers le receveur ou vers le ballon.
    const reachStart = (this.world.reachUntil[index] ?? 0) - STEAL_FLOW.gesture;
    const sinceReach = this.world.clock >= reachStart && this.world.clock < reachStart + STEAL_FLOW.gesture ? this.world.clock - reachStart : null;
    const passing = clock.pass !== null && clock.pass * 1000 < PLAYER_VIEW_TUNING.passMs;
    let facingSign: number = body.facing;
    if (!body.airborne && !holding && (passing || sinceReach !== null)) {
      const target = sinceReach !== null ? this.world.ball.pos : null;
      const toward = target ? { x: target.x - pos.x, y: target.y - pos.y } : clock.direction ?? { x: body.facing, y: 0 };
      this.headings[index] = headingFor(toward, this.headings[index]);
      facingSign = Math.sign(toward.x) || body.facing;
    }
    return {
      airborne: body.airborne,
      speed,
      holding,
      facing: facingSign,
      heading: this.headings[index],
      shot: shot?.kind ?? clock.play,
      followThrough: this.world.followThrough[index] ?? false,
      air: body.airborne ? { time: clock.air, rising: body.vel.z > 0, progress: pos.z / Math.max(0.1, shot?.dunk?.apex ?? body.jumpHeight) } : null,
      sinceRelease: clock.release,
      jumpKind: clock.jumpKind,
      freeThrow,
      sincePass: clock.pass,
      lob: clock.lob,
      catching: clock.catching,
      sinceCatch: clock.caught,
      motionPhase: (this.world.clock * 1.5) % 1,
      sinceLanding: clock.landing,
      sinceReach,
      offBalance: (this.world.offBalance[index] ?? 0) > 0,
    };
  }
}
