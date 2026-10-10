import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createYard} from '../src/scene/yard.js';
import {sampleBackdropCoverage} from '../src/scene/yard/coverage.js';
it('covers the full frustum through extreme aim, wide and flip camera envelopes',()=>{
 const yard=createYard(new THREE.Scene());
 // Aim itself does not rotate the production camera. Also test a conservative
 // +/-35 degree yaw, raised eye and 1m lateral movement for camera transitions.
 for(const [aspect,fov]of [[1468/986,48],[2560/1080,75],[390/844,48]])for(const yaw of [-35,0,35]){
  const camera=new THREE.PerspectiveCamera(fov,aspect,.1,600);camera.position.set(.2+yaw/35,2.22,aspect<1?9:3.4);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(yaw*Math.PI/180),-.13,-Math.cos(yaw*Math.PI/180))));camera.updateProjectionMatrix();
  // The layout keeps the rack and camera envelope fixed while moving near housing.
  const result=sampleBackdropCoverage(yard,camera,{columns:33,rows:19});expect(result.failures).toEqual([]);
 }
});
it('detects a missing skyline even with an oversized ground and sky',()=>{
 const yard=createYard(new THREE.Scene());yard.backdrop.housing=[];
 const camera=new THREE.PerspectiveCamera(48,1.5,.1,600);camera.position.set(0,2,4);camera.lookAt(0,2,-100);
 expect(sampleBackdropCoverage(yard,camera,{columns:5,rows:5}).failures.length).toBe(25);
});
it('budgets the entire far ring independently of the detailed courtyard',()=>{
 const yard=createYard(new THREE.Scene());let draws=0,triangles=0;
 yard.backdrop.group.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);expect(o.castShadow).toBe(o.material.isMeshStandardMaterial === true);expect(o.receiveShadow).toBe(o.material.isMeshStandardMaterial === true);}});
 expect(draws).toBeLessThanOrEqual(20);expect(triangles).toBeLessThanOrEqual(60000);
 expect(yard.backdrop.housing.filter(h=>h.variant==='P-44')).toHaveLength(2);
 expect(yard.backdrop.housing.find(h=>h.variant==='II-49').height).toBeCloseTo(9*2.7);
});
