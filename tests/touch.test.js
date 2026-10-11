import { describe, it, expect } from 'vitest';
import { pointerAim, inputModality, readTouchAimOffset, saveTouchAimOffset } from '../src/input/touch.js';
import * as THREE from 'three';
describe('touch aim and modality', () => {
 const rect = {left:10,top:20,width:400,height:800};
 it('defaults to the finger and permits an explicit CSS offset', () => {
  expect(pointerAim({clientX:210,clientY:468,pointerType:'touch'},rect)).toMatchObject({x:210,y:468,nx:0});
  expect(pointerAim({clientX:210,clientY:468,pointerType:'touch'},rect).ny).toBeCloseTo(-.12);
  expect(pointerAim({clientX:210,clientY:468,pointerType:'mouse'},rect).ny).toBeCloseTo(-.12);
  expect(pointerAim({clientX:210,clientY:468,pointerType:'touch'},rect,-24).y).toBe(444);
 });
 it('keeps the optional offset within the canvas', () => { expect(pointerAim({clientX:0,clientY:30,pointerType:'touch'},rect,-40)).toEqual({x:10,y:20,nx:-1,ny:1}); });
 it('persists the optional raised aim and tolerates unavailable storage',()=>{
  let value;const storage={getItem:()=>value,setItem:(k,v)=>{value=v;}};
  expect(readTouchAimOffset(storage)).toBe(0);expect(saveTouchAimOffset(storage,true)).toBe(-40);expect(readTouchAimOffset(storage)).toBe(-40);
  saveTouchAimOffset(storage,false);expect(readTouchAimOffset(storage)).toBe(0);
  const denied={getItem(){throw Error();},setItem(){throw Error();}};expect(readTouchAimOffset(denied)).toBe(0);expect(()=>saveTouchAimOffset(denied,true)).not.toThrow();
 });
 for(const [width,height]of [[320,568],[393,852],[430,932],[844,390]])for(const dpr of [2,3])for(const offset of [0,48])for(const pixelRatio of [.75,1]){
  it(`round trips a surface ray at ${width}x${height}, DPR ${dpr}, viewport offset ${offset}, scene ratio ${pixelRatio}`,()=>{
   // Inset and letterboxed canvas; its CSS rect includes viewport movement.
   const r={left:12-offset,top:24-offset,width:width-24,height:height-48};
   const camera=new THREE.PerspectiveCamera(48,r.width/r.height,.1,100);camera.position.set(.3,1.8,4);camera.lookAt(0,1,0);camera.updateMatrixWorld();
   const ray=new THREE.Raycaster(),surface=new THREE.Plane(new THREE.Vector3(0,0,1),0);
   // The render target size changes sampling density, never camera/input space.
   expect(Math.floor(r.width*pixelRatio)).toBeLessThanOrEqual(r.width*dpr);
   for(const fx of [.2,.5,.8])for(const fy of [.2,.5,.8]){
    const x=r.left+r.width*fx,y=r.top+r.height*fy,a=pointerAim({clientX:x,clientY:y,pointerType:'touch'},r);
    ray.setFromCamera(new THREE.Vector2(a.nx,a.ny),camera);const hit=ray.ray.intersectPlane(surface,new THREE.Vector3()).project(camera);
    expect(Math.hypot(r.left+(hit.x+1)*r.width/2-x,r.top+(1-hit.y)*r.height/2-y)).toBeLessThanOrEqual(1.5);
   }
  });
 }
 it('switches hybrid hints in both directions', () => {
  expect(inputModality('',true)).toBe('touch'); expect(inputModality('',false)).toBe('mouse');
  expect(inputModality('touch',false,'mouse')).toBe('touch'); expect(inputModality('mouse',true,'touch')).toBe('mouse');
  expect(inputModality('pen',true,'touch')).toBe('pen');
 });
});
