import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from './qa-browser.mjs';
const out='docs/qa/bgfix';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={browser:browser.version(),views:[]};
try {
 for(const mode of ['stock','procedural','no-assets'])for(const [width,height] of [[800,700],[1024,640],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
  if(mode==='procedural')await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
  if(mode==='no-assets')await page.route('**/yard/**',r=>new URL(r.request().url()).pathname.startsWith('/yard/')?r.fulfill({status:404,body:''}):r.continue());
  await page.goto(process.env.YARD_URL||'http://127.0.0.1:5178');
  await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  await page.evaluate(()=>window.__coverhit.start());await page.waitForTimeout(1200);
  const panels=[];
  for(const open of [false,true]){
   await page.locator('.ch-stats').evaluate((node,value)=>node.open=value,open);
   const rects=await page.locator('.ch-zone').evaluateAll(nodes=>nodes.map(n=>({class:n.className,rect:n.getBoundingClientRect().toJSON()})));
   for(const {class:name,rect:r}of rects)assert(!(r.left<width*.8&&r.right>width*.2&&r.top<height*.8&&r.bottom>height*.2),`${mode} ${width}x${height}: ${name} overlaps carpet safe zone`);
   panels.push({open,rects});
  }
  await page.locator('.ch-stats').evaluate(node=>node.open=false);
  assert(await page.locator('[data-flip]').evaluate(node=>{const r=node.getBoundingClientRect(),p=node.closest('.ch-zone').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom&&r.left>=p.left&&r.right<=p.right;}),'Flip button clipped by safe-zone panel');
  const assets=await page.evaluate(()=>{
   const a=window.__coverhit,groups=a.yard.root.children.filter(o=>o.userData.proceduralFacade);
   return {stock:a.yard.stockStatus,surfaces:a.yard.assetStatus,exposure:a.renderer.toneMappingExposure,replacements:groups.map(g=>({name:g.name,windowMap:g.children[0].material.map?.image?.width||0}))};
  });
  if(mode==='stock'){
   assert.equal(assets.stock.failures.length,0);assert.equal(assets.stock.substitutions.length,2);
   assert(assets.replacements.every(g=>g.windowMap>0));
   assert(!assets.stock.loaded.includes('balcony-block'));assert(!assets.stock.loaded.includes('panel-block'));
  }
  await page.evaluate(async()=>{
   const a=window.__coverhit,canvas=a.renderer.domElement;a.renderPipeline.render(1/60);a.renderer.getContext().finish();
   const snapshot=document.createElement('img');snapshot.id='qa-frame';snapshot.src=canvas.toDataURL('image/png');
   Object.assign(snapshot.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'0',pointerEvents:'none'});
   await snapshot.decode();canvas.style.visibility='hidden';document.body.appendChild(snapshot);
  });
  await page.screenshot({path:`${out}/${mode}-${width}x${height}-default.png`});
  assert.equal(errors.length,0,JSON.stringify(errors));
  report.views.push({mode,width,height,assets,panels,errors});
  console.log(`${mode} ${width}x${height}: safe zone and rendering passed`);await page.close();
 }
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
} finally {await browser.close();}
