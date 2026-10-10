import * as THREE from 'three';
import {wind as sharedWind} from '../scene/wind.js';
import {seededRandom} from './random.js';
import {BAR_HEIGHT,BAR_CONTACT_RADIUS} from './barGeometry.js';

// Material ends, not silhouette edges: landscape scans end at u=0/1.
export function fringeEdges(cloth) {
 const {cols,rows,foldAxis}=cloth;
 return foldAxis==='u'
  ? [0,cols].map(x=>Array.from({length:rows+1},(_,y)=>y*(cols+1)+x))
  : [0,rows].map(y=>Array.from({length:cols+1},(_,x)=>y*(cols+1)+x));
}
export function fringeLength(type) {return type==='tapestry'?0:type==='palas'?.065:type==='runner'?.068:.09;}

// Prefer the light wool visible in the end border; keep its warm/cool tint.
export function sampleFringeColor(map,axis) {
 const image=map?.image;
 if(!image || typeof document==='undefined')return new THREE.Color('#eee4ce');
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(image,0,0,64,64);
 const pixels=ctx.getImageData(0,0,64,64).data,light=[];
 for(let y=0;y<64;y++)for(let x=0;x<64;x++) {
  if(axis==='u'?x>3&&x<60:y>3&&y<60)continue;
  const i=(y*64+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
  light.push({rgb:[r,g,b],l:.2126*r+.7152*g+.0722*b});
 }
 light.sort((a,b)=>b.l-a.l);
 const rgb=[0,1,2].map(k=>light.slice(0,Math.max(1,Math.ceil(light.length*.12))).reduce((s,p)=>s+p.rgb[k],0)/Math.ceil(light.length*.12));
 // Wool stays cream even on a dark or saturated scan.
 return new THREE.Color().setRGB(...rgb.map((v,k)=>(v*.25+[245,238,219][k]*.75)/255),THREE.SRGBColorSpace);
}

export function createFringe(cloth,{seed='fringe',type='wool',map}={}) {
 const length=fringeLength(type);
 if(!length)return {mesh:null,update(){},shake(){},dispose(){}};
 const random=seededRandom(`${seed}:fringe`),edges=fringeEdges(cloth);
 const span=cloth.foldAxis==='u'?cloth.height:cloth.width;
 const count=Math.max(16,Math.ceil(span/.007));
 // One draw call: four low-poly wool threads per bunch share each instance.
 const vertices=[],indices=[];
 for(let strand=0;strand<4;strand++) {
  const x=(strand-1.5)*.0014,r=.00065;
  for(const y of [0,-1])for(let k=0;k<4;k++)vertices.push(x+r*Math.cos(k*Math.PI/2),y,r*Math.sin(k*Math.PI/2));
  const b=strand*8;
  for(let k=0;k<4;k++){const n=(k+1)%4;indices.push(b+k,b+n,b+k+4,b+n,b+n+4,b+k+4);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:sampleFringeColor(map,cloth.foldAxis),roughness:1});
 const mesh=new THREE.InstancedMesh(geometry,material,count*2);mesh.name='carpet-fringe';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 const tassels=[];
 for(let side=0;side<2;side++)for(let i=0;i<count;i++) {
  const t=THREE.MathUtils.clamp((i+.5+(random()-.5)*.35)/count,0,1),f=t*(edges[side].length-1),j=Math.min(Math.floor(f),edges[side].length-2);
  const variation=type==='palas'||type==='runner'?.94+random()*.14:.88+random()*.22;
  tassels.push({side,a:edges[side][j],b:edges[side][j+1],t:f-j,length:length*variation,phase:random()*Math.PI*2,swing:new THREE.Vector2(),velocity:new THREE.Vector2(),root:new THREE.Vector3(),previous:new THREE.Vector3()});
 }
 const dummy=new THREE.Object3D(),root=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,-1,0),delta=new THREE.Vector3();
 const breeze=new THREE.Vector3();
 let previousTime=cloth.time,initialized=false;
 function update() {
  const elapsed=cloth.time-previousTime,dt=Number.isFinite(elapsed)?Math.min(.033,Math.max(0,elapsed)):0;previousTime=cloth.time;
  sharedWind.velocity(breeze,0,BAR_HEIGHT,0);
  for(const [i,t] of tassels.entries()) {
   root.fromArray(cloth.positions,t.a*3).lerp(delta.fromArray(cloth.positions,t.b*3),t.t);
   t.root.copy(root);
   if(!initialized || elapsed>.15 || elapsed<0){t.swing.set(0,0);t.velocity.set(0,0);t.previous.copy(root);}
   if(dt>0) {
    delta.copy(root).sub(t.previous).divideScalar(Math.max(dt,1e-5)).clampLength(0,8);
    const wind=Number.isFinite(cloth.wind)?cloth.wind:0;
    t.velocity.x+=(-90*t.swing.x-9*t.velocity.x-delta.x*6+wind*breeze.x*.2)*dt;
    t.velocity.y+=(-90*t.swing.y-9*t.velocity.y-delta.z*6+wind*breeze.z*.4)*dt;
    t.velocity.clampLength(0,15);
    t.swing.addScaledVector(t.velocity,dt).clampLength(0,.85);
   }
   t.previous.copy(root);
   direction.set(t.swing.x,-1,t.swing.y).normalize();
   dummy.position.copy(root);dummy.quaternion.setFromUnitVectors(up,direction);
   // Deflect the entire strand outward when its segment would cross the pipe.
   // The root follows the simulated hem, including a passing wave crest.
   if(cloth.barAxis) {
    const y=root.y-cloth.barAxis.y,z=root.z-cloth.barAxis.z;
    const dy=direction.y*t.length,dz=direction.z*t.length;
    const along=THREE.MathUtils.clamp(-(y*dy+z*dz)/(dy*dy+dz*dz||1),0,1);
    if(Math.hypot(y+along*dy,z+along*dz)<BAR_CONTACT_RADIUS+.002) {
      direction.set(direction.x,y,z).normalize();
      dummy.quaternion.setFromUnitVectors(up,direction);
    }
   }
   dummy.scale.set(1,t.length,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  initialized=true;mesh.instanceMatrix.needsUpdate=true;
 }
 function shake(point,strength=1,radius=.35) {
  if(!point||![point.x,point.y,point.z,strength,radius].every(Number.isFinite)||radius<=0)return;
  for(const t of tassels){const d=t.root.distanceTo(point);if(d<radius){const kick=THREE.MathUtils.clamp(strength,0,1)*(1-d/radius)*10;t.velocity.x+=Math.sin(t.phase)*kick*.45;t.velocity.y+=Math.cos(t.phase)*kick;}}
 }
 update();
 return {mesh,tassels,update,shake,dispose(){geometry.dispose();material.dispose();}};
}
