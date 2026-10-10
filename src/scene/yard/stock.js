import * as THREE from 'three';
import {treePositions,benchPositions,lampPositions,dumpsterPositions} from './layout.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createStockHousingFallback} from './buildings.js';

const base=()=>`${import.meta.env?.BASE_URL||'/'}yard/stock/`;
const roles=new Set(['building','horizon','garage','tree','birch','bench','lamp','dumpster']);
export async function loadStockManifest(url=base()+'manifest.local.json',fetchManifest=fetch){
 try{
  const response=await fetchManifest(url,{signal:AbortSignal.timeout(4000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('json'))return [];
  const entries=await response.json();
  if(!Array.isArray(entries)||!entries.every(e=>e&&typeof e.id==='string'&&/^[a-z0-9-]+$/.test(e.id)&&roles.has(e.role)&&typeof e.title==='string'&&e.title.length>0&&typeof e.file==='string'&&/^[a-z0-9-]+\.glb$/.test(e.file)&&Number.isFinite(e.tris)&&e.tris>0&&Number.isFinite(e.scale)&&e.scale>0&&e.licence==='Envato Elements (personal)'&&typeof e.sourceUrl==='string'&&e.sourceUrl.startsWith('https://elements.envato.com/')))return [];
  if(new Set(entries.map(e=>e.id)).size!==entries.length)return [];
  return entries;
 }catch{return [];}
}
const placements={
 building:[[9,0,-69,1,0]],horizon:[[-34,0,-102,1,0],[54,0,-108,1,0]],
 garage:[[-24,0,-32.8,[.68,1,1],0],[-12.5,0,-32.8,[.68,1,1],0]],
 tree:[0,2,4].map((i,k)=>[treePositions[i][0],.09,treePositions[i][1],[1,1.1,1.2][k],[0,1.8,.7][k]]),
 birch:[1,3,5].map((i,k)=>[treePositions[i][0],.09,treePositions[i][1],[.9,.8,.9][k],[.4,2.1,1.2][k]]),
 bench:benchPositions.map(([x,z])=>[x,.09,z,1,0]),
 lamp:lampPositions.map(([x,z])=>[x,0,z,1,0]),
 dumpster:dumpsterPositions.map(([x,z])=>[x,0,z,1,0]),
};
function fallbackRoles(role){return role==='tree'?['tree-0','tree-2','tree-4']:role==='birch'?['tree-1','tree-3','tree-5']:['building','horizon'].includes(role)?[]:[role];}
export function replaceFallback(yard,role,hidden=true){
 const targets=fallbackRoles(role);
 for(const mesh of yard.root.children){const entries=mesh.userData.fallbackEntries;if(!entries)continue;
  entries.forEach((entry,i)=>{if(!targets.includes(entry.role))return;entry.hidden=hidden;mesh.setMatrixAt(i,hidden?new THREE.Matrix4().makeScale(0,0,0):entry.matrix);});
  mesh.visible=!entries.every(e=>e.hidden);mesh.instanceMatrix.needsUpdate=true;
 }
}
// A local panel-block GLB contains one NaN vertex/normal. Invalid triangles
// poison HDR bloom when exposed by a new layout, even if direct rendering works.
// Keep all finite faces and compact attributes so bounds also remain finite.
export function finiteStockGeometry(geometry){
 const position=geometry.attributes.position,normal=geometry.attributes.normal;
 const valid=i=>[position,normal].filter(Boolean).every(a=>Array.from({length:a.itemSize},(_,c)=>a.getComponent(i,c)).every(Number.isFinite));
 if(Array.from({length:position.count},(_,i)=>i).every(valid))return geometry;
 const vertices=[],count=geometry.index?.count||position.count;
 for(let i=0;i<count;i+=3){const face=[0,1,2].map(j=>geometry.index?geometry.index.getX(i+j):i+j);if(face.every(valid))vertices.push(...face);}
 if(!vertices.length)throw Error('Stock geometry contains no finite triangles');
 const clean=new THREE.BufferGeometry();
 for(const [name,attribute]of Object.entries(geometry.attributes)){
  const values=new Float32Array(vertices.length*attribute.itemSize);
  vertices.forEach((vertex,i)=>{for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=attribute.getComponent(vertex,c);});
  clean.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize));
 }
 clean.computeBoundingBox();clean.computeBoundingSphere();return clean;
}
export function instantiateStock(source,entry){
 source.traverse(o=>{if(!o.isMesh)return;const clean=finiteStockGeometry(o.geometry);if(clean!==o.geometry){o.geometry.dispose();o.geometry=clean;}});
 if(['building','horizon'].includes(entry.role)){
  const issue=stockFacadeIssue(source);
  if(issue){const fallback=createStockHousingFallback(entry,placements[entry.role]);fallback.userData.fallbackReason=issue;return fallback;}
 }
 const group=new THREE.Group();group.name=`yard-stock-${entry.id}`;
 group.userData.stockRole=entry.role;
 const dummy=new THREE.Object3D();source.updateMatrixWorld(true);
 source.traverse(o=>{if(!o.isMesh)return;
  // The imported lamp includes an English bus-lane sign on a separate atlas
  // primitive. Keep the lamp hardware, omit that inappropriate courtyard sign.
  if(entry.role==='lamp'&&/PropAtlas/i.test(o.material?.name))return;
  const instances=placements[entry.role];const mesh=new THREE.InstancedMesh(o.geometry,o.material,instances.length);
  mesh.name=o.name;mesh.receiveShadow=true;mesh.castShadow=!['building','horizon','tree','birch'].includes(entry.role);
  instances.forEach(([x,y,z,s,angle],i)=>{dummy.position.set(x,y,z);if(Array.isArray(s))dummy.scale.set(...s.map(v=>v*entry.scale));else dummy.scale.setScalar(s*entry.scale);dummy.rotation.set(0,angle,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix.clone().multiply(o.matrixWorld));});
  mesh.computeBoundingSphere();group.add(mesh);
 });
 if(!group.children.length)throw Error('Stock model contains no meshes');
 if(entry.role==='lamp')for(const [x,y,z]of placements.lamp.slice(0,2)){const light=new THREE.PointLight('#ffd09a',12,8,2);light.position.set(x,y+4.9,z);group.add(light);}
 return group;
}
export function stockFacadeIssue(source){
 source.updateMatrixWorld(true);
 const height=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3()).y;
 let facades=0,issue='';
 source.traverse(o=>{
  if(!o.isMesh)return;
  // Roof hardware may intentionally use solid metal; storey-height walls must
  // have loaded colour textures and UVs. Check each primitive/material.
  const meshHeight=new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y;
  if(meshHeight<height*.35)return;
  facades++;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  if(!o.geometry.attributes.uv||materials.some(m=>!m?.map?.image))issue='Missing facade colour texture or UVs';
 });
 return issue||(!facades?'No textured building facade':'');
}
function disposeObject(object){const geometries=new Set(),materials=new Set(),textures=new Set();object.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}for(const t of textures)t.dispose();for(const g of geometries)g.dispose();}
export async function loadYardStock(yard){
 const entries=await loadStockManifest(),loaded=[],failures=[],substitutions=[],groups=[];const loader=new GLTFLoader();
 // Independent fallbacks; a broken local model cannot block a playable yard.
 await Promise.all(entries.map(async entry=>{let source;try{
  const response=await fetch(base()+entry.file,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`${entry.id}: HTTP ${response.status}`);
  const buffer=await response.arrayBuffer();
  // Imported GLBs are self-contained. Reject external resources before parsing.
  const view=new DataView(buffer);if(view.getUint32(0,true)!==0x46546c67)throw Error('Invalid GLB');
  const length=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  if([...json.buffers||[],...json.images||[]].some(e=>e.uri&&!e.uri.startsWith('data:')))throw Error('External GLB resource rejected');
  source=(await loader.parseAsync(buffer,'')).scene;
  const group=instantiateStock(source,entry);yard.root.add(group);groups.push({group,entry});replaceFallback(yard,entry.role);
  if(group.userData.fallbackReason){substitutions.push({id:entry.id,reason:group.userData.fallbackReason});disposeObject(source);}else loaded.push(entry);
 }catch(e){if(source)disposeObject(source);failures.push({id:entry.id,error:e.message});}}));
 yard.stockStatus={requested:entries.length,loaded:loaded.map(e=>e.id),substitutions,failures};
 yard.stockCredits=loaded.sort((a,b)=>a.id.localeCompare(b.id));
 return {dispose(){for(const {group,entry}of groups){yard.root.remove(group);replaceFallback(yard,entry.role,false);disposeObject(group);}yard.stockCredits=[];}};
}
