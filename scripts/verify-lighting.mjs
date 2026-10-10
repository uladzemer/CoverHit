import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from './qa-browser.mjs';
import sharp from 'sharp';
const phase=process.argv[2]||'after',out=process.env.LIGHTING_OUT||'docs/qa/lighting';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={phase,viewport:[800,700],qualities:{},errors:[]};
try {
 const page=await browser.newPage({viewport:{width:800,height:700}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(process.env.LIGHTING_URL||'http://127.0.0.1:5183/?seed=lighting-1986');
 await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(()=>{const a=window.__coverhit;a.setQuality('high');a.start();window.lightingDefault=a.baseCamera.clone();window.lightingTarget=a.lookTarget.clone();});
 await page.waitForTimeout(2500);
 for(const level of ['high','medium','low']){
  await page.evaluate(level=>window.__coverhit.setQuality(level),level);
  if(phase==='after'){
   const material=await page.evaluate(()=>{const a=window.__coverhit,m=a.yard.scene.getObjectByName('carpet').material;return {sheen:m.sheen,fill:a.yard.bounce.intensity,foliage:a.yard.materials.foliage.emissiveIntensity};});
   assert.equal(material.sheen,0);assert.equal(material.fill,level==='low'?1.05:0);assert.equal(material.foliage,level==='low'?.13:0);
  }
  await page.waitForTimeout(1500);
  for(const view of ['default','wide','close']){
   await page.evaluate(view=>{const a=window.__coverhit;a.baseCamera.copy(window.lightingDefault);a.lookTarget.copy(window.lightingTarget);if(view==='wide'){a.baseCamera.set(10,6,18);a.lookTarget.set(0,2,-8);}if(view==='close')a.baseCamera.z*=.64;},view);
   await page.waitForTimeout(500);await page.screenshot({path:`${out}/${phase}-${level}-${view}.png`});
   if(phase==='after'&&level==='high'&&view==='default'&&process.env.LIGHTING_ORIGINAL){
    // Freeze the same camera/cloth pose for an actual shadow-only comparison.
    await page.evaluate(()=>{window.lightingRAF=window.requestAnimationFrame;window.requestAnimationFrame=cb=>{window.lightingNextFrame=cb;return 0;};});
    await page.waitForTimeout(100);await page.screenshot({path:`${out}/${phase}-${level}-${view}.png`});
    await page.evaluate(()=>{window.lightingShadows=[];window.__coverhit.yard.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow){window.lightingShadows.push([o,o.shadow.intensity]);o.shadow.intensity=0;}});window.__coverhit.renderPipeline.render(0);});
    await page.screenshot({path:`${out}/diagnostic-high-default-no-shadows.png`});
    await page.evaluate(()=>{for(const [o,intensity]of window.lightingShadows)o.shadow.intensity=intensity;window.requestAnimationFrame=window.lightingRAF;window.requestAnimationFrame(window.lightingNextFrame);});
   }
  }
  await page.evaluate(()=>{window.__coverhit.baseCamera.copy(window.lightingDefault);window.__coverhit.lookTarget.copy(window.lightingTarget);});
  await page.waitForTimeout(800);
  report.qualities[level]=await page.evaluate(()=>new Promise(resolve=>{
   const samples=[];function sample(){samples.push({...window.__coverhit.performance});if(samples.length<240)requestAnimationFrame(sample);else{const stats=k=>{const v=samples.map(s=>s[k]).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)]}:null;};const a=window.__coverhit,gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');resolve({gpuMs:stats('gpuMs'),cpuMs:stats('frameMs'),drawCalls:stats('drawCalls'),gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),lighting:a.yard.scene.userData.lighting,shadowType:a.renderer.shadowMap.type});}}requestAnimationFrame(sample);
  }));
 }
 // Exercise repeated quality changes, including newly created carpet shaders.
 for(const level of ['high','low','medium','high']){await page.evaluate(level=>window.__coverhit.setQuality(level),level);await page.waitForTimeout(300);}
 if(phase==='after'){
  await page.evaluate(()=>window.__coverhit.setCarpet(window.__coverhit.carpetEntry.id));await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>window.__coverhit.yard.scene.getObjectByName('carpet').material.sheen),0);
 }
}finally{await browser.close();await writeFile(`${out}/${phase}.json`,JSON.stringify(report,null,2));}
if(phase==='after'){
 const before=JSON.parse(await readFile(`${out}/before.json`));
 for(const level of ['high','medium','low']){
  report.qualities[level].deltaGpuMs=report.qualities[level].gpuMs.mean-before.qualities[level].gpuMs.mean;
  for(const view of ['default','wide','close']){
   await sharp({create:{width:1600,height:700,channels:3,background:'#000'}}).composite([{input:`${out}/before-${level}-${view}.png`,left:0,top:0},{input:`${out}/after-${level}-${view}.png`,left:800,top:0}]).png().toFile(`${out}/compare-${level}-${view}.png`);
   if(process.env.LIGHTING_ORIGINAL)await sharp({create:{width:1600,height:700,channels:3,background:'#000'}}).composite([{input:`${process.env.LIGHTING_ORIGINAL}/before-${level}-${view}.png`,left:0,top:0},{input:`${out}/after-${level}-${view}.png`,left:800,top:0}]).png().toFile(`${out}/compare-original-${level}-${view}.png`);
  }
 }
 await writeFile(`${out}/after.json`,JSON.stringify(report,null,2));
 if(process.env.LIGHTING_ORIGINAL){
  const sky={left:260,top:20,width:160,height:40};
  const channels=async file=>{const buffer=await sharp(file).extract(sky).png().toBuffer();return(await sharp(buffer).stats()).channels.slice(0,3).map(c=>c.mean);};
  const original=await channels(`${process.env.LIGHTING_ORIGINAL}/before-high-default.png`),after=await channels(`${out}/after-high-default.png`);
  report.sky={original,after};
  assert(after[0]/after[2]>=original[0]/original[2],'Sunset sky regressed against original warmth');
  const pad={left:380,top:530,width:140,height:40};
  const pixels=async file=>sharp(file).extract(pad).removeAlpha().raw().toBuffer();
  const on=await pixels(`${out}/after-high-default.png`),off=await pixels(`${out}/diagnostic-high-default-no-shadows.png`);
  let delta=0,visible=0;
  for(let i=0;i<on.length;i+=3){const d=(off[i]+off[i+1]+off[i+2]-on[i]-on[i+1]-on[i+2])/3;delta+=d;if(d>8)visible++;}
  report.foregroundShadows={region:pad,meanDarkening:delta/(on.length/3),pixelsDarkenedOver8:visible};
  const fullOn=await sharp(`${out}/after-high-default.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const fullOff=await sharp(`${out}/diagnostic-high-default-no-shadows.png`).removeAlpha().raw().toBuffer();
  const difference=Buffer.alloc(fullOn.data.length);
  for(let i=0;i<difference.length;i++)difference[i]=Math.min(255,Math.abs(fullOn.data[i]-fullOff[i])*5);
  await sharp(difference,{raw:fullOn.info}).png().toFile(`${out}/diagnostic-shadow-difference.png`);
  await writeFile(`${out}/after.json`,JSON.stringify(report,null,2));
  assert(visible>100,'Long shadows must be visible on the default foreground pad');
 }
 assert(report.qualities.high.deltaGpuMs<=2,'High exceeds +2 ms GPU budget');
 assert(report.qualities.medium.deltaGpuMs<=1,'Medium exceeds +1 ms GPU budget');
}
console.log(JSON.stringify(report,null,2));assert.equal(report.errors.length,0);
