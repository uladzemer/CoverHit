import {chromium} from '../../../scripts/qa-browser.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {exposureMetrics,assertExposure} from '../../../scripts/verify-yard-exposure.mjs';
const out='docs/qa/natural';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const baseline=process.argv.includes('--baseline');const report={browser:browser.version(),viewport:[1440,900],seed:'colour-1986',modes:{}};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/i.test(m.text()))errors.push(m.text());});
 await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));await page.route('**/carpets/manifest.local.json',r=>r.fulfill({status:404,body:''}));
 await page.goto((process.env.NATURAL_URL||'http://127.0.0.1:5187')+'/?seed=colour-1986');await page.waitForFunction(()=>window.__coverhit,null,{timeout:90000});
 await page.evaluate(async()=>{const a=window.__coverhit;a.start();a.setQuality('high');await a.setCarpet('09');});await page.waitForTimeout(2500);
 const original=await page.evaluate(()=>{const a=window.__coverhit;return {camera:a.baseCamera.toArray(),target:a.lookTarget.toArray(),fov:a.camera.fov};});
 for(const mode of baseline?['baseline']:['photo','procedural','photo-restored']){
  if(!baseline)await page.evaluate(mode=>window.__coverhit.setFacades(mode==='procedural'?mode:'photo'),mode);await page.waitForTimeout(1500);
  const views={};
  for(const view of (mode==='photo'||mode==='baseline')?['default','aim-left','aim-right','wide','facade-close','facade-mid','facade-far','car-side','car-front','car-three-quarter']:['default']){
   await page.evaluate(async({original,view})=>{const a=window.__coverhit,T=await import('/node_modules/three/build/three.module.js');a.baseCamera.fromArray(original.camera);a.lookTarget.fromArray(original.target);a.camera.fov=original.fov;if(view==='wide')a.camera.fov=75;if(view==='car-three-quarter'){a.baseCamera.set(14.8,1.8,-14.5);a.lookTarget.set(12,.7,-19);}if(view==='car-side'){a.baseCamera.set(12,1,-12);a.lookTarget.set(12,.7,-19);}if(view==='car-front'){a.baseCamera.set(18,1,-19);a.lookTarget.set(12,.7,-19);}if(view==='facade-mid'){a.baseCamera.set(24,4,-5);a.lookTarget.set(31,7,-24);}if(view==='facade-far'){a.baseCamera.set(24,5,8);a.lookTarget.set(31,7,-24);}if(view==='facade-close'){a.baseCamera.set(24,3,-14);a.lookTarget.set(31,7,-24);}if(view.startsWith('aim')){const v=a.lookTarget.clone().sub(a.baseCamera).applyAxisAngle(new T.Vector3(0,1,0),(view==='aim-left'?35:-35)*Math.PI/180);a.lookTarget.copy(a.baseCamera).add(v);}a.camera.updateProjectionMatrix();},{original,view});
   await page.waitForTimeout(1000);
   const perf=await page.evaluate(()=>new Promise(resolve=>{const samples=[];function tick(){samples.push({...window.__coverhit.performance});if(samples.length<240)requestAnimationFrame(tick);else{const stats=k=>{const v=samples.map(s=>s[k]).filter(Number.isFinite).sort((a,b)=>a-b);return {mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};resolve(Object.fromEntries(['drawCalls','triangles','frameMs','renderMs','gpuMs','intervalMs'].map(k=>[k,stats(k)])));}}requestAnimationFrame(tick);}));
   const url=await page.evaluate(()=>{const a=window.__coverhit;a.renderPipeline.render(0);return a.renderer.domElement.toDataURL('image/png');});const buffer=Buffer.from(url.split(',')[1],'base64');await writeFile(`${out}/${mode}-${view}.png`,buffer);
   views[view]={performance:perf,exposure:await exposureMetrics(buffer)};
  }
  report.modes[mode]=views;
 }
 report.errors=errors;
 report.facades=await page.evaluate(()=>{const a=window.__coverhit,materials=new Set();a.yard.root.traverse(o=>{if(o.material?.userData.photoSeries)materials.add(o.material);});return [...materials].map(m=>({series:m.userData.photoSeries,loaded:m.userData.photoLoaded,mode:m.userData.facadeMode,anisotropy:m.map?.anisotropy}));});
 report.photoTextures=await page.evaluate(()=>{const textures=new Set();window.__coverhit.yard.root.traverse(o=>{for(const m of [o.material].flat())for(const t of [m?.map,m?.normalMap,m?.emissiveMap])if(t?.image?.src?.includes('/yard/photos/'))textures.add(t);});return [...textures].map(t=>({file:t.image.src.split('/').at(-1),width:t.image.width,height:t.image.height,rgbaMipBytes:t.image.width*t.image.height*4*4/3}));});
 if(!baseline){
  report.quality={};
  for(const mode of ['photo','procedural'])for(const level of ['high','medium','low']){
   await page.evaluate(({mode,level})=>{const a=window.__coverhit;a.setFacades(mode);a.setQuality(level);},{mode,level});await page.waitForTimeout(1600);
   report.quality[`${mode}-${level}`]=await page.evaluate(()=>({...window.__coverhit.performance}));
  }
  await page.evaluate(()=>{const a=window.__coverhit;a.hud.openMenu(true);a.hud.modal.go(2,false);});
  await page.locator('[data-setting-facades]').selectOption('procedural');
  if(await page.evaluate(()=>window.__coverhit.facades)!=='procedural')throw Error('Settings facade selector');
  await page.reload();await page.waitForFunction(()=>window.__coverhit,null,{timeout:90000});
  report.persisted=await page.evaluate(()=>window.__coverhit.facades);if(report.persisted!=='procedural')throw Error('Facade persistence');
  await page.route('**/yard/photos/**',r=>r.fulfill({status:404,body:''}));await page.evaluate(()=>window.__coverhit.setFacades('photo'));
  await page.reload();await page.waitForFunction(()=>window.__coverhit,null,{timeout:90000});
  await page.evaluate(()=>{const a=window.__coverhit;a.start();a.setQuality('high');});await page.waitForTimeout(1500);
  report.missing=await page.evaluate(()=>{const a=window.__coverhit,materials=new Set(),windows=[];a.yard.root.traverse(o=>{if(o.material?.userData.photoSeries)materials.add(o.material);if(o.userData.facadeWindows)windows.push(o.visible);});return {photographs:[...materials].map(m=>!!m.userData.photoLoaded),windowsVisible:windows.every(Boolean),performance:{...a.performance}};});
  if(report.missing.photographs.some(Boolean)||!report.missing.windowsVisible)throw Error('Missing photo fallback');
  const previous=JSON.parse(await readFile(`${out}/baseline.json`)).modes.baseline.default.performance;
  report.drawCallDelta=report.modes.photo.default.performance.drawCalls.max-previous.drawCalls.max;
  if(report.drawCallDelta>5)throw Error('Draw regression exceeds five calls');
  report.delta=Object.fromEntries(['frameMs','renderMs','gpuMs'].map(k=>[k,(report.modes.photo.default.performance[k].mean+report.modes['photo-restored'].default.performance[k].mean)/2-previous[k].mean]));
 }
 await writeFile(`${out}/${baseline?'baseline':'performance'}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));if(errors.length)throw Error(errors.join('\n'));
 if(!baseline){const ref=JSON.parse(await readFile('docs/qa/exposure/reference.json'));assertExposure(report.modes.photo.default.exposure,ref.metrics);for(const m of Object.values(report.modes))for(const v of Object.values(m))if(v.performance.drawCalls.max>150)throw Error('Draw budget');for(const q of Object.values(report.quality))if(q.drawCalls>150)throw Error('Quality draw budget');if(report.missing.performance.drawCalls>150)throw Error('Fallback draw budget');if(report.delta.frameMs>.5||report.delta.gpuMs>.5)throw Error('Frame regression exceeds 0.5ms');}
}finally{await browser.close();}


