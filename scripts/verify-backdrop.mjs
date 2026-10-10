import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from './qa-browser.mjs';
const out='docs/qa/backdrop';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={browser:browser.version(),modes:{}};
try{
 for(const mode of ['stock','procedural','no-assets']){
  const page=await browser.newPage({viewport:{width:1468,height:986}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(mode==='procedural')await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
  if(mode==='no-assets')await page.route('**/yard/**',r=>new URL(r.request().url()).pathname.startsWith('/yard/')?r.fulfill({status:404,body:''}):r.continue());
  await page.goto(process.env.YARD_URL||'http://127.0.0.1:5178');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  await page.evaluate(()=>window.__coverhit.start());await page.waitForTimeout(1500);
  const views={};
  for(const [name,x]of [['default',734],['aim-left',1],['aim-right',1467],['wide',734],['flip',734]]){
   if(name==='wide'){await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>{const a=window.__coverhit;a.camera.fov=75;a.camera.updateProjectionMatrix();});}
   if(name==='flip')await page.evaluate(()=>window.__coverhit.flip());
   await page.mouse.move(x,493);await page.waitForTimeout(name==='flip'?400:150);
   await page.screenshot({path:`${out}/${mode}-${name}.png`});
   const coverage=await page.evaluate(async()=>{const {sampleBackdropCoverage}=await import('/src/scene/yard/coverage.js');const a=window.__coverhit;return sampleBackdropCoverage(a.yard,a.camera);});
   assert.equal(coverage.failures.length,0,`${mode}/${name}: ${JSON.stringify(coverage.failures.slice(0,5))}`);
   await page.waitForTimeout(350);
   const perf=await page.evaluate(()=>new Promise(resolve=>{const a=window.__coverhit,samples=[];function tick(){samples.push({...a.performance});if(samples.length<120)requestAnimationFrame(tick);else{const stats=k=>{const v=samples.map(s=>s[k]).sort((a,b)=>a-b);return{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};resolve(Object.fromEntries(['drawCalls','triangles','frameMs','renderMs','physicsMs','intervalMs'].map(k=>[k,stats(k)])));}}requestAnimationFrame(tick);}));
   assert(perf.drawCalls.max<=140,`${mode}/${name}: ${perf.drawCalls.max} calls`);views[name]={coverage,perf};
  }
  const farRing=await page.evaluate(()=>{const a=window.__coverhit;let draws=0,triangles=0;a.yard.backdrop.group.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{draws,triangles,housing:a.yard.backdrop.housing,stock:a.yard.stockStatus,gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};});
  assert(farRing.draws<=20&&farRing.triangles<=60000);assert.equal(errors.length,0,JSON.stringify(errors));
  report.modes[mode]={views,farRing,errors};await writeFile(`${out}/performance.json`,JSON.stringify(report,null,2)+'\n');
  console.log(mode,JSON.stringify({default:views.default.perf,wide:views.wide.perf,farRing:{draws:farRing.draws,triangles:farRing.triangles}}));await page.close();
 }
}finally{await browser.close();}
