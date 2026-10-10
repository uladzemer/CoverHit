import { clamp01, comboFrequency, hitPresetParameters } from './parameters.js';

const FLOOR = 0.0001;

/** Procedural sound. Call unlock() directly from a pointer/key gesture. */
export class Sfx {
  constructor() {
    this.context = null;
    this.volume = 0.8;
    this._ambienceWanted = false;
    this._yard = null;
    this._unlockPending = null;
  }

  unlock() {
    try {
      if (!this.context || this.context.state === 'closed') {
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
    if (this._ambienceWanted) {
      if (this._ready()) this._startYard();
    } else if (this._yard) {
      const yard = this._yard;
      this._yard = null;
      yard.active = false;
      const time = this.context.currentTime;
      yard.gain.gain.cancelAndHoldAtTime(time);
      yard.gain.gain.linearRampToValueAtTime(0, time + 0.6);
      for (const voice of yard.voices) {
        for (const source of voice.sources) source.stop(time + 0.65);
      }
    }
  }

  _startYard() {
    if (this._yard || !this._ready()) return;
    const gain = this.context.createGain();
    const time = this.context.currentTime;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(1, time + 0.8);
    gain.connect(this.master);
    const yard = { gain, active: true, voices: new Set() };
    this._yard = yard;
    this._yardChunk(yard, time);
  }

  _yardChunk(yard, time) {
    if (!yard.active || !this._ready()) return;
    const voice = this._voice(yard.gain);
    yard.voices.add(voice);
    // Six-second overlapping beds avoid seams without persistent source nodes.
    this._noise(voice, time, 6, 0.018, 220);
    this._tone(voice, time, 6, 74, 0.006);
    const chirpTime = time + 1 + Math.random() * 2;
    for (let i = 0; i < 2; i++) {
      const start = chirpTime + i * 0.22;
      const carrier = this.context.createOscillator();
      const modulator = this.context.createOscillator();
      const depth = voice.node(this.context.createGain());
      carrier.frequency.setValueAtTime(2900, start);
      carrier.frequency.exponentialRampToValueAtTime(4300, start + 0.07);
      carrier.frequency.exponentialRampToValueAtTime(2700, start + 0.16);
      modulator.frequency.value = 36;
      depth.gain.value = 180;
      modulator.connect(depth);
      depth.connect(carrier.frequency);
      carrier.connect(this._envelope(voice, start, 0.18, 0.012, 0.012));
      voice.source(carrier, start, start + 0.2);
      voice.source(modulator, start, start + 0.2);
    }
    if (Math.random() < 0.28) {
      const start = time + 3.5;
      if (Math.random() < 0.6) {
        for (let i = 0; i < 2; i++) {
          this._noise(voice, start + i * 0.3, 0.14, 0.012, 500, 'bandpass');
          this._tone(voice, start + i * 0.3, 0.13, 180, 0.007, 'triangle', 100);
        }
      } else {
        this._tone(voice, start, 0.5, 650, 0.005, 'triangle', 420);
      }
    }
    // Silent audio-clock trigger schedules the next bed while this one fades.
    const clockVoice = this._voice(yard.gain);
    const trigger = this.context.createOscillator();
    const silence = clockVoice.node(this.context.createGain());
    silence.gain.value = 0;
    trigger.connect(silence);
    silence.connect(yard.gain);
    // Separate trigger ownership prevents overriding the voice cleanup handler.
    yard.voices.add(clockVoice);
    clockVoice.source(trigger, time, time + 4);
    clockVoice.onended = () => {
      yard.voices.delete(clockVoice);
      if (yard.active) this._yardChunk(yard, this.context.currentTime);
      else if (!yard.voices.size) yard.gain.disconnect();
    };
    voice.onended = () => {
      yard.voices.delete(voice);
      if (!yard.active && !yard.voices.size) yard.gain.disconnect();
    };
  }
}

