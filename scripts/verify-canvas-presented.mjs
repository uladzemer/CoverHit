import {webkit,devices} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPresentedGame,verifyPresentedPixels} from './mobile-probes/presented-pixels.mjs';
const url=process.env.MOBILE_URL||'http://127.0.0.1:5323/CoverHit/';
const out=process.env.PRESENTED_OUT||'docs/qa/mobile-presented';await mkdir(out,{recursive:true});
const results=[];const browser=await webkit.launch();let failed=false;
try {
 for(const device of ['iPhone 14 Pro','iPhone SE'])for(const profile of ['full','lite','minimal','auto']) {
  const context=await browser.newContext({...devices[device]}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const row={device,requested:profile};
  try {
   const target=new URL(url);if(profile!=='auto')target.searchParams.set(profile,'1');
   await page.goto(target.href,{waitUntil:'domcontentloaded'});await startPresentedGame(page);
   // Pin each requested pipeline, then wait beyond the original failure delay.
   await page.evaluate(()=>{window.__sampleFrame=window.__coverhit.renderPipeline.sampleFrame;window.__coverhit.renderPipeline.sampleFrame=()=>{};});
   await page.waitForTimeout(15000);
   row.actual=await page.evaluate(()=>window.__coverhit.renderPipeline.profile);
   assert.equal(row.actual,profile==='auto'?'lite':profile);
   Object.assign(row,await verifyPresentedPixels(page,`${out}/${device.replaceAll(' ','-')}-${profile}.png`));
   if(profile==='full') {
    row.transitions=[];
    for(const next of ['lite','minimal']) {
     await page.evaluate(next=>window.__coverhit.setQuality(next),next);
     await page.waitForTimeout(1000);
     row.transitions.push({profile:next,...await verifyPresentedPixels(page,`${out}/${device.replaceAll(' ','-')}-full-to-${next}.png`)});
    }
   }
   if(profile==='auto') {
    await page.evaluate(()=>{for(let i=0;i<120;i++)window.__sampleFrame(50);});
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>window.__coverhit.renderPipeline.profile),'minimal');
    row.adaptive=await verifyPresentedPixels(page,`${out}/${device.replaceAll(' ','-')}-adaptive-minimal.png`);
    await page.setViewportSize({width:devices[device].viewport.height,height:devices[device].viewport.width});
    await page.waitForTimeout(800);
    row.rotated=await verifyPresentedPixels(page,`${out}/${device.replaceAll(' ','-')}-rotated-minimal.png`);
   }
   if(profile==='lite') {
    const muted=await page.locator('[data-mute]').getAttribute('aria-pressed');
    await page.locator('[data-mute]').tap();assert.notEqual(await page.locator('[data-mute]').getAttribute('aria-pressed'),muted);
    await page.evaluate(()=>{window.__flipEvents=0;window.__coverhit.game.on('flipStart',()=>window.__flipEvents++);});
    await page.locator('[data-flip]').tap();assert.equal(await page.evaluate(()=>window.__flipEvents),1);
    await page.locator('.ch-menu-reopen').tap();await page.waitForFunction(()=>window.__coverhit.hud.blocking);
    await page.locator('[data-modal-close]').tap();await page.waitForFunction(()=>!window.__coverhit.hud.blocking);
    row.touchUI='mute, flip, menu: PASS';
    const blank=await page.addStyleTag({content:'#app > canvas {visibility:hidden!important}'});
    try {await assert.rejects(()=>verifyPresentedPixels(page),/Canvas/);row.blankRejected=true;}
    finally {await blank.evaluate(node=>node.remove());}
   }
   assert.equal(errors.length,0,errors.join('\n'));row.pass=true;
  }catch(e){row.pass=false;row.failure=e.message;failed=true;}
  results.push(row);console.log(JSON.stringify(row));await context.close();
 }
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({url,results},null,2)+'\n');}
if(failed)process.exitCode=1;
