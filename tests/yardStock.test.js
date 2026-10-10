import {it,expect} from 'vitest';
import * as THREE from 'three';
import {mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {zipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {loadStockManifest,instantiateStock,replaceFallback,finiteStockGeometry,stockFacadeIssue} from '../src/scene/yard/stock.js';
import {safeArchivePath,extractArchive,selectInterchange,importYardStock} from '../scripts/import-yard-stock.mjs';
import {Document,NodeIO} from '@gltf-transform/core';
import {getBounds} from '@gltf-transform/functions';
import {createYard} from '../src/scene/yard.js';
const entry={id:'bench',role:'bench',title:'Bench',file:'bench.glb',tris:100,scale:1,licence:'Envato Elements (personal)',sourceUrl:'https://elements.envato.com/bench-test'};
const response=(body,type='application/json',ok=true)=>async()=>({ok,headers:{get:()=>type},json:async()=>body});
it('replaces missing facade textures or UVs with windowed housing and retains complete stock',()=>{
 const source=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(30,17,12);
 source.add(new THREE.Mesh(geometry,material));
 for(const role of ['building','horizon']){
  const group=instantiateStock(source,{...entry,role});
  expect(group.name).toBe('yard-procedural-bench');expect(group.userData.proceduralFacade).toBe(true);
  expect(group.userData.fallbackReason).toMatch(/texture or UVs/);
  expect(group.children.every(o=>o.isInstancedMesh)).toBe(true);
 }
 material.map=new THREE.DataTexture(new Uint8Array([100,100,100,255]),1,1);
 expect(stockFacadeIssue(source)).toBe('');
 expect(instantiateStock(source,{...entry,role:'building'}).name).toBe('yard-stock-bench');
 geometry.deleteAttribute('uv');expect(stockFacadeIssue(source)).toMatch(/texture or UVs/);
});
it('loads valid stock and rejects missing/HTML/broken/unsafe local manifests',async()=>{
 expect(await loadStockManifest('/local',response([entry]))).toEqual([entry]);
 for(const fn of [response([entry],'text/html'),response([],undefined,false),async()=>{throw Error('offline');},response({items:[entry]}),response([entry,entry]),response([{...entry,file:'../private.glb'}]),response([{...entry,scale:NaN}]),response([{...entry,role:'unknown'}]),async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>{throw SyntaxError('bad JSON');}})])expect(await loadStockManifest('/local',fn)).toEqual([]);
});
it('rejects archive traversal, absolute paths and Windows drive names',()=>{
 for(const name of ['/etc/file.obj','C:/file.obj','C:file.obj','../file.obj','nested/../../file.obj','nested\\..\\file.obj','\\server\\file.obj'])expect(()=>safeArchivePath(name)).toThrow();
 expect(safeArchivePath('nested/model.obj')).toBe('nested/model.obj');
 expect(selectInterchange(['mesh.obj','mesh.fbx','mesh.gltf','mesh.glb'])).toBe('mesh.glb');
});
it('extracts data only and rejects a real zip with traversal even in a script entry',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'coverhit-zip-test-'));
 try{
  await writeFile(path.join(dir,'good.zip'),zipSync({'nested/model.obj':strToU8('v 0 0 0'),'run.js':strToU8('throw Error()')}));
  await extractArchive(path.join(dir,'good.zip'),path.join(dir,'work'));
  expect(await access(path.join(dir,'work/nested/model.obj')).then(()=>true,()=>false)).toBe(true);
  expect(await access(path.join(dir,'work/run.js')).then(()=>true,()=>false)).toBe(false);
  await writeFile(path.join(dir,'bad.zip'),zipSync({'../run.js':strToU8('untrusted')}));
  await expect(extractArchive(path.join(dir,'bad.zip'),path.join(dir,'bad'))).rejects.toThrow();
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('instances models and restores exactly the fallback furniture on disposal',()=>{
 const yard=createYard(new THREE.Scene());const matrices=yard.root.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array));
 replaceFallback(yard,'bench');expect(yard.root.children.some(o=>o.userData.fallbackEntries?.some(e=>e.role==='bench'&&e.hidden))).toBe(true);
 replaceFallback(yard,'bench',false);expect(yard.root.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array))).toEqual(matrices);
 const source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
 const group=instantiateStock(source,entry);expect(group.children[0].count).toBe(2);expect(group.children[0].isInstancedMesh).toBe(true);
});
it('converts self-contained GLB and relative-resource glTF to metre-sized local GLBs',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'coverhit-gltf-test-'));
 try{
  const doc=new Document(),buffer=doc.createBuffer('geometry'),material=doc.createMaterial();
  const p=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array([-1,2,0,1,2,0,0,4,0])).setBuffer(buffer)).setMaterial(material);
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(p)));
  const io=new NodeIO();
  for(const format of ['GLB','GLTF']){
   const folder=path.join(dir,format);await mkdir(folder,{recursive:true});let data;
   if(format==='GLB')data={'model.glb':await io.writeBinary(doc)};
   else{const json=await io.writeJSON(doc,{format:'GLTF'});data={'model.gltf':strToU8(JSON.stringify(json.json)),...json.resources};}
   await writeFile(path.join(folder,'kitbash-city-streets-bench-a-test.zip'),zipSync(data));
   const results=await importYardStock({folder,work:path.join(folder,'work'),out:path.join(folder,'out')});
   expect(results[0].sourceFormat).toBe(format);expect(results[0].after).toBe(1);
   const output=await io.read(path.join(folder,'out/bench.glb')),bounds=getBounds(output.getRoot().listScenes()[0]);
   expect(bounds.max[1]).toBeCloseTo(.9);expect(bounds.min[1]).toBeCloseTo(0);expect(bounds.min[0]+bounds.max[0]).toBeCloseTo(0);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});

it('retains finite stock faces and rejects NaN triangles before bounds and HDR bloom',()=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,NaN,0,0,2,0,0,2,1,0],3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,NaN,0,0,0,0,1,0,0,1],3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],2));
 geometry.setIndex([0,1,2,3,4,5]);
 const clean=finiteStockGeometry(geometry);
 expect(clean.attributes.position.count).toBe(3);expect(clean.attributes.uv.count).toBe(3);
 expect(clean.boundingSphere.radius).toBeCloseTo(Math.sqrt(.5));
 expect(Array.from(clean.attributes.position.array).every(Number.isFinite)).toBe(true);
 expect(finiteStockGeometry(clean)).toBe(clean);
});
