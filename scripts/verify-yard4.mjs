import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from './qa-browser.mjs';

const out='docs/qa/yard4';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const url=process.env.YARD_URL||'http://127.0.0.1:5173';
const sample=page=>page.evaluate(()=>new Promise(resolve=>{
 const samples=[],a=window.__coverhit;
 function frame(){samples.push({...a.performance});if(samples.length<120)requestAnimationFrame(frame);else{
  const stats=key=>{const v=samples.map(s=>s[key]).sort((a,b)=>a-b);return{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};
  const gl=a.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  resolve({drawCalls:stats('drawCalls'),triangles:stats('triangles'),cpuFrameMs:stats('frameMs'),physicsMs:stats('physicsMs'),renderSubmitMs:stats('renderMs'),frameIntervalMs:stats('intervalMs'),gpu:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)});
 }}requestAnimationFrame(frame);
}));
// Bounds and projected silhouette are measured from actual rendered cloth nodes.
const framing=page=>page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js'),a=window.__coverhit,c=a.cloth,mesh=a.beater.carpetMeshGetter();
 let minY=Infinity,maxY=-Infinity,ground=Infinity;
 for(let i=0;i<c.positions.length;i+=3){const p=new THREE.Vector3().fromArray(c.positions,i);mesh.localToWorld(p);ground=Math.min(ground,p.y);p.project(a.camera);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
 // Rays along the complete horizontal skyline must hit housing, at the default
 // eye level and 40 cm above it. This catches facade gaps independently of sky/fog.
 const boxes=a.yard.housing.map(h=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(h.width,h.height,h.depth));mesh.position.set(h.x,h.height/2,h.z);mesh.rotation.y=h.angle;mesh.updateMatrixWorld();return mesh;});
 const holes=[];for(const height of [a.baseCamera.y,a.baseCamera.y+.4])for(let deg=0;deg<360;deg+=.5){const angle=deg*Math.PI/180,ray=new THREE.Raycaster(new THREE.Vector3(a.baseCamera.x,height,a.baseCamera.z),new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)));if(!ray.intersectObjects(boxes).length)holes.push({height,deg});}
 boxes.forEach(m=>{m.geometry.dispose();m.material.dispose();});
 return{camera:a.baseCamera.toArray(),target:a.lookTarget.toArray(),carpetFrameFraction:(maxY-minY)/2,lowerEdgeMetres:ground,housing:a.yard.housing,skylineHoles:holes};
});
// WCAG sRGB luminance, compositing translucent backing over worst-case white.
const contrast=page=>page.evaluate(()=>{
 const parse=value=>(value.match(/[\d.]+/g)||[]).map(Number),luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 return ['.ch-score span','.ch-score strong','.ch-clock span','.ch-clock strong','.ch-clean label','.ch-records','.ch-type','.ch-carpet-title','.ch-mute','.ch-reticle-size','.ch-flip','.ch-combo','.ch-poster h1','.ch-poster p','.ch-poster button','.ch-selector strong','.ch-selector small','.ch-credits summary','.ch-credits a','.ch-toast','.ch-toast button','.ch-moth-popup'].flatMap(selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).map(el=>{
  const layers=[];for(let p=el;p;p=p.parentElement){const style=getComputedStyle(p);let color=parse(style.backgroundColor);
   // The opaque paper's lightest/darkest gradient stop is cream. Dark text
   // is checked against its darker stop, cream (#f3e6c8), conservatively.
   if(p.classList.contains('ch-poster'))color=[243,230,200,1];layers.push(color);
  }
  let bg=[255,255,255];for(const color of layers.reverse()){const alpha=color[3]??1;bg=bg.map((v,i)=>(color[i]??0)*alpha+v*(1-alpha));}
  const fg=parse(getComputedStyle(el).color),l1=luminance(fg),l2=luminance(bg);return{selector,text:el.textContent.trim().slice(0,60),ratio:(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
 }));
});
const report={viewport:[1468,986],browser:browser.version(),modes:{},errors:[]};
try{
 for(const mode of ['stock','procedural','no-assets']){
  const page=await browser.newPage({viewport:{width:1468,height:986}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(mode==='procedural')await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
  if(mode==='no-assets')await page.route('**/yard/**',r=>new URL(r.request().url()).pathname.startsWith('/yard/')?r.fulfill({status:404,body:''}):r.continue());
  await page.goto(url);await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  const states={},views={};
  await page.screenshot({path:`${out}/${mode}-menu.png`});states.menu=await contrast(page);
  if(mode==='stock'){
   await page.locator('.ch-credits summary').click();await page.screenshot({path:`${out}/stock-credits.png`});states.credits=await contrast(page);await page.locator('.ch-credits summary').click();
  }
  await page.evaluate(()=>window.__coverhit.start());await page.waitForTimeout(1200);
  for(const [name,x]of [['default',734],['left-most',1],['right-most',1467]]){
   await page.mouse.move(x,493);await page.waitForTimeout(100);await page.screenshot({path:`${out}/${mode}-${name}.png`});views[name]=await sample(page);
  }
  const frame=await framing(page);states.playing=await contrast(page);
  await page.evaluate(()=>window.__coverhit.baseCamera.y+=.4);await page.waitForTimeout(100);
  await page.screenshot({path:`${out}/${mode}-raised.png`});
  await page.evaluate(()=>window.__coverhit.baseCamera.y-=.4);
  assert.equal(frame.skylineHoles.length,0,`${mode}: open skyline ${JSON.stringify(frame.skylineHoles.slice(0,10))}`);
  assert(frame.lowerEdgeMetres>=.25,`${mode}: carpet touches ground`);
  assert(frame.carpetFrameFraction>=.45&&frame.carpetFrameFraction<=.55,`${mode}: framing ${frame.carpetFrameFraction}`);
  for(const view of Object.values(views))assert(view.drawCalls.max<=130,`${mode}: draw calls ${view.drawCalls.max}`);
  if(mode==='stock'){
   await page.evaluate(()=>{const g=window.__coverhit.game;g.remainingSeconds=5;g.emit('timer',5);g.emit('neighborWarning',{count:1});g.emit('mothCaught',{id:'qa-moth'});});
   await page.screenshot({path:`${out}/stock-toast.png`});states.toast=await contrast(page);
   await page.evaluate(async()=>{const {Hud}=await import('/src/ui/hud.js');const toast=document.querySelector('[data-toast]');Hud.prototype.toast.call({nodes:{toast},timeouts:new Set(),flash:Hud.prototype.flash},'Не удалось загрузить ковёр. Повторите попытку.',async()=>{});});
   await page.screenshot({path:`${out}/stock-retry-toast.png`});states.retry=await contrast(page);
   await page.evaluate(()=>{document.querySelector('[data-toast]').hidden=true;document.querySelector('[data-popup]').hidden=true;const g=window.__coverhit.game;g.remainingSeconds=40;g.carpets=1;g.setState('carpetDone');});
   await page.screenshot({path:`${out}/stock-carpet-done.png`});states.carpetDone=await contrast(page);
   await page.evaluate(()=>window.__coverhit.game.setState('gameOver'));
   await page.screenshot({path:`${out}/stock-game-over.png`});states.gameOver=await contrast(page);
   await page.evaluate(()=>window.__coverhit.game.setState('playing'));
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:`${out}/stock-mobile-playing.png`});states.mobile=await contrast(page);
  }
  const failures=Object.entries(states).flatMap(([state,rows])=>rows.filter(r=>r.ratio<4.5).map(r=>({state,...r})));
  const status=await page.evaluate(()=>({stock:window.__coverhit.yard.stockStatus,assets:window.__coverhit.yard.assetStatus}));
  report.modes[mode]={views,framing:frame,contrast:states,contrastFailures:failures,status,errors};report.errors.push(...errors);
  await writeFile(`${out}/performance.json`,JSON.stringify(report,null,2)+'\n');
  assert.equal(failures.length,0,JSON.stringify(failures));assert.equal(errors.length,0,JSON.stringify(errors));
  await page.close();
 }
 console.log(JSON.stringify(Object.fromEntries(Object.entries(report.modes).map(([mode,r])=>[mode,{performance:r.views.default,framing:r.framing.carpetFrameFraction,clearance:r.framing.lowerEdgeMetres,contrastFailures:r.contrastFailures}])),null,2));
}finally{await browser.close();}
