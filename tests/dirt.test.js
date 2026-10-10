import { describe, it, expect } from "vitest";
import { DirtMap } from "../src/carpet/dirt.js";
import { difficultyFor } from '../src/game/difficulty.js';
import { CARPET_TYPES } from '../src/carpet/types.js';

describe("dirt removal", () => {
  it("cleans a local patch, returns removed dirt and updates the GPU mask", () => {
    const dirt = new DirtMap({ seed: 42 });
    const before = dirt.cleanliness(),
      center = dirt.grid[64 * 128 + 64],
      corner = dirt.grid[0];
    const version = dirt.texture.version;
    const amount = dirt.hit(0.5, 0.5, 1.5);
    expect(amount).toBeGreaterThan(0);
    expect(dirt.cleanliness() - before).toBeCloseTo(amount, 8);
    expect(dirt.grid[64 * 128 + 64]).toBeLessThan(center);
    expect(dirt.grid[0]).toBe(corner);
    expect(dirt.texture.version).toBeGreaterThan(version);
    dirt.texture.dispose();
  });
  it("has diminishing dust, remains bounded and can be cleaned past 95%", () => {
    const dirt = new DirtMap();
    const first = dirt.hit(0.5, 0.5, 2);
    expect(dirt.hit(0.5, 0.5, 2)).toBeLessThan(first);
    for (let pass = 0; pass < 3; pass++)
      for (let y = 0; y <= 10; y++)
        for (let x = 0; x <= 10; x++) dirt.hit(x / 10, y / 10, 2);
    expect(dirt.cleanliness()).toBeGreaterThan(0.95);
    expect(dirt.cleanliness()).toBeLessThanOrEqual(1);
    expect(dirt.grid.every((v) => v >= 0 && v <= 1)).toBe(true);
    dirt.texture.dispose();
  });
  it("ignores invalid hits and cleans at the boundary", () => {
    const dirt = new DirtMap();
    const clean = dirt.cleanliness();
    for (const args of [
      [NaN, 0.5, 1],
      [-1, 0.5, 1],
      [0.5, 2, 1],
      [0.5, 0.5, -1],
    ])
      expect(dirt.hit(...args)).toBe(0);
    expect(dirt.cleanliness()).toBe(clean);
    expect(dirt.hit(0, 1, 1)).toBeGreaterThan(0);
    dirt.texture.dispose();
  });
});
