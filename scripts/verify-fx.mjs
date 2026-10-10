import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
const out='docs/qa/fx';await mkdir(out,{recursive:true});
// A fresh server matters: the project's watcher intentionally ignores .claude worktrees.
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const url=process.env.FX_URL || `http://127.0.0.1:${port}/`;
const server=process.env.FX_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:'ignore'});
if(server) {
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(url);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready){server.kill();throw Error('FX QA server did not start');}
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],report={errors};
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(()=>window.__coverhit.start());await page.waitForTimeout(1200);
 report.integrated={};
 for(const quality of ['high','medium','low']) {
  report.integrated[quality]={};
  for(const mode of ['fx-hidden','fx-visible']) {
  await page.evaluate(q=>{const a=window.__coverhit;a.setQuality(q);a.dust.emit({x:0,y:1.3,z:.08},{x:0,y:0,z:1},.025);},quality);
  await page.evaluate(mode=>{const a=window.__coverhit;a.dust.points.visible=mode==='fx-visible';a.scene.getObjectByName('moth-scales').visible=mode==='fx-visible';},mode);
  await page.waitForTimeout(2000);
  report.integrated[quality][mode]=await page.evaluate(()=>new Promise(resolve=>{
   const samples=[];function next(){samples.push({...window.__coverhit.performance});if(samples.length<180)requestAnimationFrame(next);else{
    const stats=key=>{const a=samples.map(s=>s[key]).filter(Number.isFinite).sort((a,b)=>a-b);return a.length?{mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.floor(a.length*.95)]}:null;};
    resolve(Object.fromEntries(['drawCalls','triangles','frameMs','gpuMs','physicsMs'].map(k=>[k,stats(k)])));
   }}requestAnimationFrame(next);
  }));
  }
 }
 // Freeze the game's loop, then render an isolated, reproducible golden-hour FX fixture.
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(100);
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {DustSystem}=await import('/src/fx/dust.js'),{MothSystem}=await import('/src/fx/moths.js');
  const {seededRandom}=await import('/src/fx/mothFlight.js');
  document.body.innerHTML='';const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1280,900);renderer.setPixelRatio(1);renderer.setClearColor('#665853');document.body.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1280/900,.01,100);camera.position.set(0,1.65,3.2);camera.lookAt(0,1.25,0);
  const sun=new THREE.DirectionalLight('#ffcf9c',2);sun.position.set(-1,1,-4);scene.add(sun,sun.target,new THREE.HemisphereLight('#ccdce6','#5d564c',1.5));
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#706960',roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
  const carpet=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.7),new THREE.MeshStandardMaterial({color:'#803c29',side:THREE.DoubleSide,roughness:1}));carpet.name='carpet';carpet.position.y=1.25;scene.add(carpet);
  const dust=new DustSystem(scene,{random:seededRandom(111)}),moths=new MothSystem(scene);
  window.fxQA={THREE,renderer,scene,camera,dust,moths};
 });
 await page.waitForTimeout(300);
 await page.evaluate(()=>{const a=window.fxQA;a.dust.emit({x:0,y:1.3,z:.04},{x:0,y:0,z:1},.025);});
 let t=0;
 for(const time of [.1,.5,1.5,3]) {
  await page.evaluate(dt=>{const a=window.fxQA;a.dust.update(dt);a.renderer.render(a.scene,a.camera);},time-t);t=time;
  await page.screenshot({path:`${out}/impact-${time}.png`});
 }
 report.dust=await page.evaluate(()=>{
  const a=window.fxQA;a.dust.update(20);
  for(let i=0;i<100;i++)a.dust.emit({x:0,y:1.3,z:.04},{x:0,y:0,z:1},.08);
  const live=a.dust.liveCount,n=10000,t=performance.now();for(let i=0;i<n;i++)a.dust.update(1/60000);
  const cpuMs=(performance.now()-t)/n;a.renderer.info.reset();a.renderer.render(a.scene,a.camera);
  const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {live,capacity:a.dust.capacity,updateMeanMs:cpuMs,fixtureDraws:a.renderer.info.render.calls,fixtureTriangles:a.renderer.info.render.triangles,gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
 });
 await page.evaluate(()=>{const a=window.fxQA;a.dust.update(20);a.moths.spawn({id:13},new a.THREE.Vector3(0,1.3,.2));a.moths.update(.1);const m=a.moths.moths.get(13);a.camera.position.copy(m.group.position).add(new a.THREE.Vector3(.03,.045,.17));a.camera.lookAt(m.group.position);a.renderer.render(a.scene,a.camera);});
 await page.screenshot({path:`${out}/moth-closeup.png`});
 report.moths=await page.evaluate(()=>{const a=window.fxQA;for(let id=0;id<30;id++)a.moths.spawn({id},new a.THREE.Vector3(0,1.3,.2));let max=0,total=0;for(let i=0;i<600;i++){const start=performance.now();a.moths.update(1/60);const ms=performance.now()-start;max=Math.max(max,ms);total+=ms;}return {count:a.moths.moths.size,updateMeanMs:total/600,updateMaxMs:max,wingTriangles:a.moths.wingGeometry.index.count/3,bodyTriangles:a.moths.bodyGeometry.index.count/3};});
 assert(report.dust.live<=3000);assert(report.dust.updateMeanMs<.8);assert.equal(errors.length,0);
} finally {await writeFile(`${out}/performance.json`,JSON.stringify(report,null,2));await browser.close();server?.kill();}
console.log(JSON.stringify(report,null,2));

