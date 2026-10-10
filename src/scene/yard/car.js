import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadPhotoTexture} from './facade.js';

export const CAR_DIMENSIONS=Object.freeze({length:4.17,width:1.61,height:1.40,wheelbase:2.42,clearance:.17});
export const CIVILIAN_PAINTS=Object.freeze(['#d9d3b8','#5a1520','#7da5b8']);
export function carPaint(seed){return CIVILIAN_PAINTS[(Math.imul(seed+1986,1664525)>>>0)%CIVILIAN_PAINTS.length];}
// Traced body outline from public-domain Lada_1200.svg (wheels are separate).
// x is the longitudinal coordinate; points run clockwise round the sheet metal.
const PROFILE_HINTS=[[-2.085,.36],[-2.085,.78],[-2.02,.84],[-1.55,.90],[-1.02,.94],[-.62,1.34],[-.50,1.40],[.65,1.40],[.83,1.34],[1.12,.95],[1.91,.87],[2.085,.80],[2.085,.36],[1.59,.36],[1.56,.48],[1.48,.62],[1.35,.69],[1.21,.71],[1.06,.68],[.94,.59],[.87,.45],[.85,.34],[-.85,.34],[-.87,.45],[-.94,.59],[-1.06,.68],[-1.21,.71],[-1.35,.69],[-1.48,.62],[-1.56,.48],[-1.59,.36]];
export const CAR_PROFILE=PROFILE_HINTS.flatMap((p,i)=>{const q=PROFILE_HINTS[(i+1)%PROFILE_HINTS.length];return[p,[(p[0]+q[0])/2,(p[1]+q[1])/2]];});
export function carBodyGeometry(){
 const shape=new THREE.Shape(CAR_PROFILE.map(([x,y])=>new THREE.Vector2(x,y)));
 const g=new THREE.ExtrudeGeometry(shape,{depth:1.61,steps:4,bevelEnabled:false,curveSegments:2});
 const p=g.attributes.position,uv=g.attributes.uv,n=g.attributes.normal;
 for(let i=0;i<p.count;i++){
  const length=p.getX(i),y=p.getY(i),side=p.getZ(i)-.805;
  // Tumblehome narrows the glasshouse; a mild plan crown rounds the fenders.
  const taper=(y>.93?1-(y-.93)*.29:1)*(1-.017*Math.pow(Math.abs(length)/2.085,4));
  const crown=Math.sin(Math.PI*(side/.805+1)/2)*.012*(y>.8?Math.max(0,(1.4-y)/.6):0);
  p.setXYZ(i,side*taper,y+crown,-length);
  if(Math.abs(n.getZ(i))>.5)uv.setXY(i,(length/4.17+.5)*.75,(y/1.40)*.5+.5);
  else if(y>.94&&Math.abs(n.getX(i))>.2)uv.setXY(i,(side/1.61+.5)*.25+(length>0?.25:0),.25+(y-.94)/.46*.25);
  else if(Math.abs(n.getX(i))>.7)uv.setXY(i,.75+(side/1.61+.5)*.125+(length>0?.125:0),.5+Math.min(1,Math.max(0,(y-.34)/.6))*.5);
  else uv.setXY(i,.85,.20);
 }
 g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function carTrimGeometry(){
 const parts=[];
 const add=(g,x,y,z,color)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.translate(x,y,z);const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);};
 for(const side of [-1,1])for(const z of [-1.21,1.21]){
  const tyre=new THREE.LatheGeometry([new THREE.Vector2(.19,-.09),new THREE.Vector2(.28,-.09),new THREE.Vector2(.31,-.065),new THREE.Vector2(.31,.065),new THREE.Vector2(.28,.09),new THREE.Vector2(.19,.09)],24);tyre.rotateZ(Math.PI/2);add(tyre,side*.705,.31,z,'#232522');
  const rim=new THREE.CylinderGeometry(.195,.195,.018,24);rim.rotateZ(Math.PI/2);add(rim,side*.8,.31,z,'#b5b5ac');
  for(let k=0;k<8;k++){const a=k*Math.PI/4;const hole=new THREE.CircleGeometry(.023,6);hole.rotateY(side*Math.PI/2);add(hole,side*.812,.31+Math.sin(a)*.14,z+Math.cos(a)*.14,'#303330');}
 }
 add(new THREE.BoxGeometry(1.12,.06,2.20),0,CAR_DIMENSIONS.clearance+.03,0,'#252825');
 for(const z of [-2.045,2.045])add(new THREE.BoxGeometry(1.61,.10,.08),0,.46,z,'#bdc1b7');
 add(new THREE.BoxGeometry(.82,.20,.018),0,.72,2.087,'#282d2b');
 for(const x of [-.6,-.36,.36,.6]){const lamp=new THREE.CircleGeometry(.105,16);add(lamp,x,.73,2.098,'#d9d8c3');}
 for(const x of [-.58,.58])add(new THREE.BoxGeometry(.25,.13,.018),x,.70,-2.09,'#873e31');
 for(const z of [-2.102,2.102])add(new THREE.BoxGeometry(.42,.09,.009),0,.49,z,'#cccbbd');
 const result=mergeGeometries(parts);parts.forEach(p=>p.dispose());return result;
}
function visibility(root,role,visible){
 root.traverse(mesh=>{const entries=mesh.userData.fallbackEntries;if(!entries?.some(e=>e.role===role))return;entries.forEach((e,i)=>{if(e.role===role){e.hidden=!visible;mesh.setMatrixAt(i,visible?e.matrix:new THREE.Matrix4().makeScale(0,0,0));}});mesh.instanceMatrix.needsUpdate=true;mesh.visible=!entries.every(e=>e.hidden);});
}
export function createCar(b,root,transforms,buildFallback){
 buildFallback();
 if(typeof document==='undefined')return;
 const body=carBodyGeometry(),trim=carTrimGeometry();
 const paint=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.40,metalness:.12,clearcoat:.4,clearcoatRoughness:.28});
 paint.userData.castShadow=false;
 // Glass keeps the photographed interior, with a smoother environment response.
 paint.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', '').replace('#include <map_fragment>',`vec3 photoPaintColor=diffuseColor.rgb;
  #include <map_fragment>
  #ifdef USE_MAP
  // Narrow fender-edge fade joins the three orthographic projections to paint.
  float panelU=vMapUv.x<.75?vMapUv.x/.75:fract((vMapUv.x-.75)*8.0);
  float seam=smoothstep(0.0,.025,min(panelU,1.0-panelU));
  float projected=step(.5,vMapUv.y);
  diffuseColor.rgb=mix(texture2D(map,vec2(.85,.20)).rgb*photoPaintColor,diffuseColor.rgb,mix(1.0,seam,projected));
  #endif
  #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
  float paintMask=smoothstep(.5,.9,texture2D(map,vMapUv).a);
  float paintShade=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/.515;
  diffuseColor.rgb=mix(diffuseColor.rgb,vColor.rgb*paintShade,paintMask);
  #endif`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  #ifdef USE_MAP
  float glazing=max(step(.83,vMapUv.y),step(.25,vMapUv.y)*step(vMapUv.y,.5)*step(vMapUv.x,.5));
  float glass=glazing*(1.0-step(.5,texture2D(map,vMapUv).a));
  roughnessFactor=mix(roughnessFactor,.13,glass);
  #endif`);};paint.customProgramCacheKey=()=> 'civilian-zhiguli-v4';
 const hardware=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.45});hardware.userData.castShadow=false;
 b.setRole('photo-car');b.withTransforms(transforms,()=>{b.add(body,paint,0,0,0,1,1,1);b.add(trim,hardware,0,0,0,1,1,1);});b.setRole('');
 queueMicrotask(()=>visibility(root,'photo-car',false));
 paint.userData.photoReady=loadPhotoTexture('car-atlas.webp',true).then(map=>{
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=2;paint.map=map;paint.needsUpdate=true;paint.userData.photoLoaded=true;
   // One shared draw; the atlas mask remaps paint and retains photo glass.
  root.traverse(mesh=>{if(mesh.material===paint&&mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,new THREE.Color(carPaint(i)));});
  visibility(root,'car',false);visibility(root,'photo-car',true);return true;
 }).catch(()=>false);
}
