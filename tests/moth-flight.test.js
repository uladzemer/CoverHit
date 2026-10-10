import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createFlight, stepFlight, PLAY_VOLUME, seededRandom } from '../src/fx/mothFlight.js';
import { MothSystem } from '../src/fx/moths.js';

describe('correlated moth flight',()=>{
 it('is seeded and independent of frame partition',()=>{
  const a=createFlight({x:0,y:1,z:0},44),b=createFlight({x:0,y:1,z:0},44);
  for(let i=0;i<240;i++)stepFlight(a,1/60);
  for(let i=0;i<576;i++)stepFlight(b,1/144);
  for(const key of ['x','y','z','vx','vy','vz','heading'])expect(a[key]).toBeCloseTo(b[key],8);
  const r=seededRandom(1),s=seededRandom(1);expect(r()).toBe(s());
 });
 it('stays finite and reachable under gusts, lamps, and long runs',()=>{
  for(let seed=0;seed<12;seed++) {
   const s=createFlight({x:0,y:1,z:0},seed);
   for(let i=0;i<600;i++) {
    stepFlight(s,i%30===0?.25:1/60,{x:.8,y:.1,z:-.3},{lights:[{x:-5,y:4,z:-18}],obstacles:[{x:.5,y:1,z:.8,radius:.25}]});
    for(const k of ['x','y','z','vx','vy','vz','bank','pitch'])expect(Number.isFinite(s[k])).toBe(true);
    expect(s.x).toBeGreaterThanOrEqual(PLAY_VOLUME.minX);expect(s.x).toBeLessThanOrEqual(PLAY_VOLUME.maxX);
    expect(s.y).toBeGreaterThanOrEqual(PLAY_VOLUME.minY);expect(s.y).toBeLessThanOrEqual(PLAY_VOLUME.maxY);
    expect(s.z).toBeGreaterThanOrEqual(PLAY_VOLUME.minZ);expect(s.z).toBeLessThanOrEqual(PLAY_VOLUME.maxZ);
    expect(Math.hypot(s.vx,s.vy,s.vz)).toBeLessThanOrEqual(1.400001);
   }
  }
 });
 it('preserves pick IDs, capacity, catching, escape, and disposal in node',()=>{
  const scene=new THREE.Scene(),system=new MothSystem(scene);
  for(let id=0;id<40;id++)system.spawn({id},new THREE.Vector3(0,1,0));
  expect(system.moths.size).toBe(30);expect(system.moths.get(0).pick.userData.mothId).toBe(0);
  system.update(.2);const p=system.exit(0,'caught');expect(p.isVector3).toBe(true);
  expect(system.moths.get(0).state).toBe('caught');system.exit(1,'escaped');
  for(let i=0;i<100;i++)system.update(1/60);
  expect(system.moths.has(0)).toBe(false);expect(system.moths.has(1)).toBe(false);
  system.clear();expect(system.moths.size).toBe(0);system.dispose();expect(scene.children.length).toBe(0);
 });
});

