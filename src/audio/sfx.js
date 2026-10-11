import { clamp01, comboFrequency, hitPresetParameters } from './parameters.js';

const FLOOR = 0.0001;

/** Procedural sound. Call unlock() directly from a pointer/key gesture. */
export class Sfx {
  constructor(options = {}) {
    this.options = options;
    this._yardImport = null;
    this._disposed = false;
    this.context = null;
    this.volume = 0.8;
    this._ambienceWanted = false;
    this._yard = null;
    this._unlockPending = null;
  }

  unlock() {
    try {
      if (!this.context || this.context.state === 'closed') {
        this._yard?.dispose();
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return Promise.resolve();
        const context = new Context();
        const master = context.createGain();
        const compressor = context.createDynamicsCompressor();
        master.gain.value = this.volume;
        compressor.threshold.value = -12;
        compressor.knee.value = 18;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.18;
        master.connect(compressor);
        compressor.connect(context.destination);
        this.context = context;
        this.master = master;
        this._yard = null;
      }
      if (!this._unlockPending) {
        // resume() is invoked synchronously, preserving the user activation.
        this._unlockPending = Promise.resolve(this.context.resume()).then(() => {
          if (this._ambienceWanted) this._startYard();
        }).catch(() => {}).finally(() => { this._unlockPending = null; });
      }
      return this._unlockPending;
    } catch {
      return Promise.resolve();
    }
  }

