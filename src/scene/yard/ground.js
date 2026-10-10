import * as THREE from 'three';
import {servicePad,accessStrip,driveway,drivewayExit,sidewalk,refusePad,garageApron,inside} from './layout.js';

export const LAWN_HEIGHT=.09;
export const desireLine={from:[4,2.5],to:[8,-21.8],width:.9};
export function pathDistance(x,z){
 const [ax,az]=desireLine.from,[bx,bz]=desireLine.to,dx=bx-ax,dz=bz-az;
 const t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
 return Math.hypot(x-ax-t*dx,z-az-t*dz);
}
const hardSurfaces=[servicePad,accessStrip,driveway,drivewayExit,sidewalk,refusePad,garageApron];
export function isLawn(x,z){return !hardSurfaces.some(rect=>inside(rect,x,z));}
export function grassAllowed(x,z){
 if(!isLawn(x,z)||pathDistance(x,z)<.68)return false;
 // Sandpit, climbing rocket/slide, swing seats and bench pads.
 for(const [cx,cz,hx,hz]of [[-7,-10,2.05,1.95],[-11,-10,1.4,3.4],[-19,-10,2.4,1.5],[4.9,-3.8,1.7,.8],[-9,-18,1.6,1]])if(Math.abs(x-cx)<hx&&Math.abs(z-cz)<hz)return false;
 return true;
}

export function buildGround(root,b,m){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),m.asphalt);
 // Static batching enables vertex colours on the shared asphalt material.
 // The unbatched road needs an explicit white attribute as well; WebGL's
 // missing-attribute value is black, which otherwise erases its albedo/IBL.
 ground.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(ground.geometry.attributes.position.count*3).fill(1),3));
 ground.name='yard-ground';ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;root.add(ground);
 b.setRole('lawn');
 // Partition the raised soil around the independent service pads and L-shaped
 // driveway. The same rectangles exclude grass cards; no hidden axial road.
 const xs=[...new Set([-600,600,...hardSurfaces.flatMap(r=>[r.x0,r.x1])])].sort((a,b)=>a-b);
 const zs=[...new Set([-600,600,...hardSurfaces.flatMap(r=>[r.z0,r.z1])])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
  const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;
  if(isLawn(x,z))b.add(b.plane,m.grass,x,LAWN_HEIGHT,z,xs[i]-xs[i-1],zs[j]-zs[j-1],1,-Math.PI/2);
 }
 b.setRole('sidewalk');
 b.cube(m.concrete,33.1,.045,-22.9,62.2,.09,2.2);
 // Small asphalt entrance aprons sit between facade steps and sidewalk.
 for(const x of [10,25,40,55])b.add(b.plane,m.asphalt,x,.096,-23.55,3.2,1,1,-Math.PI/2);
 b.setRole('service-pad');
 b.add(b.plane,m.asphalt,0,.012,-.5,6,5,1,-Math.PI/2);
 b.setRole('access-slabs');
 for(let i=0;i<6;i++)b.cube(m.concrete,i*.8,.035,2.5,.76,.07,.9);
 b.setRole('refuse-pad');
 b.add(b.plane,m.concrete,-1,.012,-26.5,6,5,1,-Math.PI/2);
 b.setRole('curb');
 for(let x=-28;x<64;x++){
  if(x>=6&&x<10)continue; // pedestrian path opening
  b.cube(m.concrete,x+.5,.055,-17.9,.96,.16,.2,0,'#c2c4bd');
 }
 for(let z=-72;z<-22;z++)b.cube(m.concrete,68.1,.055,z+.5,.2,.16,.96,0,'#c2c4bd');
 b.setRole('');
}

export function configureLawn(m,worldShader){
 m.grass.onBeforeCompile=shader=>{
  worldShader(shader);
  shader.uniforms.yardDirt={value:m.sand.map||m.grass.map};
  shader.fragmentShader='uniform sampler2D yardDirt;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 p=yardWorld.xz;
   float macro=sin(p.x*.31+sin(p.y*.23))*sin(p.y*.39-p.x*.11);
   #ifdef USE_MAP
    vec3 alternate=texture2D(map,vec2(-p.y,p.x)/3.0+vec2(.37,.19)).rgb*diffuse;
    diffuseColor.rgb=mix(diffuseColor.rgb,alternate, .22);
   #endif
   diffuseColor.rgb*=mix(vec3(.83,.96,.72),vec3(1.07,1.04,.88),macro*.5+.5);
   vec2 a=vec2(${desireLine.from.map(n=>n.toFixed(2)).join(',')}),v=vec2(${desireLine.to.map((n,i)=>(n-desireLine.from[i]).toFixed(2)).join(',')});
   float t=clamp(dot(p-a,v)/dot(v,v),0.0,1.0);
   float distanceToPath=length(p-a-t*v);
   float wear=1.0-smoothstep(${(desireLine.width*.31).toFixed(3)},${(desireLine.width*.69).toFixed(3)},distanceToPath+sin(p.x*6.0+p.y*4.0)*.045);
   vec3 dirt=vec3(.28,.23,.15);
   #ifdef USE_MAP
    dirt=texture2D(yardDirt,p/2.0).rgb*vec3(.72,.62,.43);
   #endif
   // A narrow soil lip beds the grass into the concrete instead of a decal.
   float curbDistance=min(abs(p.y+17.9),abs(p.x-68.1));
   float lip=1.0-smoothstep(0.0,.17,curbDistance);
   diffuseColor.rgb=mix(diffuseColor.rgb,dirt,max(wear,lip*.45));`);
 };
 m.grass.customProgramCacheKey=()=>`yard-lawn-layout-v3-${!!m.sand.map}`;m.grass.needsUpdate=true;
}
