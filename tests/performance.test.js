import { it, expect } from 'vitest';
import * as THREE from 'three';
import { cacheNodes } from '../src/carpet/nodeAccess.js';
import { createSmoothGeometry } from '../src/carpet/smoothGeometry.js';
import { clothRestPosition, clothUv } from '../src/carpet/cloth.js';
import { BAR_CONTACT_RADIUS } from '../src/carpet/barGeometry.js';
import { optimizeYard } from '../src/scene/yard/performance.js';

it('static merging retains transformed triangles and vertex tints while limiting casters',()=>{
 const root=new THREE.Group(),backdrop=new THREE.Group();root.add(backdrop);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
 const colors=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<colors.length;i+=3)colors.set([.6,.5,1],i);
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const source=new THREE.InstancedMesh(geometry,material,3);source.castShadow=true;
 source.userData.fallbackEntries=[];
 for(let i=0;i<3;i++){
  const matrix=new THREE.Matrix4().makeTranslation([2,25,0][i],0,0);
  source.setMatrixAt(i,matrix);source.setColorAt(i,new THREE.Color().setRGB(.5,.25,.1));
  source.userData.fallbackEntries.push({matrix,role:i===2?'rack':'bench'});
 }
 root.add(source);const optimization=optimizeYard({root,backdrop:{group:backdrop},materials:{}});
 expect(source.visible).toBe(false);expect(optimization.merged).toBe(2);
 const merged=root.children.filter(o=>o.name==='yard-static-batch');
 expect(merged.reduce((n,o)=>n+o.geometry.attributes.position.count/3,0)).toBe(36);
 expect(merged.find(o=>o.castShadow).geometry.boundingBox.max.x).toBe(2.5);
 expect(merged.find(o=>!o.castShadow).geometry.boundingBox.min.x).toBe(24.5);
 for(const mesh of merged){
  expect(mesh.geometry.attributes.color.getX(0)).toBeCloseTo(.3);
  expect(mesh.geometry.attributes.color.getY(0)).toBeCloseTo(.125);
  expect(mesh.geometry.attributes.uv.count).toBe(mesh.geometry.attributes.position.count);
  const casts=mesh.castShadow;mesh.castShadow=!casts;optimization.apply();expect(mesh.castShadow).toBe(casts);
  mesh.geometry.dispose();
 }
 source.dispose();geometry.dispose();material.dispose();
});

it('uses validated vector pointers and follows replacement WASM memory views',()=>{
 const ammo={HEAPF32:new Float32Array(64),getPointer:v=>v.address};
 const vector=address=>({address,x:()=>ammo.HEAPF32[address/4],y:()=>ammo.HEAPF32[address/4+1],z:()=>ammo.HEAPF32[address/4+2]});
 const node={get_m_x:()=>vector(16),get_m_q:()=>vector(32),get_m_v:()=>vector(48),get_m_f:()=>vector(64),get_m_im:()=>.5};
 const nodes=cacheNodes(ammo,{size:()=>1,at:()=>node});
 nodes.at(0).get_m_x().setValue(1,2,3);
 ammo.HEAPF32=new Float32Array(ammo.HEAPF32);
 ammo.HEAPF32[4]=7;
 expect(nodes.at(0).get_m_x().x()).toBe(7);
 nodes.at(0).get_m_v().setValue(4,5,6);expect([...ammo.HEAPF32.slice(12,15)]).toEqual([4,5,6]);
 const fallback={...ammo,getPointer:()=>17};
 expect(cacheNodes(fallback,{size:()=>1,at:()=>node}).at(0).get_m_x()).toHaveProperty('address',16);
});

it.each(['u','v'])('subdivision preserves scan endpoints, crown clearance and flip winding on %s',foldAxis=>{
 const c={cols:24,rows:36,width:foldAxis==='u'?3:2,height:foldAxis==='u'?2:3,foldAxis,visibleSide:0};
 c.geometry=new THREE.BufferGeometry();c.positions=new Float32Array((c.cols+1)*(c.rows+1)*3);
 const uv=new Float32Array((c.cols+1)*(c.rows+1)*2);
 for(let y=0;y<=c.rows;y++)for(let x=0;x<=c.cols;x++){
  const i=y*(c.cols+1)+x;c.positions.set(clothRestPosition(x,y,c),i*3);uv.set(clothUv(x,y,c),i*2);
 }
 c.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 const smooth=createSmoothGeometry(c),p=smooth.geometry.attributes.position,out=smooth.geometry.attributes.uv;
 expect(out.getX(0)).toBe(0);expect(out.getY(0)).toBe(1);
 expect(out.getX(out.count-1)).toBe(1);expect(out.getY(out.count-1)).toBe(0);
 // Sample each subdivided crown edge, including the midpoint between nodes.
 for(let y=0;y<=c.rows*2;y++)for(let x=0;x<=c.cols*2;x++){
  const d=foldAxis==='u'?x/2-c.cols/2:y/2-c.rows/2;
  if(Math.abs(d)>2)continue;
  const i=y*(c.cols*2+1)+x;expect(Math.hypot(p.getY(i),p.getZ(i))).toBeGreaterThanOrEqual(BAR_CONTACT_RADIUS-1e-7);
 }
 const index=[...smooth.geometry.index.array.slice(0,3)];c.visibleSide=1;smooth.update();
 expect([...smooth.geometry.index.array.slice(0,3)]).toEqual([index[0],index[2],index[1]]);
 // A curved/dented end must still use the same straight segments as fringe roots.
 c.positions[3*2+2]+=.2;smooth.update();
 const midpoint=3; // halfway between coarse boundary vertices 1 and 2
 expect(p.getZ(midpoint)).toBeCloseTo((c.positions[3+2]+c.positions[6+2])*.5,6);
 smooth.geometry.dispose();c.geometry.dispose();
});
