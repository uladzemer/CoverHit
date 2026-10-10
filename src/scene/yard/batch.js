import * as THREE from 'three';

// One draw per geometry/material pair, even across separate courtyard props.
// Small background pipes use eight sides; the gameplay rack keeps its original twelve.
export function createBatch(root) {
 const box=new THREE.BoxGeometry(1,1,1), pipe=new THREE.CylinderGeometry(1,1,1,8), rackPipe=new THREE.CylinderGeometry(1,1,1,12), plane=new THREE.PlaneGeometry(1,1), sphere=new THREE.SphereGeometry(1,12,8);
 const buckets=new Map(), dummy=new THREE.Object3D();let role='',transforms=[new THREE.Matrix4()];
 function add(g,m,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,color){
  let shapes=buckets.get(m);if(!shapes)buckets.set(m,shapes=new Map());
  let entries=shapes.get(g);if(!entries)shapes.set(g,entries=[]);
  dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();
  for(const transform of transforms)entries.push({matrix:transform.clone().multiply(dummy.matrix),color,role});
 }
 const cube=(m,x,y,z,sx,sy,sz,ry=0,color)=>add(box,m,x,y,z,sx,sy,sz,0,ry,0,color);
 function rod(m,a,b,r=.035){const v=new THREE.Vector3().subVectors(b,a);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());const e=new THREE.Euler().setFromQuaternion(dummy.quaternion);const p=a.clone().add(b).multiplyScalar(.5);add(pipe,m,p.x,p.y,p.z,r,v.length(),r,e.x,e.y,e.z);}
 function flush(){for(const [m,shapes]of buckets)for(const[g,entries]of shapes){const mesh=new THREE.InstancedMesh(g,m,entries.length);entries.forEach((e,i)=>{mesh.setMatrixAt(i,e.matrix);if(e.color)mesh.setColorAt(i,new THREE.Color(e.color));});mesh.castShadow=m.userData.castShadow!==false;mesh.receiveShadow=true;mesh.userData.fallbackEntries=entries;root.add(mesh);}buckets.clear();}
 return {add,cube,rod,flush,box,pipe,rackPipe,plane,sphere,setRole(value){role=value;},withTransforms(matrices,build){const previous=transforms;transforms=matrices;try{build();}finally{transforms=previous;}}};
}
