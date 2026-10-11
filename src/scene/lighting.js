import * as THREE from 'three';

// Source behind-left of the rack; shadows run toward the +Z default camera.
// A 2m rack casts a 15.2m shadow across the pad and foreground lawn.
export const SUNSET_ELEVATION = 7.5;
export function sunsetDirection() {
 const elevation=THREE.MathUtils.degToRad(SUNSET_ELEVATION);
 return new THREE.Vector3(-.75,0,-.66).normalize().multiplyScalar(Math.cos(elevation)).setY(Math.sin(elevation));
}

// No HDR, PMREM or AO bake on phones. Diffuse sky/ground plus a small front
// bounce replace the lost environment at a fixed cost of two cheap lights.
export function applyPhoneLighting(scene,sun,yard) {
 const sky=yard.sky.material.uniforms;
 sky.zenith.value.set('#8e7294');sky.horizon.value.set('#ffa276').multiplyScalar(1.1);
 sky.sunDirection.value.copy(sunsetDirection());sky.sunColour.value.set('#ffbd86').multiplyScalar(3);
 sky.sunRadius.value.set(.004,.006);scene.fog?.color.set('#d6a18c');
 yard.sky.visible=true;scene.environment=null;
 yard.bounce.color.set('#fff1df');yard.bounce.groundColor.set('#b6adb0');yard.bounce.intensity=2.8;
 let ambient=scene.getObjectByName('phone-ambient');
 if(!ambient){ambient=new THREE.AmbientLight('#e8e1db',.35);ambient.name='phone-ambient';scene.add(ambient);}
 let bounce=scene.getObjectByName('phone-sun-bounce');
 if(!bounce){bounce=new THREE.DirectionalLight('#ffe7cf',.65);bounce.name='phone-sun-bounce';bounce.position.set(-2,3,6);bounce.target.position.set(0,1,0);scene.add(bounce,bounce.target);}
 // Sun reaches the hanging front at rest; distant perimeter shells do not
 // cast into the play area. PCF and limited intensity keep shade light.
 sun.color.set('#ffbd86');sun.intensity=3;sun.position.set(-12,18,24);sun.target.position.set(0,1,0);
 sun.shadow.intensity=.4;sun.shadow.radius=3;sun.shadow.normalBias=.015;
 yard.backdrop.group.traverse(o=>{if(o.isMesh)o.castShadow=false;});
 scene.userData.phoneLighting={noIBL:true,hemisphere:2.8,ambient:.35,bounce:.65,shadowIntensity:.4};
}

// HDRLoader rows run from zenith to nadir (flipY on upload).
export function analyseSun(image) {
 const {data,width,height}=image;let peak=0,index=0;
 for(let i=0;i<data.length;i+=4){const y=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;if(y>peak){peak=y;index=i/4;}}
 const phi=((index%width+.5)/width-.5)*Math.PI*2;
 const elevation=(.5-(Math.floor(index/width)+.5)/height)*Math.PI;
 const source=new THREE.Vector3(Math.cos(phi)*Math.cos(elevation),Math.sin(elevation),Math.sin(phi)*Math.cos(elevation));
 const direction=sunsetDirection();
 // The solar disc is clipped red in this HDR; constrain its channel-ratio
 // temperature estimate to the requested photographic golden-hour range.
 const temperature=THREE.MathUtils.clamp(4000-1000*(data[index*4]/Math.max(data[index*4+1],1)-1),3500,4000);
 const t=(temperature-3500)/500;
 const color=new THREE.Color().setRGB(1,THREE.MathUtils.lerp(.755,.807,t),THREE.MathUtils.lerp(.552,.652,t),THREE.SRGBColorSpace);
 const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),phi-Math.atan2(direction.z,direction.x));
 const aligned=source.clone().applyQuaternion(yaw);
 const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(aligned,direction).multiply(yaw));
 const average=row=>{const c=new THREE.Color(0,0,0);let count=0;for(let x=0;x<width;x+=8){const i=(row*width+x)*4,y=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;if(y>10)continue;c.r+=data[i];c.g+=data[i+1];c.b+=data[i+2];count++;}return c.multiplyScalar(1/Math.max(count,1));};
 return {direction,color,rotation,temperature,peak,horizon:average(Math.floor(height*.46)),zenith:average(Math.floor(height*.18)),sourceElevation:THREE.MathUtils.radToDeg(elevation)};
}