  setVolume(volume) {
    this.volume = clamp01(volume);
    if (this.context && this.context.state !== 'closed') {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.025);
      if (this.volume > 0 && this._ambienceWanted) this._startYard();
      else this._yard?.setEnabled(false);
    }
  }

  _ready() { return this.context?.state === 'running'; }

  // Every voice owns its entire graph; the last source frees all nodes.
  _voice(destination = this.master) {
    const nodes = [];
    const sources = [];
    let remaining = 0;
    const voice = {
      node: (node) => { nodes.push(node); return node; },
      source: (source, start, end) => {
        nodes.push(source);
        sources.push(source);
        remaining++;
        source.onended = () => {
          source.onended = null;
          if (--remaining === 0) {
            nodes.forEach((node) => node.disconnect());
            voice.onended?.();
          }
        };
        source.start(start);
        source.stop(end);
        return source;
      },
      destination,
      sources,
      onended: null,
    };
    return voice;
  }

  _envelope(voice, time, duration, gain, attack = 0.003) {
    const node = voice.node(this.context.createGain());
    node.gain.setValueAtTime(FLOOR, time);
    node.gain.exponentialRampToValueAtTime(Math.max(FLOOR, gain), time + attack);
    node.gain.exponentialRampToValueAtTime(FLOOR, time + duration);
    node.connect(voice.destination);
    return node;
  }

  _tone(voice, time, duration, frequency, gain, type = 'sine', endFrequency = frequency) {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration * 0.7);
    oscillator.connect(this._envelope(voice, time, duration, gain));
    voice.source(oscillator, time, time + duration + 0.02);
  }

  _noise(voice, time, duration, gain, cutoff, type = 'lowpass') {
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = voice.node(this.context.createBiquadFilter());
    filter.type = type;
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    source.connect(filter);
    filter.connect(this._envelope(voice, time, duration, gain));
    voice.source(source, time, time + duration + 0.02);
  }

  hit(strength, preset = 'wire') {
    if (!this._ready()) return;
    this._yard?.duck();
    const p = hitPresetParameters(strength, preset, Math.random());
    const time = this.context.currentTime;
    const voice = this._voice();
    this._tone(voice, time, p.duration, p.frequency, p.gain, 'sine', 42);
    this._noise(voice, time, 0.10, p.gain * 0.8, p.cutoff);
    this._noise(voice, time, 0.024, p.slap, 2300 + clamp01(strength) * 1800, 'highpass');
    this._noise(voice, time + 0.035, 0.32, p.dust, 1800, 'bandpass');
    if (p.click) this._tone(voice, time, 0.035, p.click, p.slap * 1.8, 'triangle', p.click * 0.45);
    if (p.ring) {
      // Several falling modes give a metallic spring recoil rather than a bell.
      for (const [ratio, gain] of [[1, 0.11], [2.73, 0.035], [4.16, 0.018]]) {
        this._tone(voice, time, 0.34 / Math.sqrt(ratio), p.ring * ratio, gain * (0.3 + clamp01(strength)), 'sine', p.ring * ratio * 0.62);
      }
    }
  }

  flip() {
    if(!this._ready())return;
    const time=this.context.currentTime,voice=this._voice();
    this._tone(voice,time,.3,85,.22,'sine',45);
    this._noise(voice,time,.18,.12,420);
  }

  _bell(time, frequency, gain = 0.14, duration = 0.48) {
    const voice = this._voice();
    this._tone(voice, time, duration, frequency, gain);
    this._tone(voice, time, duration * 0.55, frequency * 2.01, gain * 0.25);
  }

  combo(level) {
    if (this._ready()) this._bell(this.context.currentTime, comboFrequency(level));
  }

  moth() {
    if (!this._ready()) return;
    const time = this.context.currentTime;
    [880, 1320, 1100].forEach((frequency, i) => this._bell(time + i * 0.065, frequency, 0.085, 0.22));
  }

  carpetDone() {
    if (!this._ready()) return;
    const time = this.context.currentTime;
    [392, 494, 587, 784].forEach((frequency, i) => this._bell(time + i * 0.13, frequency, 0.16, i === 3 ? 0.85 : 0.35));
    this._bell(time + 0.39, 494, 0.08, 0.85);
    this._bell(time + 0.39, 587, 0.08, 0.85);
  }

  neighbor() {
    if (!this._ready()) return;
    const time = this.context.currentTime;
    const voice = this._voice();
    const distance = voice.node(this.context.createBiquadFilter());
    distance.type = 'lowpass';
    distance.frequency.value = 2100;
    distance.connect(voice.destination);
    const oscillator = this.context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(185, time);
    [230, 205, 260, 190, 220, 150].forEach((pitch, i) => {
      oscillator.frequency.linearRampToValueAtTime(pitch, time + (i + 1) * 0.18);
    });
    [650, 1250, 1900].forEach((frequency, formant) => {
      const filter = voice.node(this.context.createBiquadFilter());
      filter.type = 'bandpass';
      filter.Q.value = 5;
      filter.frequency.setValueAtTime(frequency, time);
      filter.frequency.linearRampToValueAtTime(frequency * 0.75, time + 1.2);
      const gain = voice.node(this.context.createGain());
      gain.gain.setValueAtTime(FLOOR, time);
      for (let i = 0; i < 6; i++) {
        const onset = time + i * 0.19;
        gain.gain.linearRampToValueAtTime(0.07 / (formant + 1), onset + 0.025);
        gain.gain.exponentialRampToValueAtTime(FLOOR, onset + 0.17);
      }
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(distance);
    });
    voice.source(oscillator, time, time + 1.2);
  }

  ambience(on) {
    this._ambienceWanted = Boolean(on);
    if (this._ambienceWanted && this.volume > 0 && this._ready()) this._startYard();
    else this._yard?.setEnabled(false);
  }

  _startYard() {
    if (this._disposed || !this._ready() || !this._ambienceWanted || this.volume <= 0) return;
    if (this._yard) { this._yard.setEnabled(true); return; }
    if (this._yardImport) return;
    const context = this.context;
    this._yardImport = import('./ambience.js').then(({ Ambience }) => {
      if (this._disposed || context !== this.context || context.state === 'closed') return;
      this._yard = new Ambience(context, this.master, this.options);
      this._yard.setEnabled(this._ambienceWanted && this.volume > 0);
    }).catch(() => {}).finally(() => { this._yardImport = null; });
  }

  dispose() {
    this._disposed = true;
    this._ambienceWanted = false;
    this._yard?.dispose(); this._yard = null;
    void this.context?.close();
  }
}
