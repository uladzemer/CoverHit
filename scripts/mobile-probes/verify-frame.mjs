import {chromium,webkit,devices} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const phase=process.argv.includes('--before')?'before':'after';
const out='docs/qa/mobile-frame';await mkdir(out,{recursive:true});
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
   const transition=await page.evaluate(async id=>{const a=window.__coverhit,pose=()=>[...a.baseCamera.toArray(),...a.lookTarget.toArray(),a.camera.fov],before=pose();if(id==='runner')await a.setCarpetType(id);else await a.setCarpet(id);const immediate=pose();a.cloth.step=()=>{};const render=a.renderPipeline.render;a.renderPipeline.render=()=>{};for(let i=0;i<100;i++)window.qaFrame(window.qaTime+=34);a.renderPipeline.render=render;a.camera.position.copy(a.baseCamera);a.camera.lookAt(a.lookTarget);a.camera.updateMatrixWorld();a.beater.update(0);a.scene.updateMatrixWorld(true);for(let i=0;i<3;i++)a.renderPipeline.render(0);return {immediateDelta:Math.max(...before.map((v,i)=>Math.abs(v-immediate[i])))};},id);
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
    return {id:a.carpetEntry.id,span:a.cloth.span,drop:a.cloth.drop,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top,centre:(bounds.top+bounds.bottom)/2,bounds,post,zones,overlaps,fringeReserve:fringe,fov:a.camera.fov,distance:a.baseCamera.z,eye:a.baseCamera.y};
   });
   Object.assign(row,{device,engine,landscape,viewport,requested:id,transition});
   if(phase==='after') {assert(row.post.every(p=>p.x>0&&p.x<1),'Posts clipped');assert(row.bounds.top>0&&row.bounds.bottom<1,'Carpet clipped');if(device!=='desktop'){assert(transition.immediateDelta===0,'Camera jumps on replacement');assert.equal(row.overlaps.length,0,JSON.stringify(row.overlaps));}}
   const path=`${out}/${phase}-${device.replaceAll(' ','-')}-${landscape?'landscape':'portrait'}-${id}.png`;
   // WebKit's fixed output buffer needs browser presentation opportunities;
   // repeated synchronous draws can otherwise capture the previous rug.
   await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>requestAnimationFrame(()=>{window.__coverhit.renderPipeline.render(0);resolve();}));});
   await page.waitForTimeout(100);
   await page.screenshot({path,scale:'css'});
   if(phase==='after'&&device==='desktop') {const a=await sharp(path).removeAlpha().raw().toBuffer(),b=await sharp(path.replace('/after-','/before-')).removeAlpha().raw().toBuffer();let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);row.desktopMeanChannelDelta=sum/a.length;assert(row.desktopMeanChannelDelta<.5);}
   rows.push(row);console.log(device,landscape?'landscape':'portrait',id,JSON.stringify({width:row.width,height:row.height,centre:row.centre,fov:row.fov,distance:row.distance,diff:row.desktopMeanChannelDelta}));
  }
  if(phase==='after'&&device!=='desktop') {
   const before=await page.evaluate(()=>{const a=window.__coverhit;return [...a.baseCamera.toArray(),...a.lookTarget.toArray(),...a.camera.position.toArray(),...a.camera.quaternion.toArray(),a.camera.fov];});
   await page.setViewportSize({width:viewport.height,height:viewport.width});
   await page.evaluate(()=>window.dispatchEvent(new Event('orientationchange')));
   const orientation=await page.evaluate(before=>{const a=window.__coverhit,pose=[...a.baseCamera.toArray(),...a.lookTarget.toArray(),...a.camera.position.toArray(),...a.camera.quaternion.toArray(),a.camera.fov],r=a.renderer.domElement.getBoundingClientRect();return {immediateDelta:Math.max(...pose.map((v,i)=>Math.abs(v-before[i]))),aspectError:Math.abs(a.camera.aspect-r.width/r.height)};},before);
   assert.equal(orientation.immediateDelta,0);assert(orientation.aspectError<1e-6);rows.at(-1).orientation=orientation;
  }
  await context.close();
 }
 }finally {await browser.close();}
}
await writeFile(`${out}/${phase}${desktopOnly?'-desktop':''}.json`,JSON.stringify({rows,errors},null,2)+'\n');assert.deepEqual(errors,[]);
