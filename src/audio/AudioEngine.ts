import { Timeline } from '../core/enums';

export enum Sfx {
  Jump = 'jump',
  Land = 'land',
  Shift = 'shift',
  Reject = 'reject',
  Collect = 'collect',
  Checkpoint = 'checkpoint',
  Winch = 'winch',
  Bell = 'bell',
  Death = 'death',
  Respawn = 'respawn',
  PortalUnstable = 'portalUnstable',
  PortalActivate = 'portalActivate',
  Flash = 'flash',
  MenuMove = 'menuMove',
  MenuSelect = 'menuSelect',
  Dash = 'dash',
  AirJump = 'airJump',
  Crumble = 'crumble',
  Pulse = 'pulse',
  Unravel = 'unravel',
  Unlock = 'unlock',
  LevelComplete = 'levelComplete',
}

const MUTE_STORAGE_KEY = 'timeline-merge:muted';
const MASTER_LEVEL = 0.8;
const PAD_LEVEL = 0.055;
const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'touchend'] as const;

function readStoredMute(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function storeMute(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    return;
  }
}

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  reverb: GainNode;
  dawnPad: GainNode;
  eclipsePad: GainNode;
  portalHum: GainNode;
  noise: AudioBuffer;
}

export class AudioEngine {
  private graph: Graph | null = null;
  private muted = readStoredMute();
  private timeline: Timeline = Timeline.Dawn;
  private disposed = false;
  private readonly unlockHandler = (): void => this.unlock();
  private readonly visibilityHandler = (): void => this.onVisibilityChange();

  get isMuted(): boolean {
    return this.muted;
  }

