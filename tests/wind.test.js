import {it,expect} from 'vitest';
import {Vector3} from 'three';
import {createWind,wind} from '../src/scene/wind.js';
it('replays deterministically with bounded, finite gusts and unit direction',()=>{
 const a=createWind(464),b=createWind(464),v=new Vector3();
 for(let i=0;i<1800;i++){a.update(1/30);b.update(1/30);expect(a.strength()).toBe(b.strength());expect(a.strength()).toBeGreaterThanOrEqual(0);expect(a.strength()).toBeLessThanOrEqual(1);expect(a.direction.length()).toBeCloseTo(1);expect(a.velocity(v,i,3,-i)).toBe(v);expect(v.length()).toBeLessThan(6.01);expect(v.toArray().every(Number.isFinite)).toBe(true);}
 expect(a.uniforms.uWindTime.value).toBe(a.time);expect(a.uniforms.uWindDir.value).toBe(a.direction);expect(wind.velocity(v,NaN,Infinity,-Infinity).toArray().every(Number.isFinite)).toBe(true);
});
it('varies with height, travelling fronts and seed, ignoring invalid dt',()=>{
 const w=createWind(),v=new Vector3(),ground=w.velocity(v,0,0,0).length(),high=w.velocity(v,0,4,0).length();expect(high).toBeGreaterThan(ground);
 const near=w.velocity(v,0,3,0).clone();expect(w.velocity(v,20,3,-12).distanceTo(near)).toBeGreaterThan(.01);
 w.update(NaN);w.update(-1);expect(w.time).toBe(0);expect(createWind(8).strength()).not.toBe(w.strength());
});
