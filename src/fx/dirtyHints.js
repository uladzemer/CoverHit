import * as THREE from 'three';

// A few rising motes locate the remaining dirty zones near the end of a round.
export class DirtyHints {
  constructor() {
    this.positions = new Float32Array(36 * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({ color:'#ffe3b9', size:.015, transparent:true, opacity:.65, depthWrite:false });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }
  update(dirt, sampleSurface, time, playing) {
    this.points.visible = playing && dirt.halfCleanliness(dirt.visibleSide) >= .85;
    if (!this.points.visible) return;
    const zones = [];
    for (let y=0; y<8; y++) for (let x=0; x<8; x++) {
      const u=(x+.5)/8, v=(y+.5)/8;
      if(!dirt.isOnSide(u,v,dirt.visibleSide))continue;
      const value=dirt.grid[Math.floor(v*dirt.size)*dirt.size+Math.floor(u*dirt.size)];
      zones.push({u,v,value});
    }
    zones.sort((a,b)=>b.value-a.value);
    for (let i=0; i<36; i++) {
      const zone=zones[Math.floor(i/3)];
      const phase=(time*.35+i*.237)%1;
      const point=sampleSurface(zone.u,zone.v).point;
      point.x += Math.sin(i*7+time)*.025;
      point.y += phase*.18;
      point.z += .06;
      point.toArray(this.positions,i*3);
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
