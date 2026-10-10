import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../../scripts/qa-browser.mjs';
const out='docs/qa/photos';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={browser:browser.version(),modes:{}};
try{
 for(const mode of ['photos','fallback','missing']){
  const page=await browser.newPage({viewport:{width:1468,height:986}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
  await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
  await page.route('**/carpets/manifest.local.json',r=>r.fulfill({status:404,body:''}));
  if(mode!=='photos')await page.route('**/yard/photos/**',r=>r.fulfill({status:404,body:''}));
  if(mode==='missing')await page.route('**/yard/**',r=>new URL(r.request().url()).pathname.startsWith('/yard/')?r.fulfill({status:404,body:''}):r.continue());
  await page.goto(process.env.PHOTOS_URL||'http://127.0.0.1:5183');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  await page.evaluate(()=>{window.__coverhit.start();window.__coverhit.setQuality('high');});await page.waitForTimeout(1200);
  const loaded=await page.evaluate(()=>{const a=window.__coverhit,materials=new Set();a.yard.root.traverse(o=>{for(const m of [o.material].flat())if(m?.userData.photoReady)materials.add(m);});return [...materials].map(m=>({series:m.userData.photoSeries||'car',loaded:!!m.userData.photoLoaded}));});
  const original=await page.evaluate(()=>({target:window.__coverhit.lookTarget.toArray(),camera:window.__coverhit.baseCamera.toArray(),fov:window.__coverhit.camera.fov})),views={};
  const quality={};
  for(const level of ['high','medium','low']){
   await page.evaluate(level=>window.__coverhit.setQuality(level),level);await page.waitForTimeout(3000);
   quality[level]=await page.evaluate(()=>new Promise(resolve=>{const a=window.__coverhit,samples=[];function tick(){samples.push({...a.performance});if(samples.length<240)requestAnimationFrame(tick);else{const stats=k=>{const v=samples.map(s=>s[k]).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)}:null;};resolve(Object.fromEntries(['drawCalls','triangles','frameMs','renderMs','gpuMs','intervalMs'].map(k=>[k,stats(k)])));}}requestAnimationFrame(tick);}));
  }
  await page.evaluate(()=>window.__coverhit.setQuality('high'));await page.waitForTimeout(1000);
  for(const [view,yaw]of [['default',0],['aim-left',-35],['aim-right',35],['wide',0],['car-close',0],['facade-close',0]]){
   if(mode!=='photos'&&view!=='default')continue;
   await page.evaluate(async({original,view,yaw})=>{const a=window.__coverhit,THREE=await import('/node_modules/three/build/three.module.js');a.baseCamera.fromArray(original.camera);a.lookTarget.fromArray(original.target);a.camera.fov=original.fov;
    if(view==='wide')a.camera.fov=75;
    else if(view==='car-close'){a.baseCamera.set(14.8,1.8,-14.5);a.lookTarget.set(12,.7,-19);}
    else if(view==='facade-close'){a.baseCamera.set(24,3,-14);a.lookTarget.set(31,7,-24);}
    else{const v=a.lookTarget.clone().sub(a.baseCamera).applyAxisAngle(new THREE.Vector3(0,1,0),-yaw*Math.PI/180);a.lookTarget.copy(a.baseCamera).add(v);}
    a.camera.updateProjectionMatrix();
   },{original,view,yaw});
   await page.waitForTimeout(500);
   const perf=await page.evaluate(()=>new Promise(resolve=>{const a=window.__coverhit,samples=[];function tick(){samples.push({...a.performance});if(samples.length<120)requestAnimationFrame(tick);else{const stats=k=>{const v=samples.map(s=>s[k]).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)}:null;};resolve(Object.fromEntries(['drawCalls','triangles','frameMs','renderMs','gpuMs','intervalMs'].map(k=>[k,stats(k)])));}}requestAnimationFrame(tick);}));
   await page.evaluate(async()=>{const a=window.__coverhit,canvas=a.renderer.domElement;a.renderPipeline.render(1/60);a.renderer.getContext().finish();const img=document.createElement('img');img.id='photo-qa';img.src=canvas.toDataURL('image/png');Object.assign(img.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'0',pointerEvents:'none'});await img.decode();canvas.style.visibility='hidden';document.body.appendChild(img);});
   await page.screenshot({path:`${out}/${mode}-${view}.png`});await page.evaluate(()=>{document.getElementById('photo-qa').remove();window.__coverhit.renderer.domElement.style.visibility='';});
   views[view]=perf;
  }
  report.modes[mode]={loaded,quality,views,errors,gpu:await page.evaluate(()=>{const gl=window.__coverhit.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null;})};
  console.log(mode,JSON.stringify(views.default),JSON.stringify(errors));await page.close();
 }
 await writeFile(`${out}/performance.json`,JSON.stringify(report,null,2)+'\n');
 if(Object.values(report.modes).some(m=>m.errors.length))throw Error('Browser errors');
 if(report.modes.photos.loaded.some(m=>!m.loaded)||report.modes.fallback.loaded.some(m=>m.loaded)||report.modes.missing.loaded.some(m=>m.loaded))throw Error('Unexpected photo fallback state');
 for(const mode of Object.values(report.modes))for(const stats of Object.values(mode.quality))if(stats.drawCalls.max>150||stats.triangles.max>600000)throw Error('Geometry budget exceeded');
}finally{await browser.close();}