const bakeCache=new Map();
// Startup-only diffuse AO atlas. Rays use conservative static proxy boxes,
// avoiding a triangle BVH for the thousands of decorative/animated instances.
export function bakeCourtyardAO(root) {
 root.updateMatrixWorld(true);const boxes=[],matrix=new THREE.Matrix4();
 root.traverse(o=>{
  if(!o.isMesh||!o.visible||!o.material?.isMeshStandardMaterial||o.material.alphaTest||o.material.transparent)return;
  o.geometry.computeBoundingBox();
  const add=m=>{const b=o.geometry.boundingBox.clone().applyMatrix4(m),s=b.getSize(new THREE.Vector3());if(b.min.y>.8||b.max.y<.10||s.x>100||s.z>100||s.x<.025||s.z<.025)return;boxes.push(b);};
  if(o.isInstancedMesh)for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);add(matrix.clone().premultiply(o.matrixWorld));}else add(o.matrixWorld);
 });
 const key=JSON.stringify(boxes.map(b=>[...b.min.toArray(),...b.max.toArray()]));
 if(bakeCache.has(key))return bakeCache.get(key);
 const size=128,data=new Uint8Array(size*size*4),ray=new THREE.Ray(),hit=new THREE.Vector3();
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const p=new THREE.Vector3(-70+(x+.5)*170/size,.10,-100+(z+.5)*150/size);
  const nearby=boxes.filter(b=>p.x>b.min.x-2&&p.x<b.max.x+2&&p.z>b.min.z-2&&p.z<b.max.z+2);
  let blocked=0;
  for(let i=0;i<12&&nearby.length;i++){
   const y=.2+.7*(i+.5)/12,a=i*2.399963,r=Math.sqrt(1-y*y);ray.set(p,new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));
   let distance=2;for(const b of nearby){if(b.containsPoint(p))continue;if(ray.intersectBox(b,hit))distance=Math.min(distance,hit.distanceTo(p));}blocked+=1-distance/2;
  }
  const value=Math.round(255*(1-.28*blocked/12)),j=(z*size+x)*4;data[j]=data[j+1]=data[j+2]=value;data[j+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size);texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
 bakeCache.set(key,texture);return texture;
}

