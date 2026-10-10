import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Run after optional stock replacement. Bake static instance transforms once;
// retain the sources hidden so existing ownership/disposal remains intact.
export function optimizeYard(yard) {
 const buckets=new Map(),matrix=new THREE.Matrix4(),world=new THREE.Matrix4(),center=new THREE.Vector3();
 const dynamic=new Set([yard.materials.blades,yard.materials.foliage,yard.materials.laundry]);
 const sources=[];
 yard.root.updateMatrixWorld(true);
 yard.root.traverse(mesh=>{
  if(!mesh.isInstancedMesh||!mesh.visible||Array.isArray(mesh.material)||dynamic.has(mesh.material)||mesh.material.onBeforeCompile.toString().includes('clothTime'))return;
  // The backdrop already has nine inexpensive instanced draws; keep its cards.
  if(mesh.parent===yard.backdrop.group&&!mesh.material.userData.photoSeries)return;
  const material=mesh.material, key=Object.keys(mesh.geometry.attributes).sort().join(',');
  let groups=buckets.get(material);if(!groups)buckets.set(material,groups=new Map());
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-12)continue;
   world.multiplyMatrices(mesh.matrixWorld,matrix);
   center.setFromMatrixPosition(world);
   // Distant houses, garages and trees contribute no CSM caster geometry.
   const role=mesh.userData.fallbackEntries?.[i]?.role||mesh.parent?.userData.stockRole;
   const casts=mesh.castShadow&&['rack','bench','clothesline'].includes(role)&&Math.hypot(center.x,center.z)<12;
   const facadeWindows=role?.startsWith('photo-window-')?role.slice('photo-window-'.length):null;
   const groupKey=key+':'+casts+':'+(facadeWindows||'');let group=groups.get(groupKey);
   if(!group)groups.set(groupKey,group={casts,facadeWindows,geometries:[]});
   let geometry=mesh.geometry.clone().applyMatrix4(world);
   if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
   // Always supply colour, including white for untinted instances, so every
   // primitive in this material bucket has the same attribute layout.
   const color=new THREE.Color();if(mesh.instanceColor)mesh.getColorAt(i,color);
   const colors=new Float32Array(geometry.attributes.position.count*3);
   const originalColors=geometry.attributes.color;
   for(let j=0;j<colors.length;j+=3){colors[j]=color.r*(originalColors?.getX(j/3)??1);colors[j+1]=color.g*(originalColors?.getY(j/3)??1);colors[j+2]=color.b*(originalColors?.getZ(j/3)??1);}
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   group.geometries.push(geometry);
  }
  sources.push(mesh);
 });
 const merged=[];
 for(const [material,groups]of buckets)for(const {casts,facadeWindows,geometries}of groups.values()){
  if(!geometries.length)continue;
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  if(!geometry)throw Error('Cannot merge static yard attributes');
  material.vertexColors=true;material.needsUpdate=true;
  geometry.computeBoundingSphere();geometry.computeBoundingBox();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='yard-static-batch';
  mesh.castShadow=casts;mesh.receiveShadow=true;mesh.userData.performanceCastShadow=casts;
  if(facadeWindows){
   mesh.userData.facadeWindows=facadeWindows;
   yard.root.traverse(o=>{if(o.material?.userData.photoSeries===facadeWindows)mesh.userData.facadeMaterial=o.material;});
   mesh.visible=yard.root.userData.facadeMode==='procedural'||!mesh.userData.facadeMaterial?.userData.photoLoaded;
  }
  yard.root.add(mesh);merged.push(mesh);
 }
 for(const mesh of sources)mesh.visible=false;
 yard.root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh.userData.performanceCastShadow===undefined)mesh.userData.performanceCastShadow=mesh.castShadow;
 });
 return {apply(){
  yard.root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   mesh.castShadow=mesh.userData.performanceCastShadow===true;
  });
 },sources: sources.length,merged:merged.length};
}
