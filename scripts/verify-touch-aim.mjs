import {chromium,webkit,devices} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.AIM_OUT||'docs/qa/mobile-aim';await mkdir(out,{recursive:true});
const rows=[],errors=[];
for(const engine of ['chromium','webkit']){
 const browser=await (engine==='chromium'?chromium:webkit).launch(engine==='chromium'?{channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
 try{
 for(const [width,height,dpr]of [[320,568,2],[393,852,3],[430,932,3],[844,390,2]])for(const profile of ['lite','minimal']){
 const context=await browser.newContext({...devices[engine==='webkit'?'iPhone 14 Pro':'Pixel 7'],viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{if(cb.name==='frame'){window.qaFrame=cb;return 0;}return raf(cb);};});
 await page.goto(`${process.env.AIM_URL||'http://127.0.0.1:5173/'}?${profile}=1&seed=touch-aim`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000,polling:100});
 await page.evaluate(async()=>{const a=window.__coverhit;await a.start();await a.setCarpet('05');a.renderPipeline.sampleFrame=()=>{};window.qaTime=1000;
 // Let the production camera finish its size transition before defining the
 // touch grid. Keep the real mesh fixed during this camera-only preparation.
 const step=a.cloth.step,render=a.renderPipeline.render;a.cloth.step=()=>{};a.renderPipeline.render=()=>{};
 for(let i=0;i<100;i++)window.qaFrame(window.qaTime+=34);
 a.cloth.step=step;a.renderPipeline.render=render;a.scene.updateMatrixWorld(true);window.qaHits=[];a.beater.onHit(h=>window.qaHits.push(h));});
 const cdp=engine==='chromium'?await context.newCDPSession(page):null;
 // Project the real carpet surface, then use an interior 3x3 screen grid.
 const points=await page.evaluate(()=>{const a=window.__coverhit,m=a.scene.getObjectByName('carpet'),r=a.renderer.domElement.getBoundingClientRect();m.geometry.computeBoundingBox();const b=m.geometry.boundingBox,p=b.min.clone(),corners=[];
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){p.set(x,y,b.max.z).applyMatrix4(m.matrixWorld).project(a.camera);corners.push([r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2]);}
 const minX=Math.min(...corners.map(p=>p[0])),maxX=Math.max(...corners.map(p=>p[0])),minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1]));return [.25,.5,.75].flatMap(y=>[.25,.5,.75].map(x=>({x:minX+x*(maxX-minX),y:minY+y*(maxY-minY)})));});
 const row={engine,width,height,dpr,profile,points:[]};
 for(const point of points){
 await page.evaluate(()=>{const a=window.__coverhit;a.beater.cancel();a.beater.enabled=true;});
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
 else await page.touchscreen.tap(point.x,point.y);
 if(cdp){await page.evaluate(()=>{const a=window.__coverhit;a.beater.update(.01);window.qaFrame(window.qaTime+=34);});
 await page.waitForTimeout(50);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 const result=await page.evaluate(point=>{const a=window.__coverhit,b=a.beater,r=b.dom.getBoundingClientRect(),hit=b.lockedHit;const project=p=>{const v=p.clone().project(a.camera);return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};};
 if(!hit)throw Error('Grid tap missed the carpet');
 // Production frame updates the actual mesh reticle. Use zero elapsed time;
 // the hit was already captured on release, independent of head travel.
 window.qaFrame(window.qaTime+=34);const reticle=a.scene.getObjectByName('carpet-aim-reticle');const screen=project(hit.point),centre=project(reticle.position);
 b.update(.1);b.afterPhysics(a.cloth);const dispatched=window.qaHits.at(-1);if(!dispatched)throw Error('No dispatched strike');
 const impact=project(dispatched.point),targetScreen=project(b.lockedTarget);return {tap:point,screen,centre,hitError:Math.hypot(impact.x-point.x,impact.y-point.y),reticleError:Math.hypot(centre.x-point.x,centre.y-point.y),targetScreen,targetError:Math.hypot(targetScreen.x-point.x,targetScreen.y-point.y),offset:b.touchAimOffset,aspect:a.camera.aspect,rectAspect:r.width/r.height};},point);
 row.points.push(result);assert(result.hitError<=4,JSON.stringify(result));assert(result.reticleError<=3,JSON.stringify(result));assert(result.targetError<=4,JSON.stringify(result));assert.equal(result.offset,0);assert(Math.abs(result.aspect-result.rectAspect)<1e-6);
 }
 await page.screenshot({path:`${out}/${engine}-${width}x${height}-${profile}.png`,scale:'css'});
 row.setting=await page.evaluate(()=>{const a=window.__coverhit,setting=a.hud.setting('[data-setting-touch-aim]');setting.checked=true;setting.dispatchEvent(new Event('change'));const raised={offset:a.beater.touchAimOffset,saved:localStorage.getItem('coverhit-raised-aim')};setting.checked=false;setting.dispatchEvent(new Event('change'));return {raised,disabled:a.beater.touchAimOffset,saved:localStorage.getItem('coverhit-raised-aim')};});
 assert.deepEqual(row.setting,{raised:{offset:-40,saved:'1'},disabled:0,saved:'0'});
 rows.push(row);console.log(engine,width,height,profile,'max hit',Math.max(...row.points.map(p=>p.hitError)),'max reticle',Math.max(...row.points.map(p=>p.reticleError)));
 await context.close();
 }
 }finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({rows,errors},null,2));}
}
assert.deepEqual(errors,[]);
