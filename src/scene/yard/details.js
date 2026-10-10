import * as THREE from 'three';
import {LAWN_HEIGHT,grassAllowed} from './ground.js';
import {createLaundry} from './laundry.js';
import {wind} from '../wind.js';

// Deterministic local alpha atlases: no network dependency or extra draw per leaf.
export function detailTexture(kind){
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');if(!ctx)return null;
 let seed=464;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 if(kind==='bark'){ctx.fillStyle='#d7d5c9';ctx.fillRect(0,0,256,256);for(let i=0;i<100;i++){ctx.fillStyle=i%3?'#45463e':'#a1a298';ctx.fillRect(rnd()*256,rnd()*256,3+rnd()*48,1+rnd()*5);}}
 if(kind==='leaves')for(let i=0;i<100;i++){const x=25+rnd()*206,y=25+rnd()*206;ctx.fillStyle=['#54733c','#80984e','#a3ad61','#3b602e'][i%4];ctx.beginPath();ctx.ellipse(x,y,4+rnd()*7,2+rnd()*4,rnd()*6.28,0,6.28);ctx.fill();ctx.strokeStyle='#acb276';ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.stroke();}
 if(kind==='grass')for(let i=0;i<48;i++){
  const x=55+rnd()*146;
  ctx.strokeStyle=['#829b48','#9fa756','#748d3e'][i%3];ctx.lineWidth=1.5+rnd()*2;
  ctx.beginPath();ctx.moveTo(x,256);ctx.quadraticCurveTo(x+(rnd()-.5)*30,205,x+(rnd()-.5)*45,65+rnd()*150);ctx.stroke();
 }
 if(kind==='sandbox'){
  ctx.fillStyle='#d7d0bb';ctx.fillRect(0,0,256,256);
  for(let i=0;i<150;i++){ctx.fillStyle=i%3?'rgba(201,190,146,.3)':'rgba(52,78,57,.17)';ctx.fillRect(rnd()*256,rnd()*256,1+rnd()*3,5+rnd()*50);}
 }
 if(kind==='stain')for(let i=0;i<35;i++){const x=rnd()*256,w=3+rnd()*12,g=ctx.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(60,55,40,.5)');g.addColorStop(1,'rgba(60,55,40,0)');ctx.fillStyle=g;ctx.fillRect(x,0,w,90+rnd()*166);}
 if(kind==='chainlink'){
  ctx.strokeStyle='#b0b5a7';ctx.lineWidth=2.3;
  for(let i=-256;i<512;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+256,256);ctx.stroke();ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i-256,256);ctx.stroke();}
 }
 if(kind==='rack'){
  ctx.fillStyle='#528ca3';ctx.fillRect(0,0,256,256);
  for(let i=0;i<90;i++){ctx.fillStyle=i%3?'#7ba2ac':'#715448';ctx.fillRect(rnd()*256,rnd()*256,1+rnd()*5,2+rnd()*10);}
 }
 if(kind==='flowers'){ctx.fillStyle='#c7c6a9';ctx.fillRect(0,0,256,256);for(let i=0;i<65;i++){const x=rnd()*256,y=rnd()*256;ctx.fillStyle='#6c8775';ctx.fillRect(x,y,2,16);ctx.fillStyle='#b37c8a';for(let j=0;j<5;j++){ctx.beginPath();ctx.arc(x+Math.cos(j*1.256)*4,y+Math.sin(j*1.256)*4,3,0,6.28);ctx.fill();}}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;if(kind==='chainlink'){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,1.35);}if(kind==='bark'){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,4);}return t;
}
export function buildDetail(b,m,random,trees,root){
 const V=(x,y,z)=>new THREE.Vector3(x,y,z),time={value:0};root.userData.clothTime=time;
 m.foliage.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,wind.uniforms);
  shader.vertexShader='uniform float uWindTime; uniform float uWindStrength; uniform vec2 uWindDir;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   transformed.xz+=uWindDir*sin(uWindTime*.9+instanceMatrix[3].x*.2+instanceMatrix[3].z*.3)*(.015+.06*uWindStrength)*max(instanceMatrix[3].y-2.0,0.0);
  `);
 };
 m.foliage.customProgramCacheKey=()=> 'yard-shared-wind-foliage-v1';
 // Full birch and narrow poplar silhouettes, 12,000 alpha-card triangles total.
 for(let t=0;t<trees.length;t++){
  b.setRole(t<6?`tree-${t}`:'');
  const [x,z,h]=trees[t],poplar=t%3===0;
  b.add(b.pipe,poplar?m.trunk:m.bark,x,h*.36,z,.15,h*.72,.15);
  for(let j=0;j<12;j++){const a=j*2.4,y=h*(.3+j*.043);b.rod(poplar?m.trunk:m.bark,V(x,y,z),V(x+Math.cos(a)*1.3,y+1.8,z+Math.sin(a)*1.3),.045);}
  for(let i=0;i<600;i++){
   const a=random()*6.28,y=h*(.38+random()*.66),f=Math.max(.15,Math.sin((y/h-.35)/.72*Math.PI)),r=Math.sqrt(random())*(poplar?1.35:2.9)*f;
   b.add(b.plane,m.foliage,x+Math.cos(a)*r,y,z+Math.sin(a)*r,.9+random()*.8,.8+random()*.8,1,(random()-.5)*1.4,a,random()*.6,['#a6b77b','#869e58','#bbc688'][i%3]);
  }
 }
 b.setRole('');
 // Short, softly cut clumps. Card bottoms are buried in raised lawn soil;
 // the same world-space mask excludes roads, shortcuts and playground objects.
 m.blades.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,wind.uniforms);
  shader.vertexShader='uniform float uWindTime; uniform float uWindStrength; uniform vec2 uWindDir;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float tip=pow(clamp(position.y+.5,0.0,1.0),2.0);
   transformed.xz+=uWindDir*sin(uWindTime*1.6+instanceMatrix[3].x*.8+instanceMatrix[3].z)*(.025+.06*uWindStrength)*tip;
  `);
 };
 m.blades.customProgramCacheKey=()=> 'yard-rooted-grass-v1';
 b.setRole('grass-clump');
 for(let i=0;i<750;i++){
  const band=i%5,x=-27+random()*86;
  const z=band<3?8-random()*26:-17.4+random()*.5;
  if(!grassAllowed(x,z))continue;
  const h=.09+random()*.10,w=.18+random()*.19,angle=random()*Math.PI;
  for(const rotation of [angle,angle+Math.PI/2])b.add(b.plane,m.blades,x,LAWN_HEIGHT+h/2-.014,z,w,h,1,0,rotation,0);
 }
 b.setRole('');
 createLaundry(root,m.laundry);
 // Asphalt repairs and manhole with concentric lip and radial grating.
 for(const [x,z,sx,sz]of [[6,-20,1.8,2.4],[35,-20,1.4,1.2],[65.5,-42,2.6,1.8]])b.add(b.plane,m.asphalt,x,.022,z,sx,sz,1,-Math.PI/2,0,.12,'#4c4c47');
 b.add(b.pipe,m.metal,20,.033,-20.4,.48,.024,.48);b.add(b.pipe,m.recess,20,.049,-20.4,.42,.012,.42);
 for(let i=0;i<11;i++)b.cube(m.metal,20,.057,-20.4-.34+i*.068,Math.sqrt(Math.max(.01,.15-Math.pow(-.34+i*.068,2)))*2,.012,.015);

}