export function createLightingState(scene,sun,fill,yard) {
 const legacy={background:scene.background,sky:yard.sky.visible,rotation:scene.environmentRotation.clone(),intensity:scene.environmentIntensity,fog:scene.fog.color.clone(),sunColor:sun.color.clone(),sunIntensity:sun.intensity,direction:sun.target.position.clone().sub(sun.position).normalize()};
 const enabled={value:0},ao=bakeCourtyardAO(yard.root),materials=new Map(),analysis=yard.hdrSun;
 const legacyHorizon=yard.sky.material.uniforms.horizon.value.clone();
 function register(){scene.traverse(o=>{for(const m of o.material?[o.material].flat():[]){if(!m.isMeshStandardMaterial||materials.has(m))continue;
  materials.set(m,{env:m.envMapIntensity,emissive:m.emissiveIntensity,sheen:m.sheen,roughness:m.roughness,normalScale:m.normalScale.clone()});
  m.addEventListener('dispose',()=>materials.delete(m));
  if(m.name==='carpet-wool'){m.envMapIntensity=1;m.sheen=0;}
  let ancestor=o;while(ancestor&&ancestor!==yard.root&&ancestor.name!=='carpet')ancestor=ancestor.parent;if(!ancestor||m.name==='carpet-wool')continue;
  const original=m.onBeforeCompile,cache=m.customProgramCacheKey;
  m.onBeforeCompile=function(shader,renderer){original.call(this,shader,renderer);if(!enabled.value)return;shader.uniforms.lightingEnabled=enabled;shader.uniforms.staticContactAO={value:ao};
   shader.vertexShader='varying vec3 lightingWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 lightingP=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
    lightingP=instanceMatrix*lightingP;
    #endif
    lightingWorld=(modelMatrix*lightingP).xyz;`);
   shader.fragmentShader='uniform float lightingEnabled;uniform sampler2D staticContactAO;varying vec3 lightingWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
    vec2 contactUv=(lightingWorld.xz-vec2(-70.0,-100.0))/vec2(170.0,150.0);
    float contact=texture2D(staticContactAO,clamp(contactUv,0.0,1.0)).r;
    reflectedLight.indirectDiffuse*=mix(1.0,mix(contact,1.0,smoothstep(.1,1.5,lightingWorld.y)),lightingEnabled);
    // White-balance the blue HDR sky fill without painting the direct shadows.
    reflectedLight.indirectDiffuse*=mix(vec3(1.0),vec3(1.65,1.12,.68),lightingEnabled);
    vec3 bounceNormal=inverseTransformDirection(normal,viewMatrix);
    reflectedLight.indirectDiffuse+=lightingEnabled*diffuseColor.rgb*vec3(.055,.028,.010)*(1.0-smoothstep(.0,3.0,lightingWorld.y))*max(0.0,1.0-abs(bounceNormal.y));`);
   if([yard.materials.panel,yard.materials.brick].includes(m)){
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     diffuseColor.rgb*=1.0-lightingEnabled*.16*(1.0-smoothstep(.05,.75,lightingWorld.y));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     roughnessFactor-=lightingEnabled*.08*(1.0-smoothstep(.05,.75,lightingWorld.y));`);
   }
  };m.customProgramCacheKey=function(){return `${cache.call(this)}:lighting-v1:${enabled.value}`;};m.needsUpdate=true;
 }});}
 function apply(level){const low=level==='low';enabled.value=low?0:1;register();
  scene.background=legacy.background;yard.sky.visible=true;
  const sky=yard.sky.material.uniforms;
  sky.sunDirection.value.copy(low?new THREE.Vector3(-.6,.075,-.8).normalize():sunsetDirection());
  sky.sunColour.value.copy(low?new THREE.Color(1.3,.8,.36):(analysis?.color||new THREE.Color('#ffbd86')).clone().multiplyScalar(3));
  sky.sunRadius.value.set(low?.010:.004,low?.017:.006);
  sky.horizonGlowDirection.value.set(-.6,.075,-.8).normalize();
  // The all-azimuth HDR average erases the sunset. Keep an upright warm
  // orange/pink atmosphere in view; the HDR continues to light/reflect objects.
  sky.zenith.value.copy(low?new THREE.Color(.10,.13,.27):new THREE.Color('#8e7294'));
  sky.horizon.value.copy(low?legacyHorizon:new THREE.Color('#ffa276').multiplyScalar(1.1));
  scene.backgroundIntensity=.65;scene.backgroundBlurriness=0;
  scene.environmentRotation.copy(low||!analysis?legacy.rotation:analysis.rotation);scene.backgroundRotation.copy(scene.environmentRotation);
  scene.environmentIntensity=low?legacy.intensity:1.35;yard.bounce.intensity=low?1.05:scene.environment?0:.2;fill.intensity=low?.35:0;
  scene.fog.color.copy(legacy.fog);if(!low)scene.fog.color.set('#d6a18c');
  for(const [m,v] of materials){m.envMapIntensity=low?v.env:(m.metalness>.3?.65:[yard.materials.grass,yard.materials.blades,yard.materials.asphalt].includes(m)?.25:m===yard.materials.foliage?.55:m.name==='carpet-wool'?1:.85);
   const plaster=[yard.materials.panel,yard.materials.brick].includes(m),asphalt=m===yard.materials.asphalt;
   m.roughness=low?v.roughness:plaster?.95:asphalt?.94:v.roughness;
   m.normalScale.copy(v.normalScale);if(!low&&(plaster||asphalt))m.normalScale.multiplyScalar(plaster?.7:.8);
   if(v.emissive!==undefined){m.emissiveIntensity=low?v.emissive:(m.userData.photoLoaded&&m.emissiveMap?v.emissive:m===yard.materials.blades?v.emissive:[yard.materials.lit,yard.materials.lamp].includes(m)?2.4:0);}
   if(m.name==='carpet-wool')m.sheen=0;
  }
  scene.traverse(o=>{if(!o.isMesh)return;if(o.userData.legacyCastShadow===undefined)o.userData.legacyCastShadow=o.castShadow;
   // Visual perimeter LOD shells intentionally omit play-area shadows. At a
   // low sun their overlapping boxes would put the entire courtyard in shade.
   o.castShadow=o.userData.legacyCastShadow;
   if(o.parent===yard.backdrop.group)o.castShadow=low?o.userData.legacyCastShadow:false;
   if(['tree','birch'].includes(o.parent?.userData.stockRole))o.castShadow=low?o.userData.legacyCastShadow:true;
   if(o.material===yard.materials.chainlink)o.castShadow=!low;
  });
  const direction=low?legacy.direction:sunsetDirection().negate(),color=low?legacy.sunColor:analysis?.color||new THREE.Color('#ffbd86'),intensity=low?legacy.sunIntensity:6;
  scene.userData.lighting={temperature:low?null:analysis?.temperature??3500,elevation:low?THREE.MathUtils.radToDeg(Math.asin(-legacy.direction.y)):SUNSET_ELEVATION,sourceElevation:analysis?.sourceElevation,environmentIntensity:scene.environmentIntensity,skyFill:low?'legacy hemisphere':scene.environment?'HDRI, warm white balance':'limited fallback hemisphere',staticAO:!low,sunDirection:direction.toArray()};
  return {direction,color,intensity};
 }
 return {apply,register,applyPhone:()=>applyPhoneLighting(scene,sun,yard)};
}
