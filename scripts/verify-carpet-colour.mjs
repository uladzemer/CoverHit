if (process.argv.includes('--dirty')) { await import('./verify-feel.mjs'); process.exit(0); }
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from './qa-browser.mjs';
import sharp from 'sharp';
// Phone QA uses the same eroded mask, filtered source and circular hue metrics.
if(process.argv.some(v=>v.startsWith('--profile=')||v==='--iphone'||v.startsWith('--engine='))){
  if(process.argv.includes('--iphone')&&!process.argv.some(v=>v.startsWith('--engine=')))process.argv.push('--engine=webkit');
  await import('./mobile-probes/verify-bright.mjs');process.exit(0);
}
const phase=process.argv[2]||'after', out=process.env.COLOUR_OUT||'docs/qa/colour';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={phase,viewport:[1000,800],quality:'high',method:'Frozen default camera, clean cloth. GPU-filtered sRGB scan at identical visible UVs; silhouette eroded 2px. Circular saturation-weighted mean hue, mean HSV saturation, mean Rec.709 sRGB luminance. Any channel =255 counts as clipping.',carpets:[],qualityChecks:{},errors:[]};
const pixels=async buffer=>(await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true}));
function stats(data,indices){let sin=0,cos=0,sat=0,lum=0,clipped=0;const histogram=new Array(256).fill(0);for(const i of indices){const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,s=max?d/max:0;let h=d?(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*Math.PI/3:0;sin+=Math.sin(h)*s;cos+=Math.cos(h)*s;sat+=s;const l=.2126*r+.7152*g+.0722*b;lum+=l;histogram[Math.round(l*255)]++;if(max===1)clipped++;}return {pixels:indices.length,hue:(Math.atan2(sin,cos)*180/Math.PI+360)%360,saturation:sat/indices.length,luminance:lum/indices.length,clippedPercent:100*clipped/indices.length,histogram};}
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(process.env.COLOUR_URL||'http://127.0.0.1:5183/?seed=colour-1986');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(()=>{window.__coverhit.renderPipeline.sampleFrame=()=>{};window.__coverhit.setQuality('high');window.__coverhit.start();});await page.waitForTimeout(2000);
 for(const [id,name]of [['01','red medallion'],['03','bukhara'],['09','Kazak']]){
  await page.evaluate(async id=>{await window.__coverhit.setCarpet(id);},id);await page.waitForTimeout(1200);
  await page.evaluate(()=>{const a=window.__coverhit;a.dirt.grid.fill(0);a.dirt.texture.needsUpdate=true;window.qaRAF=window.requestAnimationFrame;window.requestAnimationFrame=cb=>{window.qaNext=cb;return 0;};});await page.waitForTimeout(100);
  await page.evaluate(()=>window.__coverhit.renderPipeline.render(0));
  await page.screenshot({path:`${out}/${phase}-${id}-default.png`});const rendered=await pixels(await page.locator('canvas').first().screenshot());
  const capture=async mode=>{
   await page.evaluate(async mode=>{
    const T=await import('/node_modules/three/build/three.module.js'),a=window.__coverhit,scene=a.scene,mesh=scene.getObjectByName('carpet');
    window.qaRestore=[];scene.traverse(o=>{if(o.material&&o!==mesh){window.qaRestore.push([o,o.material]);const selected=mode==='sky'?o===a.yard.sky:mode==='facades'?!!o.material.userData.photoSeries||[a.yard.materials.panel,a.yard.materials.brick,a.yard.materials.trim].includes(o.material):mode==='ground'?[a.yard.materials.asphalt,a.yard.materials.grass,a.yard.materials.blades].includes(o.material):false;o.material=new T.MeshBasicMaterial({color:selected?0xffffff:0,side:T.DoubleSide,depthWrite:o.material.depthWrite,alphaTest:o.material.alphaTest,map:o.material.alphaTest?o.material.map:null});}});
    window.qaSky=scene.background;scene.background=new T.Color(0);window.qaFog=scene.fog;scene.fog=null;
    window.qaMaterial=mesh.material;const m=mesh.material.clone(),compile=mesh.material.onBeforeCompile;
    m.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',mode==='mask'?'gl_FragColor=vec4(1.0);':mode==='source'?'outgoingLight=diffuseColor.rgb;\n#include <opaque_fragment>':'gl_FragColor=vec4(0.0,0.0,0.0,1.0);');};const baseCompile=m.onBeforeCompile;m.onBeforeCompile=function(shader,renderer){baseCompile.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor.a = 0.0;', 'gl_FragColor.a = 1.0;');};m.customProgramCacheKey=()=>`colour-reference-${mode}`;mesh.material=m;a.renderer.render(scene,a.camera);
   },mode);
   await page.locator('canvas').first().screenshot({path:`${out}/${phase}-${id}-${mode}.png`});const p=await pixels(await page.locator('canvas').first().screenshot());
   await page.evaluate(()=>{const a=window.__coverhit,mesh=a.scene.getObjectByName('carpet');mesh.material.dispose();mesh.material=window.qaMaterial;for(const[o,m]of window.qaRestore){o.material.dispose();o.material=m;}a.scene.background=window.qaSky;a.scene.fog=window.qaFog;});return p;
  };
  const mask=await capture('mask'),source=await capture('source'),indices=[];const {width:w,height:h}=mask.info;
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){let valid=true;for(const [dx,dy]of [[0,0],[-2,0],[2,0],[0,-2],[0,2]]){const j=((y+dy)*w+x+dx)*3;if(mask.data[j]<250)valid=false;}if(valid)indices.push((y*w+x)*3);}
  const s=stats(source.data,indices),r=stats(rendered.data,indices),shift=Math.abs(s.hue-r.hue),all=Array.from({length:w*h},(_,i)=>i*3);
  const entry={id,name,source:s,rendered:r,hueShift:Math.min(shift,360-shift),saturationRatio:r.saturation/s.saturation,view:stats(rendered.data,all)};
  // Verify bloom cannot add radiance to the carpet, including spill from lamps.
  await page.evaluate(()=>{const a=window.__coverhit;window.qaBloom=a.renderPipeline.composer.passes.find(p=>p.effects?.some(e=>e.name==='BloomEffect'));window.qaBloom.enabled=false;a.renderPipeline.render(0);});
  const noBloom=await pixels(await page.locator('canvas').first().screenshot());
  entry.bloom={maxChannelDelta:0,meanChannelDelta:0};let bloomDelta=0;
  for(const i of indices)for(let k=0;k<3;k++){const d=Math.abs(rendered.data[i+k]-noBloom.data[i+k]);bloomDelta+=d;entry.bloom.maxChannelDelta=Math.max(entry.bloom.maxChannelDelta,d);}entry.bloom.meanChannelDelta=bloomDelta/(indices.length*3);
  await page.evaluate(()=>{window.qaBloom.enabled=true;window.__coverhit.renderPipeline.render(0);});
  entry.regions={};
  for(const region of ['sky','facades','ground']){const coverage=await capture(region),selected=[];for(let i=0;i<coverage.data.length;i+=3)if(coverage.data[i]>250&&coverage.data[i+1]>250&&coverage.data[i+2]>250)selected.push(i);entry.regions[region]=stats(rendered.data,selected);if(region==='ground'){
   await page.evaluate(()=>{window.qaShadows=[];window.__coverhit.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow){window.qaShadows.push([o,o.shadow.intensity]);o.shadow.intensity=0;}});window.__coverhit.renderPipeline.render(0);});
   const off=await pixels(await page.locator('canvas').first().screenshot({path:`${out}/${phase}-${id}-no-shadows.png`}));let darkened=0,delta=0,foreground=0;
   for(const i of selected){if(i/3/w<h*.65)continue;foreground++;const d=(off.data[i]+off.data[i+1]+off.data[i+2]-rendered.data[i]-rendered.data[i+1]-rendered.data[i+2])/3;delta+=d;if(d>8)darkened++;}
   entry.shadows={foregroundPixels:foreground,pixelsDarkenedOver8:darkened,meanDarkening:delta/foreground};
   await page.evaluate(()=>{for(const[o,v]of window.qaShadows)o.shadow.intensity=v;window.__coverhit.renderPipeline.render(0);});
  }}
  // At 7.5 degrees, the raised carpet's shadow falls beyond the close default
  // pad. Inspect that projected ground footprint with a dedicated camera;
  // retain the default coverage above instead of requiring blanket pad shade.
  const defaultShadows=entry.shadows;
  await page.evaluate(()=>{const a=window.__coverhit;window.qaCamera={position:a.camera.position.clone(),quaternion:a.camera.quaternion.clone()};a.camera.position.set(8,6,12);a.camera.lookAt(7,0,6);a.camera.updateMatrixWorld();a.renderPipeline.render(0);});
  const coverage=await capture('ground');
  await page.evaluate(()=>window.__coverhit.renderPipeline.render(0));
  const shaded=await pixels(await page.locator('canvas').first().screenshot({path:`${out}/${phase}-${id}-long-shadows.png`}));
  await page.evaluate(()=>{window.qaShadows=[];window.__coverhit.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow){window.qaShadows.push([o,o.shadow.intensity]);o.shadow.intensity=0;}});window.__coverhit.renderPipeline.render(0);});
  const off=await pixels(await page.locator('canvas').first().screenshot({path:`${out}/${phase}-${id}-long-no-shadows.png`}));let foreground=0,darkened=0,softDarkened=0,delta=0;
  for(let i=0;i<coverage.data.length;i+=3){if(coverage.data[i]<250||coverage.data[i+1]<250||coverage.data[i+2]<250)continue;foreground++;const d=(off.data[i]+off.data[i+1]+off.data[i+2]-shaded.data[i]-shaded.data[i+1]-shaded.data[i+2])/3;delta+=d;if(d>8)darkened++;if(d>1)softDarkened++;}
  entry.shadows={default:defaultShadows,method:'Camera (8,6,12) toward (7,0,6), visible ground mask in the expected long-shadow footprint; >1 channel-code difference detects soft grass penumbra',foregroundPixels:foreground,pixelsDarkenedOver8:darkened,pixelsDarkenedOver1:softDarkened,meanDarkening:delta/foreground,projectionMetres:2/Math.tan(7.5*Math.PI/180)};
  await page.evaluate(()=>{const a=window.__coverhit;for(const[o,v]of window.qaShadows)o.shadow.intensity=v;a.camera.position.copy(window.qaCamera.position);a.camera.quaternion.copy(window.qaCamera.quaternion);a.camera.updateMatrixWorld();a.renderPipeline.render(0);});
  report.carpets.push(entry);
  await page.evaluate(()=>{window.requestAnimationFrame=window.qaRAF;window.requestAnimationFrame(window.qaNext);});
 }
 // Repeated quality changes and replacement must retain the selective shaders.
 for(const quality of ['medium','low','high']){
  await page.evaluate(async quality=>{const a=window.__coverhit;a.setQuality(quality);await a.setCarpet('09');a.dirt.grid.fill(0);a.dirt.texture.needsUpdate=true;},quality);
  await page.waitForTimeout(400);
  const material=await page.evaluate(()=>{const m=window.__coverhit.scene.getObjectByName('carpet').material;return {sheen:m.sheen,specular:m.specularIntensity};});
  assert.equal(material.sheen,0);assert.equal(material.specular,.08);
  await page.screenshot({path:`${out}/${phase}-${quality}-replacement.png`});
  const image=await pixels(await page.locator('canvas').first().screenshot()),indices=[];
  for(let y=288;y<480;y++)for(let x=300;x<700;x++)indices.push((y*image.info.width+x)*3);
  report.qualityChecks[quality]=stats(image.data,indices);
  assert(report.qualityChecks[quality].luminance>.08&&report.qualityChecks[quality].luminance<.35,`${quality}: final alpha/exposure`);
 }
}finally{await browser.close();await writeFile(`${out}/${phase}.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report.carpets.map(({name,hueShift,saturationRatio,source,rendered,view})=>({name,hueShift,saturationRatio,sourceLuminance:source.luminance,renderedLuminance:rendered.luminance,carpetClipped:rendered.clippedPercent,viewClipped:view.clippedPercent})),null,2));
assert.equal(report.errors.length,0,report.errors.join('\n'));
if(phase==='after')for(const c of report.carpets){assert(c.source.pixels>1000);assert(c.hueShift<=6,`${c.name}: hue`);assert(c.saturationRatio>=.85,`${c.name}: saturation`);assert(c.rendered.clippedPercent<.5,`${c.name}: clipping`);assert(c.view.clippedPercent<1,`${c.name}: view clipping`);for(const region of ['sky','facades']){assert(c.regions[region].pixels>1000);assert(c.regions[region].clippedPercent<1,`${c.name}: ${region} clipping`);}assert(c.bloom.maxChannelDelta<=1,`${c.name}: bloom spill`);assert(c.shadows.default.pixelsDarkenedOver8>100&&c.shadows.pixelsDarkenedOver1>100&&c.shadows.meanDarkening>0,`${c.name}: visible sun shadows`);assert(c.shadows.default.pixelsDarkenedOver8<c.shadows.default.foregroundPixels*.9,`${c.name}: pad must receive sun`);assert(c.shadows.projectionMetres>15&&c.shadows.projectionMetres<16,`${c.name}: long sunset projection`);assert(c.rendered.luminance/c.source.luminance>=.85&&c.rendered.luminance/c.source.luminance<=1.1,`${c.name}: textile exposure`);}
