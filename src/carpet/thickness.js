import * as THREE from 'three';
import { CARPET_HALF_THICKNESS } from './barGeometry.js';

export function createThicknessStrip(cloth) {
  const {cols,rows}=cloth, boundary=[];
  for(let x=0;x<=cols;x++)boundary.push(x);
  for(let y=1;y<=rows;y++)boundary.push(y*(cols+1)+cols);
  for(let x=cols-1;x>=0;x--)boundary.push(rows*(cols+1)+x);
  for(let y=rows-1;y>0;y--)boundary.push(y*(cols+1));
  const geometry=new THREE.BufferGeometry(), indices=[];
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(boundary.length*6),3).setUsage(THREE.DynamicDrawUsage));
  for(let i=0;i<boundary.length;i++) {
    const a=i*2,b=((i+1)%boundary.length)*2;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  geometry.setIndex(indices);
  const material=new THREE.MeshStandardMaterial({color:'#665044',roughness:1,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='carpet-wool-edge'; mesh.castShadow=true; mesh.receiveShadow=true;
  const update=()=>{
    const p=cloth.positions,n=cloth.geometry.attributes.normal.array,out=geometry.attributes.position.array;
    for(let i=0;i<boundary.length;i++)for(let side=0;side<2;side++)for(let k=0;k<3;k++)
      out[i*6+side*3+k]=p[boundary[i]*3+k]+(side===0?1:-1)*CARPET_HALF_THICKNESS*n[boundary[i]*3+k];
    geometry.attributes.position.needsUpdate=true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  };
  update();
  return {mesh,update,dispose(){geometry.dispose();material.dispose();}};
}
