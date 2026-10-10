import * as THREE from 'three';

// Three r186 PCSS example's blocker-search / penumbra / filter sequence,
// adapted to CSM orthographic depth and native (unpacked) depth textures.
const pcss=`
vec2 sunsetDisk(int i, int count) {
 float a=float(i)*2.39996323;
 return vec2(cos(a),sin(a))*sqrt((float(i)+.5)/float(count));
}
float sunsetPCSS(sampler2D map, vec2 uv, float receiver, vec2 size, float depthToUv) {
 vec2 texel=1.0/size;
 float blockers=0.0,total=0.0;
 for(int i=0;i<8;i++){
  float d=texture2D(map,uv+sunsetDisk(i,8)*texel*6.0).r;
  if(d<receiver){total+=d;blockers+=1.0;}
 }
 if(blockers==0.0)return 1.0;
 // Orthographic parallel rays: world separation * solar angular radius.
 float radius=clamp((receiver-total/blockers)*depthToUv,texel.x*.7,.012);
 float visibility=0.0;
 for(int i=0;i<12;i++)visibility+=step(receiver,texture2D(map,uv+sunsetDisk(i,12)*radius).r);
 return visibility/12.0;
}
`;
export function injectSoftShadows(shader,level) {
 if(level!=='high')return;
 const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;
 const patched=chunk.replace('#ifdef USE_SHADOWMAP','#ifdef USE_SHADOWMAP\n'+pcss).replace('float depth = texture2D( shadowMap, shadowCoord.xy ).r;',`return mix(1.0,sunsetPCSS(shadowMap,shadowCoord.xy,shadowCoord.z,shadowMapSize,shadowRadius),shadowIntensity);
 float depth = texture2D( shadowMap, shadowCoord.xy ).r;`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',patched);
}
