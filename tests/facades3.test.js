import {it,expect} from 'vitest';
import sharp from 'sharp';
import {carBodyGeometry,carTrimGeometry,carPhotoGeometry} from '../src/scene/yard/car.js';
import {facadeBox,FACADE_SERIES} from '../src/scene/yard/facade.js';
import * as THREE from 'three';
import {optimizeYard} from '../src/scene/yard/performance.js';

it('draws the physical car proxy only during the shadow pass',()=>{
 const root=new THREE.Group(),material=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
 material.userData.shadowOnly=true;
 const source=new THREE.InstancedMesh(carBodyGeometry(),material,1);source.castShadow=true;
 const matrix=new THREE.Matrix4().makeTranslation(28,0,-19);source.setMatrixAt(0,matrix);
 source.userData.fallbackEntries=[{role:'photo-car-proxy',matrix}];root.add(source);
 optimizeYard({root,materials:{},backdrop:{group:new THREE.Group()}});
 const proxy=root.children.find(o=>o.name==='yard-static-batch');
 expect(proxy.castShadow).toBe(true);expect(proxy.geometry.drawRange.count).toBe(0);
 proxy.onBeforeShadow();expect(proxy.geometry.drawRange.count).toBe(Infinity);
 proxy.onAfterShadow();expect(proxy.geometry.drawRange.count).toBe(0);
 proxy.geometry.dispose();source.geometry.dispose();material.dispose();
});

it('keeps side photographic triangles coplanar and the entire vehicle below 2k triangles',()=>{
 const cards=carPhotoGeometry(),p=cards.attributes.position;
 // First side quad: every vertex has the same lateral coordinate. No fender,
 // door or glasshouse vertex can deform the photographic side.
 const n=new THREE.Vector3().fromBufferAttribute(cards.attributes.normal,0),point=new THREE.Vector3().fromBufferAttribute(p,0);
 for(let i=0;i<p.count;i++)expect(new THREE.Vector3().fromBufferAttribute(p,i).sub(point).dot(n)).toBeCloseTo(0,6);
 expect(cards.index.count/3).toBe(2);
 const parts=[carBodyGeometry(),carTrimGeometry(),cards];
 expect(parts.reduce((sum,g)=>sum+(g.index?.count||g.attributes.position.count)/3,0)).toBeLessThanOrEqual(2000);
 for(const g of parts)g.dispose();
});

it('maps five-floor sections as intact upright photographs with concrete on the other faces',()=>{
 for(const family of ['panel','panel335','brick','nine']){
  const width=(FACADE_SERIES[family].sectionWidth||15.5)*4,g=facadeBox(width,13.5,12.4,family,11),p=g.attributes.position,uv=g.attributes.facadeUv;
  for(let col=0;col<4;col++){
   const i=col*6;
   expect((p.getY(i+2)-p.getY(i))*13.5).toBeCloseTo(5*2.7,5);
   expect((p.getX(i+1)-p.getX(i))*width).toBeCloseTo(width/4,5);
   expect(uv.getX(i+1)-uv.getX(i)).toBeCloseTo(2031/2048,6);
   expect(uv.getY(i+2)-uv.getY(i)).toBeCloseTo(1783/2048,6);
  }
  expect(uv.getY(24)).toBeGreaterThan(.875); // rear uses the concrete strip
  g.dispose();
 }
});

it('uses coverage alpha for the car cards, leaving the roof background and wheel arches clear',async()=>{
 const {data,info}=await sharp('public/yard/photos/car-flat-atlas.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const alpha=(x,y)=>data[(y*info.width+x)*4+3];
 expect(alpha(30,10)).toBe(0);expect(alpha(161,199)).toBe(0);expect(alpha(607,199)).toBe(0);
 expect(alpha(450,150)).toBeGreaterThan(240);
});
