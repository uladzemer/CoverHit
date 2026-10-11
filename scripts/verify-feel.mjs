import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { chromium } from './qa-browser.mjs';
const out='docs/qa/feel'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={method:'Identical frozen cloth/camera; eroded visible-carpet mask; mean Rec.709 sRGB luminance and HSV saturation, paired dirt=0/1. Before shader = previous dirt overlay only. Procedural noise, no external assets.',cases:[],errors:[]};
const raw=async png=>(await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true}));
function stats(data,indices) { let luminance=0,saturation=0; for(const i of indices) {const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;const max=Math.max(r,g,b),min=Math.min(r,g,b);luminance+=.2126*r+.7152*g+.0722*b;saturation+=max?(max-min)/max:0;}return {pixels:indices.length,luminance:luminance/indices.length,saturation:saturation/indices.length}; }
try {
 for(const profile of ['full','lite','minimal']) {
  const page=await browser.newPage({viewport:profile==='full'?{width:1000,height:800}:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${process.env.COLOUR_URL||'http://127.0.0.1:5183/'}?${profile}=1&seed=feel-1986`);
  await page.waitForFunction(()=>window.__coverhit,null,{timeout:90000});
  const menu=await page.locator('[data-side]').textContent(); assert(!menu.includes('NaN'));
  await page.evaluate(()=>{const a=window.__coverhit;a.renderPipeline.sampleFrame=()=>{};if(a.renderPipeline.profile==='full')a.setQuality('high');a.start();}); await page.waitForTimeout(1500);
  for(const id of ['01','03']) {
   await page.evaluate(async id=>{await window.__coverhit.setCarpet(id);},id);await page.waitForTimeout(800);
   await page.evaluate(()=>{const a=window.__coverhit;window.qaRAF=window.requestAnimationFrame;window.requestAnimationFrame=cb=>{window.qaNext=cb;return 0;};a.scene.getObjectByName('carpet').material.userData.dirtyHint.value=0;a.hud.root.style.visibility='hidden';}); await page.waitForTimeout(100);
   const capture=async(name,mode)=>{
    await page.evaluate(({mode})=>{
     const a=window.__coverhit,d=a.dirt;
     d.grid.fill(mode==='clean'?0:1);d.total=mode==='clean'?0:d.grid.length;
     if(mode==='half-clean') { for(let side=0;side<2;side++){d.visibleSide=side;for(let k=0;k<10;k++)for(let y=0;y<4;y++)d.hit(.32,(y+.5)/4,1);}d.visibleSide=a.game.visibleSide; }
     d.texture.needsUpdate=true;a.renderPipeline.render(0);
    },{mode});
    const png=await page.locator('canvas').first().screenshot({path:`${out}/${profile}-${id}-${name}-${mode}.png`});return raw(png);
   };
   // Save the previous overlay with all other concurrent rendering changes identical.
   await page.evaluate(()=>{const m=window.__coverhit.scene.getObjectByName('carpet').material;window.qaCompile=m.onBeforeCompile;window.qaKey=m.customProgramCacheKey;m.onBeforeCompile=shader=>{window.qaCompile(shader);const start=shader.fragmentShader.indexOf('      float film =');const end=shader.fragmentShader.indexOf('hintZone * smoothstep(.1, .4, dirt) * .12;')+'hintZone * smoothstep(.1, .4, dirt) * .12;'.length;shader.fragmentShader=shader.fragmentShader.slice(0,start)+`diffuseColor.rgb *= 1.0 - dirt * .38; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.15,.115,.085),dirt*.08);`+shader.fragmentShader.slice(end);};m.customProgramCacheKey=()=> 'feel-before';m.needsUpdate=true;});
   for(const mode of ['dirty','half-clean','clean'])await capture('before',mode);
   await page.evaluate(()=>{const m=window.__coverhit.scene.getObjectByName('carpet').material;m.onBeforeCompile=window.qaCompile;m.customProgramCacheKey=window.qaKey;m.needsUpdate=true;});
   const clean=await capture('after','clean'),dirty=await capture('after','dirty');await capture('after','half-clean');
   // White carpet coverage through the actual presentation path (including phone target).
   await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js');const a=window.__coverhit,m=a.scene.getObjectByName('carpet');window.qaVisible=[];a.scene.traverse(o=>{if(o!==m && !o.children.length){window.qaVisible.push([o,o.visible]);o.visible=false;}});m.visible=true;window.qaMat=m.material;window.qaBackground=a.scene.background;window.qaFog=a.scene.fog;a.scene.background=new T.Color(0);a.scene.fog=null;m.material=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});a.renderPipeline.render(0);});
   const mask=await raw(await page.locator('canvas').first().screenshot());const indices=[],w=mask.info.width,h=mask.info.height;
   for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){if([[0,0],[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>mask.data[((y+dy)*w+x+dx)*3]>180))indices.push((y*w+x)*3);}
   await page.evaluate(()=>{const a=window.__coverhit,m=a.scene.getObjectByName('carpet');m.material.dispose();m.material=window.qaMat;a.scene.background=window.qaBackground;a.scene.fog=window.qaFog;for(const[o,v]of window.qaVisible)o.visible=v;a.renderPipeline.render(0);});
   const c=stats(clean.data,indices),d=stats(dirty.data,indices);const entry={profile,id,clean:c,dirty:d,luminanceDrop:1-d.luminance/c.luminance,saturationDrop:1-d.saturation/c.saturation};report.cases.push(entry);
   assert(c.pixels>1000,`${profile}/${id}: carpet coverage`);assert(entry.luminanceDrop>=.18,`${profile}/${id}: luminance ${entry.luminanceDrop}`);assert(entry.saturationDrop>=.30,`${profile}/${id}: saturation ${entry.saturationDrop}`);
   await page.evaluate(()=>{window.requestAnimationFrame=window.qaRAF;window.requestAnimationFrame(window.qaNext);});
  }
  // Existing HUD regressions: floor below completion, reset side on next rug.
  const hud=await page.evaluate(()=>{const a=window.__coverhit;a.hud.setCleanliness(.89999);const below=a.hud.nodes.percent.textContent;a.game.visibleSide=1;a.game.setState('carpetDone');a.game.nextCarpet();return {below,side:a.game.visibleSide,label:a.hud.nodes.side.textContent,percent:a.hud.nodes.percent.textContent};});
  assert.equal(hud.below,'89.9%');assert.equal(hud.side,0);assert(hud.label.includes('1/2'));assert.equal(hud.percent,'0%');
  const temporal = await page.evaluate(async()=>{
    const a=window.__coverhit;const {advanceGameplayFrame}=await import('/src/game/frame.js');
    window.qaRAF=window.requestAnimationFrame;window.requestAnimationFrame=cb=>{window.qaNext=cb;return 0;};
    a.game.start();a.beater.phase='charging';a.beater.chargeTime=0;
    let quality;const off=a.game.on('hit',e=>quality=e.quality);
    a.hit(.5,.25,.775);const beforeGame=a.game.time,beforePhysics=a.cloth.time;
    advanceGameplayFrame({game:a.game,beater:a.beater,cloth:a.cloth,mesh:a.scene.getObjectByName('carpet')},.05);
    off();return {quality,gameSeconds:a.game.time-beforeGame,physicsSeconds:a.cloth.time-beforePhysics,visualSeconds:a.beater.chargeTime,impact:a.scene.getObjectByName('strike-impact').visible};
  });
  assert.equal(temporal.quality,'excellent');assert(Math.abs(temporal.gameSeconds-.05)<1e-6);assert(Math.abs(temporal.physicsSeconds-.05)<1e-6);assert(temporal.visualSeconds<.025);assert(temporal.impact);
  await page.evaluate(()=>{window.requestAnimationFrame=window.qaRAF;window.requestAnimationFrame(window.qaNext);});
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.__coverhit.scene.getObjectByName('strike-impact').visible),false);
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>{const a=window.__coverhit;a.beater.phase='charging';a.beater.chargeTime=0;a.hit(.5,.25,.775);a.beater.update(.02);return {seconds:a.beater.chargeTime,impact:a.scene.getObjectByName('strike-impact').visible};});
  assert.equal(reduced.seconds,.02);assert.equal(reduced.impact,false);
  (report.motion ||= []).push({profile,temporal,reduced});
  await page.close();
 }
 assert.equal(report.errors.length,0,report.errors.join('\n'));
} finally { await browser.close(); await writeFile(`${out}/metrics.json`,JSON.stringify(report,null,2)); }
console.log(JSON.stringify(report,null,2));
