import * as THREE from "three";

// Shared CPU reference for the shader; dirt=0 is an exact identity.
export function dirtLook(dirt, speckle = .5) {
  const d = Math.max(0, Math.min(1, Number.isFinite(dirt) ? dirt : 0));
  const film = d * d * (3 - 2 * d);
  return { film, desaturation: film * .90, brightness: 1 - film * (.58 + (speckle - .5) * .08) };
}

export function createDirtNoise(size = 32) {
  const data = new Uint8Array(size * size);
  let seed = 1986;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed >>> 24;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Exact peak per coarse zone, cached by the visual hint consumer between strikes.
export function findDirtyZones(dirt, count = 3) {
  const zones = new Map();
  for (let y = 0; y < dirt.size; y++) for (let x = 0; x < dirt.size; x++) {
    const u = (x + .5) / dirt.size, v = (y + .5) / dirt.size;
    if (!dirt.isOnSide(u, v, dirt.visibleSide)) continue;
    const value = dirt.grid[y * dirt.size + x];
    const key = Math.floor(v * 8) * 8 + Math.floor(u * 8);
    if (!zones.has(key) || value > zones.get(key).value) zones.set(key, { u, v, value });
  }
  return [...zones.values()].sort((a, b) => b.value - a.value).slice(0, count);
}

export class DirtMap {
  constructor({ size = 128, dirtAmount = 1, foldAxis = null, width = 1, height = 1 } = {}) {
    this.size = size;
    this.revision = 0;
    // Equal UV coverage scales the physical cleaning area with the whole carpet.
    // sqrt(area) converts this normalized kernel to an equivalent radius in metres.
    this.cleaningLengthScale = Math.sqrt(width * height);
    this.foldAxis = foldAxis;
    this.visibleSide = 0;
    this.dirtAmount = dirtAmount;
    this.grid = new Float32Array(size * size);
    this.total = 0;
    this.grid.fill(1);
    this.total = this.grid.length;
    this.texture = new THREE.DataTexture(
      this.grid,
      size,
      size,
      THREE.RedFormat,
      THREE.FloatType,
    );
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  hit(u, v, strength = 1, headRadius = 1) {
    if (
      ![u, v, strength, headRadius].every(Number.isFinite) ||
      strength <= 0 || headRadius <= 0 ||
      u < 0 ||
      u > 1 ||
      v < 0 ||
      v > 1
    )
      return 0;
    if(this.foldAxis && !this.isOnSide(u,v,this.visibleSide))return 0;
    strength = THREE.MathUtils.clamp(strength, 0, 1);
    const radiusMetres = this.cleaningLengthScale * (0.088 + 0.010 * Math.sqrt(strength)) * THREE.MathUtils.clamp(headRadius, 0.6, 1.4),
      radius = radiusMetres / this.cleaningLengthScale,
      reach = radius * 2.8;
    const loX = Math.max(0, Math.floor((u - reach) * this.size));
    const hiX = Math.min(this.size - 1, Math.ceil((u + reach) * this.size));
    const loY = Math.max(0, Math.floor((v - reach) * this.size));
    const hiY = Math.min(this.size - 1, Math.ceil((v + reach) * this.size));
    let removed = 0;
    for (let y = loY; y <= hiY; y++)
      for (let x = loX; x <= hiX; x++) {
        // A strike cannot clean through to the hidden panel across the crown.
        if (this.foldAxis && !this.isOnSide((x+.5)/this.size,(y+.5)/this.size,this.visibleSide)) continue;
        const distance2 =
          ((x + 0.5) / this.size - u) ** 2 + ((y + 0.5) / this.size - v) ** 2;
        if (distance2 > reach * reach) continue;
        const index = y * this.size + x,
          before = this.grid[index];
        const clean =
          1 -
          Math.exp(
            -strength * 1.05 / this.dirtAmount * Math.exp(-distance2 / (2 * radius * radius)),
          );
        this.grid[index] = Math.max(0, before * (1 - clean));
        removed += before - this.grid[index];
      }
    this.total = Math.max(0, this.total - removed);
    this.revision++;
    this.texture.needsUpdate = true;
    // Removed dirt as a fraction of the full carpet; emission scales with actual dirt left.
    return removed / this.grid.length;
  }

  isOnSide(u,v,side) {
    const coordinate=this.foldAxis==='u' ? 1-u : v;
    return side===0 ? coordinate<=.5 : coordinate>=.5;
  }
  halfCleanliness(side) {
    // Gameplay/HUD/hints ask several times per frame; sum only after mask edits.
    // Texture version also invalidates direct QA/debug edits followed by upload.
    if (this.halfVersion !== this.texture.version) {
      const totals = [0, 0], counts = [0, 0];
      for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
        const u = (x + .5) / this.size, v = (y + .5) / this.size;
        for (let half = 0; half < 2; half++) if (this.isOnSide(u, v, half)) {
          totals[half] += this.grid[y * this.size + x]; counts[half]++;
        }
      }
      this.halfValues = totals.map((total, half) => counts[half] ? THREE.MathUtils.clamp(1 - total / counts[half], 0, 1) : 0);
      this.halfVersion = this.texture.version;
    }
    return this.halfValues[side === 1 ? 1 : 0];
  }
  cleanliness() {
    return THREE.MathUtils.clamp(1 - this.total / this.grid.length, 0, 1);
  }
}
