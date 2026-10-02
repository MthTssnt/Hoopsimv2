import { reach } from '../../engine/athletics';
import type { Rng } from '../../engine/rng';
import { canDunk, gaugeTime, resolveDunk, resolveShot, type Contest, type DunkContext, type ShotKind, type ShotMode, type ShotSpeed, type ShotZone, type TimingGrade } from '../../engine/shot';
import type { Player } from '../../engine/types';
import { BALL_PHYSICS, stepBall, type BallState } from '../physics/ball';
import { BALL_RADIUS, distanceToRim, inPaintHalf, type Court, type Hoop, type HoopSide, type Vec3 } from '../physics/court';
import { solveDunk } from '../physics/dunk';
import { solveShot } from '../physics/shotSolver';
import { isCleared, mustClearAfterPickup, newOneOnOne, ONE_ON_ONE, startPositions, type OneOnOneState } from './oneOnOne';
import { createPlayerBody, PLAYER_TUNING, setJumpTiming, stepPlayer, type MoveInput, type PlayerBody } from './player';
import { attacksRim, dunkFinish, dunkJumpHeight, layupFinish, releasePoint, SHOT_FLOW, shotZone, targetHoop } from './shooting';

/** Valeurs provisoires, réglables à l'œil. */
export const WORLD_TUNING = {
  /** Un ballon libre est ramassé à moins de cette distance horizontale des pieds (m)… */
  pickupRadius: 0.65,
  /** …et s'il est sous la main tendue (+ marge, m). */
  pickupReachMargin: 0.1,
  /** Délai pendant lequel le tireur ne peut pas rattraper son propre tir (s). */
  pickupCooldown: 0.5,
  /** Dribble : durée d'un aller-retour main → sol → main (s), hauteur de la main (m). */
  dribblePeriod: 0.5,
  dribbleHandHeight: 0.85,
  /**
   * Main qui tient le ballon : écart devant le joueur et vers le spectateur (m). Le ballon est
   * dribblé devant le corps, un peu en avant : l'écart suit le dessin (voir le rig).
   */
  handForward: 0.22,
  handDepth: 0.12,
  /** Rayon d'un joueur au sol (m) : deux joueurs ne se chevauchent jamais. */
  bodyRadius: 0.35,
} as const;

/** Geste de tir : tir en suspension, layup (avec la jauge) ou dunk (simple appui). */
export type PlayKind = ShotKind | 'dunk';

/** Un tir dans le monde : vrai tir (jauge), dunk, ou tir de démo (R/M). */
export interface ShotRecord {
  /** Tir de démo (touches R/M, résultat imposé) ou vrai tir (résultat tiré par `engine/`). */
  demo: boolean;
  /** Index du tireur. */
  shooter: number;
  kind: PlayKind;
  zone: ShotZone;
  /** Point de lâcher du ballon. */
  start: Vec3;
  /** Distance au cercle et 3 pts, mesurées là où le tireur a décollé. */
  distance: number;
  three: boolean;
  hoop: HoopSide;
  /** Défenseur le plus proche au lâcher (au décollage pour un dunk), ou null. */
  contest: Contest | null;
  /** Le tireur avait bien ressorti le ballon (1 contre 1) : sinon, le panier ne compte pas. */
  cleared: boolean;
  /** Résultat tiré par `engine/` (ou imposé pour une démo). */
  wanted: boolean;
  probability: number | null;
  grade: TimingGrade | null;
  /** Écart entre le lâcher et le sommet du saut (s), négatif = trop tôt. */
  timingError: number | null;
  /** Parti tout seul : Tir encore enfoncé à l'atterrissage. */
  forced: boolean;
  /** Panier marqué avant le premier contact avec le parquet. */
  scored: boolean;
  /** Panier marqué mais non valable (ballon pas ressorti). */
  invalid: boolean;
  /** Résultat observé en direct (null tant que le ballon n'a pas touché le sol). */
  live: boolean | null;
}

/** Dunk en cours : résultat déjà tiré à l'appui, smash au sommet, puis accroche si réussi. */
export interface ActiveDunk {
  made: boolean;
  probability: number;
  /** Ballon smashé (le joueur ne le tient plus). */
  slammed: boolean;
  /** Temps d'accroche au cercle restant (s). */
  hang: number;
  /** Hauteur des pieds au sommet (m) : saut relevé si besoin pour que la main dépasse le cercle. */
  apex: number;
}

