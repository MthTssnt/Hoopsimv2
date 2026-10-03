import { POSITION_INDEX } from './ratings';
import type { Rng } from './rng';
import {
  drainEnergy,
  energyFactor,
  FOUL_OUT,
  inBonus,
  matchRotation,
  newCoachContext,
  nextLineup,
  restEnergy,
  rotationTargets,
  seatLineup,
  startingEnergy,
  startingLineup,
  SUB_INTERVAL,
  updateCoachContext,
  type CoachContext,
} from './rotation';
import { freeThrowBase, SHOT_MODEL } from './shot';
import {
  emptyStatLine,
  playerName,
  type AttributeKey,
  type BoxScoreRow,
  type GameResult,
  type PlayEvent,
  type Player,
  type StatLine,
  type Team,
} from './types';

const PERIOD_SECONDS = 720;
const OT_SECONDS = 300;
const REGULATION_PERIODS = 4;

interface LivePlayer {
  id: string;
  player: Player;
  overall: number;
  posIndex: number;
  energy: number;
  onCourt: boolean;
  starter: boolean;
  fouledOut: boolean;
  /** Temps de jeu visé sur l'ensemble du match, en secondes. */
  targetSecs: number;
  line: StatLine;
}

interface LiveTeam {
  team: Team;
  rotation: LivePlayer[];
  lineup: LivePlayer[];
  score: number;
  periodScores: number[];
  periodFouls: number;
  isHome: boolean;
}

export interface GameSimOptions {
  /** Conserver le déroulé action par action (coûteux : réservé aux matchs affichés). */
  collectPbp?: boolean;
  /** Terrain neutre : pas d'avantage pour l'équipe « à domicile ». */
  neutralCourt?: boolean;
}

/** Note d'attribut corrigée par la fatigue. */
function eff(lp: LivePlayer, key: AttributeKey): number {
  return lp.player.attrs[key] * energyFactor(lp.energy);
}

