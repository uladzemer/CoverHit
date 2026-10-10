import { describe, it, expect } from 'vitest';
import { chargeArc, reticleScale, reticleState, readReticleSize, saveReticleSize } from '../src/input/reticleHelpers.js';
describe('aim reticle helpers', () => {
  it('fills the clockwise arc from zero to one turn and clamps invalid charge', () => {
    expect(chargeArc(0)).toBe(0); expect(chargeArc(.25)).toBe(Math.PI / 2);
    expect(chargeArc(1)).toBe(Math.PI * 2); expect(chargeArc(2)).toBe(Math.PI * 2);
    expect(chargeArc(-1)).toBe(0); expect(chargeArc(NaN)).toBe(0);
  });
  it('keeps a 13 cm nearby ring and a readable distant ring at both screen sizes', () => {
    expect(reticleScale(2,48,1080)).toBe(1);
    for (const height of [800,1080]) {
      const scale = reticleScale(8,48,height);
      expect(.13 * scale * height / (16 * Math.tan(48 * Math.PI / 360))).toBeGreaterThanOrEqual(26 - 1e-10);
      expect(reticleScale(8,48,height,'large')).toBe(scale * 1.5);
    }
  });
  it('transitions between surface, fallback, moth, charge, strike, flip and hidden', () => {
    expect(reticleState({onCarpet:true})).toMatchObject({visible:true,surface:true,opacity:.92});
    expect(reticleState({})).toMatchObject({surface:false,opacity:.38});
    expect(reticleState({moth:true})).toMatchObject({target:true});
    expect(reticleState({charging:true,charge:1})).toMatchObject({pulse:true,arc:2*Math.PI});
    expect(reticleState({strikeAge:.08}).snap).toBe(1);
    expect(reticleState({strikeAge:.2}).snap).toBe(0);
    expect(reticleState({enabled:false,flipping:true})).toMatchObject({visible:true,opacity:.28});
    expect(reticleState({enabled:false}).visible).toBe(false);
  });
  it('persists only supported sizes and tolerates blocked storage', () => {
    let value; const storage={getItem:()=>value,setItem:(_,v)=>{value=v;}};
    expect(readReticleSize(storage)).toBe('normal'); saveReticleSize(storage,'large');
    expect(readReticleSize(storage)).toBe('large'); value='bad'; expect(readReticleSize(storage)).toBe('normal');
    expect(readReticleSize(undefined)).toBe('normal'); expect(()=>saveReticleSize(undefined,'large')).not.toThrow();
  });
});
import * as THREE from 'three';
import { vi } from 'vitest';
import { Reticle } from '../src/fx/reticle.js';
it('tracks the current surface normal and point, renders above patterns, and disposes', () => {
  const fallback={style:{},classList:{toggle:vi.fn()},remove:vi.fn()};
  vi.stubGlobal('document',{createElement:()=>fallback,body:{append:vi.fn()}});
  try {
    const camera=new THREE.PerspectiveCamera(48,1.6,.1,100); camera.position.z=4; camera.updateMatrixWorld();
    const dom={getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800})};
    const reticle=new Reticle(camera,dom);
    const normal=new THREE.Vector3(.2,.1,1).normalize();
    const hit={point:new THREE.Vector3(.3,.2,0),face:{normal},object:{matrixWorld:new THREE.Matrix4()}};
    const beater={enabled:true,phase:'charging',charge:1,pointer:new THREE.Vector2(),raycaster:{ray:{direction:new THREE.Vector3(0,0,-1)}},aim:()=>hit};
    reticle.update(.016,beater);
    expect(reticle.mesh.visible).toBe(true); expect(fallback.hidden).toBe(true);
    expect(new THREE.Vector3(0,0,1).applyQuaternion(reticle.mesh.quaternion).distanceTo(normal)).toBeLessThan(1e-6);
    expect(reticle.mesh.position.distanceTo(hit.point.clone().addScaledVector(normal,.002))).toBeLessThan(1e-6);
    expect(reticle.material.depthTest).toBe(false); expect(reticle.material.depthWrite).toBe(false);
    expect(reticle.material.uniforms.arc.value).toBe(Math.PI*2);
    hit.point.y+=.1; reticle.update(.016,beater,{flipping:true});
    expect(reticle.mesh.position.y).toBeCloseTo(hit.point.y+normal.y*.002);
    expect(reticle.material.uniforms.opacity.value).toBe(.28);
    beater.aim=()=>null; reticle.update(.016,beater);
    expect(reticle.mesh.visible).toBe(false); expect(fallback.hidden).toBe(false);
    reticle.dispose(); expect(fallback.remove).toHaveBeenCalledOnce();
  } finally { vi.unstubAllGlobals(); }
});
