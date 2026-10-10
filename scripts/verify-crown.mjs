import {chromium} from './qa-browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CARPET_THICKNESS} from '../src/carpet/barGeometry.js';
const out=process.env.QA_OUT||'docs/qa/crown';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],metrics=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;Math.random=()=>.375;});
 await page.goto(`${process.env.QA_URL||'http://127.0.0.1:5173'}/?seed=crown`);
 await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
 await page.evaluate(()=>window.__coverhit.start());
 for(const type of ['palas','wool','runner']) {
  const metric=await page.evaluate(async type=>{
   const a=window.__coverhit;await a.setCarpetType(type);const c=a.cloth;c.wind=0;
   for(let i=0;i<180;i++)c.integrate(1/60);c.refreshGeometry();
   const {CARPET_HALF_THICKNESS,BAR_RADIUS}=await import('/src/carpet/barGeometry.js');
   const gaps=[];for(let y=0;y<=c.rows;y++)for(let x=0;x<=c.cols;x++)if(c.foldAxis==='u'?x===c.cols/2:y===c.rows/2)gaps.push(c.positions[(y*(c.cols+1)+x)*3+1]-c.barAxis.y-CARPET_HALF_THICKNESS-BAR_RADIUS);
   a.game.nextMoth=Infinity;
   return {type,id:a.carpetEntry.id,axis:c.foldAxis,minGap:Math.min(...gaps),maxGap:Math.max(...gaps)};
  },type);
  assert(metric.minGap>=0&&metric.maxGap<=CARPET_THICKNESS+.005,JSON.stringify(metric));metrics.push(metric);
  await page.evaluate(()=>{const a=window.__coverhit;a.camera.position.copy(a.baseCamera);a.camera.lookAt(a.lookTarget);a.renderer.render(a.yard.scene,a.camera);});
  await page.screenshot({path:`${out}/${type}-front.png`});
  await page.evaluate(()=>{
   const a=window.__coverhit,c=a.cloth,center=a.yard.barPosition.clone();
   // Hide rack uprights only for the diagnostic axial view of the crown.
   a.hiddenPosts=[];a.yard.root.traverse(o=>{if(!o.isInstancedMesh)return;for(let i=0;i<o.count;i++){const e=o.userData.fallbackEntries?.[i];if(e?.role!=='rack'||Math.abs(e.matrix.elements[12])<.1)continue;const m=e.matrix.clone();a.hiddenPosts.push({o,i,m});o.setMatrixAt(i,m.clone().scale(center.clone().set(0,0,0)));o.instanceMatrix.needsUpdate=true;}});
   a.camera.position.copy(center).add(center.clone().set(c.span/2+.6,.10,.10));a.camera.lookAt(center.clone().add(center.clone().set(0,-.07,0)));a.camera.fov=18;a.camera.updateProjectionMatrix();
   a.renderer.render(a.yard.scene,a.camera);
  });
  await page.screenshot({path:`${out}/${type}-side.png`});
  await page.evaluate(()=>{const a=window.__coverhit;for(const {o,i,m} of a.hiddenPosts){o.setMatrixAt(i,m);o.instanceMatrix.needsUpdate=true;}a.camera.fov=48;a.camera.updateProjectionMatrix();});
 }
 assert.equal(errors.length,0);await writeFile(`${out}/browser.json`,JSON.stringify({metrics,errors},null,2));console.log(JSON.stringify(metrics));
} finally {await browser.close();}

