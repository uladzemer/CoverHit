import * as THREE from 'three';
import {createFacadeMaterial,facadeImpostorBox,facadeTint,FACADE_SERIES} from './facade.js';
import {createBatch} from './batch.js';

// Our own deterministic facades: all floors are baked into a single texture per
// series. Boxes retain correct perspective from every aim/flip camera position.
function facade(kind,floors,bays){
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=bays*48;c.height=floors*48;
 const ctx=c.getContext('2d');if(!ctx)return null;
 ctx.fillStyle=kind==='brick'||kind==='school'?'#aa8578':'#c0b6ae';ctx.fillRect(0,0,c.width,c.height);
 if(kind==='brick'||kind==='school'){
  ctx.strokeStyle='#92766d';ctx.lineWidth=.7;
  for(let y=0;y<c.height;y+=8){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke();for(let x=(y%16?0:12);x<c.width;x+=24)ctx.strokeRect(x,y,24,8);}
 }
 for(let row=0;row<floors;row++)for(let col=0;col<bays;col++){
  const x=col*48,y=row*48,loggia=(kind==='nine'||kind==='tower')&&col%3===1;
  ctx.fillStyle='#978d88';ctx.fillRect(x,y,1,48);ctx.fillRect(x,y,48,1);
  if(loggia){ctx.fillStyle='#605d61';ctx.fillRect(x+4,y+3,40,44);}
  ctx.fillStyle='#d4c4b2';ctx.fillRect(x+11,y+9,26,30);
  ctx.fillStyle=(row*17+col*7)%11<2?'#ffd19a':['#565a65','#73747a','#62616b'][col%3];ctx.fillRect(x+13,y+11,22,25);
  ctx.fillStyle='#bdb5aa';ctx.fillRect(x+24,y+11,2,25);ctx.fillRect(x+13,y+25,22,2);
  ctx.fillStyle=loggia?'#b7aaa2':'#8c817b';ctx.fillRect(x+(loggia?4:9),y+38,loggia?40:30,loggia?8:3);
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.userData.facadeCells={floors,bays};return t;
}
function treeTexture(){
 if(typeof document==='undefined')return null;
 const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');if(!ctx)return null;
 for(let type=0;type<2;type++){
  const cx=64+type*128;ctx.fillStyle=type?'#b0aaa0':'#77706c';ctx.fillRect(cx-2,80,4,176);
  for(let i=0;i<130;i++){
   const a=i*2.399,y=20+(i*37%170),r=Math.sqrt((i*19%101)/101)*(type?48:22)*Math.sin((y-5)/215*Math.PI);
   ctx.fillStyle=['#626452','#7b765f','#8c806a'][i%3];ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*r,y,9,type?7:11,a,0,Math.PI*2);ctx.fill();
  }
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function buildBackdrop(root){
 const group=new THREE.Group();group.name='yard-backdrop';root.add(group);const b=createBatch(group),housing=[];
 const specs={panel:[5,18],brick:[5,18],nine:[9,18],tower:[16,9],school:[3,16]};
 const materials=Object.fromEntries(Object.entries(specs).map(([kind,[floors,bays]])=>{
  const map=facade(kind,floors,bays),m=createFacadeMaterial(kind,{roughness:.9,map,color:map?'#eee0da':kind==='brick'?'#ad8b80':'#b5a8a4'},()=>{},false,true);m.userData.castShadow=true;return[kind,m];
 }));
 // Front/back use the complete facade; end walls use a narrow subset, roof a
 // solid texel. One shared box for all instances, five material batches.
 const box=new THREE.BoxGeometry(1,1,1),uv=box.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,i<8?uv.getX(i)*.17:i<16?.002:uv.getX(i),i>=8&&i<16?.002:uv.getY(i));
 const boxes=new Map();
 function building(kind,x,z,width,angle=0){const bay=FACADE_SERIES[kind].bay;width=Math.round(width/bay)*bay;const height=specs[kind][0]*2.7,depth=kind==='tower'?20:12;
  const key=`${kind}-${width}`;if(!boxes.has(key))boxes.set(key,facadeImpostorBox(width,height,depth,kind));
  b.add(boxes.get(key),materials[kind],x,height/2,z,width,height,depth,0,angle,0,facadeTint(housing.length));
  housing.push({x,z,width,height,depth,angle,variant:kind==='nine'?'II-49':kind==='tower'?'P-44':kind==='brick'?'1-447':kind==='school'?'school':'1-464',lod:'backdrop'});
 }
 // Tangential slabs overlap around a full 150m perimeter. The staggered inner
 // row leaves streets and courtyards, revealing the continuous outer skyline.
 for(let i=0;i<24;i++){const a=i*Math.PI/12;building(i%4===0?'nine':i%2?'brick':'panel',Math.sin(a)*150,-Math.cos(a)*150,48,-a);}
 for(let i=0;i<10;i++){const a=(i+.35)*Math.PI/5;building(i%3?'nine':'brick',Math.sin(a)*96,-Math.cos(a)*96,42,-a+.08);}
 building('tower',-49,-125,24,.12);building('tower',91,-169,24,-.16);
 building('school',-43,-83,46,.1);
 const metal=new THREE.MeshBasicMaterial({color:'#77676b'});metal.userData.castShadow=false;
 for(let i=0;i<38;i++)b.cube(metal,-69+i*1.4,1,-72,.07,2,.07);
 for(const y of [.4,1.7])b.cube(metal,-43,y,-72,54,.06,.06);
 for(const x of [-70,-16])b.cube(metal,x,1,-83,.08,2,22);
 const stripes=new THREE.MeshBasicMaterial({color:'#ffffff'});stripes.userData.castShadow=false;
 const chimney=new THREE.CylinderGeometry(1,1.3,1,10);
 for(let i=0;i<10;i++)b.add(chimney,stripes,-76,2.3+i*4.6,-134,1.4,4.6,1.4,0,0,0,i%2?'#d6b9b2':'#a15e62');
 b.cube(materials.brick,-77,3,-129,20,6,14);
 const trees=new THREE.MeshBasicMaterial({map:treeTexture(),color:'#b5a59a',transparent:false,alphaTest:.25,side:THREE.DoubleSide});trees.userData.castShadow=false;
 // Select the atlas half from each instance's width: birch 10m, poplar 5m.
 // Both species share one geometry and one draw.
 trees.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
 #if defined(USE_MAP) && defined(USE_INSTANCING)
 vMapUv.x=(vMapUv.x+step(7.0,length(instanceMatrix[0].xyz)))*.5;
 #endif`);};trees.customProgramCacheKey=()=> 'backdrop-tree-atlas-v1';
 const card=new THREE.PlaneGeometry(1,1);
 for(let row=0;row<3;row++)for(let i=0;i<80;i++){
  const a=i*Math.PI/40+row*.13,r=78+row*46,h=11+(i*7%9),type=i%3===0?1:0;
  // Crossed fixed cards keep tree coverage when the camera is displaced.
  for(const angle of [-a,-a+Math.PI/2])b.add(card,trees,Math.sin(a)*r,h/2,-Math.cos(a)*r,type?10:5,h,1,0,angle);
 }
 b.flush();group.traverse(o=>{if(o.isMesh){o.castShadow=o.material.userData.castShadow===true;o.receiveShadow=o.material.isMeshStandardMaterial===true;}});
 return {group,housing};
}

export function createSunsetSky(){
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{horizon:{value:new THREE.Color('#e7a58c')},zenith:{value:new THREE.Color(.10,.13,.27)},sunDirection:{value:new THREE.Vector3(-.6,.075,-.8).normalize()},horizonGlowDirection:{value:new THREE.Vector3(-.6,.075,-.8).normalize()},sunColour:{value:new THREE.Color(1.3,.8,.36)},sunRadius:{value:new THREE.Vector2(.010,.017)}},
 vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:`varying vec3 direction;uniform vec3 horizon;uniform vec3 zenith;uniform vec3 sunDirection;uniform vec3 horizonGlowDirection;uniform vec3 sunColour;uniform vec2 sunRadius;
 void main(){vec3 d=normalize(direction);float h=max(d.y,0.0);
 vec3 col=mix(horizon,zenith,smoothstep(0.0,.40,h));
 col=mix(vec3(.50,.35,.36),col,smoothstep(-.12,.025,d.y));
 vec3 sun=normalize(sunDirection);float angle=acos(clamp(dot(d,sun),-1.0,1.0));
 // Broad atmospheric sunset colour stays behind the skyline even with the
 // direct source behind the camera. The solar disc follows the actual sun.
 float glowAngle=acos(clamp(dot(d,normalize(horizonGlowDirection)),-1.0,1.0));
 col+=vec3(.80,.28,.08)*exp(-glowAngle*glowAngle/ .065);
 col+=sunColour*(1.0-smoothstep(sunRadius.x,sunRadius.y,angle));
 gl_FragColor=vec4(col,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(550,32,16),material);sky.name='yard-sunset-sky';return sky;
}
