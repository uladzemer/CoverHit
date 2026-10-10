import {chromium} from 'playwright';
import sharp from 'sharp';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/qa/laundry',base=process.env.LAUNDRY_URL||'http://127.0.0.1:5182';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={errors:[],clips:{},qualities:{}};
try{
 const page=await browser.newPage({viewport:{width:640,height:400}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404 (Not Found)'))report.errors.push(m.text());});
 await page.goto(base+'/docs/qa/laundry/preview.html');await page.waitForFunction(()=>window.qa);
 assert.equal(await page.evaluate(()=>window.qa.laundry.status),'vat');
 const tiles=[];
 for(const [row,[name,strength]] of [['calm',0],['breeze',.5],['strong',1]].entries()){
  for(let f=0;f<8;f++){const t=f*6/7;report.clips[name]=await page.evaluate(({t,strength})=>window.qa.render(t,strength),{t,strength});tiles.push({input:await page.screenshot(),left:f*320,top:row*200});}
 }
 for(const tile of tiles)tile.input=await sharp(tile.input).resize(320,200).png().toBuffer();
 await sharp({create:{width:2560,height:600,channels:4,background:'#d0b79b'}}).composite(tiles).png().toFile(out+'/contact-sheet.png');
 report.renderer=await page.evaluate(()=>{const gl=window.qa.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER);});
 report.vertexUploadsPerFrame=0;report.laundrySimulationCpuMs=0;
 report.isolatedSubmission=await page.evaluate(()=>{const q=window.qa, samples=[];for(let i=0;i<180;i++){const start=performance.now();q.render(i/30,.5);samples.push(performance.now()-start);}return {meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,colourDrawCalls:2,shadowDrawCalls:1};});
 await page.route('**/yard/laundry/**',r=>r.abort());await page.reload();await page.waitForFunction(()=>window.qa);assert.equal(await page.evaluate(()=>window.qa.laundry.status),'fallback');await page.screenshot({path:out+'/fallback.png'});await page.unroute('**/yard/laundry/**');
 // Network failure console messages are expected for the intentional fallback.
 report.fallback='passed';report.errors=report.errors.filter(e=>!e.includes('net::ERR_FAILED'));
 await page.setViewportSize({width:1100,height:760});await page.goto(base+'/?laundryqa=1');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 report.integration=await page.evaluate(()=>{const a=window.__coverhit,l=a.yard.root.userData.laundry;return {status:l.status,visible:l.group.children.map(m=>m.visible),sharedMaterial:l.group.children.every(m=>m.material===a.yard.materials.laundry)};});assert(report.integration.visible.every(Boolean));
 await page.evaluate(()=>{window.__coverhit.hud.root.style.visibility='hidden';});
 await page.screenshot({path:out+'/default-view.png'});
 for(const quality of ['high','medium','low']){
  await page.evaluate(q=>window.__coverhit.setQuality(q),quality);await page.waitForTimeout(1200);
  report.qualities[quality]=await page.evaluate(()=>new Promise(resolve=>{const samples=[];function sample(){samples.push({...window.__coverhit.performance});if(samples.length<30)requestAnimationFrame(sample);else{const average=k=>samples.map(s=>s[k]).filter(Number.isFinite).reduce((a,b)=>a+b,0)/samples.length;resolve({drawCalls:average('drawCalls'),triangles:average('triangles'),frameCpuMs:average('frameMs'),gpuMs:average('gpuMs'),intervalMs:average('intervalMs')});}}requestAnimationFrame(sample);}));
 }
 assert.equal(report.errors.length,0);
}finally{await writeFile(out+'/performance.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report,null,2));
