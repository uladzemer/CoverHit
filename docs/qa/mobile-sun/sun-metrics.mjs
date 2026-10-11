import sharp from 'sharp';
export function sunPresence(rendered, unshadowed, mask, width, height) {
 const groups={lit:[],shade:[],ground:[]}; let shadow=0,ground=0,attenuated=0;
 const lum=(d,i)=>(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255;
 for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++) {
  const i=(y*width+x)*3;
  if(mask[i]>240&&mask[i+1]<20&&x>width*.55)groups.lit.push(i);
  if(mask[i+1]>240&&mask[i]<20&&x>width*.55)groups.shade.push(i);
  if(mask[i+2]>240&&mask[i]<20&&y>height*.5){
   groups.ground.push(i);ground++;let neighbour=0;
   const step=Math.max(8,Math.round(width*20/393)),diagonal=Math.round(step*1.75);
   for(const [dx,dy]of [[-step,0],[step,0],[0,step],[0,-step],[-diagonal,-diagonal],[diagonal,diagonal]]){
    const nx=x+dx,ny=y+dy;if(nx<2||nx>=width-2||ny<2||ny>=height-2)continue;
    const j=(ny*width+nx)*3;if(mask[j+2]>240&&mask[j]<20)neighbour=Math.max(neighbour,lum(rendered,j));
   }
   if(lum(rendered,i)<.7*neighbour)shadow++;
   if(lum(unshadowed,i)-lum(rendered,i)>1/255)attenuated++;
  }
 }
 const average=ids=>{let r=0,b=0,y=0;for(const i of ids){r+=rendered[i];b+=rendered[i+2];y+=lum(rendered,i);}return {pixels:ids.length,luminance:y/ids.length,redBlue:r/Math.max(b,1)};};
 const lit=average(groups.lit),shade=average(groups.shade);
 return {lit,shade,litShadeRatio:lit.luminance/shade.luminance,shadowCoverage:shadow/ground,shadowAttenuatedCoverage:attenuated/ground,groundPixels:ground};
}
export async function measureSunPresence(page,path) {
 const pixels=async()=> (await sharp(await page.screenshot({scale:'css'})).removeAlpha().raw().toBuffer({resolveWithObject:true}));
 await page.waitForFunction(()=>window.qaDrawCount>=3);await page.waitForTimeout(100);await page.screenshot({path,scale:'css'});const rendered=await pixels();
 await page.evaluate(()=>{const a=window.__coverhit;window.sunQA=[];a.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow){window.sunQA.push([o,o.shadow.intensity]);o.shadow.intensity=0;}});window.qaDrawCount=0;});
 await page.waitForFunction(()=>window.qaDrawCount>=3);await page.screenshot({path:path.replace('.png','-no-shadow.png'),scale:'css'});const unshadowed=await pixels();
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),a=window.__coverhit;
  for(const [o,intensity]of window.sunQA)o.shadow.intensity=intensity;
  window.sunMaterials=[];window.sunBackground=a.scene.background;window.sunFog=a.scene.fog;a.scene.background=new T.Color(0);a.scene.fog=null;
  a.scene.traverse(o=>{if(!o.material)return;window.sunMaterials.push([o,o.material]);const materials=[o.material].flat();const ground=materials.some(m=>[a.yard.materials.asphalt,a.yard.materials.grass].includes(m));const facade=materials.some(m=>m.userData.photoSeries||[a.yard.materials.panel,a.yard.materials.brick].includes(m));
   o.material=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{ground:{value:ground},facade:{value:facade}},vertexShader:`varying vec3 n;void main(){vec3 v=normal;vec4 p=vec4(position,1.0);
    #ifdef USE_INSTANCING
     p=instanceMatrix*p;v=mat3(instanceMatrix)*v;
    #endif
    n=normalize(mat3(modelMatrix)*v);gl_Position=projectionMatrix*viewMatrix*modelMatrix*p;}`,fragmentShader:`varying vec3 n;uniform bool ground,facade;void main(){float l=dot(normalize(n),normalize(vec3(-.75,.131,-.66)));gl_FragColor=vec4(ground?vec3(0,0,1):facade?(l>.2?vec3(1,0,0):vec3(0,1,0)):vec3(0),1);}`});
  });window.qaDraw=()=>{a.renderer.setRenderTarget(null);a.renderer.render(a.scene,a.camera);};window.qaDrawCount=0;
 });
 await page.waitForFunction(()=>window.qaDrawCount>=3);await page.screenshot({path:path.replace('.png','-mask.png'),scale:'css'});const mask=await pixels();
 await page.evaluate(()=>{const a=window.__coverhit;for(const[o,m]of window.sunMaterials){o.material.dispose();o.material=m;}a.scene.background=window.sunBackground;a.scene.fog=window.sunFog;window.qaDraw=()=>a.renderPipeline.render(0);window.qaDrawCount=0;});
 await page.waitForFunction(()=>window.qaDrawCount>=3);
 return sunPresence(rendered.data,unshadowed.data,mask.data,rendered.info.width,rendered.info.height);
}

