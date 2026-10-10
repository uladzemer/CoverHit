import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
let pw; try { pw=await import('playwright'); } catch { for(const d of await readdir(`${homedir()}/AppData/Local/npm-cache/_npx`)){try{pw=await import(pathToFileURL(`${homedir()}/AppData/Local/npm-cache/_npx/${d}/node_modules/playwright/index.mjs`));break;}catch{}} }
if(!pw) throw Error('Playwright is required for browser QA');
const out='docs/qa/polish';await mkdir(out,{recursive:true});
const browser=await pw.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];const report={viewport:[1468,986],qualities:{},errors};
try {
  const page=await browser.newPage({viewport:{width:1468,height:986}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.POLISH_URL||'http://127.0.0.1:5180/');
  await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  await page.evaluate(()=>window.__coverhit.start());await page.waitForTimeout(4500);
  report.autoQuality=await page.evaluate(()=>window.__coverhit.quality);
  assert.equal(await page.evaluate(()=>window.__coverhit.setQuality('invalid')),false);
  await page.evaluate(()=>window.__coverhit.setQuality('high'));
  for(const name of ['AGX','NEUTRAL','ACES_FILMIC']) {
    assert(await page.evaluate(name=>window.__coverhit.renderPipeline.setToneMapping(name),name));
    await page.waitForTimeout(600);await page.screenshot({path:`${out}/tone-${name.toLowerCase()}.png`});
  }
  await page.evaluate(()=>window.__coverhit.renderPipeline.setToneMapping('NEUTRAL'));
  for(const level of ['high','medium','low']) {
    await page.evaluate(level=>window.__coverhit.setQuality(level),level);await page.waitForTimeout(1200);
    await page.screenshot({path:`${out}/${level}.png`});
    report.qualities[level]=await page.evaluate(()=>new Promise(resolve=>{
      const samples=[];function sample(){samples.push({...window.__coverhit.performance});if(samples.length<180)requestAnimationFrame(sample);else {
        const stats=key=>{const v=samples.map(s=>s[key]).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)]}:null;};
        const a=window.__coverhit,gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
        resolve({drawCalls:stats('drawCalls'),gpuMs:stats('gpuMs'),cpuMs:stats('frameMs'),physicsMs:stats('physicsMs'),renderSubmitMs:stats('renderMs'),intervalMs:stats('intervalMs'),triangles:stats('triangles'),gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),quality:a.quality,ao:a.renderPipeline.ao.enabled,halfRes:a.renderPipeline.ao.configuration.halfRes,multisampling:a.renderPipeline.composer.multisampling});
      }}requestAnimationFrame(sample);
    }));
    assert.equal(report.qualities[level].quality,level);assert.equal(report.qualities[level].multisampling,0);
  }
  await page.evaluate(()=>window.__coverhit.setQuality('high'));
  // Exercise actual idle/wind-up/impact poses for every tool, preserving QA pose
  // while taking screenshots. The world-scale assertion includes trail clones.
  report.beaters=[];
  for(const id of ['soviet','plastic','rattan','sonne','victorian','bamboo']) {
    await page.evaluate(id=>{const a=window.__coverhit;a.beater.setBeater(id);a.beater.enabled=true;},id);
    for(const phase of ['idle','charging','strike']) {
      const state=await page.evaluate(async({phase})=>{
        const a=window.__coverhit,b=a.beater,THREE=await import('/node_modules/.vite/deps/three.js');
        b.phase=phase;b.chargeTime=.6*b.entry.feel.swingMass;b.charge=1;b.swingTime=.085;b.didHit=false;b.lockedTarget=a.lookTarget.clone();b.lockedHit=null;b.update(0);
        b.group.updateMatrixWorld(true);let uniform=true;b.group.traverse(o=>{const s=new THREE.Vector3().setFromMatrixScale(o.matrixWorld);uniform&&=Math.max(s.x,s.y,s.z)-Math.min(s.x,s.y,s.z)<1e-6;});
        window.__resumeBeater=b.update;b.update=()=>{};return {phase:b.phase,uniform};
      },{phase});
      assert(state.uniform);await page.screenshot({path:`${out}/beater-${id}-${phase}.png`});await page.evaluate(()=>{window.__coverhit.beater.update=window.__resumeBeater;});
      report.beaters.push({id,requestedPhase:phase,...state});
    }
  }
  await page.reload();await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});report.persistedQuality=await page.evaluate(()=>window.__coverhit.quality);assert.equal(report.persistedQuality,'high');
  await page.screenshot({path:`${out}/carousel.png`});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:`${out}/mobile.png`});assert(await page.evaluate(()=>window.__coverhit.camera.aspect<1));
  await page.setViewportSize({width:1468,height:986});
  await page.goto(new URL('beaters.html',process.env.POLISH_URL||'http://127.0.0.1:5180/').href);await page.waitForFunction(()=>window.__beatersPreview);await page.evaluate(()=>window.__beatersPreview.setRotation(0));await page.waitForTimeout(600);await page.screenshot({path:`${out}/beaters-preview.png`});
  report.previewModels=await page.evaluate(()=>window.__beatersPreview.models.length);assert.equal(report.previewModels,6);
} finally { await writeFile(`${out}/performance.json`,JSON.stringify(report,null,2));await browser.close(); }
console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);
