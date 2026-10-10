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
const out='docs/qa/yard3';await mkdir(out,{recursive:true});
const browser=await pw.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const url=process.env.YARD_URL||'http://127.0.0.1:5180';
try{
 const page=await browser.newPage({viewport:{width:1468,height:986}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 const credits=await page.locator('.ch-credits').textContent();
 assert.equal(await page.locator('.ch-credits a').filter({hasText:'Envato Elements,'}).count(),8);
 await page.evaluate(async()=>window.__coverhit.start());await page.waitForTimeout(1500);
 const views={};
 for(const [name,camera,target]of [['default',null,null],['wide',[15,7,22],[-1,4,-15]],['garages',[7,3,-12.5],[22,1.3,-24]]]){
  if(camera)await page.evaluate(({camera,target})=>{const a=window.__coverhit;a.baseCamera.fromArray(camera);a.lookTarget.fromArray(target);},{camera,target});
  await page.waitForTimeout(1000);await page.mouse.move(734,493);await page.screenshot({path:`${out}/${name}.png`});
  views[name]=await page.evaluate(()=>new Promise(resolve=>{
   const samples=[],a=window.__coverhit;
   function frame(){samples.push({...a.performance});if(samples.length<180)requestAnimationFrame(frame);else{
    const stats=key=>{const v=samples.map(s=>s[key]).sort((a,b)=>a-b);return{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};
    const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    resolve({drawCalls:stats('drawCalls'),triangles:stats('triangles'),cpuFrameMs:stats('frameMs'),physicsMs:stats('physicsMs'),frameIntervalMs:stats('intervalMs'),stock:a.yard.stockStatus,gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)});
   }}requestAnimationFrame(frame);
  }));
 }
 const fallbacks={};
 for(const mode of ['missing','html','invalid-json','malformed','broken-model']){
  const p=await browser.newPage();const pageErrors=[];p.on('pageerror',e=>pageErrors.push(e.message));
  if(mode==='broken-model')await p.route('**/yard/stock/birch.glb',r=>r.fulfill({status:404,body:''}));
  else await p.route('**/yard/stock/manifest.local.json',r=>r.fulfill({status:mode==='missing'?404:200,contentType:mode==='html'?'text/html':'application/json',body:mode==='html'?'<html>SPA</html>':mode==='invalid-json'?'{bad':mode==='malformed'?'[{}]':'[]'}));
  await p.goto(url);await p.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  fallbacks[mode]=await p.evaluate(async()=>{const a=window.__coverhit;await a.start();return{state:a.game.state,stock:a.yard.stockStatus,credits:a.yard.stockCredits.length,bar:a.yard.barPosition.toArray()};});
  assert.equal(pageErrors.length,0);assert.equal(fallbacks[mode].state,'playing');assert.deepEqual(fallbacks[mode].bar,[0,BAR_HEIGHT,0]);
  if(mode==='broken-model'){assert.equal(fallbacks[mode].stock.loaded.length,7);assert.equal(fallbacks[mode].stock.failures.length,1);}else assert.equal(fallbacks[mode].credits,0);
  await p.close();
 }
 const report={viewport:[1468,986],browser:browser.version(),views,fallbacks,credits,errors};
 await writeFile(`${out}/performance.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 assert.equal(errors.length,0);for(const view of Object.values(views)){assert.equal(view.stock.loaded.length,8);assert(view.drawCalls.max<=130);assert(view.triangles.max<=600000);}
}finally{await browser.close();}
