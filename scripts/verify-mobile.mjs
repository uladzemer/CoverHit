import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { startPresentedGame, verifyPresentedPixels } from './mobile-probes/presented-pixels.mjs';

const url = process.env.MOBILE_URL || 'http://127.0.0.1:5187/';
const out = process.env.MOBILE_OUT || 'docs/qa/mobile';
await mkdir(out,{recursive:true});
const report = { url, at:new Date().toISOString(), notes:['Desktop GPU emulation cannot reproduce physical iOS tab memory kills.', 'Pixel uses 4x CPU and Fast 3G (1.6 Mbps down, 750 Kbps up, 150ms RTT).'], results:[] };
const scenarios = (process.env.MOBILE_SCENARIOS || 'auto,lite,hidden,loss,404').split(',');
let failed = false;
for (const name of (process.env.MOBILE_DEVICES || 'iPhone 14 Pro,iPhone SE,Pixel 7').split(',')) {
  const browser = await (name === 'Pixel 7' ? chromium : webkit).launch({headless:true,
    ...(name==='Pixel 7'?{executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try {
    for(const orientation of ['portrait','landscape'])for(const scenario of scenarios){
      const device = devices[name], viewport = orientation==='portrait'?device.viewport:{width:device.viewport.height,height:device.viewport.width};
      const context = await browser.newContext({...device,viewport});
      const page = await context.newPage();const errors=[];let transferred=0;
      page.on('pageerror',error=>errors.push(error.message));
      const stockRequests=[];page.on('request',r=>{if(/yard\/stock\/|carpets\/manifest\.local\.json/.test(r.url()))stockRequests.push(r.url());});
      const responses=[];page.on('response',response=>responses.push(response));
      await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
      await page.route('**/carpets/manifest.local.json',r=>r.fulfill({status:404,body:''}));
      if(scenario==='404'){
        await page.route('**/lite/**',r=>r.fulfill({status:404,body:''}));
        await page.route('**/sunset.hdr',r=>r.fulfill({status:404,body:''}));
      }
      if(scenario==='hidden')await page.addInitScript(()=>{
        const original=WebGL2RenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getExtension=function(name){if(/color_buffer_(float|half_float)|timer_query/.test(name))return null;return original.call(this,name);};
      });
      if(scenario==='loss')await page.addInitScript(()=>{
        const poll=setInterval(()=>{
          const canvas=document.querySelector('canvas');if(!canvas)return;
          const gl=canvas.getContext('webgl2');if(!gl)return;clearInterval(poll);
          setTimeout(()=>gl.getExtension('WEBGL_lose_context')?.loseContext(),5000);
        },100);
      });
      if(name==='Pixel 7'){
        const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
        await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6e6/8,uploadThroughput:750e3/8});
      }
      const start=Date.now();let row={device:name,orientation,scenario};
      try{
        await page.goto(`${url}${url.includes('?')?'&':'?'}${scenario==='lite'||scenario==='404'?'lite=1':''}`,{waitUntil:'domcontentloaded',timeout:90000});
        await page.waitForFunction(()=>document.getElementById('boot-error')||window.__boot?.some(step=>step.step==='first frame rendered'),null,{timeout:60000});
        row.ttiMs=Date.now()-start;
        if(scenario==='loss')await page.waitForFunction(()=>document.getElementById('boot-error'),null,{timeout:15000});
        else {
          // Photos upgrade independently of the HUD. Measure their settled cost,
          // not just the smaller procedural maps present at the first frame.
          await page.evaluate(async()=>{
            const waiting=new Set();window.__coverhit?.scene.traverse(o=>{
              for(const m of [o.material].flat())if(m?.userData.photoReady)waiting.add(m.userData.photoReady);
            });await Promise.allSettled([...waiting]);
          });
          await page.waitForTimeout(2500);
        }
        Object.assign(row,await page.evaluate(()=>{
          const a=window.__coverhit,panel=document.getElementById('boot-error');
          return {profile:window.__bootDiagnostics?.profile,panel:!!panel,
            dpr:a?.renderPipeline.renderPixelRatio,outputDpr:a?.renderer.getPixelRatio(),composer:!!a?.renderPipeline.composer,
            heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,textureMB:window.__bootDiagnostics?.textureMB??null,
            caps:window.__bootDiagnostics?.caps,steps:window.__boot,reasons:window.__bootDiagnostics?.reasons};
        }));
        if(scenario==='loss')assert(row.panel,'Context loss must show recovery panel');
        else {
          assert(!row.panel,'Startup must reach gameplay without an error panel');
          await startPresentedGame(page);
          Object.assign(row,await verifyPresentedPixels(page,`${out}/${name.replaceAll(' ','-')}-${orientation}-${scenario}-canvas.png`));
        }
        assert.equal(errors.length,0,errors.join('\n'));
        assert.equal(stockRequests.length,0,'Phone must not request licensed stock manifests');
        assert.equal(row.composer,false,'Phone profile must use the small presentation pass');
        if(row.dpr!==undefined)assert(row.dpr<=(row.profile==='minimal'?.75:1),'Phone DPR cap');
        if(row.textureMB!==null)assert(row.textureMB<=250,'Phone texture budget exceeded');
        // Encoded response body sizes avoid counting compression as transfer inflation.
        for(const response of responses)try{const sizes=await response.request().sizes();transferred+=sizes.responseBodySize;}catch{}
        row.transferredMB=Math.round(transferred/1048576*100)/100;
        if(scenario==='lite'&&!row.panel)assert(row.transferredMB<=8,'Lite first load exceeds 8 MB');
        row.pass=true;
      }catch(error){row.pass=false;row.failure=error.message;failed=true;}
      row.errors=errors;await page.screenshot({path:`${out}/${name.replaceAll(' ','-')}-${orientation}-${scenario}.png`,scale:'css'});
      report.results.push(row);console.log(`${name} ${orientation} ${scenario}: ${row.pass?'PASS':'FAIL'} ${row.profile||''} ${row.ttiMs||'?'}ms ${row.transferredMB||'?'}MB SD=${row.luminanceSD??'-'} body=${row.bodyPercent??'-'}% carpetDeltaE=${row.carpetSkyDeltaE??'-'} green=${row.greenPercent??'-'}% ${row.failure||''}`);
      await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await context.close();
    }
  }finally{await browser.close();}
}
console.table(report.results.map(({device,orientation,scenario,pass,profile,ttiMs,transferredMB,heapMB,textureMB})=>({device,orientation,scenario,pass,profile,ttiMs,transferredMB,heapMB,textureMB})));
if(failed)process.exitCode=1;
