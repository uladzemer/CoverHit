import * as THREE from 'three';

export const FACADE_SERIES={panel:{file:'panel',bays:4,floors:3,bay:3.1},panel335:{file:'panel335',bays:4,floors:3,bay:3.1},brick:{file:'brick',bays:4,floors:3,bay:3},nine:{file:'nine',bays:4,floors:3,bay:3.2},tower:{file:'tower',bays:4,floors:3,bay:3.2},school:{file:'panel',bays:4,floors:3,bay:3.1}};
const photoCache=new Map();
export async function loadPhotoTexture(file,color=false){
 const key=`${file}:${color}`;
 if(!photoCache.has(key))photoCache.set(key,(async()=>{
  let timer,expired=false;
  const request=new THREE.TextureLoader().loadAsync(`${import.meta.env?.BASE_URL||'/'}yard/photos/${file}`).then(t=>{if(expired){t.dispose();throw Error('Photo texture timed out');}t.wrapS=t.wrapT=file==='concrete-detail-normal.webp'?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;t.anisotropy=16;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;if(color)t.colorSpace=THREE.SRGBColorSpace;t.addEventListener('dispose',()=>photoCache.delete(key));return t;});
  try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Photo texture timed out'));},8000);})]);}finally{clearTimeout(timer);}
 })().catch(error=>{photoCache.delete(key);throw error;}));
 return photoCache.get(key);
}
export function facadeUV(horizontal,vertical,series='panel'){
 const s=FACADE_SERIES[series]||FACADE_SERIES.panel;
 return [horizontal/(s.bay*s.bays),vertical/(2.7*s.floors)];
}
export function facadeTint(seed){return new THREE.Color().setRGB(.996+(seed%4)*.001,1,1);}
// UVs are baked before static instance merging: rotations never change bay size.
export function moduleChoice(col,row,seed=0){let h=(Math.imul(col+1,73856093)^Math.imul(row+1,19349663)^Math.imul(seed+1,83492791))>>>0;h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return 1+((h^(h>>>16))>>>0)%2;}
export function facadeBox(width,height,depth,series='panel',seed=0){
 const s=FACADE_SERIES[series]||FACADE_SERIES.panel;
 const positions=[],normals=[],uvs=[],photo=[],detail=[],colors=[],openings=[];
 function face(horizontal,point,normal){
  const columns=Math.round(horizontal/s.bay),bayWidth=horizontal/columns,rows=Math.ceil(height/2.7-1e-8);
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
   const x0=col*bayWidth,x1=Math.min(horizontal,(col+1)*bayWidth),y0=row*2.7,y1=Math.min(height,(row+1)*2.7);
   const slot=row===0?0:row===rows-1?3:col===0||col===columns-1?2:moduleChoice(col,row,seed);
   for(const [x,y]of [[x0,y0],[x1,y0],[x0,y1],[x0,y1],[x1,y0],[x1,y1]]){
    positions.push(...point(x/horizontal,y/height));normals.push(...normal);
    uvs.push(...facadeUV(x*s.bay/bayWidth,y,series));
    photo.push((slot%2+(8.5+1007*(x-x0)/bayWidth)/1024)/2,(1-Math.floor(slot/2)+(8.5+1007*(y-y0)/2.7)/1024)/2);
    detail.push(x/3.5,y/3.5);colors.push(1,1,1);
   }
   // Thin photographic opening layer in this same material batch. Its mask
   // uses exactly the cell UVs, never procedural per-fragment randomness.
   const loggia=series==='nine'||series==='tower',a=loggia?64/1008:220/1008,c=loggia?944/1008:788/1008;
   for(const [u,v]of [[a,183/1008],[c,183/1008],[a,788/1008],[a,788/1008],[c,183/1008],[c,788/1008]]){
    const x=x0+u*bayWidth,y=y0+v*2.7,p=point(x/horizontal,y/height);
    const axis=normal[0]?0:2;p[axis]+=normal[axis]*.001;
    openings.push({p,normal,uv:facadeUV(x*s.bay/bayWidth,y,series),photo:[(slot%2+(8.5+1007*u)/1024)/2,(1-Math.floor(slot/2)+(8.5+1007*v)/1024)/2],detail:[x/3.5,y/3.5]});
   }
  }
 }
 face(width,(x,y)=>[x-.5,y-.5,.5],[0,0,1]);
 face(width,(x,y)=>[.5-x,y-.5,-.5],[0,0,-1]);
 face(depth,(x,y)=>[.5,y-.5,.5-x],[1,0,0]);
 face(depth,(x,y)=>[-.5,y-.5,x-.5],[-1,0,0]);
 for(const sign of [-1,1])for(const [x,z]of [[-.5,-.5],[-.5,.5],[.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){
  positions.push(x,sign*.5,z);normals.push(0,sign,0);uvs.push(.001,.001);photo.push(.002,.002);detail.push(x,z);colors.push(1,1,1);
 }
 for(const o of openings){positions.push(...o.p);normals.push(...o.normal);uvs.push(...o.uv);photo.push(...o.photo);detail.push(...o.detail);colors.push(1,1,1);}
 const g=new THREE.BufferGeometry();
 for(const [name,data,size]of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['facadeUv',photo,2],['detailUv',detail,2],['color',colors,3]])g.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// Four complete, offline assembled buildings per shared impostor atlas.
export function facadeImpostorBox(width,height,depth,series='panel',seed=0){
 const g=new THREE.BoxGeometry(1,1,1),uv=g.attributes.uv,photo=new Float32Array(uv.count*2),colors=new Float32Array(uv.count*3).fill(1);
 const slot=seed%4,s=FACADE_SERIES[series]||FACADE_SERIES.panel,bakedBays=series==='tower'?8:20,bakedFloors=series==='tower'?16:series==='nine'?9:5;
 for(let i=0;i<uv.count;i++){
  const face=Math.floor(i/4),x=uv.getX(i),y=uv.getY(i),roof=face===2||face===3,horizontal=face<2?depth:width;
  const columns=Math.round(horizontal/s.bay),floorRatio=Math.min(1,height/2.7/bakedFloors),bayRatio=Math.min(1,columns/bakedBays);
  photo[i*2]=slot%2*.5+(.5+(roof?0:x*511*bayRatio))/1024;
  photo[i*2+1]=(1-Math.floor(slot/2))*.5+(.5+(roof?0:y*511*floorRatio))/1024;
  const p=facadeUV(x*horizontal,y*height,series);uv.setXY(i,roof?.001:p[0],roof?.001:p[1]);
 }
 g.setAttribute('facadeUv',new THREE.BufferAttribute(photo,2));g.setAttribute('detailUv',uv.clone());g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;
}

const MODE_KEY='coverhit-facades';
export function readFacadeMode(){try{return globalThis.localStorage?.getItem(MODE_KEY)==='procedural'?'procedural':'photo';}catch{return 'photo';}}
export function setFacadeMode(root,mode,{persist=true}={}){
 if(!['photo','procedural'].includes(mode))return false;
 root.userData.facadeMode=mode;
 const materials=new Set();
 root.traverse(o=>{for(const m of [o.material].flat())if(m?.userData.applyFacadeMode&&!materials.has(m)){materials.add(m);m.userData.applyFacadeMode(mode);}
  if(o.userData.facadeWindows)o.visible=mode==='procedural'||!o.userData.facadeMaterial?.userData.photoLoaded;
 });
 if(persist)try{globalThis.localStorage?.setItem(MODE_KEY,mode);}catch{}
 return true;
}

// Threshold dark glass within each structural cell, then remove isolated pixels.
// This keeps tree silhouettes and black inter-panel joints out of the mask.
export function extractWindowMask(rgb,width,height,{bays=4,floors=3,threshold=105,rectangles}={}){
 const raw=new Uint8Array(width*height),mask=new Uint8Array(raw.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x*bays/width)%1,v=(y*floors/height)%1,i=y*width+x,j=i*3;
  const l=rgb[j]*.2126+rgb[j+1]*.7152+rgb[j+2]*.0722;
  const inWindow=rectangles?rectangles.some(([a,b,c,d])=>x/width>=a&&x/width<=c&&y/height>=b&&y/height<=d):u>.12&&u<.88&&v>.10&&v<.86;
  if(inWindow&&l<threshold)raw[i]=255;
 }
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x;let count=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)count+=raw[i+dy*width+dx]>0;
  if(raw[i]&&count>=6)mask[i]=255;
 }
 return mask;
}

