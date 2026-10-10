import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createYard} from '../src/scene/yard.js';
import {driveway,drivewayExit} from '../src/scene/yard/layout.js';
import {LAWN_HEIGHT,grassAllowed,pathDistance,isLawn} from '../src/scene/yard/ground.js';

it('keeps grass roots in raised lawns and away from asphalt, sandpit and shortcut',()=>{
 const yard=createYard(new THREE.Scene());let clumps=0;
 for(const mesh of yard.root.children)for(const entry of mesh.userData.fallbackEntries||[]){
  if(entry.role!=='grass-clump')continue;
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();entry.matrix.decompose(p,q,s);
  expect(grassAllowed(p.x,p.z)).toBe(true);
  expect(p.y-s.y/2).toBeCloseTo(LAWN_HEIGHT-.014,6);clumps++;
 }
 expect(clumps).toBeGreaterThan(300);
 for(const [x,z]of [[0,0],[14,-20],[14,-23],[-7,-10],[-11,-11],[4,2.5],[6,-9.65],[-19,-10],[-1,-27]])expect(grassAllowed(x,z)).toBe(false);
 expect(pathDistance(6,-9.65)).toBeCloseTo(0);
});

it('gives the sandpit broad wooden seats, a light infill and fence clearance',()=>{
 const yard=createYard(new THREE.Scene()),sandbox=new THREE.Box3(),fences=[];let seats=0;
 for(const mesh of yard.root.children)for(const entry of mesh.userData.fallbackEntries||[]){
  if(!['sandbox','lawn-fence'].includes(entry.role))continue;
  mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(entry.matrix);
  if(entry.role==='sandbox'){
   sandbox.union(box);
   if(mesh.material===yard.materials.sandboxPaint&&box.min.y>.33){expect(Math.min(box.max.x-box.min.x,box.max.z-box.min.z)).toBeGreaterThan(.3);seats++;}
  }else fences.push(box);
 }
 expect(seats).toBe(4);expect(sandbox.max.y-LAWN_HEIGHT).toBeCloseTo(.3,2);
 for(const fence of fences)expect(fence.intersectsBox(sandbox)).toBe(false);
 expect(yard.materials.sand.color.r).toBeGreaterThan(.7);
});


it('separates the origin service pad, frontage driveway, exit and refuse area',()=>{
 const yard=createYard(new THREE.Scene());
 expect(yard.barPosition.x).toBe(0);expect(yard.barPosition.z).toBe(0);
 for(const z of [-4,-8,-14])expect(isLawn(0,z)).toBe(true);
 for(const x of [-20,0,20,60])expect(isLawn(x,-20)).toBe(false);
 expect(isLawn(66,-50)).toBe(false);
 expect(isLawn(0,0)).toBe(false);expect(isLawn(-1,-27)).toBe(false);
 const near=yard.housing.find(h=>h.lod==='near'&&h.angle===0);
 expect(near.z+near.depth/2).toBe(-24);
 // Every entrance is offset from the bar; sidewalk and driveway are parallel.
 expect([-22,-7,8,23].map(x=>x+near.x).every(x=>Math.abs(x)>6)).toBe(true);
 const bounds=role=>{const box=new THREE.Box3();for(const mesh of yard.root.children)for(const entry of mesh.userData.fallbackEntries||[]){if(entry.role!==role)continue;mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox.clone().applyMatrix4(entry.matrix));}return box;};
 for(const h of yard.housing.filter(h=>h.lod==='near'||h.lod==='far')){
  const building=new THREE.Box3(new THREE.Vector3(-h.width/2,0,-h.depth/2),new THREE.Vector3(h.width/2,h.height,h.depth/2)).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(h.x,0,h.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),h.angle),new THREE.Vector3(1,1,1)));
  for(const r of [driveway,drivewayExit])expect(building.intersectsBox(new THREE.Box3(new THREE.Vector3(r.x0,0,r.z0),new THREE.Vector3(r.x1,.1,r.z1)))).toBe(false);
 }
 const pad=bounds('service-pad'),refuse=bounds('refuse-pad');
 expect(pad.max.x-pad.min.x).toBe(6);expect(pad.max.z-pad.min.z).toBe(5);
 expect(pad.intersectsBox(refuse)).toBe(false);
 const fence=bounds('service-fence');expect(fence.max.z).toBeLessThan(2.1);
 const cars=bounds('car');expect(cars.min.z).toBeGreaterThan(-21.8);expect(cars.max.z).toBeLessThan(-18);
 expect(bounds('clothesline').min.x).toBeGreaterThan(-3);expect(bounds('clothesline').max.x).toBeLessThan(3);
});
