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
// Painted volume only: no photographic UVs on bevelled or curved surfaces.
export function carBodyGeometry(){
 const parts=[];
 // Wheel arches cut the volume as well as the photo alpha: tyres cannot be
 // occluded by a solid box inside a transparent photographic arch.
 const bodyOutline=PROFILE_HINTS.filter(p=>p[1]<1).map(([x,y])=>new THREE.Vector2(x,Math.min(.94,y)));
 const bodyShape=new THREE.Shape(bodyOutline);
 const shell=new THREE.ExtrudeGeometry(bodyShape,{depth:1.54,steps:1,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3});
 shell.translate(0,0,-.77);shell.rotateY(Math.PI/2);parts.push(shell);
 const cabinShape=new THREE.Shape([[-1.02,.94],[-.62,1.34],[-.50,1.365],[.65,1.365],[.83,1.34],[1.12,.95]].map(([x,y])=>new THREE.Vector2(x,y)));
 const cabin=new THREE.ExtrudeGeometry(cabinShape,{depth:1.33,steps:1,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3});cabin.translate(0,0,-.665);cabin.rotateY(Math.PI/2);parts.push(cabin);
 const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());g.computeBoundingBox();g.scale(1,1,4.17/(g.boundingBox.max.z-g.boundingBox.min.z));g.computeBoundingBox();return g;
}
// A complete car photograph belongs to one flat, fixed-yaw plane.
export function carPhotoGeometry(width=4.17,height=1.62){
 const g=new THREE.PlaneGeometry(width,height);
 // Existing placements are longitudinal Z with a +PI/2 yaw. This fixed
 // billboard faces the yard cameras, with ample coverage at both aim limits.
 g.rotateY(-Math.PI/2-.20);g.translate(0,height/2+.012,0);
 g.computeBoundingBox();return g;
}
export function carTrimGeometry(){
 const parts=[];
 const add=(g,x,y,z,color)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.translate(x,y,z);const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);};
 for(const side of [-1,1])for(const z of [-1.21,1.21]){
  const tyre=new THREE.LatheGeometry([new THREE.Vector2(.19,-.09),new THREE.Vector2(.31,-.065),new THREE.Vector2(.31,.065),new THREE.Vector2(.19,.09)],24);tyre.rotateZ(Math.PI/2);add(tyre,side*.705,.31,z,'#232522');
  const rim=new THREE.CylinderGeometry(.195,.195,.018,16);rim.rotateZ(Math.PI/2);add(rim,side*.8,.31,z,'#b5b5ac');
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
function visibility(root,role,visible,positions=null){
 root.traverse(mesh=>{const entries=mesh.userData.fallbackEntries;if(!entries?.some(e=>e.role===role))return;entries.forEach((e,i)=>{if(e.role===role&&(!positions||positions.some(x=>Math.abs(e.matrix.elements[12]-x)<3))){e.hidden=!visible;mesh.setMatrixAt(i,visible?e.matrix:new THREE.Matrix4().makeScale(0,0,0));}});mesh.instanceMatrix.needsUpdate=true;mesh.visible=!entries.every(e=>e.hidden);});
}
export function createCar(b,root,transforms,buildFallback){
 buildFallback();
 if(typeof document==='undefined')return;
 const proxy=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
 proxy.userData.castShadow=true;proxy.userData.shadowOnly=true;
 // The camera sees only the complete photographs; the physical body and tyres
 // remain in the light's depth pass. Soft ground contact AO is shared in yard.js.
 b.setRole('photo-car-proxy');b.withTransforms(transforms,()=>{
  b.add(carBodyGeometry(),proxy,0,0,0,1,1,1);
  b.add(carTrimGeometry(),proxy,0,0,0,1,1,1);
 });
 for(const [name,indices,width,height]of [['red',[0,2],4.17,1.62],['cream',[1],4.17,1.72]]){
  const photo=new THREE.MeshStandardMaterial({color:'#eee7dd',roughness:1,metalness:0,transparent:true,alphaTest:.025,depthWrite:true,side:THREE.DoubleSide});
  photo.userData.castShadow=false;
  photo.forceSinglePass=true;
  b.setRole('photo-car-'+name);b.withTransforms(indices.map(i=>transforms[i]),()=>b.add(carPhotoGeometry(width,height),photo,0,0,0,1,1,1));
  queueMicrotask(()=>visibility(root,'photo-car-'+name,false));
  photo.userData.photoReady=loadPhotoTexture('car-'+name+'-cutout.webp',true).then(map=>{
   photo.map=map;photo.needsUpdate=true;photo.userData.photoLoaded=true;
   visibility(root,'car',false,indices.map(i=>transforms[i].elements[12]));visibility(root,'photo-car-'+name,true);return true;
  }).catch(()=>false);
 }
 b.setRole('');
}
