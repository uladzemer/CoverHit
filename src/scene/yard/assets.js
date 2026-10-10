import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {loadYardStock} from './stock.js';
import {analyseSun} from '../lighting.js';

export const surfaceIds={panel:'concrete_wall_008',brick:'brick_wall_13',asphalt:'asphalt_02',grass:'leafy_grass',painted:'rusty_painted_metal',wood:'wood_planks_grey',sand:'playground_sand'};
const base=()=>`${import.meta.env?.BASE_URL||'/'}yard/`;
// Each request is optional and bounded: a stalled CDN must not block the menu.
async function optional(load,fail){let timer;try{return await Promise.race([load(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('yard asset timeout')),12000);})]);}catch(e){fail(e);return null;}finally{clearTimeout(timer);}}
export async function loadYardAssets(yard,renderer,onProgress=()=>{}){
 const stockPromise=loadYardStock(yard);
 let done=0;const total=22, failures=[];const textures=[];
 const failed=e=>failures.push(e?.message||'Yard texture could not be loaded');
 const progress=()=>onProgress(++done,total);
 const loader=new THREE.TextureLoader();
 await Promise.all(Object.entries(surfaceIds).flatMap(([key,id])=>['color','normal','arm'].map(async type=>{
  const t=await optional(()=>loader.loadAsync(`${base()}${id}_${type}.webp`),failed);progress();if(!t)return;
  textures.push(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  if(type==='color')t.colorSpace=THREE.SRGBColorSpace;
  const m=yard.materials[key];
  if(type==='color'){m.map=t;m.color.set(key==='panel'?'#deded7':key==='brick'?'#f3f3eb':key==='sand'?'#fff5d6':key==='grass'?'#609638':'#ffffff');}
  else if(type==='normal'){m.normalMap=t;m.normalScale.set(key==='grass'?.22:.45,key==='grass'?.22:.45);}
  else {m.roughnessMap=t;m.aoMap=t;m.aoMapIntensity=.65;if(key==='painted')m.metalnessMap=t;}
  m.needsUpdate=true;
 })));
 yard.configureGround();
 const [hdr]=await Promise.all([
  optional(()=>new HDRLoader().setDataType(THREE.FloatType).loadAsync(`${base()}sunset.hdr`),failed).then(r=>{progress();return r;}),
 ]);
 let environment;
 if(hdr){
  yard.hdrSun=analyseSun(hdr.image);yard.hdrTexture=hdr;
  hdr.mapping=THREE.EquirectangularReflectionMapping;
  // Align the HDR reflection peak to the western sun azimuth. The visible
  // sky and direct light stay at sunset elevation independently of HDR latitude.
  const {data,width,height}=hdr.image;let peak=-1,index=0;
  for(let i=0;i<data.length;i+=4){const luminance=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;if(luminance>peak){peak=luminance;index=i/4;}}
  const u=(index%width+.5)/width;
  const phi=(u-.5)*Math.PI*2;
  const desired=Math.atan2(-.8,-.6),rotation=phi-desired;
  sceneEnvironment();
  function sceneEnvironment(){
   const scene=yard.scene;scene.background=null;scene.backgroundRotation.y=rotation;scene.environmentRotation.y=rotation;
   scene.backgroundIntensity=.42;scene.backgroundBlurriness=.06;
   const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromEquirectangular(hdr);pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=.75;
   // Retain the low direct-light position from createYard regardless of HDR latitude.
   yard.sun.color.set('#ffbd86');yard.sun.intensity=2.1;
   // Horizon radiance, excluding the solar disc, sets the atmospheric tint.
   const h=(Math.floor(height*.50)*width+Math.floor(width*.35))*4;
   const horizon=new THREE.Color(data[h],data[h+1],data[h+2]);horizon.multiplyScalar(.6);horizon.lerp(new THREE.Color('#efa080'),.8);scene.fog.color.copy(horizon);yard.sky.material.uniforms.horizon.value.copy(horizon);
   yard.sky.visible=true;yard.bounce.intensity=1.05;yard.sun.target.position.set(0,0,0);yard.sun.updateMatrixWorld();
  }
 }
 yard.assetStatus={loaded:total-failures.length,total,failures};
 const stock=await stockPromise;
 return {dispose(){stock.dispose();textures.forEach(t=>t.dispose());hdr?.dispose();environment?.dispose();}};
}
