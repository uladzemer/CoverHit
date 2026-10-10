import {it,expect} from 'vitest';
import * as THREE from 'three';
import {analyseSun,createLightingState} from '../src/scene/lighting.js';
import {createYard} from '../src/scene/yard.js';

it('aligns the HDR peak with the 7.5 degree sun behind-left of the rack',()=>{
 const width=16,height=8,data=new Float32Array(width*height*4).fill(.2),x=11,y=3,i=(y*width+x)*4;data[i]=100;data[i+1]=20;data[i+2]=2;
 const sun=analyseSun({data,width,height}),phi=((x+.5)/width-.5)*Math.PI*2,e=(.5-(y+.5)/height)*Math.PI;
 const peak=new THREE.Vector3(Math.cos(phi)*Math.cos(e),Math.sin(e),Math.sin(phi)*Math.cos(e)).applyEuler(sun.rotation);
 expect(peak.distanceTo(sun.direction)).toBeLessThan(1e-6);
 expect(THREE.MathUtils.radToDeg(Math.asin(sun.direction.y))).toBeCloseTo(7.5);
 expect(sun.direction.x).toBeLessThan(0);expect(sun.direction.z).toBeLessThan(0);
 expect(sun.temperature).toBeGreaterThanOrEqual(3500);expect(sun.temperature).toBeLessThanOrEqual(4000);
 expect(sun.color.g).toBeGreaterThan(sun.color.b);
});

it('keeps a warm visible sky without an HDR, long foreground shadows and reversible caster LODs',()=>{
 const scene=new THREE.Scene(),yard=createYard(scene),fill=new THREE.DirectionalLight();
 const sky=yard.sky.material.uniforms,originalHorizon=sky.horizon.value.clone();
 const stock=new THREE.Group();stock.userData.stockRole='birch';yard.root.add(stock);
 const tree=new THREE.Mesh(new THREE.BoxGeometry(1,4,1),yard.materials.bark);stock.add(tree);
 const fence=new THREE.Mesh(new THREE.PlaneGeometry(3,2),yard.materials.chainlink);yard.root.add(fence);
 const skyline=yard.backdrop.group.children.find(o=>o.castShadow);
 const lighting=createLightingState(scene,yard.sun,fill,yard);
 for(const level of ['high','low','medium','low']){
  const state=lighting.apply(level);
  if(level==='low'){
   expect(sky.horizon.value.equals(originalHorizon)).toBe(true);
   expect(tree.castShadow).toBe(false);expect(fence.castShadow).toBe(false);expect(skyline.castShadow).toBe(true);
  }else{
   expect(sky.horizon.value.r).toBeGreaterThan(sky.horizon.value.b*2);
   expect(sky.zenith.value.r).toBeGreaterThan(sky.zenith.value.g);
   // Projection of a 2m rack onto flat ground: 15m, toward camera (+Z).
   const length=2*Math.hypot(state.direction.x,state.direction.z)/-state.direction.y;
   expect(length).toBeGreaterThan(15);expect(length).toBeLessThan(16);
   expect(state.direction.x).toBeGreaterThan(0);expect(state.direction.z).toBeGreaterThan(0);
   expect(tree.castShadow).toBe(true);expect(fence.castShadow).toBe(true);expect(skyline.castShadow).toBe(false);
  }
 }
});

it('restores Low materials and fill after High and Medium, including zeroed emissive',()=>{
 const scene=new THREE.Scene(),yard=createYard(scene),fill=new THREE.DirectionalLight('#d4dce1',.35);
 scene.environment=new THREE.Texture();
 const original={emissive:yard.materials.foliage.emissiveIntensity,roughness:yard.materials.panel.roughness,env:yard.materials.panel.envMapIntensity};
 const lighting=createLightingState(scene,yard.sun,fill,yard);
 for(const level of ['high','low','medium','low']){
  lighting.apply(level);
  if(level==='low'){expect(yard.materials.foliage.emissiveIntensity).toBe(original.emissive);expect(yard.materials.panel.roughness).toBe(original.roughness);expect(yard.materials.panel.envMapIntensity).toBe(original.env);expect(fill.intensity).toBe(.35);expect(yard.bounce.intensity).toBe(1.05);}
  else {expect(yard.materials.foliage.emissiveIntensity).toBe(0);expect(fill.intensity).toBe(0);expect(yard.bounce.intensity).toBe(0);}
 }
});


it('preserves textile white balance and sheen through quality switches and newly registered carpets',()=>{
 const scene=new THREE.Scene(),yard=createYard(scene),fill=new THREE.DirectionalLight();
 const lighting=createLightingState(scene,yard.sun,fill,yard);
 const addCarpet=()=>{
  const material=new THREE.MeshPhysicalMaterial({name:'carpet-wool',roughness:.97,specularIntensity:.08});
  const compile=()=>{},cache=()=> 'textile';material.onBeforeCompile=compile;material.customProgramCacheKey=cache;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,3),material);mesh.name='carpet';scene.add(mesh);
  return {material,compile,cache};
 };
 const first=addCarpet();
 for(const level of ['high','low','medium','high']){
  lighting.apply(level);const next=addCarpet();lighting.register();
  for(const {material,compile,cache} of [first,next]){
   expect(material.sheen).toBe(0);expect(material.specularIntensity).toBe(.08);
   expect(material.onBeforeCompile).toBe(compile);expect(material.customProgramCacheKey).toBe(cache);
  }
  next.material.dispose();scene.remove(scene.children.at(-1));
 }
});
