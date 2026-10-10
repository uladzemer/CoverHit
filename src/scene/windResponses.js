// Configure the existing yard shader hooks at integration, keeping yard assets
// and source independent of this gameplay tuning pass.
import {WIND_RESPONSE} from './wind.js';
export function bindYardWindResponses(root) {
 const seen=new Set();
 root.traverse(object=>{
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!material||seen.has(material))continue;seen.add(material);
   const key=material.customProgramCacheKey?.();
   if(!/yard-shared-wind-foliage|yard-rooted-grass/.test(key))continue;
   const compile=material.onBeforeCompile;
   material.onBeforeCompile=function(shader,...args){
    compile.call(this,shader,...args);
    shader.vertexShader=shader.vertexShader.replace('transformed.xz+=uWindDir',`transformed.xz+=${WIND_RESPONSE.vegetation}*uWindDir`);
   };
   material.customProgramCacheKey=()=>`${key}-response-0.8`;
   material.needsUpdate=true;
  }
 });
}
