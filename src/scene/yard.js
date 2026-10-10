import * as THREE from 'three';
import {BAR_HEIGHT, BAR_RADIUS, BAR_POST_RADIUS, BAR_MIN_SPAN} from '../carpet/barGeometry.js';
import {buildBackdrop,createSunsetSky} from './yard/backdrop.js';
import {treePositions, dumpsterPositions} from './yard/layout.js';
import {createBatch} from './yard/batch.js';
import {buildHousing} from './yard/buildings.js';
import {buildDetail, detailTexture} from './yard/details.js';
import {buildProps} from './yard/props.js';
import {buildGround,configureLawn,LAWN_HEIGHT,isLawn} from './yard/ground.js';
import {loadYardAssets as loadBaseYardAssets} from './yard/assets.js';
import {readFacadeMode,setFacadeMode} from './yard/facade.js';
export async function loadYardAssets(yard,renderer,onProgress){
 const assets=await loadBaseYardAssets(yard,renderer,onProgress),photos=new Set();
 yard.root.traverse(o=>{for(const m of [o.material].flat())if(m?.userData.photoReady)photos.add(m.userData.photoReady);});
 await Promise.allSettled([...photos]);setFacadeMode(yard.root,readFacadeMode(),{persist:false});
 yard.root.traverse(o=>{for(const m of [o.material].flat())if(m?.userData.photoSeries)for(const t of [m.map,m.normalMap,m.emissiveMap])if(t)t.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());});
 return assets;
}

function randomSource(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function radialTexture(){
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');if(!ctx)return null;
 const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.65)');g.addColorStop(.5,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
function puddleTexture(){
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='#000';ctx.fillRect(0,0,128,128);ctx.fillStyle='#fff';ctx.beginPath();
 for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,r=45+Math.sin(a*5)*5+Math.cos(a*9)*3;const x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();
 const t=new THREE.CanvasTexture(c);return t;
}
// World-size UVs avoid stretching a scan across a 60m facade or a bench plank.
function worldSurface(material,metres=2){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 yardWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 yardP=vec4(transformed,1.0);vec3 yardN=objectNormal;
   #ifdef USE_INSTANCING
    yardP=instanceMatrix*yardP;yardN=mat3(instanceMatrix)*yardN;
   #endif
   yardWorld=(modelMatrix*yardP).xyz;yardN=normalize(mat3(modelMatrix)*yardN);
   vec3 axis=abs(yardN);vec2 yardUv=(axis.y>axis.x && axis.y>axis.z)?yardWorld.xz:(axis.x>axis.z?yardWorld.zy:yardWorld.xy);yardUv/=${metres.toFixed(2)};
   #ifdef USE_MAP
    vMapUv=yardUv;
   #endif
   #ifdef USE_NORMALMAP
    vNormalMapUv=yardUv;
   #endif
   #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv=yardUv;
   #endif
   #ifdef USE_AOMAP
    vAoMapUv=yardUv;
   #endif
   #ifdef USE_METALNESSMAP
    vMetalnessMapUv=yardUv;
   #endif`);
  shader.fragmentShader='varying vec3 yardWorld;\n'+shader.fragmentShader;
  material.userData.shader=shader;
 };
 material.customProgramCacheKey=()=>`yard-world-${metres}`;
}

