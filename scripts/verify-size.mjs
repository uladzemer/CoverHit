import {chromium} from './qa-browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {carpetEntryType,fitCarpetSize,foldLayout} from '../src/carpet/assets.js';
import {CARPET_TYPES} from '../src/carpet/types.js';
import {BAR_HEIGHT,CARPET_THICKNESS,CARPET_GROUND_CLEARANCE} from '../src/carpet/barCollision.js';
const out='docs/qa/size';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],metrics=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().includes('watchdog'))console.log(m.text());});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(()=>window.__coverhit.start());
 for(const id of ['09','03','05','01']) {
  await page.evaluate(async id=>{await window.__coverhit.setCarpet(id);},id);
  await page.waitForTimeout(1800);
  const metric=await page.evaluate(()=>{
   const a=window.__coverhit,c=a.cloth,mesh=a.beater.carpetMeshGetter();
   const bounds={minY:Infinity,maxY:-Infinity,minX:Infinity,maxX:-Infinity};let groundClearance=Infinity;
   for(let i=0;i<c.positions.length;i+=3){const v=a.beater.headCenter.clone().fromArray(c.positions,i);mesh.localToWorld(v);groundClearance=Math.min(groundClearance,v.y-c.carpetThickness);v.project(a.camera);bounds.minY=Math.min(bounds.minY,v.y);bounds.maxY=Math.max(bounds.maxY,v.y);bounds.minX=Math.min(bounds.minX,v.x);bounds.maxX=Math.max(bounds.maxX,v.x);}
   return {id:a.carpetEntry.id,type:a.carpetEntry.type,aspect:a.carpetEntry.aspect,width:c.width,height:c.height,span:c.span,drop:c.drop,barHeight:a.yard.barPosition.y,barSpan:a.yard.barLength,endMargin:(a.yard.barLength-c.span)/2,groundClearance,frameHeight:(bounds.maxY-bounds.minY)/2,bounds,camera:a.baseCamera.toArray(),target:a.lookTarget.toArray(),recoveries:c.watchdogRecoveries??0};
  });
  const entry=await page.evaluate(()=>window.__coverhit.carpetEntry),size=fitCarpetSize(carpetEntryType(entry),entry.aspect);
  assert(Math.abs(metric.width-size.width)<1e-10&&Math.abs(metric.height-size.height)<1e-10);
  assert.equal(metric.drop,foldLayout(size).drop);assert(metric.endMargin>=.3);assert(metric.groundClearance>=CARPET_GROUND_CLEARANCE);assert.equal(metric.recoveries,0);
  assert(metric.bounds.minY>=-1&&metric.bounds.maxY<=1&&metric.bounds.minX>=-1&&metric.bounds.maxX<=1);
  if(metric.type!=='palas')assert(metric.frameHeight>=.50&&metric.frameHeight<=.61);
  await page.screenshot({path:`${out}/${id}-${metric.type}.png`});metrics.push(metric);
 }
 assert.equal(errors.length,0);
 const types=CARPET_TYPES.map(t=>({type:t.id,nominal:t.size,longSide:Math.max(t.size.width,t.size.height)}));
 await writeFile(`${out}/browser.json`,JSON.stringify({types,barHeight:BAR_HEIGHT,barSpan:metrics[0].barSpan,conservativeBiggestClearance:BAR_HEIGHT-1.75-CARPET_THICKNESS,metrics,errors},null,2));
 console.log(JSON.stringify({types,metrics,errors},null,2));
} finally {await browser.close();}