/**
 * Tir en cours : le tireur est en l'air. Tir et layup : le ballon est au-dessus de la tête et la
 * jauge tourne jusqu'au lâcher. Dunk : jusqu'à l'atterrissage (smash, puis accroche).
 */
export interface ActiveShot {
  shooter: number;
  kind: PlayKind;
  /** Zone mesurée au décollage (layup et dunk : toujours « près du cercle »). */
  zone: ShotZone;
  hoop: Hoop;
  /** Temps passé en l'air depuis le décollage (s). */
  airTime: number;
  /** Vitesse au sol au décollage (m/s) : pénalité du tir en mouvement. */
  takeoffSpeed: number;
  takeoff: Vec3;
  /** Défenseur au décollage (pour un dunk, déjà pris en compte à l'appui). */
  contest: Contest | null;
  dunk: ActiveDunk | null;
}

/** Réglages du tir choisis dans le panneau. */
export interface ShotSettings {
  mode: ShotMode;
  speed: ShotSpeed;
}

/** Ce que le monde reçoit à chaque pas pour un joueur : direction, appui et relâche de Tir. */
export interface WorldInput extends MoveInput {
  /** Tir relâché à ce pas. */
  release?: boolean;
}

const IDLE_INPUT: WorldInput = { x: 0, y: 0, jump: false };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class MatchWorld {
  court: Court;
  readonly players: PlayerBody[] = [];
  controlled = 0;
  ball: BallState;
  /** Index du joueur qui tient le ballon, ou null s'il est libre. */
  holder: number | null = null;
  /** Tir en cours (en l'air, ballon pas encore lâché, ou dunk jusqu'à l'atterrissage). */
  shot: ActiveShot | null = null;
  lastShot: ShotRecord | null = null;
  /** Points marqués par chaque joueur (vrais tirs seulement). */
  points: number[] = [0];
  /** Règles du 1 contre 1, ou null pour un joueur seul (panier le plus proche, pas de règle). */
  rules: OneOnOneState | null = null;
  shotSettings: ShotSettings;
  private readonly rng: Rng;
  private dribbleTime = 0;
  private cooldown = 0;

  constructor(court: Court, athlete: Player, start: Vec3, shotSettings: ShotSettings, rng: Rng) {
    this.court = court;
    this.rng = rng;
    this.shotSettings = { ...shotSettings };
    this.players.push(createPlayerBody(athlete, start, gaugeTime(shotSettings.speed)));
    this.holder = 0;
    this.ball = { pos: this.handPosition(this.players[0]), vel: { x: 0, y: 0, z: 0 } };
  }

  get player(): PlayerBody {
    return this.players[this.controlled];
  }

  /**
   * Passe en 1 contre 1 sur le panier de droite contre `opponent` : chacun à sa place de départ,
   * ballon au joueur 0, score à 0-0.
   */
  startOneOnOne(opponent: Player, target: number = ONE_ON_ONE.target): void {
    if (this.players.length < 2) this.players.push(createPlayerBody(opponent, { x: 0, y: 0, z: 0 }, this.player.timeToApex));
    else this.setAthlete(opponent, 1);
    this.rules = newOneOnOne(this.players.length, target);
    this.resetGame();
  }

  /** Panier visé : celui de droite en 1 contre 1, sinon le plus proche. */
  hoopFor(x: number): Hoop {
    return this.rules ? this.court.hoops.right : targetHoop(this.court, x);
  }

  /** Change un joueur en gardant sa position, sa vitesse et son saut en cours. */
  setAthlete(athlete: Player, index: number = this.controlled): void {
    const old = this.players[index];
    const body = createPlayerBody(athlete, old.pos, old.timeToApex);
    body.facing = old.facing;
    body.vel = { ...old.vel };
    body.airborne = old.airborne;
    this.players[index] = body;
  }

  /** Mode et vitesse de tir : la vitesse règle aussi la durée du saut (sommet = fin de la jauge). */
  setShotSettings(settings: ShotSettings): void {
    this.shotSettings = { ...settings };
    for (const body of this.players) setJumpTiming(body, gaugeTime(settings.speed));
  }

  /** Position du ballon tenu : dribble au sol, levé au-dessus de la tête en l'air. */
  handPosition(body: PlayerBody): Vec3 {
    const t = WORLD_TUNING;
    const x = body.pos.x + body.facing * t.handForward;
    const y = body.pos.y + t.handDepth;
    if (body.airborne) return { x, y, z: body.pos.z + (body.athlete.heightCm / 100) * 1.1 };
    const phase = Math.abs(Math.cos((Math.PI * this.dribbleTime) / t.dribblePeriod));
    return { x, y, z: BALL_RADIUS + (t.dribbleHandHeight - BALL_RADIUS) * phase };
  }

  /**
   * Défenseur le plus proche du joueur `index` face au cercle `hoop` : distance horizontale et
   * `facing`, cosinus de l'angle (tireur → défenseur, tireur → cercle) ramené à 0-1.
   */
  contestFor(index: number, hoop: Hoop): (Contest & { player: Player }) | null {
    const shooter = this.players[index].pos;
    let best: (Contest & { player: Player }) | null = null;
    this.players.forEach((body, i) => {
      if (i === index) return;
      const dx = body.pos.x - shooter.x;
      const dy = body.pos.y - shooter.y;
      const distance = Math.hypot(dx, dy);
      if (best && distance >= best.distance) return;
      const rx = hoop.rim.x - shooter.x;
      const ry = hoop.rim.y - shooter.y;
      const rimDist = Math.hypot(rx, ry);
      const facing = distance < 1e-6 || rimDist < 1e-6 ? 1 : clamp01((dx * rx + dy * ry) / (distance * rimDist));
      best = { distance, facing, player: body.athlete };
    });
    return best;
  }

  /** Contexte de dunk d'un joueur, s'il appuyait sur Tir maintenant (mesures de `match/`). */
  dunkContext(index: number = this.controlled): DunkContext {
    const body = this.players[index];
    const hoop = this.hoopFor(body.pos.x);
    return {
      dunker: body.athlete,
      inDunkZone: inPaintHalf(this.court, hoop, body.pos.x, body.pos.y),
      moveSpeed: Math.hypot(body.vel.x, body.vel.y),
      defender: this.contestFor(index, hoop),
    };
  }

  /**
   * Avance le monde d'un pas. Une entrée par joueur (une seule : celle du joueur 0). Pendant la
   * pause de fin de partie, personne ne bouge, puis la partie reprend à 0-0.
   */
  step(dt: number, inputs: WorldInput | readonly WorldInput[]): void {
    let list: readonly WorldInput[] = Array.isArray(inputs) ? inputs : [inputs as WorldInput];
    if (this.rules && this.rules.winner !== null) {
      this.rules.pause -= dt;
      if (this.rules.pause <= 0) this.resetGame();
      list = [];
    }

    this.players.forEach((body, i) => {
      const input = list[i] ?? IDLE_INPUT;
      // Appui sur Tir avec le ballon, au sol : le tir commence avec le saut. Dunk d'abord (s'il
      // est possible), sinon layup en attaquant le cercle, sinon tir en suspension.
      const startsShot = input.jump && this.holder === i && !body.airborne && this.shot === null;
      const takeoffSpeed = Math.hypot(body.vel.x, body.vel.y);
      const takeoff = { ...body.pos };
      let kind: PlayKind | null = null;
      let dunkCtx: DunkContext | null = null;
      if (startsShot) {
        dunkCtx = this.dunkContext(i);
        if (canDunk(dunkCtx)) kind = 'dunk';
        else kind = attacksRim(body.pos, body.vel, this.hoopFor(body.pos.x)) ? 'layup' : 'jump';
      }
      // Accroché au cercle : le dunkeur ne bouge plus jusqu'à la fin de l'accroche.
      const dunk = this.shot?.shooter === i ? this.shot.dunk : null;
      if (dunk && dunk.hang > 0) dunk.hang = Math.max(0, dunk.hang - dt);
      else stepPlayer(body, input, dt, this.court);
      if (kind) this.startShot(i, kind, takeoffSpeed, takeoff, dunkCtx);
    });
    this.separateBodies();
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.shot) {
      const shooter = this.players[this.shot.shooter];
      const input = list[this.shot.shooter] ?? IDLE_INPUT;
      this.shot.airTime += dt;
      if (this.shot.dunk) this.stepDunk();
      // Lâcher au relâchement de Tir ; Tir encore enfoncé à l'atterrissage : le tir part tout seul.
      else if (input.release) this.releaseShot(false);
      else if (!shooter.airborne) this.releaseShot(true);
    }

    if (this.holder !== null) {
      const holder = this.players[this.holder];
      this.dribbleTime = holder.airborne ? 0 : this.dribbleTime + dt;
      this.ball.pos = this.handPosition(holder);
      this.ball.vel = { ...holder.vel };
      // 1 contre 1 : tenir le ballon derrière l'arc le « ressort ».
      if (this.rules?.mustClear[this.holder] && isCleared(this.court, this.court.hoops.right, holder.pos)) {
        this.rules.mustClear[this.holder] = false;
      }
      return;
    }

    for (const event of stepBall(this.ball, this.court, dt)) {
      const shot = this.lastShot;
      if (!shot || shot.live !== null) continue;
      if (event.type === 'score' && event.hoop === shot.hoop && !shot.scored) this.onBasket(shot);
      if (event.type === 'floor') shot.live = shot.scored;
    }
    this.tryPickup();
  }

  /** Panier marqué : points au tireur, ou panier non valable (pas ressorti) et ballon à l'autre. */
  private onBasket(shot: ShotRecord): void {
    shot.scored = true;
    if (shot.demo) return;
    const rules = this.rules;
    if (rules && !shot.cleared) {
      shot.invalid = true;
      shot.live = true;
      const other = (shot.shooter + 1) % this.players.length;
      this.holder = other;
      this.dribbleTime = 0;
      rules.mustClear[other] = true;
      rules.lastHolder = other;
      return;
    }
    this.points[shot.shooter] += shot.three ? 3 : 2;
    if (rules && rules.winner === null && this.points[shot.shooter] >= rules.target) {
      rules.winner = shot.shooter;
      rules.pause = ONE_ON_ONE.endPause;
    }
  }

  /** Deux joueurs ne se chevauchent jamais : on les écarte à parts égales. */
  private separateBodies(): void {
    const min = 2 * WORLD_TUNING.bodyRadius;
    const m = PLAYER_TUNING.boundsMargin;
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i].pos;
        const b = this.players[j].pos;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
          // Superposés exactement : on écarte le long du terrain.
        }
        const push = (min - Math.hypot(b.x - a.x, b.y - a.y)) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        for (const p of [a, b]) {
          p.x = Math.min(this.court.length + m, Math.max(-m, p.x));
          p.y = Math.min(this.court.width + m, Math.max(-m, p.y));
        }
      }
    }
  }

  /**
   * Début du tir : tourné vers le panier. Un layup file vers un point devant le cercle ; un dunk
   * (résultat tiré dès l'appui) file tout près du cercle et l'atteint au sommet, la main au-dessus.
   */
  private startShot(shooter: number, kind: PlayKind, takeoffSpeed: number, takeoff: Vec3, dunkCtx: DunkContext | null): void {
    const body = this.players[shooter];
    const hoop = this.hoopFor(takeoff.x);
    body.facing = hoop.rim.x >= takeoff.x ? 1 : -1;
    let dunk: ActiveDunk | null = null;
    if (kind === 'dunk' && dunkCtx) {
      const { made, probability } = resolveDunk(dunkCtx, this.rng);
      const T = body.timeToApex;
      // Saut relevé si besoin : la main doit dépasser le cercle au sommet (mise en scène).
      const apex = dunkJumpHeight(body.jumpHeight, reach(body.athlete));
      dunk = { made, probability, slammed: false, hang: 0, apex };
      body.jumpGravity = (2 * apex) / (T * T);
      body.vel.z = body.jumpGravity * T;
      const finish = dunkFinish(takeoff, hoop);
      const vx = (finish.x - takeoff.x) / T;
      const vy = (finish.y - takeoff.y) / T;
      const speed = Math.hypot(vx, vy);
      const k = speed > SHOT_FLOW.dunkMaxSpeed ? SHOT_FLOW.dunkMaxSpeed / speed : 1;
      body.vel.x = vx * k;
      body.vel.y = vy * k;
    }
    if (kind === 'layup') {
      // Le layup garde son propre élan (pas celui, réduit, d'un tir en suspension).
      const finish = layupFinish(takeoff, hoop);
      const airTime = 2 * body.timeToApex;
      const vx = (finish.x - takeoff.x) / airTime;
      const vy = (finish.y - takeoff.y) / airTime;
      const speed = Math.hypot(vx, vy);
      const k = speed > SHOT_FLOW.layupMaxSpeed ? SHOT_FLOW.layupMaxSpeed / speed : 1;
      body.vel.x = vx * k;
      body.vel.y = vy * k;
    }
    const zone: ShotZone = kind === 'jump' ? shotZone(this.court, hoop, takeoff.x, takeoff.y) : 'rim';
    const contest = dunkCtx?.defender ? { distance: dunkCtx.defender.distance, facing: dunkCtx.defender.facing } : null;
    this.shot = { shooter, kind, zone, hoop, airTime: 0, takeoffSpeed, takeoff, contest, dunk };
  }

  /** Le tireur avait-il ressorti le ballon (toujours vrai hors 1 contre 1) ? */
  private cleared(shooter: number): boolean {
    return !this.rules?.mustClear[shooter];
  }

  /** Dunk : smash au sommet du saut, accroche au cercle s'il est réussi, fin à l'atterrissage. */
  private stepDunk(): void {
    const shot = this.shot!;
    const dunk = shot.dunk!;
    const body = this.players[shot.shooter];
    if (!dunk.slammed && shot.airTime >= body.timeToApex) {
      dunk.slammed = true;
      const plan = solveDunk(dunk.made, shot.hoop, shot.takeoff, this.court, this.rng);
      this.ball = { pos: { ...plan.start }, vel: { ...plan.velocity } };
      this.holder = null;
      this.cooldown = WORLD_TUNING.pickupCooldown;
      body.vel.x = 0;
      body.vel.y = 0;
      if (dunk.made) {
        dunk.hang = SHOT_FLOW.dunkHang;
        body.vel.z = 0;
      }
      this.lastShot = {
        demo: false,
        shooter: shot.shooter,
        kind: 'dunk',
        zone: 'rim',
        start: plan.start,
        distance: distanceToRim(shot.hoop, shot.takeoff.x, shot.takeoff.y),
        three: false,
        hoop: shot.hoop.side,
        contest: shot.contest,
        cleared: this.cleared(shot.shooter),
        wanted: dunk.made,
        probability: dunk.probability,
        grade: null,
        timingError: null,
        forced: false,
        scored: false,
        invalid: false,
        live: null,
      };
    }
    if (!body.airborne) this.endShot();
  }

  /** Fin d'un tir en cours : le saut retrouve sa hauteur normale (un dunk a pu la relever). */
  private endShot(): void {
    this.shot = null;
    for (const body of this.players) setJumpTiming(body, body.timeToApex);
  }

  /** Lâcher : `engine/` tire le résultat, la physique produit une trajectoire qui y aboutit. */
  private releaseShot(forced: boolean): void {
    const shot = this.shot!;
    this.endShot();
    const body = this.players[shot.shooter];
    const { hoop, takeoff, zone } = shot;
    const timingError = shot.airTime - body.timeToApex;
    const defender = this.contestFor(shot.shooter, hoop);
    const contest = defender ? { distance: defender.distance, facing: defender.facing } : null;
    const result = resolveShot(
      {
        shooter: body.athlete,
        zone,
        kind: shot.kind === 'layup' ? 'layup' : 'jump',
        mode: this.shotSettings.mode,
        speed: this.shotSettings.speed,
        timingError,
        contest,
        moveSpeed: shot.takeoffSpeed,
      },
      this.rng,
    );
    const start = releasePoint(body.pos, body.athlete.heightCm, hoop, WORLD_TUNING.handDepth);
    this.launch(start, result.made, hoop);
    this.lastShot = {
      demo: false,
      shooter: shot.shooter,
      kind: shot.kind,
      zone,
      start,
      distance: distanceToRim(hoop, takeoff.x, takeoff.y),
      three: zone === 'three',
      hoop: hoop.side,
      contest,
      cleared: this.cleared(shot.shooter),
      wanted: result.made,
      probability: result.probability,
      grade: result.grade,
      timingError,
      forced,
      scored: false,
      invalid: false,
      live: null,
    };
  }

  /**
   * Le ballon quitte la main vers `hoop` avec le résultat voulu. Si aucune trajectoire n'existe
   * (cas extrême), il tombe de la main : raté.
   */
  private launch(start: Vec3, made: boolean, hoop: Hoop): void {
    let velocity: Vec3 = { x: 0, y: 0, z: 0 };
    try {
      velocity = solveShot(start, made, this.court, hoop, this.rng).velocity;
    } catch {
      // Position impossible (sous ou derrière la planche) malgré `releasePoint`.
    }
    this.ball = { pos: { ...start }, vel: velocity };
    this.holder = null;
    this.cooldown = WORLD_TUNING.pickupCooldown;
  }

  /** Ballon libre : ramassé par le joueur à portée le plus proche. */
  private tryPickup(): void {
    if (this.cooldown > 0) return;
    const { pos } = this.ball;
    let picker: number | null = null;
    let best = Infinity;
    this.players.forEach((body, index) => {
      const dist = Math.hypot(pos.x - body.pos.x, pos.y - body.pos.y);
      const reachable = pos.z <= body.pos.z + reach(body.athlete) + WORLD_TUNING.pickupReachMargin;
      if (dist <= WORLD_TUNING.pickupRadius && reachable && dist < best) {
        best = dist;
        picker = index;
      }
    });
    if (picker === null) return;
    this.holder = picker;
    this.dribbleTime = 0;
    const shot = this.lastShot;
    // Rattrapé avant de toucher le parquet (rebond pris en l'air, ballon sous le filet) : le tir est
    // jugé là.
    if (shot && shot.live === null) shot.live = shot.scored;
    if (this.rules) {
      const afterBasket = !!shot && shot.scored && !shot.invalid;
      this.rules.mustClear[picker] = mustClearAfterPickup(picker, this.rules.lastHolder, afterBasket);
      this.rules.lastHolder = picker;
    }
  }

  /** 1 contre 1 : 0-0, positions de départ, ballon au joueur 0 qui n'a rien à ressortir. */
  private resetGame(): void {
    const rules = this.rules!;
    const { attacker, defender } = startPositions(this.court, this.court.hoops.right);
    const places = [attacker, defender];
    this.players.forEach((body, i) => {
      body.pos = { ...(places[i] ?? defender) };
      body.vel = { x: 0, y: 0, z: 0 };
      body.airborne = false;
      body.facing = i === 0 ? 1 : -1;
    });
    this.endShot();
    this.points = this.players.map(() => 0);
    rules.mustClear = this.players.map(() => false);
    rules.lastHolder = 0;
    rules.winner = null;
    rules.pause = 0;
    this.holder = 0;
    this.dribbleTime = 0;
    this.cooldown = 0;
    this.lastShot = null;
    this.ball = { pos: this.handPosition(this.players[0]), vel: { x: 0, y: 0, z: 0 } };
  }

  /**
   * Tir de démonstration (debug, touches R/M) : depuis le porteur s'il y en a un, sinon depuis un
   * point aléatoire autour du panier de droite. Le résultat est imposé, la physique suit ; il ne
   * compte pas au score.
   */
  demoShot(made: boolean): ShotRecord | null {
    let start: Vec3;
    let hoop: Hoop;
    const shooter = this.holder ?? this.controlled;
    if (this.holder !== null) {
      const body = this.players[this.holder];
      hoop = this.hoopFor(body.pos.x);
      start = releasePoint(body.pos, body.athlete.heightCm, hoop, WORLD_TUNING.handDepth);
    } else {
      hoop = this.court.hoops.right;
      const dist = this.rng.range(1.2, 8.5);
      const angle = this.rng.range(-1.4, 1.4);
      start = {
        x: hoop.rim.x - Math.cos(angle) * dist,
        y: Math.min(this.court.width - 0.4, Math.max(0.4, hoop.rim.y + Math.sin(angle) * dist)),
        z: this.rng.range(2.2, 2.7),
      };
    }
    let velocity: Vec3;
    try {
      velocity = solveShot(start, made, this.court, hoop, this.rng).velocity;
    } catch {
      return null; // position impossible (sous ou derrière la planche)
    }
    this.endShot();
    this.ball = { pos: { ...start }, vel: velocity };
    this.holder = null;
    this.cooldown = WORLD_TUNING.pickupCooldown;
    const zone = shotZone(this.court, hoop, start.x, start.y);
    this.lastShot = {
      demo: true,
      shooter,
      kind: 'jump',
      zone,
      start,
      distance: distanceToRim(hoop, start.x, start.y),
      three: zone === 'three',
      hoop: hoop.side,
      contest: null,
      cleared: true,
      wanted: made,
      probability: null,
      grade: null,
      timingError: null,
      forced: false,
      scored: false,
      invalid: false,
      live: null,
    };
    return this.lastShot;
  }
}

/** Pas fixe partagé par le monde et la physique du ballon. */
export const WORLD_DT = BALL_PHYSICS.dt;
