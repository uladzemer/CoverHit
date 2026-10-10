import {BAR_HEIGHT} from '../src/carpet/barCollision.js';
import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
let pw;try{pw=await import('playwright');}catch{
 const cache=`${homedir()}/AppData/Local/npm-cache/_npx`;
 for(const d of await readdir(cache)){try{pw=await import(pathToFileURL(`${cache}/${d}/node_modules/playwright/index.mjs`));break;}catch{}}
 if(!pw)throw Error('Install Playwright to run browser QA');
}
const out='docs/qa/yard2';await mkdir(out,{recursive:true});
const args=[];
if(process.env.YARD_UNCAPPED==='1')args.push('--disable-frame-rate-limit','--disable-gpu-vsync');
const browser=await pw.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args});
try{
 const page=await browser.newPage({viewport:{width:1468,height:986}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.YARD_URL||'http://127.0.0.1:5180');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(async()=>{await window.__coverhit.start();});await page.waitForTimeout(1500);
 await page.mouse.move(734,493);await page.waitForTimeout(100);await page.screenshot({path:`${out}/default.png`});
 const sample=()=>page.evaluate(()=>new Promise(resolve=>{
  const samples=[],a=window.__coverhit,startTime=performance.now();let n=0;
  function frame(){samples.push({...a.performance});if(++n<180||performance.now()-startTime<3000)requestAnimationFrame(frame);else{
   const stats=key=>{const v=samples.map(s=>s[key]).sort((a,b)=>a-b);return{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};
   const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   resolve({drawCalls:stats('drawCalls'),cpuFrameMs:stats('frameMs'),physicsMs:stats('physicsMs'),renderSubmitMs:stats('renderMs'),frameIntervalMs:stats('intervalMs'),triangles:stats('triangles'),assets:a.yard.assetStatus,renderer:a.renderer.info.memory,environment:!!a.yard.scene.environment,backgroundMapping:a.yard.scene.background.mapping,sun:a.yard.sun.position.toArray(),sunColor:a.yard.sun.color.toArray(),gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)});
  }}requestAnimationFrame(frame);
 }));
 const normal=await sample();
 await page.mouse.move(734,493);await page.mouse.down();
 const holdSnapshot=async(seconds,file)=>{
  const state=await page.evaluate(seconds=>new Promise(resolve=>{const a=window.__coverhit,b=a.beater,original=b.update;
   const check=()=>{if(b.chargeTime<seconds){requestAnimationFrame(check);return;}
    b.update=()=>{};window.__yardQAResume=()=>{b.update=original;};
    const reticle=a.yard.scene.getObjectByName('carpet-aim-reticle');
    resolve({seconds:b.chargeTime,charge:b.charge,phase:b.phase,visible:reticle.visible,arc:reticle.material.uniforms.arc.value,depthTest:reticle.material.depthTest,renderOrder:reticle.renderOrder});};requestAnimationFrame(check);
  }),seconds);
  assert.equal(state.phase,'charging');assert(state.visible);assert(state.arc>0);assert.equal(state.depthTest,false);
  await page.screenshot({path:`${out}/${file}`});await page.evaluate(()=>window.__yardQAResume());return state;
 };
 const reticle150=await holdSnapshot(.15,'reticle-150ms.png');
 const reticle400=await holdSnapshot(.4,'reticle-mid-charge.png');
 await page.mouse.up();

 await page.evaluate(()=>{const a=window.__coverhit;a.baseCamera.set(15,7,22);a.lookTarget.set(-1,4,-15);});await page.waitForTimeout(500);await page.screenshot({path:`${out}/wide.png`});
 const wide=await sample();
 await page.evaluate(()=>{const a=window.__coverhit;a.baseCamera.set(7,3,-12.5);a.lookTarget.set(22,1.3,-24);});await page.waitForTimeout(1000);await page.screenshot({path:`${out}/garages.png`});
 const garages=await sample();
 // A failed yard download must leave the menu and bar usable.
 const fallbackPage=await browser.newPage({viewport:{width:1280,height:800}});
 await fallbackPage.route('**/yard/**',route=>new URL(route.request().url()).pathname.startsWith('/yard/')?route.abort():route.continue());
 await fallbackPage.goto(process.env.YARD_URL||'http://127.0.0.1:5180');await fallbackPage.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 const fallback=await fallbackPage.evaluate(async()=>{await window.__coverhit.start();return{state:window.__coverhit.game.state,assets:window.__coverhit.yard.assetStatus,bar:window.__coverhit.yard.barPosition.toArray()};});
 const result={viewport:[1468,986],browserArgs:args,normal,wide,garages,reticle150,reticle400,fallback,errors};await writeFile(`${out}/${process.env.YARD_UNCAPPED==='1'?'performance-uncapped':'performance'}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 assert.equal(errors.length,0);assert.equal(normal.assets.failures.length,0);assert(normal.environment);for(const view of [normal,wide,garages])assert(view.triangles.max<=400000);assert.equal(normal.backgroundMapping,303);assert(normal.drawCalls.max<=120);assert(wide.drawCalls.max<=120);assert(garages.drawCalls.max<=120);assert.equal(fallback.state,'playing');assert.equal(fallback.assets.failures.length,22);
}finally{await browser.close();}
