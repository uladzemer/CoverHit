import * as THREE from 'three';

const weights=t=>[-.5*t+t*t-.5*t*t*t,1-2.5*t*t+1.5*t*t*t,.5*t+2*t*t-1.5*t*t*t,-.5*t*t+.5*t*t*t];
// Interpolate within each material interval, preserving the narrow crown chords
// and their nonuniform UV spacing exactly. Physics and contact topology stay coarse.
export function createSmoothGeometry(cloth) {
 const {cols,rows,foldAxis}=cloth, nx=cols*2,ny=rows*2,stride=nx+1;
 const geometry=new THREE.BufferGeometry(), count=stride*(ny+1),indices=[];
 const uv=new Float32Array(count*2), positions=new Float32Array(count*3),ao=new Float32Array(count*2);
 const sourceUv=cloth.geometry.attributes.uv.array;
 const samples=[];
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const gx=x*.5,gy=y*.5,ix=Math.min(cols-1,Math.floor(gx)),iy=Math.min(rows-1,Math.floor(gy)),tx=gx-ix,ty=gy-iy;
  const corners=[iy*(cols+1)+ix,iy*(cols+1)+ix+1,(iy+1)*(cols+1)+ix,(iy+1)*(cols+1)+ix+1];
  const linear=[(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty];
  const wx=weights(tx),wy=weights(ty),nodes=[],coefficients=[];
  // Fringe roots and the wool thickness strip follow coarse boundary segments.
  // Keep those exact too, so smoothing cannot detach them during a dent.
  const crown=Math.abs((foldAxis==='u'?gx-cols/2:gy-rows/2))<=3 || x===0 || x===nx || y===0 || y===ny;
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
   nodes.push(Math.max(0,Math.min(rows,iy+j-1))*(cols+1)+Math.max(0,Math.min(cols,ix+i-1)));
   coefficients.push(wx[i]*wy[j]);
  }
  const index=y*stride+x;
  for(let k=0;k<2;k++)for(let i=0;i<4;i++)uv[index*2+k]+=sourceUv[corners[i]*2+k]*linear[i];
  samples.push({corners,linear,nodes,coefficients,crown});
  if(x<nx&&y<ny)indices.push(index,index+stride,index+1,index+1,index+stride,index+stride+1);
 }
 if(foldAxis==='u')for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 geometry.setIndex(indices);
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 geometry.setAttribute('clothOcclusion',new THREE.BufferAttribute(ao,2).setUsage(THREE.DynamicDrawUsage));
 let side=0,frame=0,recoveries=cloth.watchdogRecoveries,flipping=false;
 const update=()=>{
  const forceNormals=side!==cloth.visibleSide||recoveries!==cloth.watchdogRecoveries||flipping!==Boolean(cloth.flip);
  flipping=Boolean(cloth.flip);
  recoveries=cloth.watchdogRecoveries;
  if(side!==cloth.visibleSide){const index=geometry.index.array;for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];geometry.index.needsUpdate=true;side=cloth.visibleSide;}
  const source=cloth.positions,sourceAO=cloth.geometry.attributes.clothOcclusion?.array;
  for(let i=0;i<count;i++){
   const s=samples[i],nodes=s.crown?s.corners:s.nodes,w=s.crown?s.linear:s.coefficients;
   for(let k=0;k<3;k++){
    let value=0;for(let j=0;j<nodes.length;j++)value+=source[nodes[j]*3+k]*w[j];
    positions[i*3+k]=value;
   }
   for(let k=0;k<2;k++){let value=0;for(let j=0;j<4;j++)value+=(sourceAO?.[s.corners[j]*2+k]??1)*s.linear[j];ao[i*2+k]=value;}
  }
  geometry.attributes.position.needsUpdate=true;geometry.attributes.clothOcclusion.needsUpdate=true;
  if(!geometry.attributes.normal||forceNormals||frame++%2===0)geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
 };
 update();return {geometry,update};
}
