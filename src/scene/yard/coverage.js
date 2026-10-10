import * as THREE from 'three';
import {LAWN_HEIGHT} from './ground.js';

// Test actual triangle intersections, not an angular union of building bounds.
// Sky is legal only above the far skyline at this ray's azimuth. Ground must
// be reached before that skyline; extending a floor cannot hide a horizon gap.
export function sampleBackdropCoverage(yard,camera,{columns=81,rows=45,maxDistance=350}={}){
 yard.root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const boxes=yard.backdrop.housing.map(h=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(h.width,h.height,h.depth));mesh.position.set(h.x,h.height/2,h.z);mesh.rotation.y=h.angle;mesh.updateMatrixWorld();return mesh;});
 // Structural far solids and the actual paved/raised floor prove
 // coverage. Avoid thousands of decorative leaf instances per sampled ray.
 const meshes=[];yard.backdrop.group.traverse(o=>{if(o.isMesh&&o.visible&&o.geometry.type!=='PlaneGeometry')meshes.push(o);});
 const ground=yard.root.getObjectByName('yard-ground');if(ground)meshes.push(ground);
 // The redesigned yard has separate pad, sidewalk and lawn surfaces. Include
 // their actual instance triangles, rather than assuming an axial asphalt road.
 const floorRoles=new Set(['lawn','service-pad','refuse-pad','sidewalk','access-slabs']);
 for(const mesh of yard.root.children)if(mesh.isMesh&&mesh.visible&&mesh.userData.fallbackEntries?.some(e=>floorRoles.has(e.role)))meshes.push(mesh);
 const failures=[];let geometry=0,sky=0;const ray=new THREE.Raycaster(),horizontal=new THREE.Raycaster();
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const ndc=new THREE.Vector2(x/(columns-1)*2-1,y/(rows-1)*2-1);ray.setFromCamera(ndc,camera);ray.far=maxDistance;
  const d=ray.ray.direction,flat=new THREE.Vector3(d.x,0,d.z).normalize();
  horizontal.set(new THREE.Vector3(camera.position.x,.1,camera.position.z),flat);horizontal.far=maxDistance;
  const ring=horizontal.intersectObjects(boxes,false)[0];
  if(!ring){failures.push({x,y,reason:'open far ring'});continue;}
  const distanceXZ=ring.distance,atRing=camera.position.y+d.y*distanceXZ/Math.hypot(d.x,d.z);
  const hit=ray.intersectObjects(meshes,false)[0];
  if(hit&&hit.distance<=maxDistance){
   const p=hit.point,hitXZ=Math.hypot(p.x-camera.position.x,p.z-camera.position.z);
   if(p.y<=LAWN_HEIGHT+.01&&hitXZ>distanceXZ+.2){failures.push({x,y,reason:'ground beyond skyline'});continue;}
   geometry++;continue;
  }
  if(atRing>ring.object.geometry.parameters.height){sky++;continue;}
  failures.push({x,y,reason:'void below skyline',atRing});
 }
 boxes.forEach(o=>{o.geometry.dispose();o.material.dispose();});
 return{samples:columns*rows,geometry,sky,maxDistance,failures};
}
