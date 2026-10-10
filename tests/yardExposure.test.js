import {it,expect} from 'vitest';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {decalResidual} from '../scripts/correct-yard-photos.mjs';
import {carPaint,CIVILIAN_PAINTS} from '../src/scene/yard/car.js';
import {createYard} from '../src/scene/yard.js';
import {createLightingState} from '../src/scene/lighting.js';
import {assertExposure} from '../scripts/verify-yard-exposure.mjs';

it('ships civilian body paint with negligible colour/text decal residual',async()=>{
 const data=await sharp('public/yard/photos/car-atlas.webp').ensureAlpha().raw().toBuffer();
 expect(decalResidual(data)).toBeLessThan(.01);
 // A saturated synthetic decal must fail the same detector.
 const dirty=Buffer.from(data);for(let y=150;y<180;y++)for(let x=450;x<510;x++)dirty.set([255,0,0,255],(y*1024+x)*4);
 expect(decalResidual(dirty)).toBeGreaterThan(.01);
 expect(new Set([0,1,2].map(carPaint)).size).toBe(3);
 for(let seed=0;seed<20;seed++){expect(carPaint(seed)).toBe(carPaint(seed));expect(CIVILIAN_PAINTS).toContain(carPaint(seed));}
 // Blank plate/sticker crops also reject surviving high-contrast lettering.
 for(const [x0,y0,x1,y1]of [[946,24,992,126],[802,177,863,249]]){
  let min=255,max=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const v=data[(y*1024+x)*4];min=Math.min(min,v);max=Math.max(max,v);}expect(max-min).toBeLessThan(15);
 }
});
it('ships neutral facade albedos in the architectural luminance range',async()=>{
 for(const series of ['panel','panel335','brick','nine','tower']){
  const {data}=await sharp(`public/yard/photos/${series}-albedo.webp`).removeAlpha().raw().toBuffer({resolveWithObject:true});let sums=[0,0,0];
  for(let i=0;i<data.length;i++)sums[i%3]+=data[i]/255;
  const means=sums.map(v=>v/(data.length/3)),l=means[0]*.2126+means[1]*.7152+means[2]*.0722;
  expect(l).toBeGreaterThanOrEqual(.45);expect(l).toBeLessThanOrEqual(.60);expect(Math.max(...means)-Math.min(...means)).toBeLessThan(.025);
 }
});
it('retains grass sky fill and photo window emission across quality switches',()=>{
 const scene=new THREE.Scene(),yard=createYard(scene),fill=new THREE.DirectionalLight(),photo=new THREE.MeshStandardMaterial({emissive:0xffbb88,emissiveIntensity:.55,emissiveMap:new THREE.Texture()});photo.userData.photoLoaded=true;photo.userData.photoSeries='panel';
 const facade=new THREE.Mesh(new THREE.BoxGeometry(60,14,12),photo);facade.castShadow=false;yard.root.add(facade);
 const lighting=createLightingState(scene,yard.sun,fill,yard);
 for(const level of ['high','low','medium','high']){lighting.apply(level);expect(photo.emissiveIntensity).toBe(.55);expect(yard.materials.blades.emissiveIntensity).toBe(.22);expect(facade.castShadow).toBe(false);}
});
it('stores a matched main reference and enforces all three exposure regions',()=>{
 const reference=JSON.parse(readFileSync('docs/qa/exposure/reference.json'));
 expect(reference.viewport).toEqual([1440,900]);expect(reference.lighting.environment).toBe(true);
 for(const name of ['pad','lawn','facade'])expect(reference.metrics.regions[name]).toBeGreaterThan(.05);
 const after=JSON.parse(readFileSync('docs/qa/exposure/after.json'));expect(()=>assertExposure(after.metrics,reference.metrics)).not.toThrow();
 const dark={regions:{...reference.metrics.regions,pad:reference.metrics.regions.pad*.79},clippedPercent:0};expect(()=>assertExposure(dark,reference.metrics)).toThrow('pad');
 expect(()=>assertExposure({...reference.metrics,clippedPercent:1},reference.metrics)).toThrow('clipped');
});
it('supplies white vertex colours on the unbatched road shared with tinted asphalt batches',()=>{
 const yard=createYard(new THREE.Scene()),road=yard.root.getObjectByName('yard-ground');
 expect([...road.geometry.attributes.color.array].every(v=>v===1)).toBe(true);
});
