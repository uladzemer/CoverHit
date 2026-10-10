import {beforeAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {Cloth,crownLayout} from '../src/carpet/cloth.js';
import {carpetGeometry,carpetEntryType} from '../src/carpet/assets.js';
import {CARPET_TYPES} from '../src/carpet/types.js';
import {createYard} from '../src/scene/yard.js';
import {BAR_HEIGHT,BAR_RADIUS,BAR_CONTACT_RADIUS,CARPET_HALF_THICKNESS,CARPET_THICKNESS,CLOTH_BAR_OFFSET,rackSpan} from '../src/carpet/barGeometry.js';
let ammo;
beforeAll(async()=>{
 const context=vm.createContext({console,WebAssembly,TextDecoder,setTimeout,clearTimeout});
 vm.runInContext(readFileSync('public/vendor/ammo/ammo.wasm.js','utf8'),context);
 ammo=await context.Ammo({wasmBinary:readFileSync('public/vendor/ammo/ammo.wasm.wasm')});
});
const manifest=JSON.parse(readFileSync('public/carpets/manifest.json','utf8'));
const cases=[...CARPET_TYPES.flatMap(type=>[.7,1.4].map(aspect=>({id:`${type.id}-${aspect}`,type,aspect}))),...manifest.map(entry=>({id:entry.id,type:carpetEntryType(entry),aspect:entry.aspect}))];
it.each(cases)('seats $id on the real pipe at rest, with clear crown facets',({type,aspect})=>{
 const geometry=carpetGeometry(type,aspect),barLength=rackSpan([geometry.span]);
 const c=new Cloth({...type,...geometry,ammo,wind:0,barLength,barPosition:new THREE.Vector3(0,BAR_HEIGHT,CLOTH_BAR_OFFSET)});
 try {
  const check=()=>{
   const nodes=c.body.get_m_nodes(),count=c.foldAxis==='u'?c.cols:c.rows;
   const across=c.foldAxis==='u'?c.rows:c.cols, crown=crownLayout(c).crown;
   const at=(n,i)=>nodes.at(c.foldAxis==='u'?i*(c.cols+1)+n:n*(c.cols+1)+i).get_m_x();
   for(let i=0;i<=across;i++) {
    const top=at(count/2,i);
    const gap=top.y()-CARPET_HALF_THICKNESS-(BAR_HEIGHT+BAR_RADIUS);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(CARPET_THICKNESS+.005);
    for(const side of [-1,1]) {
     const tangent=at(count/2+side*crown,i);
     expect(tangent.y()).toBeCloseTo(BAR_HEIGHT,6);
     const sideGap=Math.abs(tangent.z())-CARPET_HALF_THICKNESS-BAR_RADIUS;
     expect(sideGap).toBeGreaterThanOrEqual(0);
     expect(sideGap).toBeLessThanOrEqual(.005);
    }
    for(let n=count/2-crown;n<count/2+crown;n++) {
     const a=at(n,i),b=at(n+1,i),dy=b.y()-a.y(),dz=b.z()-a.z();
     const t=Math.max(0,Math.min(1,-((a.y()-BAR_HEIGHT)*dy+a.z()*dz)/(dy*dy+dz*dz)));
     // Check the chord interior, not just its endpoints.
     expect(Math.hypot(a.y()-BAR_HEIGHT+t*dy,a.z()+t*dz)-CARPET_HALF_THICKNESS).toBeGreaterThanOrEqual(BAR_RADIUS-1e-6);
    }
   }
  };
  check();for(let i=0;i<120;i++)c.integrate(1/60);check();
  expect(c.barLength).toBe(barLength);expect(c.barContactRadius).toBe(BAR_CONTACT_RADIUS);
  expect(c.watchdogRecoveries??0).toBe(0);
 } finally {c.dispose();}
},20000);
it('uses the physics radius, height and span in the actual yard crossbar mesh',()=>{
 const barLength=rackSpan(cases.map(({type,aspect})=>carpetGeometry(type,aspect).span));
 const yard=createYard(new THREE.Scene(),{barLength});let crossbars=0;
 yard.root.traverse(o=>{if(!o.isInstancedMesh)return;o.userData.fallbackEntries.forEach(({role,matrix})=>{
  if(role!=='rack'||Math.abs(matrix.elements[12])>1e-6||matrix.elements[13]<1)return;
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);
  expect(p.y).toBe(BAR_HEIGHT);expect(p.z).toBe(0);
  expect(s.x*o.geometry.parameters.radiusTop).toBeCloseTo(BAR_RADIUS,12);
  expect(s.z*o.geometry.parameters.radiusBottom).toBeCloseTo(BAR_RADIUS,12);
  expect(s.y*o.geometry.parameters.height).toBeCloseTo(barLength,12);crossbars++;
 });});
 expect(crossbars).toBe(1);
});
