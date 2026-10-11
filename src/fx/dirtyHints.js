import { findDirtyZones } from '../carpet/dirt.js';
import { feel } from '../game/feel.js';
import * as THREE from 'three';

// A few rising motes locate the remaining dirty zones near the end of a round.
export class DirtyHints {
  constructor() {
    this.zone = new THREE.Vector2(.5,.5);
    this.pulse = 0;
    this.positions = new Float32Array(36 * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({ color:'#ffe3b9', size:.015, transparent:true, opacity:.35, depthWrite:false });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }
  update(dirt, sampleSurface, time, playing, reduced = false) {
    const active = playing && dirt.halfCleanliness(dirt.visibleSide) >= feel.hintCleanliness;
    this.pulse = active ? (reduced ? .35 : .35 + .65 * (.5 + .5 * Math.sin(time * 2.4))) : 0;
    this.points.visible = active && !reduced;
    if (!active) return;
    if (this.dirt !== dirt || this.revision !== dirt.texture.version || this.side !== dirt.visibleSide) {
      this.dirt = dirt; this.revision = dirt.texture.version; this.side = dirt.visibleSide;
      this.zones = findDirtyZones(dirt);
    }
    const zones = this.zones;
    this.zone.set(zones[0].u,zones[0].v);
    if (reduced) return;
    for (let i=0; i<36; i++) {
      const zone=zones[Math.floor(i/12)];
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
