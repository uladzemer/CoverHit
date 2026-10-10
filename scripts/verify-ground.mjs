import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from './qa-browser.mjs';
const out='docs/qa/ground',baseline=process.argv.includes('--baseline');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={browser:browser.version(),modes:{}};
try{
 for(const mode of ['stock','procedural','no-assets']){
  const page=await browser.newPage({viewport:{width:1468,height:986}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
  if(mode==='procedural')await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
  if(mode==='no-assets')await page.route('**/yard/**',r=>new URL(r.request().url()).pathname.startsWith('/yard/')?r.fulfill({status:404,body:''}):r.continue());
  await page.goto(process.env.YARD_URL||'http://127.0.0.1:5178');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  await page.evaluate(()=>window.__coverhit.start());await page.waitForTimeout(1500);
  const original=await page.evaluate(()=>window.__coverhit.lookTarget.toArray()),views={};
  for(const [view,yaw]of [['default',0],['aim-left',-35],['aim-right',35]]){
   // Production pointer aim does not turn the camera. Rotate the shared look target
   // for explicit far-left/right inspection, preserving eye position and pitch.
   await page.evaluate(({original,yaw})=>{const a=window.__coverhit,t=a.lookTarget.clone().fromArray(original),v=t.sub(a.baseCamera);v.applyAxisAngle(v.clone().set(0,1,0),-yaw*Math.PI/180);a.lookTarget.copy(a.baseCamera).add(v);},{original,yaw});
   await page.waitForTimeout(250);
   await page.screenshot({path:`${out}/${baseline?'before-':''}${mode}-${view}.png`});
   const perf=await page.evaluate(()=>new Promise(resolve=>{const a=window.__coverhit,samples=[];function tick(){samples.push({...a.performance});if(samples.length<120)requestAnimationFrame(tick);else{const stats=k=>{const v=samples.map(s=>s[k]).sort((a,b)=>a-b);return{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};resolve(Object.fromEntries(['drawCalls','triangles','frameMs','renderMs','intervalMs'].map(k=>[k,stats(k)])));}}requestAnimationFrame(tick);}));
   views[view]={yaw,perf};
  }
  if(!baseline){
   await page.evaluate(()=>{const a=window.__coverhit;a.baseCamera.set(-3,1.9,-4);a.lookTarget.set(-7,.2,-10);});
   await page.waitForTimeout(200);await page.screenshot({path:`${out}/${mode}-sandbox-detail.png`});
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  report.modes[mode]={views,errors,assets:await page.evaluate(()=>({surfaces:window.__coverhit.yard.assetStatus,stock:window.__coverhit.yard.stockStatus}))};
  console.log(mode,JSON.stringify(views.default.perf));await page.close();
 }
 if(!baseline){const before=JSON.parse(await readFile(`${out}/baseline.json`,'utf8'));for(const [mode,data]of Object.entries(report.modes))for(const [view,{perf}]of Object.entries(data.views))for(const k of ['drawCalls','triangles']){const old=before.modes[mode].views[view].perf[k].max;assert(perf[k].max<=old*1.1,`${mode}/${view}/${k}: ${perf[k].max} > ${old} + 10%`);}}
 await writeFile(`${out}/${baseline?'baseline':'performance'}.json`,JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
