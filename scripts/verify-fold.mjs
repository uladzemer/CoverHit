import {chromium} from './qa-browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.QA_OUT||'docs/qa/fold';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(async()=>{const a=window.__coverhit;await a.start();await a.setCarpet('09');a.cloth.wind=0;});
 await page.waitForTimeout(2500);
 const geometry=await page.evaluate(()=>{
  const a=window.__coverhit,c=a.cloth,uv=c.geometry.attributes.uv.array,ends=[[],[]];
  for(let y=0;y<=c.rows;y++)for(let x=0;x<=c.cols;x++){
   const n=c.foldAxis==='u'?x:y, count=c.foldAxis==='u'?c.cols:c.rows;
   if(n===0||n===count)ends[n===0?0:1].push(c.positions[(y*(c.cols+1)+x)*3+1]);
  }
  const mean=v=>v.reduce((s,x)=>s+x,0)/v.length;
  return {id:a.carpetEntry.id,width:c.width,height:c.height,foldAxis:c.foldAxis,drop:c.drop,span:c.span,frontBottom:mean(ends[1]),backBottom:mean(ends[0]),relativeDifference:Math.abs(mean(ends[0])-mean(ends[1]))/c.drop,finite:c.positions.every(Number.isFinite),uvRange:[Math.min(...uv),Math.max(...uv)]};
 });
 assert(geometry.finite);assert(geometry.relativeDifference<.02);
 await page.screenshot({path:`${out}/front-rest.png`});
 await page.keyboard.press('f');await page.waitForTimeout(560);
 const mid=await page.evaluate(()=>({flipping:window.__coverhit.game.flipping,remaining:window.__coverhit.game.flipRemaining,side:window.__coverhit.game.visibleSide}));
 assert(mid.flipping);const ignored=await page.evaluate(()=>{const a=window.__coverhit,before=a.game.score,dirt=a.dirt.total,result=a.hit(.5,.25,1);return {result,scoreUnchanged:a.game.score===before,dirtUnchanged:a.dirt.total===dirt};});assert(ignored.scoreUnchanged&&ignored.dirtUnchanged);
 await page.screenshot({path:`${out}/mid-flip.png`});
 await page.waitForFunction(()=>!window.__coverhit.game.flipping);await page.waitForTimeout(1500);
 assert.equal(await page.evaluate(()=>window.__coverhit.game.visibleSide),1);
 await page.screenshot({path:`${out}/after-flip.png`});
 await page.evaluate(()=>{const a=window.__coverhit;a.savedCamera={position:a.baseCamera.toArray(),target:a.lookTarget.toArray()};a.baseCamera.set(4,1.6,0);a.lookTarget.copy(a.yard.barPosition);});
 await page.waitForTimeout(300);await page.screenshot({path:`${out}/side-view-occluded.png`});
 const hiddenPosts=await page.evaluate(()=>{const a=window.__coverhit;a.hiddenPosts=[];a.yard.root.traverse(o=>{if(!o.isInstancedMesh)return;for(let i=0;i<o.count;i++){const m=o.matrix.clone();o.getMatrixAt(i,m);if(o.userData.fallbackEntries?.[i]?.role==='rack'&&Math.abs(m.elements[12])>.1){a.hiddenPosts.push({object:o,index:i,matrix:m.clone()});m.scale(a.baseCamera.clone().set(0,0,0));o.setMatrixAt(i,m);o.instanceMatrix.needsUpdate=true;}}});return a.hiddenPosts.length;});
 assert.equal(hiddenPosts,8);
 await page.waitForTimeout(100);await page.screenshot({path:`${out}/side-view.png`});
 await page.evaluate(()=>{const a=window.__coverhit;for(const p of a.hiddenPosts){p.object.setMatrixAt(p.index,p.matrix);p.object.instanceMatrix.needsUpdate=true;}a.baseCamera.set(4,1.6,1.2);a.lookTarget.copy(a.yard.barPosition).add(a.baseCamera.clone().set(0,-.6,0));});
 await page.waitForTimeout(100);await page.screenshot({path:`${out}/side-oblique.png`});
 await page.evaluate(()=>{const a=window.__coverhit;a.baseCamera.fromArray(a.savedCamera.position);a.lookTarget.fromArray(a.savedCamera.target);});
 await page.locator('.ch-flip').click();await page.waitForFunction(()=>!window.__coverhit.game.flipping);await page.waitForTimeout(800);
 await page.evaluate(()=>{const a=window.__coverhit;a.strikeLog.length=0;a.inputs=[];for(const name of ['pointerdown','pointerup'])a.beater.dom.addEventListener(name,()=>a.inputs.push({name,wall:performance.now()/1000,time:a.game.time,phase:a.beater.phase}),{capture:true});});
 const target=()=>page.evaluate(()=>{const a=window.__coverhit,c=a.cloth,mesh=a.beater.carpetMeshGetter(),x=c.foldAxis==='u'?Math.floor(c.cols*.75):Math.floor(c.cols*.5),y=c.foldAxis==='u'?Math.floor(c.rows*.5):Math.floor(c.rows*.75),v=a.beater.headCenter.clone().fromArray(c.positions,(y*(c.cols+1)+x)*3);mesh.localToWorld(v);v.project(a.camera);return {x:(v.x+1)*640,y:(1-v.y)*450};});
 await page.evaluate(()=>{window.__coverhit.game.nextMoth=Infinity;});
 for(let i=0;i<12;i++){const point=await target();await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(400);await page.mouse.up();await page.waitForTimeout(250);}
 const combo=await page.evaluate(()=>({impacts:window.__coverhit.strikeLog,inputs:window.__coverhit.inputs,multiplier:window.__coverhit.game.comboMultiplier,frameMs:window.__coverhit.performance.frameMs}));
 assert.equal(combo.impacts.filter(e=>!e.miss).length,12);assert(combo.multiplier>=3);
 const metrics=[];
 for(const id of ['09','03','01','06','02','04','07','05','08','10']) {
  await page.evaluate(async id=>{const a=window.__coverhit;await a.setCarpet(id);a.cloth.wind=0;},id);await page.waitForTimeout(1000);
  metrics.push(await page.evaluate(()=>{const a=window.__coverhit,c=a.cloth;let spawned;const off=a.game.on('mothSpawn',event=>spawned=event);a.game.nextMoth=a.game.time+.01;a.game.update(.02);off();return {id:a.carpetEntry.id,aspect:a.carpetEntry.aspect,physicalAspect:c.width/c.height,foldAxis:c.foldAxis,drop:c.drop,span:c.span,finite:c.positions.every(Number.isFinite),mothOnVisibleHalf:!!spawned&&a.dirt.isOnSide(spawned.u,spawned.v,a.game.visibleSide)};}));
 }
 assert(metrics.every(c=>c.finite&&c.mothOnVisibleHalf&&Math.abs(c.physicalAspect/c.aspect-1)<.005&&c.foldAxis===(c.aspect>1?'u':'v')&&c.drop>=1.1&&c.drop<=1.75));assert.equal(errors.length,0);
 await page.evaluate(async()=>{const a=window.__coverhit;await a.setCarpet('09');a.game.prepareCarpet();});
 const cleaning=[];
 for(let side=0;side<2;side++){
  cleaning.push(await page.evaluate(()=>{const a=window.__coverhit;let seed=42,hits=0;const r=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);while(a.game.state==='playing'&&!a.game.flipping&&hits<400){let u=r(),v=r();if(a.cloth.foldAxis==='u')u=a.game.visibleSide===0?.5+u*.5:u*.5;else v=(v+a.game.visibleSide)/2;a.hit(u,v,.75);hits++;}return {hits,state:a.game.state,flipping:a.game.flipping,halves:[a.dirt.halfCleanliness(0),a.dirt.halfCleanliness(1)]};}));
  await page.waitForFunction(()=>!window.__coverhit.game.flipping);
 }
 assert(cleaning[0].flipping&&cleaning[0].state==='playing');assert.equal(cleaning[1].state,'carpetDone');
 await writeFile(`${out}/browser.json`,JSON.stringify({geometry,mid,ignored,sideCamera:[4,1.6,0],hiddenPosts,combo,metrics,cleaning,errors},null,2));
 console.log(JSON.stringify({geometry,mid,combo:combo.impacts.map(e=>({interval:e.interval,multiplier:e.multiplier})),metrics,errors},null,2));
} finally {await browser.close();}