function lineupAvg(team: LiveTeam, key: AttributeKey): number {
  let sum = 0;
  for (const lp of team.lineup) sum += eff(lp, key);
  return sum / team.lineup.length;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function simulateGame(
  rng: Rng,
  gameId: string,
  homeTeam: Team,
  awayTeam: Team,
  players: Record<string, Player>,
  options: GameSimOptions = {},
): GameResult {
  const home = buildLiveTeam(homeTeam, players, true);
  const away = buildLiveTeam(awayTeam, players, false);
  const pbp: PlayEvent[] = [];
  const collectPbp = options.collectPbp ?? false;
  const hca = options.neutralCourt ? 0 : 1;

  const ctx = newCoachContext();
  // Le cinq de départ, ce sont les cinq premiers de la rotation.
  setStartingLineup(home);
  setStartingLineup(away);
  for (const lp of [...home.lineup, ...away.lineup]) {
    lp.starter = true;
    lp.line.gs = 1;
  }

  let period = 1;
  let elapsedTotal = 0;
  // L'équipe qui attaque en premier alterne à chaque période.
  let offenseIsHome = rng.chance(0.5);
  const firstPossessionHome = offenseIsHome;

  const log = (text: string, teamId: string | null, clock: number, highlight = false) => {
    if (!collectPbp) return;
    pbp.push({ period, clock, teamId, text, homeScore: home.score, awayScore: away.score, highlight });
  };

  for (;;) {
    const periodLength = period <= REGULATION_PERIODS ? PERIOD_SECONDS : OT_SECONDS;
    let clock = periodLength;
    home.periodFouls = 0;
    away.periodFouls = 0;
    home.periodScores.push(0);
    away.periodScores.push(0);
    offenseIsHome = period % 2 === 1 ? firstPossessionHome : !firstPossessionHome;
    let sinceLastSub = 0;

    log(
      period <= REGULATION_PERIODS ? `Début du ${period}${period === 1 ? 'er' : 'e'} quart-temps` : `Début de la prolongation ${period - REGULATION_PERIODS}`,
      null,
      clock,
    );

    while (clock > 0) {
      const off = offenseIsHome ? home : away;
      const def = offenseIsHome ? away : home;

      const margin = Math.abs(home.score - away.score);
      updateCoachContext(ctx, period, clock, elapsedTotal, REGULATION_PERIODS * PERIOD_SECONDS, margin, REGULATION_PERIODS);

      if (sinceLastSub >= SUB_INTERVAL) {
        setLineup(home, ctx);
        setLineup(away, ctx);
        sinceLastSub = 0;
      }

      const base = clamp(rng.normal(14.4, 5.2), 3, 24);
      const displayClock = Math.max(0, clock - base);
      const extra = runPossession(rng, off, def, displayClock, log, hca, ctx);
      const elapsed = Math.min(clock, base + extra);

      advanceTime(home, elapsed);
      advanceTime(away, elapsed);
      clock -= elapsed;
      elapsedTotal += elapsed;
      sinceLastSub += elapsed;
      offenseIsHome = !offenseIsHome;
    }

    // Récupération entre les périodes (plus longue à la mi-temps).
    for (const lp of [...home.rotation, ...away.rotation]) {
      lp.energy = restEnergy(lp.energy, period);
    }

    const tied = home.score === away.score;
    if (period >= REGULATION_PERIODS && !tied) break;
    if (period >= REGULATION_PERIODS + 6) break; // garde-fou
    period += 1;
  }

  log(`Fin du match : ${homeTeam.abbr} ${home.score} - ${away.score} ${awayTeam.abbr}`, null, 0, true);

  const periods = home.periodScores.map((h, i) => ({ home: h, away: away.periodScores[i] ?? 0 }));
  const box = {
    gameId,
    homeId: homeTeam.id,
    awayId: awayTeam.id,
    homeScore: home.score,
    awayScore: away.score,
    periods,
    rows: {
      [homeTeam.id]: toRows(home),
      [awayTeam.id]: toRows(away),
    },
  };

  // Report de l'énergie de fin de match sur le joueur (récupérée entre les rencontres).
  for (const lp of [...home.rotation, ...away.rotation]) {
    lp.player.energy = lp.energy;
  }

  return { homeScore: home.score, awayScore: away.score, periods, box, pbp };
}

function buildLiveTeam(team: Team, players: Record<string, Player>, isHome: boolean): LiveTeam {
  const available = matchRotation(team, players);
  // L'ordre de la rotation choisi par l'entraîneur fixe les minutes visées :
  // le premier de la liste joue le plus, le dernier le moins.
  const targetById = rotationTargets(available);

  return {
    team,
    rotation: available.map((player) => ({
      id: player.id,
      player,
      overall: player.overall,
      posIndex: POSITION_INDEX[player.pos],
      energy: startingEnergy(player),
      onCourt: false,
      starter: false,
      fouledOut: false,
      targetSecs: targetById.get(player.id) ?? 0,
      line: emptyStatLine(),
    })),
    lineup: [],
    score: 0,
    periodScores: [],
    periodFouls: 0,
    isHome,
  };
}

/** Aligne les cinq premiers joueurs de la rotation, chacun au poste qui lui va le mieux. */
function setStartingLineup(team: LiveTeam): void {
  const next = startingLineup(team.rotation);
  seatLineup(team.rotation, next);
  team.lineup = next;
}

function setLineup(team: LiveTeam, ctx: CoachContext): void {
  const next = nextLineup(team.rotation, ctx);
  seatLineup(team.rotation, next);
  team.lineup = next;
}

function advanceTime(team: LiveTeam, seconds: number): void {
  for (const lp of team.rotation) {
    if (lp.onCourt) lp.line.secs += seconds;
    lp.energy = drainEnergy(lp.energy, lp.player.attrs.stamina, seconds, lp.onCourt);
  }
}

type LogFn = (text: string, teamId: string | null, clock: number, highlight?: boolean) => void;

function addScore(off: LiveTeam, def: LiveTeam, points: number): void {
  off.score += points;
  off.periodScores[off.periodScores.length - 1] += points;
  for (const lp of off.lineup) lp.line.plusMinus += points;
  for (const lp of def.lineup) lp.line.plusMinus -= points;
}

function weightedPlayer(rng: Rng, lineup: LivePlayer[], weightFn: (lp: LivePlayer) => number): LivePlayer {
  return lineup[rng.weightedIndex(lineup.map(weightFn))];
}

/** Déroule une possession complète, rebonds offensifs compris. Renvoie le temps additionnel consommé. */
function runPossession(
  rng: Rng,
  off: LiveTeam,
  def: LiveTeam,
  clock: number,
  log: LogFn,
  hca: number,
  ctx: CoachContext,
): number {
  let extra = 0;

  // --- Perte de balle ---
  const handler = weightedPlayer(rng, off.lineup, (lp) => eff(lp, 'handling') * 0.6 + eff(lp, 'passing') * 0.4);
  const pressure = lineupAvg(def, 'steal') * 0.55 + lineupAvg(def, 'perimeterDef') * 0.45;
  const security = eff(handler, 'handling') * 0.5 + eff(handler, 'iq') * 0.3 + eff(handler, 'passing') * 0.2;
  const tovChance = clamp(0.128 + (pressure - security) * 0.0022 - (off.isHome ? hca * 0.004 : 0), 0.05, 0.26);

  if (rng.chance(tovChance)) {
    handler.line.tov += 1;
    if (rng.chance(0.55)) {
      const thief = weightedPlayer(rng, def.lineup, (lp) => Math.pow(eff(lp, 'steal') / 50, 2.2));
      thief.line.stl += 1;
      log(`Interception de ${playerName(thief.player)} sur ${playerName(handler.player)}`, def.team.id, clock);
    } else {
      log(`Perte de balle de ${playerName(handler.player)}`, off.team.id, clock);
    }
    return extra;
  }

  // --- Faute sans tir (envoi en bonus) ---
  if (rng.chance(0.1)) {
    const fouler = weightedPlayer(rng, def.lineup, (lp) => 110 - eff(lp, 'iq'));
    fouler.line.pf += 1;
    def.periodFouls += 1;
    checkFoulOut(fouler, def, log, clock, ctx);
    if (inBonus(def.periodFouls)) {
      log(`Faute de ${playerName(fouler.player)} — bonus, ${playerName(handler.player)} sur la ligne`, def.team.id, clock);
      shootFreeThrows(rng, handler, off, def, 2, clock, log);
      return extra;
    }
    log(`Faute de ${playerName(fouler.player)}`, def.team.id, clock);
  }

  // --- Séquence de tir, prolongée par les rebonds offensifs ---
  for (let attempt = 0; attempt < 4; attempt++) {
    const outcome = runShotSequence(rng, off, def, clock - extra, log, hca, attempt > 0, ctx);
    if (outcome !== 'offreb') break;
    extra += 4;
  }
  return extra;
}

type ShotOutcome = 'end' | 'offreb';

function runShotSequence(
  rng: Rng,
  off: LiveTeam,
  def: LiveTeam,
  clock: number,
  log: LogFn,
  hca: number,
  isPutback: boolean,
  ctx: CoachContext,
): ShotOutcome {
  const shooter = isPutback
    ? weightedPlayer(rng, off.lineup, (lp) => Math.pow(eff(lp, 'offReb') / 50, 2) + 0.4)
    : weightedPlayer(rng, off.lineup, (lp) => lp.player.tendencies.usage * (0.65 + 0.35 * (lp.energy / 100)));

  const t = shooter.player.tendencies;
  const shotType: 'rim' | 'mid' | 'three' = isPutback
    ? 'rim'
    : (['rim', 'mid', 'three'] as const)[rng.weightedIndex([t.rim, t.mid, t.three])];

  // Le défenseur direct est celui qui occupe le même poste dans le cinq adverse.
  const slotIndex = off.lineup.indexOf(shooter);
  const defender = def.lineup[Math.min(slotIndex, def.lineup.length - 1)];

  // --- Faute sur tir ---
  const foulChance = shotType === 'rim' ? 0.15 : shotType === 'mid' ? 0.05 : 0.025;
  if (rng.chance(foulChance)) {
    defender.line.pf += 1;
    def.periodFouls += 1;
    checkFoulOut(defender, def, log, clock, ctx);
    const andOne = shotType === 'rim' && rng.chance(0.3);
    if (andOne) {
      shooter.line.fga += 1;
      shooter.line.fgm += 1;
      registerMake(shooter, off, def, 2, clock, log, `${playerName(shooter.player)} marque au cercle et provoque la faute !`, true);
      return shootFreeThrows(rng, shooter, off, def, 1, clock, log);
    }
    log(`Faute sur ${playerName(shooter.player)}, ${shotType === 'three' ? 'trois' : 'deux'} lancers`, def.team.id, clock);
    return shootFreeThrows(rng, shooter, off, def, shotType === 'three' ? 3 : 2, clock, log);
  }

  // --- Contre ---
  const blockChance =
    shotType === 'rim'
      ? clamp(0.085 + (eff(defender, 'block') * 0.6 + lineupAvg(def, 'block') * 0.4 - 62) * 0.0022, 0.015, 0.2)
      : shotType === 'mid'
        ? 0.024
        : 0.008;
  if (rng.chance(blockChance)) {
    shooter.line.fga += 1;
    if (shotType === 'three') shooter.line.tpa += 1;
    defender.line.blk += 1;
    log(`Contre de ${playerName(defender.player)} sur ${playerName(shooter.player)} !`, def.team.id, clock, true);
    return rebound(rng, off, def, clock, log, false, -0.05);
  }

  // --- Réussite du tir ---
  const skill = shotType === 'rim' ? eff(shooter, 'inside') : shotType === 'mid' ? eff(shooter, 'midRange') : eff(shooter, 'three');
  const defRating =
    shotType === 'rim'
      ? eff(defender, 'interiorDef') * 0.5 + lineupAvg(def, 'interiorDef') * 0.5
      : eff(defender, 'perimeterDef') * 0.65 + lineupAvg(def, 'perimeterDef') * 0.35;

  const { base, pivot, skillSlope, defenseSlope, bounds } = SHOT_MODEL;
  const courtBonus = off.isHome ? hca * 0.011 : -hca * 0.004;
  let p = base[shotType] + (skill - pivot) * skillSlope - (defRating - pivot) * defenseSlope + courtBonus;
  if (isPutback) p += 0.05;
  p = clamp(p, bounds[shotType][0], bounds[shotType][1]);

  shooter.line.fga += 1;
  if (shotType === 'three') shooter.line.tpa += 1;

  if (rng.chance(p)) {
    const points = shotType === 'three' ? 3 : 2;
    if (shotType === 'three') shooter.line.tpm += 1;
    shooter.line.fgm += 1;
    const assistChance = isPutback ? 0.14 : shotType === 'three' ? 0.87 : shotType === 'mid' ? 0.6 : 0.58;
    let assistText = '';
    if (off.lineup.length > 1 && rng.chance(assistChance)) {
      const passer = weightedPlayer(rng, off.lineup, (lp) =>
        lp === shooter ? 0 : Math.pow(eff(lp, 'passing') / 50, 2.5),
      );
      passer.line.ast += 1;
      assistText = ` (passe de ${playerName(passer.player)})`;
    }
    const label =
      shotType === 'three'
        ? `${playerName(shooter.player)} plante un 3 points${assistText}`
        : shotType === 'mid'
          ? `${playerName(shooter.player)} marque à mi-distance${assistText}`
          : isPutback
            ? `Second ballon converti par ${playerName(shooter.player)}`
            : `${playerName(shooter.player)} conclut près du cercle${assistText}`;
    registerMake(shooter, off, def, points, clock, log, label, shotType === 'three');
    return 'end';
  }

  const missLabel =
    shotType === 'three'
      ? `3 points manqué de ${playerName(shooter.player)}`
      : shotType === 'mid'
        ? `Tir à mi-distance manqué de ${playerName(shooter.player)}`
        : `Tentative près du cercle manquée de ${playerName(shooter.player)}`;
  log(missLabel, off.team.id, clock);
  return rebound(rng, off, def, clock, log, false, 0);
}

function registerMake(
  shooter: LivePlayer,
  off: LiveTeam,
  def: LiveTeam,
  points: number,
  clock: number,
  log: LogFn,
  label: string,
  highlight: boolean,
): void {
  // Les compteurs de tirs (fga/fgm/tpm) sont tenus par l'appelant :
  // ici on ne s'occupe que des points et du +/-.
  shooter.line.pts += points;
  addScore(off, def, points);
  log(label, off.team.id, clock, highlight);
}

function checkFoulOut(lp: LivePlayer, team: LiveTeam, log: LogFn, clock: number, ctx: CoachContext): void {
  if (lp.line.pf >= FOUL_OUT && !lp.fouledOut) {
    lp.fouledOut = true;
    log(`${playerName(lp.player)} est éliminé pour six fautes`, team.team.id, clock, true);
    setLineup(team, ctx);
  }
}

function shootFreeThrows(
  rng: Rng,
  shooter: LivePlayer,
  off: LiveTeam,
  def: LiveTeam,
  count: number,
  clock: number,
  log: LogFn,
): ShotOutcome {
  // Les lancers francs dépendent peu de la fatigue : on prend la note brute.
  const p = freeThrowBase(shooter.player.attrs.freeThrow);
  let made = 0;
  for (let i = 0; i < count; i++) {
    shooter.line.fta += 1;
    if (rng.chance(p)) {
      shooter.line.ftm += 1;
      shooter.line.pts += 1;
      addScore(off, def, 1);
      made += 1;
    } else if (i === count - 1) {
      log(`${playerName(shooter.player)} : ${made}/${count} aux lancers`, off.team.id, clock);
      return rebound(rng, off, def, clock, log, true, 0);
    }
  }
  log(`${playerName(shooter.player)} : ${made}/${count} aux lancers`, off.team.id, clock);
  return 'end';
}

function rebound(
  rng: Rng,
  off: LiveTeam,
  def: LiveTeam,
  clock: number,
  log: LogFn,
  isFreeThrow: boolean,
  modifier: number,
): ShotOutcome {
  const offStrength = lineupAvg(off, 'offReb') * 0.75 + lineupAvg(off, 'strength') * 0.25;
  const defStrength = lineupAvg(def, 'defReb') * 0.75 + lineupAvg(def, 'strength') * 0.25;
  const p = clamp(0.245 + (offStrength - defStrength) * 0.0035 + modifier - (isFreeThrow ? 0.06 : 0), 0.1, 0.42);

  if (rng.chance(p)) {
    const rebounder = weightedPlayer(rng, off.lineup, (lp) => Math.pow(eff(lp, 'offReb') / 45, 2.6));
    rebounder.line.oreb += 1;
    log(`Rebond offensif de ${playerName(rebounder.player)}`, off.team.id, clock);
    return 'offreb';
  }
  const rebounder = weightedPlayer(rng, def.lineup, (lp) => Math.pow(eff(lp, 'defReb') / 45, 2.6));
  rebounder.line.dreb += 1;
  log(`Rebond défensif de ${playerName(rebounder.player)}`, def.team.id, clock);
  return 'end';
}

function toRows(team: LiveTeam): BoxScoreRow[] {
  return team.rotation
    .filter((lp) => lp.line.secs > 0 || lp.starter)
    .map((lp) => {
      lp.line.gp = 1;
      return { playerId: lp.id, starter: lp.starter, line: lp.line };
    })
    .sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0) || b.line.secs - a.line.secs);
}

export { formatClock };
