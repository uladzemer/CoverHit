import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from './qa-browser.mjs';
const out='docs/qa/layout',baseline=process.argv.includes('--baseline');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={browser:browser.version(),modes:{}};
try{
 for(const mode of ['stock','procedural','no-assets']){
  const page=await browser.newPage({viewport:{width:1468,height:986}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
  if(mode==='procedural')await page.route('**/yard/stock/**',r=>r.fulfill({status:404,body:''}));
  if(mode==='no-assets')await page.route('**/yard/**',r=>new URL(r.request().url()).pathname.startsWith('/yard/')?r.fulfill({status:404,body:''}):r.continue());
  await page.goto(process.env.YARD_URL||'http://127.0.0.1:5178');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
  await page.evaluate(()=>window.__coverhit.start());await page.waitForTimeout(1500);
  const original=await page.evaluate(()=>window.__coverhit.lookTarget.toArray()),views={};
  for(const [view,yaw]of [['default',0],['aim-left',-35],['aim-right',35]]){
   // Production pointer aim does not turn the camera. Rotate the shared look target
   // for explicit far-left/right inspection, preserving eye position and pitch.
   await page.evaluate(({original,yaw})=>{const a=window.__coverhit,t=a.lookTarget.clone().fromArray(original),v=t.sub(a.baseCamera);v.applyAxisAngle(v.clone().set(0,1,0),-yaw*Math.PI/180);a.lookTarget.copy(a.baseCamera).add(v);},{original,yaw});
   await page.waitForTimeout(250);
   // Capture after sampling so first-frame shader compilation has settled.
   const perf=await page.evaluate(()=>new Promise(resolve=>{const a=window.__coverhit,samples=[];function tick(){samples.push({...a.performance});if(samples.length<120)requestAnimationFrame(tick);else{const stats=k=>{const v=samples.map(s=>s[k]).sort((a,b)=>a-b);return{mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};resolve(Object.fromEntries(['drawCalls','triangles','frameMs','renderMs','intervalMs'].map(k=>[k,stats(k)])));}}requestAnimationFrame(tick);}));
   const coverage=await page.evaluate(async()=>{const {sampleBackdropCoverage}=await import('/src/scene/yard/coverage.js');const a=window.__coverhit;return sampleBackdropCoverage(a.yard,a.camera);});
   assert.equal(coverage.failures.length,0,`${mode}/${view}: coverage gaps`);
   // Read a completed WebGL frame before its drawing buffer is discarded.
   // Pin those pixels for the browser compositor screenshot, preserving the HUD.
   await page.evaluate(async()=>{
    const a=window.__coverhit,canvas=a.renderer.domElement;
    a.renderPipeline.render(1/60);a.renderer.getContext().finish();
    const check=document.createElement('canvas');check.width=check.height=16;const checkCtx=check.getContext('2d');checkCtx.drawImage(canvas,0,0,16,16);const pixels=checkCtx.getImageData(0,0,16,16).data;
    if(Math.max(...pixels.filter((_,i)=>i%4!==3))<50)throw Error('Blank postprocessed courtyard frame');
    const snapshot=document.createElement('img');snapshot.id='qa-frame';snapshot.src=canvas.toDataURL('image/png');
    Object.assign(snapshot.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'0',pointerEvents:'none'});
    await snapshot.decode();canvas.style.visibility='hidden';document.body.appendChild(snapshot);
   });
   await page.screenshot({path:`${out}/${baseline?'before-':''}${mode}-${view}.png`});
   await page.evaluate(()=>{document.getElementById('qa-frame').remove();window.__coverhit.renderer.domElement.style.visibility='';});
   views[view]={yaw,perf,coverage,quality:await page.evaluate(()=>window.__coverhit.quality)};
  }
  if(!baseline){
   // One direct orthographic render, saved before the production RAF restores
   // its perspective camera. This does not modify gameplay camera code.
   const plan=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js'),a=window.__coverhit;
    const camera=new THREE.OrthographicCamera(-58,58,39,-39,.1,600);
    camera.position.set(18,120,-23);camera.up.set(0,0,-1);camera.lookAt(18,0,-23);camera.updateMatrixWorld();
    const canvas=a.renderer.domElement;a.renderer.setRenderTarget(null);a.renderer.clear();a.renderer.render(a.yard.scene,camera);
    // Add a small plan key and world-position labels on the captured pixels.
    const image=document.createElement('canvas');image.width=canvas.width;image.height=canvas.height;
    const ctx=image.getContext('2d');ctx.drawImage(canvas,0,0);const scale=image.width/1468;
    ctx.scale(scale,scale);ctx.font='bold 17px sans-serif';
    const label=(text,x,z)=>{const p=new THREE.Vector3(x,0,z).project(camera),px=(p.x+1)*734,py=(1-p.y)*493;ctx.fillStyle='rgba(20,24,20,.85)';ctx.fillRect(px-5,py-19,ctx.measureText(text).width+10,25);ctx.fillStyle='#fff5db';ctx.fillText(text,px,py);};
    label('Rack / 6 x 5 m service pad',0,5);label('Slabs + worn access path',7,-6);label('Sandbox / steel playground',-23,-5);label('3.8 m driveway along facade',17,-17);label('Sidewalk + entrance aprons',23,-23);label('Separate refuse pad',-9,-30);label('Driveway exit',60,-48);label('Garages + apron',-29,-38);
    ctx.fillStyle='rgba(20,24,20,.85)';ctx.fillRect(16,16,720,70);ctx.fillStyle='#fff5db';ctx.font='bold 23px sans-serif';ctx.fillText('CoverHit / courtyard orthographic plan',30,46);ctx.font='16px sans-serif';ctx.fillText('Rack fixed at (0, 0)  |  top = rear of courtyard  |  scene units = metres',30,72);
    return image.toDataURL('image/png').split(',')[1];
   });
   await writeFile(`${out}/${mode}-plan.png`,Buffer.from(plan,'base64'));
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  report.modes[mode]={views,errors,assets:await page.evaluate(()=>({surfaces:window.__coverhit.yard.assetStatus,stock:window.__coverhit.yard.stockStatus}))};
  console.log(mode,JSON.stringify(views.default.perf));await page.close();
 }
 await writeFile(`${out}/${baseline?'baseline':'performance'}.json`,JSON.stringify(report,null,2)+'\n');
 if(!baseline){const before=JSON.parse(await readFile(`${out}/baseline.json`,'utf8'));for(const [mode,data]of Object.entries(report.modes))for(const [view,{perf}]of Object.entries(data.views))for(const k of ['drawCalls','triangles']){const old=before.modes[mode].views[view].perf[k].max;assert(perf[k].max<=old*1.05,`${mode}/${view}/${k}: ${perf[k].max} > ${old} + 5%`);}}

}finally{await browser.close();}

