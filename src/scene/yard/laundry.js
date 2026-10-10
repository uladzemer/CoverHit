import * as THREE from 'three';
import {wind} from '../wind.js';
import {laundry,laundryHeight} from './layout.js';

const COLS=12,ROWS=16,FRAMES=151;
const sizes=[[.44,1.15,0],[.44,1.25,0],[.3,.72,0],[.3,.8,0],[.4,.67,1],[.32,.97,2],[.4,.7,1],[.13,.28,0],[.13,.28,0],[.3,.48,0]];
export function laundryPlacements(){return sizes.map(([width,height,template],i)=>({width,height,template,x:laundry.lines[i%2],z:laundry.from+.25+Math.floor(i/2)*(laundry.to-laundry.from-.5)/4,phase:i*.371}));}
function geometry(pins=true){
 const p=[],uv=[],ids=[],indices=[];
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const u=x/(COLS-1),v=y/(ROWS-1);p.push(u-.5,-v-.045*Math.sin(u*Math.PI),.015*Math.sin(u*19)*v);uv.push(u,1-v);ids.push(y*COLS+x);if(x<COLS-1&&y<ROWS-1){const a=y*COLS+x;indices.push(a,a+COLS,a+1,a+1,a+COLS,a+COLS+1);}}
 for(let pin=0;pins&&pin<2;pin++){
  const base=p.length/3;
  for(const [x,y] of [[-.015,-.022],[.015,-.022],[-.015,.035],[.015,.035]]){p.push(x+(pin===0?-.5:.5),y,.018);uv.push(.5,1);ids.push(-1-pin);}
  indices.push(base,base+1,base+2,base+1,base+3,base+2);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('vatVertex',new THREE.Float32BufferAttribute(ids,1));g.setIndex(indices);g.computeVertexNormals();return g;
}
function fabricTextures(){
 if(typeof document==='undefined')return {};
 const c=document.createElement('canvas');c.width=640;c.height=128;const ctx=c.getContext('2d');if(!ctx)return {};
 const colors=['#dcd8c7','#819da4','#d3c2a8','#bec7af','#c2aaa8'];
 for(let tile=0;tile<5;tile++){
  const ox=tile*128;ctx.fillStyle=colors[tile];ctx.fillRect(ox,0,128,128);
  ctx.fillStyle=['#a9a18c','#bdc8bd','#947f71','#8d9e8a','#e0ccbb'][tile];
  for(let y=4;y<128;y+=12)for(let x=4;x<128;x+=12){if(tile===0){ctx.fillRect(ox+x,y,1,3);ctx.fillRect(ox+x-1,y+1,3,1);}if(tile===1)ctx.fillRect(ox, y,128,2);if(tile===2){ctx.fillRect(ox+x,0,2,128);ctx.fillRect(ox,y,128,2);}if(tile===3){ctx.beginPath();ctx.arc(ox+x,y,2,0,6.28);ctx.fill();}}
  ctx.fillStyle='rgba(255,255,255,.08)';for(let x=0;x<128;x+=2)ctx.fillRect(ox+x,0,1,128);
 }
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
 const b=document.createElement('canvas');b.width=b.height=32;const bc=b.getContext('2d');bc.fillStyle='#808080';bc.fillRect(0,0,32,32);bc.fillStyle='#a0a0a0';for(let y=0;y<32;y+=2)for(let x=0;x<32;x+=2)bc.fillRect(x,y,1,1);
 const bumpMap=new THREE.CanvasTexture(b);bumpMap.wrapS=bumpMap.wrapT=THREE.RepeatWrapping;bumpMap.repeat.set(32,40);return {map,bumpMap};
}