/** Geometry and fallback materials build in Node without DOM or WebGL. */
export function createYard(scene,{barLength=BAR_MIN_SPAN}={}){
 const random=randomSource(1986),root=new THREE.Group();root.name='yard';scene.add(root);
 scene.background=new THREE.Color('#a7a3a0');scene.fog=new THREE.Fog('#d9a496',60,350);
 const standard=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,...extra});
 const m={
  brick:standard('#e0e0d5'),panel:standard('#c8cac3'),concrete:standard('#83847b'),trim:standard('#e2e0d7'),roof:standard('#575b55'),seam:standard('#6a6c63'),recess:standard('#26302e'),
  metal:standard('#70766e',{metalness:.65,roughness:.65}),painted:standard('#6f8b7c',{metalness:.4}),wood:standard('#797362'),sand:standard('#e4d4a3',{emissive:'#c5b78e',emissiveIntensity:.16}),grass:standard('#789246',{roughness:1,envMapIntensity:.25}),asphalt:standard('#595954'),
  door:standard('#3b514b'),laundry:standard('#c5c0af',{side:THREE.DoubleSide}),curtain:standard('#b7b0a1',{roughness:1}),curtainShade:standard('#7f8275'),
  glass:standard('#899596',{metalness:.85,roughness:.14}),lit:standard('#e7c894',{emissive:'#ffc776',emissiveIntensity:1.35,roughness:.6}),
  red:standard('#83473a',{metalness:.3}),car:standard('#b0a27f',{metalness:.5,roughness:.36}),chrome:standard('#c0c3b9',{metalness:1,roughness:.23}),tyre:standard('#222725'),headlamp:standard('#aab6b0',{metalness:.7,roughness:.18}),lamp:standard('#e6c99a',{emissive:'#ffc880',emissiveIntensity:1.8}),
  fallen:standard('#9c7946',{side:THREE.DoubleSide}),water:new THREE.MeshPhysicalMaterial({color:'#858b93',metalness:0,roughness:.06,clearcoat:1,clearcoatRoughness:.15,alphaMap:puddleTexture(),alphaTest:.1,transparent:true,opacity:.6,depthWrite:false}),trunk:standard('#615d50'),leaf:standard('#71774b',{side:THREE.DoubleSide}),
 };
 m.chainlink=standard('#afb5a7',{map:detailTexture('chainlink'),alphaTest:.3,side:THREE.DoubleSide,metalness:.5});m.chainlink.userData.castShadow=false;
 m.bark=standard('#d4d2c5',{map:detailTexture('bark')});
 m.rack=standard('#ffffff',{map:detailTexture('rack'),metalness:.15,roughness:.8,emissive:'#528ca3',emissiveIntensity:.16});
 m.foliage=standard('#6c8449',{emissive:'#82954a',emissiveIntensity:.13,map:detailTexture('leaves'),alphaTest:.45,side:THREE.DoubleSide,roughness:1});
 m.blades=standard('#bacb91',{emissive:'#718e42',emissiveIntensity:.22,map:detailTexture('grass'),alphaTest:.12,alphaToCoverage:false,side:THREE.DoubleSide,roughness:1});m.blades.userData.castShadow=false;
 m.sandboxPaint=standard('#ffffff',{roughness:.9,map:detailTexture('sandbox')});
 m.stain=standard('#74766b',{map:detailTexture('stain'),transparent:true,opacity:.28,depthWrite:false});m.stain.userData.castShadow=false;
 const glow=radialTexture();
 m.glow=new THREE.MeshBasicMaterial({color:'#ffcd82',map:glow,transparent:true,opacity:glow?.18:0,depthWrite:false,toneMapped:false});m.glow.userData.castShadow=false;
 const b=createBatch(root);const {cube,add,pipe,plane,sphere}=b;
 for(const key of ['panel','brick','painted','wood','sand','grass','asphalt'])worldSurface(m[key],key==='wood'?.8:key==='panel'?2.7:key==='grass'?3:2);
 const lawnWorldShader=m.grass.onBeforeCompile;configureLawn(m,lawnWorldShader);
 buildGround(root,b,m);
 const housing=buildHousing(b,m,random,root);buildProps(b,m,random,root);
 // Human-reach carpet rack: capped 72 mm posts, a welded 48 mm crossbar.
 // A local chipped blue paint atlas also works when optional scans are absent.
 b.setRole('rack');
 for(const x of [-barLength/2,barLength/2]){
  add(b.rackPipe,m.rack,x,BAR_HEIGHT/2,0,BAR_POST_RADIUS,BAR_HEIGHT,BAR_POST_RADIUS);
  add(pipe,m.concrete,x,.035,0,.13,.07,.13);
  add(b.rackPipe,m.rack,x,BAR_HEIGHT+.006,0,BAR_POST_RADIUS+.002,.012,BAR_POST_RADIUS+.002);
  add(pipe,m.metal,x-Math.sign(x)*.018,BAR_HEIGHT,0,BAR_RADIUS+.003,.04,BAR_RADIUS+.003,0,0,Math.PI/2);
 }
 add(b.rackPipe,m.rack,0,BAR_HEIGHT,0,BAR_RADIUS,barLength,BAR_RADIUS,0,0,Math.PI/2);
 b.setRole('');

 buildDetail(b,m,random,treePositions,root);
 // Cheap soft contact AO, shared with restrained light halos.
 if(glow){const ao=new THREE.MeshBasicMaterial({color:'#151c15',map:glow,transparent:true,opacity:.4,depthWrite:false});ao.userData.castShadow=false;
  for(const [x,z,sx,sz]of [[5.35,-3.8,1.7,.7],[-7,-10,2,1.8],...Array.from({length:3},(_,i)=>[[12,28,49][i],-19,2.1,1.1]),...dumpsterPositions.map(([x,z])=>[x,z,.5,.5]),...Array.from({length:7},(_,i)=>[-28+i*3.25,-32,2,3]),...treePositions.map(([x,z])=>[x,z,1.1,1.1])])add(plane,ao,x,isLawn(x,z)?LAWN_HEIGHT+.002:.002,z,sx*2,sz*2,1,-Math.PI/2);
 }
 b.flush();
 const backdrop=buildBackdrop(root);housing.push(...backdrop.housing);
 const sky=createSunsetSky();root.add(sky);
 const sun=new THREE.DirectionalLight('#ffcf9c',2.1);sun.position.set(-32,4,-43);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:85});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;
 const bounce=new THREE.HemisphereLight('#d8e3ec','#65715a',1.05);root.add(sun,sun.target,bounce);
 let elapsed=0;const wind={value:0};
 return {
  root,scene,materials:m,sun,sky,bounce,housing,backdrop,barPosition:new THREE.Vector3(0,BAR_HEIGHT,0),barLength,
  assetStatus:{loaded:0,total:22,failures:[]},
  configureGround(){configureLawn(m,lawnWorldShader);},
  update(dt){if(Number.isFinite(dt)&&dt>0){elapsed+=dt;wind.value=elapsed;root.userData.clothTime.value=elapsed;}},
 };
}
