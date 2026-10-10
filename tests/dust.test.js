import { describe, expect, it } from 'vitest';
import { allocateEmission, emissionProfile, particleBudget } from '../src/fx/dust/emission.js';
import { DirtMap } from '../src/carpet/dirt.js';

describe('dust emission calibrated to carpet dirt', () => {
  it('emits nothing for empty or invalid amounts', () => {
    for (const amount of [0, -1, NaN, Infinity, undefined]) {
      expect(emissionProfile(amount).total).toBe(0);
      expect(emissionProfile(amount).size).toBe(0);
    }
    expect(emissionProfile(0.00001).total).toBe(0);
  });

  it('scales all layers and puff size monotonically and saturates huge inputs', () => {
    let previous = emissionProfile(0);
    for (const amount of [0.0001, 0.001, 0.004, 0.015, 0.025, 0.06, 1, 1e9]) {
      const next = emissionProfile(amount);
      for (const key of ['cloud', 'specks', 'haze', 'edge', 'total', 'size']) {
        expect(next[key]).toBeGreaterThanOrEqual(previous[key]);
        expect(Number.isFinite(next[key])).toBe(true);
      }
      previous = next;
    }
    expect(emissionProfile(1)).toEqual(emissionProfile(0.08));
  });

  it('produces a layered fresh hit and almost nothing on a clean spot', () => {
    const dirt = new DirtMap();
    const fresh = emissionProfile(dirt.hit(0.5, 0.5, 1.4));
    expect(fresh.cloud).toBeGreaterThan(20);
    expect(fresh.specks).toBeGreaterThan(80);
    expect(fresh.haze).toBeGreaterThan(0);
    expect(fresh.edge).toBeGreaterThan(0);
    let clean;
    for (let i = 0; i < 80; i++) clean = emissionProfile(dirt.hit(0.5, 0.5, 1.4));
    expect(clean.total).toBeLessThan(fresh.total * 0.01);
    expect(clean.edge).toBe(0);
  });

  it('keeps repeated emission within budget and reserves haze headroom', () => {
    for (const capacity of [0, 1, 25, 400, 3000, 4000]) {
      const live = { cloud: 0, haze: 0, specks: 0 };
      for (let i = 0; i < 100; i++) {
        const admitted = allocateEmission(emissionProfile(1), capacity, live);
        live.cloud += admitted.cloud + admitted.edge;
        live.haze += admitted.haze;
        live.specks += admitted.specks;
        expect(live.cloud + live.haze + live.specks).toBeLessThanOrEqual(particleBudget(capacity));
      }
      expect(allocateEmission(emissionProfile(1), capacity, live).total).toBe(0);
    }
    const admitted = allocateEmission(emissionProfile(0.025), 3000, { cloud: 1650, specks: 1110 });
    expect(admitted.cloud + admitted.edge + admitted.specks).toBe(0);
    expect(admitted.haze).toBeGreaterThan(0);
  });

  it('clamps optional capacity to an integer no greater than 3000', () => {
    expect(particleBudget(-20)).toBe(0);
    expect(particleBudget(123.9)).toBe(123);
    expect(particleBudget(4000)).toBe(3000);
    expect(particleBudget(NaN)).toBe(3000);
  });
});
