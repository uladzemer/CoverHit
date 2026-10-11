import {chromium,webkit,devices} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
// The aim probe advances synthetic frame time faster than wall time. Disable
// the visual hit-stop during that probe so it cannot read the previous strike.
if(process.argv.includes('--touch-aim')) {
  devices['iPhone 14 Pro'].reducedMotion='reduce';devices['Pixel 7'].reducedMotion='reduce';
  process.env.AIM_OUT ||= 'docs/qa/mobile-frame2/touch-aim';
  await import('../verify-touch-aim.mjs');process.exit(0);
}
const phase=process.argv.includes('--before')?'before':'after';
const out='docs/qa/mobile-frame2';await mkdir(out,{recursive:true});
const rows=[],errors=[],desktopOnly=process.argv.includes('--desktop');
for(const engine of desktopOnly?['chromium']:['webkit','chromium']) {
 const browser=await (engine==='webkit'?webkit:chromium).launch(engine==='chromium'?{channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
 try {
 const cases=desktopOnly?['desktop']:engine==='webkit'?['iPhone 14 Pro','iPhone SE']:['Pixel 7'];
 for(const device of cases)for(const landscape of device==='desktop'?[false]:[false,true]) {
  const size=device==='desktop'?{width:1440,height:900}:device==='iPhone 14 Pro'?{width:393,height:852}:devices[device].viewport;
  const viewport=landscape?{width:size.height,height:size.width}:size;
  const context=await browser.newContext({...device==='desktop'?{}:devices[device],viewport,deviceScaleFactor:device==='desktop'?1:devices[device].deviceScaleFactor}),page=await context.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{if(cb.name==='frame'){window.qaFrame=cb;return 0;}return raf(cb);};});
  await page.goto(`${process.env.FRAME_URL||'http://127.0.0.1:5174/'}?${device==='desktop'?'full':'lite'}=1&seed=frame-qa`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000,polling:100});
  await page.evaluate(async()=>{const a=window.__coverhit;await a.start();a.renderPipeline.sampleFrame=()=>{};a.cloth.step=()=>{};a.game.update=()=>{};window.qaTime=1000;});
  for(const id of ['09','05','runner']) {
   const transition=await page.evaluate(async id=>{const a=window.__coverhit,pose=()=>[...a.baseCamera.toArray(),...a.lookTarget.toArray(),a.camera.fov,a.camera.view?.offsetY/a.camera.view?.fullHeight||0],before=pose();if(id==='runner')await a.setCarpetType(id);else await a.setCarpet(id);const immediate=pose();a.cloth.step=()=>{};const render=a.renderPipeline.render;a.renderPipeline.render=()=>{};for(let i=0;i<100;i++)window.qaFrame(window.qaTime+=34);a.renderPipeline.render=render;a.camera.position.copy(a.baseCamera);a.camera.lookAt(a.lookTarget);a.camera.updateMatrixWorld();a.beater.update(0);a.scene.updateMatrixWorld(true);for(let i=0;i<3;i++)a.renderPipeline.render(0);return {immediateDelta:Math.max(...before.map((v,i)=>Math.abs(v-immediate[i])))};},id);
   const row=await page.evaluate(()=>{
    const a=window.__coverhit,m=a.scene.getObjectByName('carpet'),r=a.renderer.domElement.getBoundingClientRect();m.geometry.computeBoundingBox();
    const b=m.geometry.boundingBox,p=b.min.clone(),pts=[];
    const project=(x,y,z)=>{p.set(x,y,z).applyMatrix4(m.matrixWorld).project(a.camera);return {x:(p.x+1)/2,y:(1-p.y)/2};};
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])pts.push(project(x,y,z));
    const bounds={left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))};
    const post=[];for(const x of [-a.yard.barLength/2-.08,a.yard.barLength/2+.08])for(const y of [0,a.yard.barPosition.y+.036]){p.set(x,y,0).project(a.camera);post.push({x:(p.x+1)/2,y:(1-p.y)/2});}
    const zones=[...document.querySelectorAll('.ch-zone,.ch-menu-reopen,[data-flip]')].filter(n=>n.getClientRects().length).map(n=>{const b=n.getBoundingClientRect();return {name:n.className,left:b.left/r.width,right:b.right/r.width,top:b.top/r.height,bottom:b.bottom/r.height};});
    const fringe=.08/r.height*(r.height/(2*Math.tan(a.camera.fov*Math.PI/360)*a.baseCamera.z));
    const overlaps=zones.filter(z=>z.left<bounds.right&&z.right>bounds.left&&z.top<bounds.bottom+fringe&&z.bottom>bounds.top);
    const worldRow=(x,y,z)=>{p.set(x,y,z).project(a.camera);return (1-p.y)/2;};
    const clamp=v=>Math.max(0,Math.min(1,v));
    // Rough centreline backdrop bands at the distant apartment row (62 m behind
    // the rack, 13.5 m roof); these are geometry proxies, not pixel labels.
    const roof=clamp(worldRow(0,13.5,-62)),base=clamp(worldRow(0,0,-62));
    const padTop=clamp(worldRow(0,.012,-3)),padBottom=clamp(worldRow(0,.012,2));
    const bands={sky:roof,buildings:base-roof,ground:1-base,buildingBase:base,pad:Math.max(0,padBottom-padTop),horizon:worldRow(0,a.baseCamera.y,-10000)};
    return {pitchDown:Math.atan2(a.baseCamera.y-a.lookTarget.y,a.baseCamera.z)*180/Math.PI,viewOffset:a.camera.view?.offsetY/a.camera.view?.fullHeight||0,bands,id:a.carpetEntry.id,span:a.cloth.span,drop:a.cloth.drop,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top,centre:(bounds.top+bounds.bottom)/2,bounds,post,zones,overlaps,fringeReserve:fringe,fov:a.camera.fov,distance:a.baseCamera.z,eye:a.baseCamera.y};
   });
   Object.assign(row,{device,engine,landscape,viewport,requested:id,transition});
   if(phase==='after') {if(device==='desktop')assert(row.post.every(p=>p.x>0&&p.x<1),'Posts clipped');assert(row.bounds.top>0&&row.bounds.bottom<1,'Carpet clipped');if(device!=='desktop'){assert(transition.immediateDelta===0,'Camera jumps on replacement');assert.equal(row.overlaps.length,0,JSON.stringify(row.overlaps));assert(row.eye>=1.7&&row.eye<=2);assert(row.pitchDown<=6);assert(row.centre>=(landscape?.38:.36)&&row.centre<=(landscape?.48:.42));if(landscape)assert(row.height>=.55&&row.height<=.70);else {assert(row.eye>=1.8&&row.eye<=1.95);assert(row.width>=.94&&row.width<=1.06,JSON.stringify(row));assert(row.bounds.left>=-.03&&row.bounds.right<=1.03);assert(row.bounds.bottom+row.fringeReserve<1);row.visibleWidth=(Math.min(1,row.bounds.right)-Math.max(0,row.bounds.left))/row.width;assert(row.visibleWidth>=.88);row.bottomGround=1-row.bounds.bottom-row.fringeReserve;row.groundTargetMet=row.bottomGround<=.35;}}}
   const path=`${out}/${phase}-${device.replaceAll(' ','-')}-${landscape?'landscape':'portrait'}-${id}.png`;
   // WebKit's fixed output buffer needs browser presentation opportunities;
   // repeated synchronous draws can otherwise capture the previous rug.
   await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>requestAnimationFrame(()=>{window.__coverhit.renderPipeline.render(0);resolve();}));});
   await page.waitForTimeout(100);
   await page.screenshot({path,scale:'css'});
   if(phase==='after'&&device==='desktop') {const a=await sharp(path).removeAlpha().raw().toBuffer(),b=await sharp(path.replace('/after-','/before-')).removeAlpha().raw().toBuffer();let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);row.desktopMeanChannelDelta=sum/a.length;assert(row.desktopMeanChannelDelta<.5);}
   rows.push(row);console.log(device,landscape?'landscape':'portrait',id,JSON.stringify({width:row.width,height:row.height,centre:row.centre,fov:row.fov,distance:row.distance,eye:row.eye,pitch:row.pitchDown,bands:row.bands,diff:row.desktopMeanChannelDelta}));
  }
  if(phase==='after'&&device!=='desktop') {
   const before=await page.evaluate(()=>{const a=window.__coverhit;return [...a.baseCamera.toArray(),...a.lookTarget.toArray(),...a.camera.position.toArray(),...a.camera.quaternion.toArray(),a.camera.fov,a.camera.view?.offsetY/a.camera.view?.fullHeight||0];});
   await page.setViewportSize({width:viewport.height,height:viewport.width});
   await page.evaluate(()=>window.dispatchEvent(new Event('orientationchange')));
   const orientation=await page.evaluate(before=>{const a=window.__coverhit,pose=[...a.baseCamera.toArray(),...a.lookTarget.toArray(),...a.camera.position.toArray(),...a.camera.quaternion.toArray(),a.camera.fov,a.camera.view?.offsetY/a.camera.view?.fullHeight||0],r=a.renderer.domElement.getBoundingClientRect();return {immediateDelta:Math.max(...pose.map((v,i)=>Math.abs(v-before[i]))),aspectError:Math.abs(a.camera.aspect-r.width/r.height)};},before);
   assert(orientation.immediateDelta<1e-12);assert(orientation.aspectError<1e-6);rows.at(-1).orientation=orientation;
  }
  await context.close();
 }
 }finally {await browser.close();}
}
const groundFailures=rows.filter(r=>!r.landscape&&r.device!=='desktop'&&r.groundTargetMet===false);
await writeFile(`${out}/${phase}${desktopOnly?'-desktop':''}.json`,JSON.stringify({rows,errors,groundFailures:groundFailures.map(r=>({device:r.device,carpet:r.requested,bottomGround:r.bottomGround}))},null,2)+'\n');assert.deepEqual(errors,[]);
if(groundFailures.length)console.warn(`UNMET: ${groundFailures.length} portrait cases exceed the 35% bottom-ground target; see ${out}/${phase}.json`);
// Keep the measurement report even when enforcing every requested target.
if(process.argv.includes('--strict-ground'))assert.equal(groundFailures.length,0,'Bottom-ground target unmet');
