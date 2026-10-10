import {it,expect} from 'vitest';
import * as THREE from 'three';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {facadeBox,facadeImpostorBox,moduleChoice,readFacadeMode,setFacadeMode,createFacadeMaterial} from '../src/scene/yard/facade.js';
import {createYard} from '../src/scene/yard.js';
import {optimizeYard} from '../src/scene/yard/performance.js';
import sharp from 'sharp';
import {resampleFacadeModule} from '../scripts/bake-facade-impostors.mjs';

it('keeps both wall joints around a window when baking narrow impostor bays',async()=>{
 const pixels=Buffer.alloc(2048*2048*3);
 for(let y=0;y<2048;y++)for(let x=0;x<2048;x++){const value=x%1024<180?190:x%1024>844?210:50;pixels.fill(value,(y*2048+x)*3,(y*2048+x+1)*3);}
 const source=await sharp(pixels,{raw:{width:2048,height:2048,channels:3}}).png().toBuffer();
 const baked=await resampleFacadeModule(source,0,32,128),row=64*32*3;
 expect(baked[row]).toBeGreaterThan(170);expect(baked[row+31*3]).toBeGreaterThan(190);expect(baked[row+16*3]).toBeLessThan(70);
});

// The atlas re-measurement needs Python + OpenCV (a local authoring tool); skip where it is not installed (e.g. CI).
const hasOpenCv=(()=>{try{return spawnSync('python',['-c','import cv2, numpy'],{stdio:'ignore'}).status===0;}catch{return false;}})();
it.skipIf(!hasOpenCv)('independently decodes whole photos and verifies joints, pitch, seams and alpha edges',()=>{
 execFileSync('python',['scripts/verify-natural-photos.py'],{stdio:'pipe'});
 const report=JSON.parse(readFileSync('docs/qa/natural/asset-quality.json'));
 expect(report.passes).toBe(true);
},20000);
it('preserves upright UV winding and photographic section density without per-pane rebuilding',()=>{
 const g=facadeBox(60,14.3,12,'panel',19),uv=g.attributes.facadeUv;
 // First triangle in each front-facing bay: right edge never reverses UV.
 const frontCount=4*6;
 for(let i=0;i<frontCount;i+=6){expect(uv.getX(i+1)).toBeGreaterThan(uv.getX(i));expect(uv.getY(i+2)).toBeGreaterThan(uv.getY(i));const metres=(g.attributes.position.getX(i+1)-g.attributes.position.getX(i))*60;expect((uv.getX(i+1)-uv.getX(i))*2048/metres).toBeGreaterThan(120);}
 const report=JSON.parse(readFileSync('docs/qa/facades2/rectification.json'));
 for(const p of Object.values(report.photos))expect(Math.min(...p.texelsPerMetre)).toBeGreaterThanOrEqual(256);
 // Seeded avalanche hash avoids the old checkerboard/reflected repeating blocks.
 const choices=Array.from({length:80},(_,i)=>moduleChoice(i%20,Math.floor(i/20),7));expect(new Set(choices).size).toBe(2);expect(choices.some((c,i)=>i>0&&c===choices[i-1])).toBe(true);expect(choices).toEqual(Array.from({length:80},(_,i)=>moduleChoice(i%20,Math.floor(i/20),7)));expect(choices).not.toEqual(Array.from({length:80},(_,i)=>moduleChoice(i%20,Math.floor(i/20),8)));
 g.dispose();const box=facadeImpostorBox(48,26,12,'nine',3);expect(box.index.count/3).toBe(12);box.dispose();
});
it('retains reversible procedural window batches after optimization',()=>{
 const yard=createYard(new THREE.Scene());setFacadeMode(yard.root,'procedural',{persist:false});optimizeYard(yard);
 const windows=[];yard.root.traverse(o=>{if(o.userData.facadeWindows){windows.push(o);o.userData.facadeMaterial.userData.photoLoaded=true;}});expect(windows.length).toBeGreaterThan(0);
 setFacadeMode(yard.root,'photo',{persist:false});expect(windows.every(o=>!o.visible)).toBe(true);
 setFacadeMode(yard.root,'procedural',{persist:false});expect(windows.every(o=>o.visible)).toBe(true);
 windows[0].userData.facadeMaterial.userData.photoLoaded=false;setFacadeMode(yard.root,'photo',{persist:false});expect(windows[0].visible).toBe(true);
});
it('persists valid facade modes and survives unavailable or denied browser storage',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),root=new THREE.Group();let value;
 try{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>value,setItem:(k,v)=>{value=v;}}});expect(readFacadeMode()).toBe('photo');expect(setFacadeMode(root,'procedural')).toBe(true);expect(readFacadeMode()).toBe('procedural');expect(setFacadeMode(root,'invalid')).toBe(false);expect(readFacadeMode()).toBe('procedural');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('denied');}});expect(readFacadeMode()).toBe('photo');expect(()=>setFacadeMode(root,'photo')).not.toThrow();
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
it('keeps original photographic glass without generated emission and disables photo UVs in procedural mode',()=>{
 const material=createFacadeMaterial('panel');material.userData.photoLoaded=true;
 const shader={vertexShader:'#include <uv_vertex>',fragmentShader:'#include <emissivemap_fragment>\n#include <normal_fragment_maps>'};material.onBeforeCompile(shader);expect(shader.fragmentShader).toBe('#include <emissivemap_fragment>\n#include <normal_fragment_maps>');expect(shader.fragmentShader).not.toContain('fract(sin');expect(shader.vertexShader).toContain('facadeUv');
 material.userData.applyFacadeMode('procedural');const fallback={vertexShader:'#include <uv_vertex>',fragmentShader:'#include <emissivemap_fragment>'};material.onBeforeCompile(fallback);expect(fallback.vertexShader).not.toContain('facadeUv');material.dispose();
});