  armUnlock(): void {
    this.listenForUnlock(true);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  dispose(): void {
    this.disposed = true;
    this.listenForUnlock(false);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    void this.graph?.ctx.close();
    this.graph = null;
  }

  unlock(): void {
    if (this.disposed) return;
    if (!this.graph) {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        this.graph = this.build(new AudioContextClass());
      } catch (error) {
        console.warn('[Timeline Merge] Audio is unavailable:', error);
        this.listenForUnlock(false);
        return;
      }
    }
    const ctx = this.graph.ctx;
    if (ctx.state === 'running') {
      this.listenForUnlock(false);
      return;
    }
    if (!document.hidden) {
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') this.listenForUnlock(false);
        })
        .catch(() => undefined);
    }
  }

  private listenForUnlock(enabled: boolean): void {
    for (const type of UNLOCK_EVENTS) {
      if (enabled) window.addEventListener(type, this.unlockHandler);
      else window.removeEventListener(type, this.unlockHandler);
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    storeMute(this.muted);
    if (this.graph) {
      const now = this.graph.ctx.currentTime;
      this.graph.master.gain.cancelScheduledValues(now);
      this.graph.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_LEVEL, now, 0.08);
    }
    return this.muted;
  }

  setTimeline(timeline: Timeline): void {
    this.timeline = timeline;
    if (!this.graph) return;
    const now = this.graph.ctx.currentTime;
    this.graph.dawnPad.gain.setTargetAtTime(timeline === Timeline.Dawn ? PAD_LEVEL : 0.0001, now, 0.35);
    this.graph.eclipsePad.gain.setTargetAtTime(timeline === Timeline.Eclipse ? PAD_LEVEL : 0.0001, now, 0.35);
  }

  setBothRealities(): void {
    if (!this.graph) return;
    const now = this.graph.ctx.currentTime;
    this.graph.dawnPad.gain.setTargetAtTime(PAD_LEVEL, now, 0.8);
    this.graph.eclipsePad.gain.setTargetAtTime(PAD_LEVEL * 0.8, now, 0.8);
  }

  setPortalProximity(amount: number): void {
    if (!this.graph) return;
    this.graph.portalHum.gain.setTargetAtTime(Math.max(0.0001, amount * 0.07), this.graph.ctx.currentTime, 0.3);
  }

  play(sfx: Sfx, intensity = 1): void {
    const graph = this.graph;
    if (!graph || this.muted || graph.ctx.state !== 'running') return;
    const t = graph.ctx.currentTime + 0.005;
    switch (sfx) {
      case Sfx.Jump:
        this.noiseBurst(graph, t, 0.07, 1800, 1.2, 0.05);
        this.tone(graph, t, 'sine', 300, 540, 0.09, 0.05);
        break;
      case Sfx.Land:
        this.noiseBurst(graph, t, 0.1, 320, 0.8, 0.09 * intensity);
        this.tone(graph, t, 'sine', 95, 55, 0.12, 0.12 * intensity);
        break;
      case Sfx.Shift: {
        const toDawn = this.timeline === Timeline.Dawn;
        this.sweep(graph, t, toDawn ? 380 : 2600, toDawn ? 2600 : 380, 0.38, 0.16);
        const notes = toDawn ? [880, 1318.5] : [440, 622.3];
        notes.forEach((frequency, index) => this.bell(graph, t + index * 0.04, frequency, 0.9, 0.05, 0.6));
        break;
      }
      case Sfx.Reject:
        this.tone(graph, t, 'sine', 150, 70, 0.18, 0.18);
        this.tone(graph, t, 'square', 98, 92, 0.12, 0.025);
        this.noiseBurst(graph, t, 0.05, 900, 2, 0.05);
        break;
      case Sfx.Collect:
        [659.3, 830.6, 987.8, 1318.5].forEach((frequency, index) => this.bell(graph, t + index * 0.075, frequency, 1.4, 0.07, 0.8));
        break;
      case Sfx.Checkpoint:
        this.bell(graph, t, 523.3, 1.6, 0.06, 0.7);
        this.bell(graph, t + 0.06, 784, 1.6, 0.045, 0.7);
        break;
      case Sfx.Winch:
        this.grind(graph, t, 1.7);
        this.tone(graph, t + 1.6, 'sine', 120, 60, 0.3, 0.2);
        break;
      case Sfx.Bell:
        [196, 392 * 1.01, 523.3, 784 * 0.99, 1046.5].forEach((frequency, index) => this.bell(graph, t, frequency, 3.6 - index * 0.4, 0.09 / (index + 1), 1));
        break;
      case Sfx.Death:
        this.tone(graph, t, 'sine', 620, 110, 0.6, 0.1);
        this.noiseBurst(graph, t, 0.35, 600, 0.6, 0.05);
        break;
      case Sfx.Respawn:
        this.tone(graph, t, 'sine', 320, 900, 0.5, 0.05);
        this.bell(graph, t + 0.2, 880, 1, 0.03, 0.6);
        break;
      case Sfx.PortalUnstable:
        this.tone(graph, t, 'sawtooth', 110, 104, 0.7, 0.04);
        this.tone(graph, t, 'sawtooth', 116.5, 121, 0.7, 0.04);
        this.noiseBurst(graph, t, 0.5, 400, 0.5, 0.05);
        break;
      case Sfx.PortalActivate:
        this.sweep(graph, t, 200, 3000, 4.5, 0.08);
        [110, 164.8, 220, 277.2, 329.6].forEach((frequency, index) => this.swell(graph, t + index * 0.25, frequency, 5.5, 0.04));
        break;
      case Sfx.Flash:
        [440, 554.4, 659.3, 880, 1318.5].forEach((frequency) => this.bell(graph, t, frequency, 3, 0.05, 1));
        break;
      case Sfx.MenuMove:
        this.tone(graph, t, 'sine', 920, 880, 0.05, 0.035);
        break;
      case Sfx.MenuSelect:
        this.tone(graph, t, 'sine', 660, 990, 0.14, 0.05);
        this.bell(graph, t + 0.05, 1318.5, 0.6, 0.025, 0.6);
        break;
      case Sfx.Dash:
        this.noiseBurst(graph, t, 0.16, 2600, 0.9, 0.08);
        this.sweep(graph, t, 1800, 500, 0.2, 0.05);
        break;
      case Sfx.AirJump:
        this.noiseBurst(graph, t, 0.06, 2400, 1.4, 0.04);
        this.tone(graph, t, 'sine', 420, 820, 0.11, 0.05);
        this.bell(graph, t + 0.02, 1046.5, 0.5, 0.025, 0.5);
        break;
      case Sfx.Crumble:
        this.noiseBurst(graph, t, 0.32, 260, 0.7, 0.12);
        this.tone(graph, t, 'triangle', 140, 60, 0.3, 0.06);
        break;
      case Sfx.Pulse:
        this.tone(graph, t, 'sine', 240, 180, 0.2, 0.06);
        this.bell(graph, t, 1174.7, 0.6, 0.03, 0.7);
        break;
      case Sfx.Unravel:
        this.sweep(graph, t, 90, 40, 1.6, 0.12);
        this.noiseBurst(graph, t, 1.2, 180, 0.4, 0.07);
        break;
      case Sfx.Unlock:
        [523.3, 659.3, 784, 1046.5, 1318.5].forEach((frequency, index) => this.bell(graph, t + index * 0.09, frequency, 2.2, 0.06, 0.9));
        this.sweep(graph, t, 300, 2400, 1.2, 0.04);
        break;
      case Sfx.LevelComplete:
        [392, 493.9, 587.3, 784].forEach((frequency, index) => this.bell(graph, t + index * 0.12, frequency, 2.4, 0.07, 0.9));
        break;
    }
  }

  private onVisibilityChange(): void {
    const graph = this.graph;
    if (!graph) return;
    if (document.hidden) {
      void graph.ctx.suspend();
    } else {
      this.listenForUnlock(true);
      this.unlock();
    }
  }

  private build(ctx: AudioContext): Graph {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : MASTER_LEVEL;
    master.connect(compressor);

    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse(ctx, 2.8);
    const reverb = ctx.createGain();
    reverb.gain.value = 0.55;
    reverb.connect(convolver);
    convolver.connect(master);

    const sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;

    const ambience = ctx.createGain();
    ambience.gain.value = 1;
    ambience.connect(master);
    ambience.connect(reverb);

    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.7;
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.07;
    const windDepth = ctx.createGain();
    windDepth.gain.value = 260;
    windLfo.connect(windDepth).connect(windFilter.frequency);
    const windGain = ctx.createGain();
    windGain.gain.value = 0.045;
    wind.connect(windFilter).connect(windGain).connect(ambience);
    wind.start();
    windLfo.start();

    const dawnPad = this.pad(ctx, [220, 277.18, 329.63, 440, 659.25], 'sine', 1500, ambience);
    const eclipsePad = this.pad(ctx, [55, 58.27, 110, 164.81, 698.46], 'sawtooth', 360, ambience);
    dawnPad.gain.value = this.timeline === Timeline.Dawn ? PAD_LEVEL : 0.0001;
    eclipsePad.gain.value = this.timeline === Timeline.Eclipse ? PAD_LEVEL : 0.0001;

    const portalHum = ctx.createGain();
    portalHum.gain.value = 0.0001;
    const humTremolo = ctx.createGain();
    humTremolo.gain.value = 0.6;
    const humLfo = ctx.createOscillator();
    humLfo.frequency.value = 3.2;
    const humDepth = ctx.createGain();
    humDepth.gain.value = 0.4;
    humLfo.connect(humDepth).connect(humTremolo.gain);
    for (const frequency of [110, 164.8, 220.5]) {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(humTremolo);
      oscillator.start();
    }
    humTremolo.connect(portalHum).connect(ambience);
    humLfo.start();

    return { ctx, master, sfx, reverb, dawnPad, eclipsePad, portalHum, noise };
  }

  private pad(ctx: AudioContext, frequencies: number[], type: OscillatorType, cutoff: number, destination: AudioNode): GainNode {
    const output = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.05;
    const filterDepth = ctx.createGain();
    filterDepth.gain.value = cutoff * 0.35;
    filterLfo.connect(filterDepth).connect(filter.frequency);
    filterLfo.start();
    frequencies.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (index % 2 === 0 ? 1 : -1) * (4 + index * 2);
      const voice = ctx.createGain();
      voice.gain.value = 0.22 / (1 + index * 0.35);
      oscillator.connect(voice).connect(filter);
      oscillator.start();
    });
    filter.connect(output).connect(destination);
    return output;
  }

  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index++) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 3);
      }
    }
    return buffer;
  }

  private envelope(graph: Graph, start: number, attack: number, duration: number, peak: number, reverbAmount: number): GainNode {
    const gain = graph.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(graph.sfx);
    if (reverbAmount > 0) {
      const send = graph.ctx.createGain();
      send.gain.value = reverbAmount;
      gain.connect(send).connect(graph.reverb);
    }
    return gain;
  }

  private tone(graph: Graph, start: number, type: OscillatorType, from: number, to: number, duration: number, peak: number): void {
    const oscillator = graph.ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    oscillator.connect(this.envelope(graph, start, 0.008, duration, peak, 0.2));
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  private bell(graph: Graph, start: number, frequency: number, duration: number, peak: number, reverbAmount: number): void {
    const output = this.envelope(graph, start, 0.005, duration, peak, reverbAmount);
    for (const [ratio, level] of [[1, 1], [2.01, 0.35], [3.02, 0.12]] as const) {
      const oscillator = graph.ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * ratio;
      const partial = graph.ctx.createGain();
      partial.gain.value = level;
      oscillator.connect(partial).connect(output);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }
  }

  private swell(graph: Graph, start: number, frequency: number, duration: number, peak: number): void {
    const gain = graph.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(graph.sfx);
    gain.connect(graph.reverb);
    const oscillator = graph.ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  private noiseSource(graph: Graph, start: number, duration: number): AudioBufferSourceNode {
    const source = graph.ctx.createBufferSource();
    source.buffer = graph.noise;
    source.loop = true;
    source.start(start, Math.random() * 1.5);
    source.stop(start + duration + 0.05);
    return source;
  }

  private noiseBurst(graph: Graph, start: number, duration: number, frequency: number, q: number, peak: number): void {
    const filter = graph.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    this.noiseSource(graph, start, duration).connect(filter).connect(this.envelope(graph, start, 0.005, duration, peak, 0.1));
  }

  private sweep(graph: Graph, start: number, from: number, to: number, duration: number, peak: number): void {
    const filter = graph.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    this.noiseSource(graph, start, duration).connect(filter).connect(this.envelope(graph, start, duration * 0.4, duration, peak, 0.4));
  }

  private grind(graph: Graph, start: number, duration: number): void {
    const filter = graph.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    const flutter = graph.ctx.createGain();
    flutter.gain.value = 0.5;
    const lfo = graph.ctx.createOscillator();
    lfo.frequency.value = 17;
    const depth = graph.ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(flutter.gain);
    lfo.start(start);
    lfo.stop(start + duration + 0.05);
    this.noiseSource(graph, start, duration).connect(filter).connect(flutter).connect(this.envelope(graph, start, 0.15, duration, 0.35, 0.3));
  }
}
