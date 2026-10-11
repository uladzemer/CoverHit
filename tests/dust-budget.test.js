import { describe, it, expect } from 'vitest';
import { screenSizeClamp, coverageCap, DUST_PROFILES } from '../src/fx/dust/budget.js';
import { DustSystem } from '../src/fx/dust.js';
import * as THREE from 'three';

describe('phone dust screen budgets',()=>{
  it('caps physical diameter across viewport widths and render DPRs',()=>{
    for(const width of [320,393,852]) for(const dpr of [.75,1,3]) {
      expect(screenSizeClamp(1e6,width,dpr)).toBeCloseTo(width*dpr*.22);
      expect(screenSizeClamp(1e6,width,dpr,true)).toBeCloseTo(width*dpr*.14);
      expect(screenSizeClamp(2,width,dpr)).toBe(2);
    }
    expect(screenSizeClamp(NaN,393)).toBe(0);
    expect(screenSizeClamp(100,0)).toBe(0);
  });
  it('bounds simultaneous strikes and settled coverage including rotated sprite bounds',()=>{
    const sprites=Array.from({length:1000},()=>({diameter:86,alpha:.6}));
    expect(coverageCap(sprites,393,852,0).applied).toBeCloseTo(.35);
    expect(coverageCap(sprites,393,852,1.5).applied).toBeCloseTo(.12);
    expect(coverageCap(sprites,393,852,3).applied).toBeCloseTo(.12);
    expect(coverageCap([],393,852).scale).toBe(1);
    expect(coverageCap([{diameter:10,alpha:.1}],393,852).scale).toBe(1);
  });
  it('keeps phone clouds short, motes lingering, and recycles saturated slots',()=>{
    const d=new DustSystem({capacity:100,profile:'phone',random:()=>.5});
    const p=new THREE.Vector3(0,1,0),n=new THREE.Vector3(0,0,1);
    d.emit(p,n,.08);d.update(.5);d.emit(p,n,.08);
    expect(d.profile).toBe(DUST_PROFILES.phone);
    const life=d.attributes.life,shape=d.attributes.shape;
    let haze=0;
    for(let i=0;i<d.capacity;i++) if(shape.getX(i)===3) {haze++;expect(life.getY(i)).toBeLessThanOrEqual(1.8);}
    expect(haze).toBeGreaterThan(0);
    for(let i=0;i<d.capacity;i++) if(d.expiry[i]>d.time&&shape.getX(i)!==1) expect(life.getY(i)).toBeLessThanOrEqual(1.8);
    expect(Array.from(life.array).some((v,i)=>i%4===0&&v===.5)).toBe(true);
    d.update(3.1);
    expect(d.liveCount).toBeGreaterThan(0);
    for(let i=0;i<d.capacity;i++) if(d.expiry[i]>d.time) {
      expect(shape.getX(i)).toBe(1);expect(life.getY(i)).toBeGreaterThanOrEqual(3);expect(life.getY(i)).toBeLessThanOrEqual(5);
    }
    d.update(2);expect(d.liveCount).toBe(0);d.dispose();
  });
  it('enforces the combined budget at close camera distances independently of DPR',()=>{
    const d=new DustSystem({capacity:1380,profile:'phone',random:()=>.5});
    const p=new THREE.Vector3(0,1,0),n=new THREE.Vector3(0,0,1);
    const camera=new THREE.PerspectiveCamera(48,393/852,.1,600);
    camera.position.set(0,1,.15);camera.lookAt(p);camera.updateMatrixWorld();
    for(let i=0;i<10;i++)d.emit(p,n,.08);
    d.update(.3);
    let first;
    for(const dpr of [.75,1,3]) {
      d.applyScreenBudget({getCurrentViewport:v=>v.set(0,0,393*dpr,852*dpr)},camera);
      expect(d.coverage.requested).toBeGreaterThan(d.coverage.limit);
      expect(d.coverage.scale).toBeLessThan(1);
      expect(d.coverage.applied).toBeLessThanOrEqual(.35);
      if(first!==undefined)expect(d.coverage.applied).toBeCloseTo(first);
      first=d.coverage.applied;
    }
    d.update(1.2);d.applyScreenBudget({getCurrentViewport:v=>v.set(0,0,393,852)},camera);
    expect(d.coverage.applied).toBeLessThanOrEqual(.12);d.dispose();
  });
});
