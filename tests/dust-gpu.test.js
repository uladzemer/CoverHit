import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DustSystem } from '../src/fx/dust.js';
import { hgPhase, dustColor } from '../src/fx/dust/lighting.js';

describe('GPU dust lifecycle and light',()=>{
 it('backlighting warms dust without white RGB',()=>{
  expect(hgPhase(1)).toBeGreaterThan(hgPhase(-1)*20);
  for(const c of [-1,0,1,NaN,Infinity]) {
   const rgb=dustColor(c);expect(rgb.every(v=>Number.isFinite(v)&&v>0&&v<1)).toBe(true);expect(rgb[0]).toBeGreaterThan(rgb[2]);
  }
 });
 it('bounds bursts, expires exactly with elapsed time, and reuses storage',()=>{
  const scene=new THREE.Scene(),d=new DustSystem(scene,{capacity:100});
  const p=new THREE.Vector3(0,1,.2),n=new THREE.Vector3(0,0,1),attr=d.geometry.attributes.aorigin;
  for(let i=0;i<100;i++)d.emit(p,n,.08);
  expect(d.liveCount).toBe(100);expect(d.geometry.instanceCount).toBe(100);
  d.update(12.1);expect(d.liveCount).toBe(0);d.emit(p,n,.025);expect(d.liveCount).toBeGreaterThan(0);
  expect(d.geometry.attributes.aorigin).toBe(attr);
  d.dispose();d.dispose();expect(scene.children.length).toBe(0);
 });
 it('rejects invalid input and works without a browser',()=>{
  const d=new DustSystem({capacity:0});d.emit(new THREE.Vector3(),new THREE.Vector3(),1);d.update(NaN);expect(d.liveCount).toBe(0);expect(d.time).toBe(0);d.dispose();
 });
});
