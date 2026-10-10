import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from './qa-browser.mjs';
import {execFileSync} from 'node:child_process';

export const REGIONS={pad:[.32,.83,.60,.98],lawn:[.10,.56,.24,.73],facade:[.79,.18,.98,.46]};
export function assertExposure(metrics,baseline){
 for(const name of Object.keys(REGIONS)){const value=metrics.regions[name],reference=baseline.regions[name];assert(Number.isFinite(value)&&reference>0&&Math.abs(value/reference-1)<=.20,`${name}: ${value} versus ${reference}`);}
 assert(metrics.clippedPercent<1,'clipped pixels');
}
export async function exposureMetrics(buffer){
 const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const regions={};
 for(const [name,[x0,y0,x1,y1]] of Object.entries(REGIONS)){
  let sum=0,n=0;for(let y=Math.floor(y0*info.height);y<Math.floor(y1*info.height);y++)for(let x=Math.floor(x0*info.width);x<Math.floor(x1*info.width);x++){const i=(y*info.width+x)*3;sum+=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;n++;}regions[name]=sum/n;
 }
 let clipped=0;for(let i=0;i<data.length;i+=3)if(Math.max(data[i],data[i+1],data[i+2])===255)clipped++;
 return {regions,clippedPercent:100*clipped/(info.width*info.height)};
}
export async function verifyExposure(){
 const phase=process.argv[2]||'after',out='docs/qa/exposure';await mkdir(out,{recursive:true});
 const reference=phase==='reference',browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const report={phase,viewport:[1440,900],seed:'colour-1986',assetMode:'CC photographs and base yard assets; optional licensed stock blocked, matching photos QA',regions:REGIONS,errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
  await page.route('**/carpets/manifest.local.json',r=>r.fulfill({status:404,body:''}));
  if(phase==='before'){
   await page.route('**/yard/photos/*',async r=>{const file=new URL(r.request().url()).pathname.split('/').at(-1);if(file==='car-atlas.webp'||file.endsWith('-albedo.webp')){let body;try{body=await readFile(`artifacts/exposure-source/${file}`);}catch{body=execFileSync('git',['show',`3850382:public/yard/photos/${file}`]);}await r.fulfill({contentType:'image/webp',body});}else await r.continue();});
  }
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/i.test(m.text()))report.errors.push(m.text());});
  await page.goto(`${process.env.EXPOSURE_URL||`http://127.0.0.1:${reference||phase==='before'?5184:5183}`}/?seed=colour-1986`);await page.waitForFunction(()=>window.__coverhit,null,{timeout:90000});
  await page.evaluate(async()=>{const a=window.__coverhit;a.start();a.setQuality('high');await a.setCarpet('09');});await page.waitForTimeout(2000);
  const original=await page.evaluate(()=>{const a=window.__coverhit;return {camera:a.baseCamera.toArray(),target:a.lookTarget.toArray(),fov:a.camera.fov};});
  for(const view of reference||phase==='before'?['default']:['default','car-close','car-cherry','car-sky','wide','aim-left','aim-right']){
   await page.evaluate(async({view,original})=>{const a=window.__coverhit,T=await import('/node_modules/three/build/three.module.js');a.baseCamera.fromArray(original.camera);a.lookTarget.fromArray(original.target);a.camera.fov=original.fov;if(view==='wide')a.camera.fov=75;if(view.startsWith('car-')){const offset=view==='car-cherry'?37:view==='car-sky'?16:0;a.baseCamera.set(14.8+offset,1.8,-14.5);a.lookTarget.set(12+offset,.7,-19);}if(view.startsWith('aim')){const v=a.lookTarget.clone().sub(a.baseCamera).applyAxisAngle(new T.Vector3(0,1,0),(view==='aim-left'?35:-35)*Math.PI/180);a.lookTarget.copy(a.baseCamera).add(v);}a.camera.updateProjectionMatrix();}, {view,original});
   await page.waitForTimeout(400);
   // Read the just-rendered framebuffer, avoiding an empty non-preserved canvas.
   const url=await page.evaluate(()=>{const a=window.__coverhit;a.renderPipeline.render(0);return a.renderer.domElement.toDataURL('image/png');});
   const buffer=Buffer.from(url.split(',')[1],'base64');await writeFile(`${out}/${phase}-${view}.png`,buffer);
   if(view==='default'){
    report.metrics=await exposureMetrics(buffer);
    const off=await page.evaluate(()=>{const a=window.__coverhit;window.qaShadowLights=[];a.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow){window.qaShadowLights.push([o,o.shadow.intensity]);o.shadow.intensity=0;}});a.renderPipeline.render(0);return a.renderer.domElement.toDataURL('image/png');});
    const offBuffer=Buffer.from(off.split(',')[1],'base64');await writeFile(`${out}/${phase}-no-shadows.png`,offBuffer);report.noShadows=await exposureMetrics(offBuffer);
    await page.evaluate(()=>{for(const[o,v]of window.qaShadowLights)o.shadow.intensity=v;window.__coverhit.renderPipeline.render(0);});
   }
  }
  report.lighting=await page.evaluate(()=>{const a=window.__coverhit,materials=new Set(),casters=[];a.yard.root.traverse(o=>{if(o.material?.userData.photoLoaded)materials.add(o.material);if(o.visible&&o.castShadow&&o.isMesh)casters.push({name:o.name,series:o.material?.userData.photoSeries,backdrop:o.parent===a.yard.backdrop.group});});return {state:a.scene.userData.lighting,environment:!!a.scene.environment,exposure:a.renderer.toneMappingExposure,photos:[...materials].map(m=>({series:m.userData.photoSeries||'car',env:m.envMapIntensity,emissive:m.emissiveIntensity,roughness:m.roughness,normal:m.normalScale.toArray()})),casters,grass:{color:a.yard.materials.blades.color.getHexString(),emissive:a.yard.materials.blades.emissiveIntensity,env:a.yard.materials.blades.envMapIntensity}};});
 }finally{await browser.close();await writeFile(`${out}/${reference?'reference':phase}.json`,JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report.metrics));assert.equal(report.errors.length,0,report.errors.join('\n'));
 if(phase==='after'){
  const baseline=JSON.parse(await readFile(`${out}/reference.json`));assertExposure(report.metrics,baseline.metrics);
  assert(report.lighting.environment,'HDR sky environment');assert.equal(report.lighting.exposure,.85);
  assert(report.lighting.casters.every(o=>!o.series&&!o.backdrop),'Photographic perimeter walls must not blanket the pad');
  assert(report.lighting.photos.filter(m=>m.series!=='car').every(m=>m.emissive>0),'Photo window lights');
 }
}
if(process.argv[1]?.endsWith('verify-yard-exposure.mjs'))await verifyExposure();