const declarations=`
uniform sampler2D laundryVAT; uniform float laundryReady;
uniform float uWindTime; uniform float uWindStrength; uniform vec2 uWindDir;
attribute float vatVertex; attribute vec3 laundryData;
varying vec2 clothUV; varying float clothKind; varying float clothPin;
vec3 vatFrame(float vertex,float clip,float f){
 vec2 coord=vec2((vertex+.5)/192.0,((laundryData.x*3.0+clip)*151.0+f+.5)/1812.0);
 return texture2D(laundryVAT,coord).xyz*vec3(1.6,1.6,2.2)+vec3(-.8,-1.4,-.8);
}
vec3 vatClip(float vertex,float clip){
 float f=mod(uWindTime*30.0+laundryData.y*150.0,150.0);
 return mix(vatFrame(vertex,clip,floor(f)),vatFrame(vertex,clip,floor(f)+1.0),fract(f));
}
vec3 clothPoint(float vertex){
 float w=smoothstep(0.0,1.0,uWindStrength)*2.0;
 vec3 a=vatClip(vertex,0.0),b=vatClip(vertex,1.0),c=vatClip(vertex,2.0);
 vec3 p=mix(mix(a,b,min(w,1.0)),c,max(w-1.0,0.0));
 float freeEdge=floor(vertex/12.0)/15.0;
 if(laundryData.x<2.5){
  p.z+=sin(vertex*.37+uWindTime*9.0+laundryData.y)*.012*uWindStrength*freeEdge*freeEdge;
  float yaw=uWindDir.x*.12*freeEdge;
  p.x+=p.z*yaw; p.z-=p.x*yaw;
 }
 return p;
}
`;
function patch(material,uniforms,depth=false){
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms,wind.uniforms);
  shader.vertexShader=declarations+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   if(laundryReady>.5&&vatVertex>=0.0){
    float col=mod(vatVertex,12.0),row=floor(vatVertex/12.0);
    vec3 dx=clothPoint(vatVertex+(col<11.0?1.0:0.0))-clothPoint(vatVertex-(col>0.0?1.0:0.0));
    vec3 dy=clothPoint(vatVertex+(row<15.0?12.0:0.0))-clothPoint(vatVertex-(row>0.0?12.0:0.0));
    objectNormal=normalize(cross(dy,dx));
   }`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   if(laundryReady>.5)transformed=vatVertex<0.0?clothPoint(vatVertex<-1.5?11.0:0.0)+position-vec3(vatVertex<-1.5?.5:-.5,0.0,0.0):clothPoint(vatVertex);
   clothUV=uv;clothKind=laundryData.x;clothPin=vatVertex<0.0?1.0:0.0;
   #ifdef USE_MAP
    vMapUv=vec2((uv.x+laundryData.z)/5.0,uv.y);
   #endif`);
  shader.fragmentShader='varying vec2 clothUV; varying float clothKind; varying float clothPin;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   if(clothKind>1.5&&clothKind<2.5&&clothUV.y<.72&&abs(clothUV.x-.5)<.075)discard;`);
  if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`// Thin cloth warms on the reverse face under courtyard sunlight.
   if(clothKind>2.5)outgoingLight=vec3(.25,.24,.19);
   if(clothPin>.5)outgoingLight=vec3(.38,.23,.1);
   outgoingLight+=diffuseColor.rgb*vec3(1.0,.63,.32)*.11*(1.0-max(dot(normal,normalize(vec3(-.6,.2,-.8))),0.0));
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`laundry-vat-v1-${depth}`;
}
/** Synchronous static drape, upgraded independently; no runtime vertex/instance uploads. */
export function createLaundry(root,baseMaterial){
 const group=new THREE.Group();group.name='baked-laundry';root.add(group);
 const blank=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);blank.needsUpdate=true;
 const uniforms={laundryVAT:{value:blank},laundryReady:{value:0}};
 const fabrics=fabricTextures();const material=baseMaterial||new THREE.MeshStandardMaterial();material.setValues({color:'#ffffff',side:THREE.DoubleSide,roughness:.96,...fabrics,bumpScale:.003});patch(material,uniforms);
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});patch(depth,uniforms,true);
 const g=geometry(),placements=laundryPlacements(),attrs=[];
 const mesh=new THREE.InstancedMesh(g,material,placements.length);mesh.userData.fallbackEntries=[];mesh.name='laundry-cloth';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.customDepthMaterial=depth;
 const obj=new THREE.Object3D();placements.forEach((p,i)=>{obj.position.set(p.x,laundryHeight(p.z),p.z);obj.rotation.set(0,Math.PI/2,0);obj.scale.set(p.width,p.height,.32);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);attrs.push(p.template,p.phase,i%5);});g.setAttribute('laundryData',new THREE.InstancedBufferAttribute(new Float32Array(attrs),3));group.add(mesh);
 const rg=geometry(false);rg.setAttribute('laundryData',new THREE.InstancedBufferAttribute(new Float32Array([3,0,0,3,0,0]),3));
 // Static fallback uses the same sag profile as the placement helper.
 const rp=rg.attributes.position;for(let i=0;i<rp.count;i++){const u=i%COLS/(COLS-1),v=Math.floor(i/COLS)/(ROWS-1);rp.setXYZ(i,u-.5,-.2*Math.sin(u*Math.PI)+(v-.5)*.008,0);}rg.computeVertexNormals();
 const rm=material;const rope=new THREE.InstancedMesh(rg,rm,2);rope.userData.fallbackEntries=[];rope.name='laundry-rope';rope.frustumCulled=false;
 laundry.lines.forEach((x,i)=>{obj.position.set(x,2.74,(laundry.from+laundry.to)/2);obj.rotation.set(0,Math.PI/2,0);obj.scale.set(laundry.to-laundry.from,1,.1);obj.updateMatrix();rope.setMatrixAt(i,obj.matrix);});group.add(rope);
 const api={group,uniforms,status:'fallback',placements,dispose(){api.disposed=true;api.controller?.abort();group.removeFromParent();g.dispose();rg.dispose();material.dispose();depth.dispose();fabrics.map?.dispose();fabrics.bumpMap?.dispose();uniforms.laundryVAT.value.dispose();}};
 root.userData.laundry=api;
 if(typeof window!=='undefined')api.ready=loadLaundry(api);
 return api;
}
export async function loadLaundry(api){
 const base=`${import.meta.env?.BASE_URL||'/'}yard/laundry/`;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);api.controller=controller;
 try{
  const res=await fetch(base+'manifest.json',{signal:controller.signal});if(!res.ok)throw Error('manifest');const m=await res.json();
  if(m.version!==1||m.width!==192||m.height!==1812||m.frames!==FRAMES||m.cols!==COLS||m.rows!==ROWS||m.file!=='positions.bin'||JSON.stringify(m.bounds)!==JSON.stringify({min:[-.8,-1.4,-.8],max:[.8,.2,1.4]}))throw Error('VAT schema');
  const response=await fetch(base+m.file,{signal:controller.signal});if(!response.ok)throw Error('positions');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==m.width*m.height*4)throw Error('VAT length');
  if(api.disposed)return api;
  const tex=new THREE.DataTexture(bytes,m.width,m.height,THREE.RGBAFormat,THREE.UnsignedByteType);tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
  api.uniforms.laundryVAT.value.dispose();api.uniforms.laundryVAT.value=tex;api.uniforms.laundryReady.value=1;api.status='vat';
 }catch{api.status='fallback';}finally{clearTimeout(timer);}return api;
}
