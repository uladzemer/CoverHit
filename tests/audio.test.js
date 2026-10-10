import { Sfx } from '../src/audio/sfx.js';
import { describe, expect, it } from 'vitest';
import { clamp01, comboFrequency, hitParameters, hitPresetParameters, HIT_PRESETS } from '../src/audio/parameters.js';

describe('audio parameter mapping', () => {
  it('clamps strength and volume including invalid numeric input', () => {
    expect([-1, 0, 0.4, 1, 2, NaN, Infinity, -Infinity].map(clamp01))
      .toEqual([0, 0, 0.4, 1, 1, 0, 1, 0]);
    expect(hitParameters(-5)).toEqual(hitParameters(0));
    expect(hitParameters(5)).toEqual(hitParameters(1));
  });

  it('makes strong hits louder, brighter, and longer with a bounded low thump', () => {
    const soft = hitParameters(0);
    const hard = hitParameters(1);
    for (const key of ['gain', 'cutoff', 'duration', 'slap', 'dust']) {
      expect(hard[key]).toBeGreaterThan(soft[key]);
    }
    for (const strength of [0, 0.5, 1]) {
      for (const variation of [0, 0.5, 1]) {
        const p = hitParameters(strength, variation);
        expect(p.frequency).toBeGreaterThanOrEqual(60);
        expect(p.frequency).toBeLessThanOrEqual(110);
        expect(p.cutoff).toBeGreaterThan(0);
      }
    }
    expect(hitParameters(0.5, 0).frequency).not.toBe(hitParameters(0.5, 1).frequency);
  });

  it('uses ascending pentatonic steps and repeats at the octave', () => {
    const notes = Array.from({ length: 25 }, (_, i) => comboFrequency(i + 1));
    notes.slice(1).forEach((frequency, i) => expect(frequency).toBeGreaterThan(notes[i]));
    expect(comboFrequency(6)).toBeCloseTo(comboFrequency(1) * 2);
    expect(comboFrequency(2) / comboFrequency(1)).toBeCloseTo(2 ** (2 / 12));
    expect(comboFrequency(4) / comboFrequency(1)).toBeCloseTo(2 ** (7 / 12));
  });

  it('bounds malformed or excessive combo levels', () => {
    for (const level of [NaN, Infinity, -Infinity, -2, 0]) {
      expect(comboFrequency(level)).toBe(comboFrequency(1));
    }
    expect(comboFrequency(2.9)).toBe(comboFrequency(2));
    expect(comboFrequency(100000)).toBe(comboFrequency(25));
  });
});

// Preset synthesis can be checked without an AudioContext or sound files.
describe('beater sound presets', () => {
  it('retains wire parameters and falls back safely', () => {
    const wire = hitPresetParameters(0.7);
    const { click, ring, ...legacy } = wire;
    expect(legacy).toEqual(hitParameters(0.7));
    expect(click).toBe(0); expect(ring).toBe(0);
    expect(hitPresetParameters(0.7, 'unknown')).toEqual(wire);
    expect(hitPresetParameters(0.7, 'toString')).toEqual(wire);
  });
  it('distinguishes soft rattan, weaker plastic, ringing spring and bamboo clack', () => {
    const wire = hitPresetParameters(0.8);
    const rattan = hitPresetParameters(0.8, 'rattan');
    const plastic = hitPresetParameters(0.8, 'plastic');
    const spring = hitPresetParameters(0.8, 'spring');
    const bamboo = hitPresetParameters(0.8, 'bamboo');
    expect(rattan.cutoff).toBeLessThan(wire.cutoff); expect(rattan.slap).toBeLessThan(wire.slap);
    expect(plastic.gain).toBeLessThan(wire.gain); expect(plastic.click).toBeGreaterThan(0);
    expect(spring.ring).toBeGreaterThan(0); expect(bamboo.click).toBeGreaterThan(0);
    expect(bamboo.click).not.toBe(plastic.click);
    for (const preset of Object.keys(HIT_PRESETS)) for (const strength of [NaN,-1,0,0.5,1,Infinity]) {
      const p = hitPresetParameters(strength,preset);
      Object.values(p).forEach(n => { expect(Number.isFinite(n)).toBe(true); expect(n).toBeGreaterThanOrEqual(0); });
    }
  });
  it('uses each preset in the synthesized voice and preserves default wire dispatch', () => {
    const sfx = new Sfx(); sfx.context = { state: 'running', currentTime: 4 };
    sfx._voice = () => ({});
    const tones = [], noises = [];
    sfx._tone = (...args) => tones.push(args.slice(1));
    sfx._noise = (...args) => noises.push(args.slice(1));
    for (const preset of Object.keys(HIT_PRESETS)) {
      tones.length = 0; noises.length = 0; sfx.hit(0.8,preset);
      expect(noises.length).toBe(3); expect(tones.length).toBe(preset === 'spring' ? 4 : ['bamboo','plastic'].includes(preset) ? 2 : 1);
    }
    tones.length = 0; sfx.hit(0.8); expect(tones.length).toBe(1);
  });
});