// Photo and procedural textures share geometry; no rebuilding or loss of fallback.
export function createFacadeMaterial(series='panel',fallback={},onReady=()=>{},detail=true,impostor=false){
 const s=FACADE_SERIES[series]||FACADE_SERIES.panel;
 if(fallback.map){const cells=fallback.map.userData.facadeCells||{bays:20,floors:5};fallback.map.wrapS=fallback.map.wrapT=THREE.RepeatWrapping;fallback.map.repeat.set(s.bays/cells.bays,s.floors/cells.floors);}
 const material=new THREE.MeshStandardMaterial({roughness:.94,vertexColors:true,...fallback});
 material.userData.photoSeries=series;material.userData.castShadow=false;
 material.userData.facadeMode=readFacadeMode();
 const procedural={map:material.map,color:material.color.clone(),normalMap:material.normalMap,roughnessMap:material.roughnessMap,emissiveMap:material.emissiveMap,emissive:material.emissive.clone(),emissiveIntensity:material.emissiveIntensity};
 material.addEventListener('dispose',()=>{if(procedural.map!==material.map)procedural.map?.dispose();});
 let photos;
 material.userData.applyFacadeMode=mode=>{
  material.userData.facadeMode=mode;const values=mode==='photo'&&photos?photos:procedural;
  for(const [key,value]of Object.entries(values))if(value?.isColor)material[key].copy(value);else material[key]=value;
  material.needsUpdate=true;
 };
 material.onBeforeCompile=shader=>{
  if(material.userData.facadeMode!=='photo'||!material.userData.photoLoaded)return;
  shader.vertexShader='attribute vec2 facadeUv;attribute vec2 detailUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
   vec2 photoUV=facadeUv;
   ${impostor?`float buildingSeed=0.0;
   #ifdef USE_INSTANCING_COLOR
    buildingSeed=mod(floor(instanceColor.r*1000.0+.5)-996.0,4.0);
   #elif defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
    buildingSeed=mod(floor(color.r*1000.0+.5)-996.0,4.0);
   #endif
   photoUV+=vec2(mod(buildingSeed,2.0),-floor(buildingSeed/2.0))*.5;`:''}
   #ifdef USE_MAP
    vMapUv=photoUV;
   #endif
   #ifdef USE_EMISSIVEMAP
    vEmissiveMapUv=photoUV;
   #endif
   #ifdef USE_NORMALMAP
    vNormalMapUv=detailUv;
   #endif`);
  // Mip-filtered emission is baked into the module. No interpolated seed,
  // sin/hash or alpha test can turn one window into unrelated bright texels.
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   totalEmissiveRadiance=min(totalEmissiveRadiance,vec3(.24));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;',`mapN.xy *= normalScale * (1.0-smoothstep(.006,.035,max(length(dFdx(vNormalMapUv)),length(dFdy(vNormalMapUv)))));`));
 };
 material.customProgramCacheKey=()=>`photo-facade-${series}-modules-v2-${impostor}-${material.userData.facadeMode}-${!!material.userData.photoLoaded}`;
 if(typeof document!=='undefined'){
  material.userData.photoReady=Promise.allSettled([
   loadPhotoTexture(`${s.file}${impostor?'-impostor':''}-albedo.webp`,true),loadPhotoTexture(`${s.file}${impostor?'-impostor':''}-windows.webp`),
   ...(detail?[loadPhotoTexture('concrete-detail-normal.webp')]:[]),
  ]).then(results=>{
   if(results[0].status!=='fulfilled')return false;
   photos={map:results[0].value,color:new THREE.Color('#ffffff'),normalMap:results[2]?.status==='fulfilled'?results[2].value:null,roughnessMap:null,emissiveMap:results[1].status==='fulfilled'?results[1].value:null,emissive:new THREE.Color('#ffd39c'),emissiveIntensity:.55};
   material.normalScale.set(.08,.08);material.userData.photoLoaded=true;
   material.userData.applyFacadeMode(material.userData.facadeMode);onReady();return true;
  });
 }
 return material;
}
