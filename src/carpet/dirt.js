import * as THREE from "three";

export class DirtMap {
  constructor({ size = 128, dirtAmount = 1, foldAxis = null, width = 1, height = 1 } = {}) {
    this.size = size;
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
    this.texture.needsUpdate = true;
    // Removed dirt as a fraction of the full carpet; emission scales with actual dirt left.
    return removed / this.grid.length;
  }

  isOnSide(u,v,side) {
    const coordinate=this.foldAxis==='u' ? 1-u : v;
    return side===0 ? coordinate<=.5 : coordinate>=.5;
  }
  halfCleanliness(side) {
    let total=0,count=0;
    for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++) {
      if(this.isOnSide((x+.5)/this.size,(y+.5)/this.size,side)){total+=this.grid[y*this.size+x];count++;}
    }
    return THREE.MathUtils.clamp(1-total/count,0,1);
  }
  cleanliness() {
    return THREE.MathUtils.clamp(1 - this.total / this.grid.length, 0, 1);
  }
}
