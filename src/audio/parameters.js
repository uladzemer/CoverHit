export function clamp01(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(1, n));
}

export function hitParameters(strength, variation = 0.5) {
  const s = clamp01(strength);
  const jitter = (clamp01(variation) - 0.5) * 2;
  return {
    gain: 0.22 + s * 0.48,
    frequency: 65 + s * 40 + jitter * 5,
    cutoff: 360 + s * 1100 + jitter * 60,
    duration: 0.16 + s * 0.09,
    slap: 0.035 + s * 0.09,
    dust: 0.025 + s * 0.045,
  };
}

export function comboFrequency(level) {
  const n = Number(level);
  const step = Math.max(0, Math.min(24, Number.isFinite(n) ? Math.floor(n) - 1 : 0));
  const semitones = [0, 2, 4, 7, 9][step % 5] + 12 * Math.floor(step / 5);
  return 330 * 2 ** (semitones / 12);
}

// Wire deliberately retains the original six parameter values and synthesis graph.
export const HIT_PRESETS = Object.freeze({
  wire: Object.freeze({ body: 1, brightness: 1, slap: 1, decay: 1, click: 0, ring: 0 }),
  rattan: Object.freeze({ body: 1.08, brightness: 0.55, slap: 0.25, decay: 1.1, click: 0, ring: 0 }),
  plastic: Object.freeze({ body: 0.42, brightness: 1.5, slap: 0.7, decay: 0.6, click: 1500, ring: 0 }),
  spring: Object.freeze({ body: 0.95, brightness: 0.9, slap: 0.7, decay: 1.05, click: 0, ring: 520 }),
  bamboo: Object.freeze({ body: 0.6, brightness: 1.2, slap: 0.5, decay: 0.72, click: 920, ring: 0 }),
});

export function hitPresetParameters(strength, preset = 'wire', variation = 0.5) {
  const base = hitParameters(strength, variation);
  const p = Object.hasOwn(HIT_PRESETS, preset) ? HIT_PRESETS[preset] : HIT_PRESETS.wire;
  return {
    ...base,
    gain: base.gain * p.body,
    cutoff: base.cutoff * p.brightness,
    duration: base.duration * p.decay,
    slap: base.slap * p.slap,
    click: p.click,
    ring: p.ring,
  };
}
