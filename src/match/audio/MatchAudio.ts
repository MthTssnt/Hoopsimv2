import type { MatchWorld } from '../world/MatchWorld';
import type { MatchSettings } from '../settings';
import { PLAYER_TUNING } from '../world/player';

type Sound = 'floor' | 'rim' | 'board' | 'net' | 'foot' | 'whistle' | 'siren';
/** Synthesized effects only; never consumes the match RNG or advances simulation. */
export class MatchAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: Pick<MatchSettings, 'audioVolume' | 'audioMuted'>;
  private closed = false;
  private lastImpact = 0;
  private lastEvent = 0;
  private phase = 0;
  private feet = new Map<string, number>();
  private recent = new Map<Sound, number>();
  private played: Partial<Record<Sound, number>> = {};
  private voices = 0;
  constructor(settings: MatchSettings) {
    this.settings = settings;
    window.addEventListener('pointerdown', this.unlock);
    window.addEventListener('keydown', this.unlock);
  }
  private unlock = () => {
    if (this.closed || typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * 0.15), this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      // Repeatable noise, completely independent of game random state.
      for (let i = 0; i < data.length; i++) { const n = Math.sin(i * 12.9898) * 43758.5453; data[i] = (n - Math.floor(n)) * 2 - 1; }
      this.configure(this.settings);
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  };
  configure(settings: Pick<MatchSettings, 'audioVolume' | 'audioMuted'>) {
    this.settings = settings;
    if (this.context && this.master) this.master.gain.setTargetAtTime(settings.audioMuted ? 0 : settings.audioVolume * settings.audioVolume, this.context.currentTime, 0.01);
  }
  observe(world: MatchWorld) {
    for (const event of world.ballImpacts) if (event.id > this.lastImpact) {
      this.emit(event.kind, event.kind === 'floor' ? Math.min(1, event.strength / 5) : 1);
      this.lastImpact = event.id;
    }
    const p = world.dribblePhase;
    if (this.phase < 0.5 && p >= 0.5 && world.holder !== null && !world.players[world.holder].airborne && !world.shot && (!world.full || world.full.phase === 'jeu')) this.emit('floor', 0.45);
    this.phase = p;
    for (const body of world.players) {
      const step = Math.floor(body.strideDistance / (PLAYER_TUNING.strideMeters / 2)), id = body.athlete.id;
      const previous = this.feet.get(id);
      if (previous !== undefined && previous !== step && !body.airborne && Math.hypot(body.vel.x, body.vel.y) > 1.4) this.emit('foot', 0.3);
      this.feet.set(id, step);
    }
    // Keep only active players: replacement identities do not accumulate across seasons.
    if (this.feet.size > world.players.length * 2) {
      const active = new Set(world.players.map((body) => body.athlete.id));
      for (const id of this.feet.keys()) if (!active.has(id)) this.feet.delete(id);
    }
    for (const event of world.events) if (event.id > this.lastEvent) {
      if (event.kind === 'faute-main' || event.kind === 'faute-tir' || event.kind === 'faute-intentionnelle') this.emit('whistle', 0.4);
      if (event.kind === 'sirène') this.emit('siren', 0.6);
      this.lastEvent = event.id;
    }
  }
  private emit(kind: Sound, strength: number) {
    const ctx = this.context, master = this.master;
    if (!ctx || !master || ctx.state !== 'running' || this.settings.audioMuted || this.settings.audioVolume === 0 || strength < 0.1 || this.voices >= 24) return;
    const now = ctx.currentTime;
    if (now - (this.recent.get(kind) ?? -Infinity) < (kind === 'foot' ? 0.09 : 0.04)) return;
    this.recent.set(kind, now);
    const noisy = kind === 'net' || kind === 'foot';
    const duration = kind === 'siren' ? 0.65 : kind === 'net' ? 0.08 : kind === 'foot' ? 0.035 : kind === 'whistle' ? 0.12 : 0.09;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(Math.max(0.001, strength * (kind === 'foot' ? 0.12 : 0.3)), now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration); gain.connect(master);
    let source: AudioScheduledSourceNode;
    if (noisy) {
      const buffer = ctx.createBufferSource(); buffer.buffer = this.noise;
      const filter = ctx.createBiquadFilter(); filter.type = kind === 'foot' ? 'highpass' : 'lowpass'; filter.frequency.value = kind === 'foot' ? 1200 : 2000;
      buffer.connect(filter); filter.connect(gain); source = buffer;
      source.onended = () => { filter.disconnect(); gain.disconnect(); this.voices--; };
    } else {
      const oscillator = ctx.createOscillator(); oscillator.type = kind === 'rim' ? 'triangle' : 'sine';
      const frequency = kind === 'siren' ? 620 : kind === 'rim' ? 740 : kind === 'board' ? 220 : kind === 'whistle' ? 1700 : 145;
      oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === 'whistle' ? 1.05 : 0.4), now + duration);
      oscillator.connect(gain); source = oscillator;
      source.onended = () => { gain.disconnect(); this.voices--; };
    }
    this.voices++; source.start(now); source.stop(now + duration);
    this.played[kind] = (this.played[kind] ?? 0) + 1;
  }
  status() { return { state: this.context?.state ?? 'locked', played: { ...this.played }, muted: this.settings.audioMuted, volume: this.settings.audioVolume }; }
  close() {
    this.closed = true;
    window.removeEventListener('pointerdown', this.unlock); window.removeEventListener('keydown', this.unlock);
    if (this.context) void this.context.close().catch(() => {});
  }
}
