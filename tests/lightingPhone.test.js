import {it,expect} from 'vitest';
import * as THREE from 'three';
import {applyPhoneLighting,fitPhoneSunShadow,registerPhoneCarpet,sunsetDirection,sunsetColour,SUNSET_INTENSITY} from '../src/scene/lighting.js';
import {createYard} from '../src/scene/yard.js';
import {sunPresence} from '../docs/qa/mobile-sun/sun-metrics.mjs';
it('phones share the analysed desktop sun and fit all eight play-area corners',()=>{
 const scene=new THREE.Scene(),yard=createYard(scene);applyPhoneLighting(scene,yard.sun,yard);fitPhoneSunShadow(yard.sun);
 const sun=yard.sun;expect(sun.intensity).toBe(SUNSET_INTENSITY);expect(sun.color.equals(sunsetColour())).toBe(true);
 expect(sun.position.clone().sub(sun.target.position).normalize().distanceTo(sunsetDirection())).toBeLessThan(1e-6);
 expect(sun.shadow.intensity).toBeLessThanOrEqual(.6);expect(scene.environment).toBeNull();
 expect(scene.children.filter(o=>o.isDirectionalLight)).toHaveLength(0);
 const camera=sun.shadow.camera;
 for(const x of [-16,18])for(const y of [0,12])for(const z of [-18,24]){
  const p=new THREE.Vector3(x,y,z).project(camera);for(const c of p.toArray())expect(Math.abs(c)).toBeLessThan(1);
 }
 applyPhoneLighting(scene,sun,yard);expect(scene.getObjectsByProperty('name','phone-sun-bounce')).toHaveLength(1);
});
it('local hero bounce chains the wool shader once and survives carpet replacement',()=>{
 const scene=new THREE.Scene();
 for(let i=0;i<2;i++){
  const m=new THREE.MeshPhysicalMaterial({name:'carpet-wool'});m.onBeforeCompile=s=>{s.fragmentShader+='// wool cap';};
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),m);mesh.name='carpet';scene.add(mesh);
  registerPhoneCarpet(scene);const compile=m.onBeforeCompile;registerPhoneCarpet(scene);expect(m.onBeforeCompile).toBe(compile);
  const s={fragmentShader:'#include <aomap_fragment>'};m.onBeforeCompile(s);expect(s.fragmentShader).toContain('// wool cap');expect(s.fragmentShader).toContain('vec3(.48,.45,.42)');scene.remove(mesh);
 }
});
it('sun metric measures warm/cool regions and detects real shadow attenuation',()=>{
 const w=20,h=20,a=new Uint8Array(w*h*3),off=new Uint8Array(a.length),mask=new Uint8Array(a.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*3,ground=y>10;mask[i+(ground?2:y<6?0:1)]=255;
  const level=x>=4&&x<=8?40:100;
  a.set(ground?[level,level,level]:y<6?[180,140,100]:[70,80,100],i);off.set(ground?[100,100,100]:a.slice(i,i+3),i);
 }
 const s=sunPresence(a,off,mask,w,h);expect(s.litShadeRatio).toBeGreaterThan(1.4);expect(s.lit.redBlue).toBeGreaterThan(1.25);expect(s.shade.redBlue).toBeLessThan(1);
 expect(s.shadowCoverage).toBeCloseTo(5/16);expect(s.shadowCoverage).toBeGreaterThanOrEqual(.1);expect(s.shadowCoverage).toBeLessThanOrEqual(.35);
 expect(s.shadowAttenuatedCoverage).toBeCloseTo(5/16);
 expect(sunPresence(off,off,mask,w,h).shadowCoverage).toBe(0);
 expect(sunPresence(off,off,mask,w,h).shadowAttenuatedCoverage).toBe(0);
});

