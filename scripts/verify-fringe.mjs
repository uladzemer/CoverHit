import {chromium} from './qa-browser.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {rectifyCarpet} from './carpet-image.mjs';
import assert from 'node:assert/strict';
const out=process.env.QA_OUT||'docs/qa/fringe';await mkdir(out,{recursive:true});
const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const audit=JSON.parse(await readFile('scripts/carpets.audit.json','utf8'));
const id='envato-RBFEDY2',entry=config.find(c=>c.id===id);
await (await rectifyCarpet((process.env.FRINGE_SOURCE_ROOT||'assets-src/carpets')+'/'+entry.source,audit[id].beforeCorners)).resize({height:2048}).webp().toFile('public/carpets/envato-RBFEDY2-qa-before.webp');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>console.log('Request failed:',r.url(),r.failure()));
 await page.route('**/carpets/envato-RBFEDY2-qa-before.webp',async route=>route.fulfill({contentType:'image/webp',body:await readFile('public/carpets/envato-RBFEDY2-qa-before.webp')}));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
 await page.goto('http://127.0.0.1:5173/?seed=fringe-qa');
 await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
 await page.evaluate(()=>window.__coverhit.start());
 await page.addStyleTag({content:'.coverhit-hud {visibility:hidden}'});
 const render=()=>page.evaluate(()=>{const a=window.__coverhit;a.renderer.render(a.yard.scene,a.camera);});
 const setup=async id=>page.evaluate(async id=>{
  const a=window.__coverhit;await a.setCarpet(id);a.game.prepareCarpet();a.beater.group.visible=false;
  a.cloth.wind=0;a.dirt.grid.fill(0);a.dirt.total=0;a.dirt.texture.needsUpdate=true;
  for(let i=0;i<60;i++)a.cloth.step(1/60);
  a.camera.position.set(.15,1.05,3.3);a.camera.lookAt(0,1.25,0);a.camera.updateMatrixWorld();
 },id);
 const metrics=[];
 for(const carpetId of [id,'03','09']) {
  await setup(carpetId);
  if(carpetId===id){
   await page.evaluate(async()=>{
    const a=window.__coverhit,mesh=a.yard.scene.getObjectByName('carpet');
    const THREE=await import('/node_modules/.vite/deps/three.js');
    a.qaMap=mesh.material.map;mesh.material.map=await new THREE.TextureLoader().loadAsync('/carpets/envato-RBFEDY2-qa-before.webp');mesh.material.map.colorSpace=THREE.SRGBColorSpace;
    mesh.scale.x=(2047/3071)/a.carpetEntry.aspect;
    mesh.getObjectByName('carpet-fringe').visible=false;
   });
   await render();await page.screenshot({path:`${out}/${id}-before-game.png`});
   await page.evaluate(()=>{const a=window.__coverhit,mesh=a.yard.scene.getObjectByName('carpet');mesh.material.map.dispose();mesh.material.map=a.qaMap;mesh.scale.x=1;mesh.getObjectByName('carpet-fringe').visible=true;});
  }
  await render();await page.screenshot({path:`${out}/${carpetId}-after-game.png`});
  const result=await page.evaluate(()=>{
   const a=window.__coverhit,c=a.cloth,f=a.yard.scene.getObjectByName('carpet-fringe'),m=f.matrix.clone();let maxAttachmentError=0;
   // Reconstruct roots using material edge coordinates (the instance origin).
   for(let i=0;i<f.count;i++){f.getMatrixAt(i,m);const x=m.elements[12],y=m.elements[13],z=m.elements[14];const axis=c.foldAxis==='u',edges=axis?[0,c.cols]:[0,c.rows];let nearest=Infinity;
    for(const edge of edges)for(let n=0;n<(axis?c.rows:c.cols);n++){
     const j=axis?n*(c.cols+1)+edge:edge*(c.cols+1)+n,k=axis?j+c.cols+1:j+1,p=c.positions;
     const dx=p[k*3]-p[j*3],dy=p[k*3+1]-p[j*3+1],dz=p[k*3+2]-p[j*3+2],t=Math.max(0,Math.min(1,((x-p[j*3])*dx+(y-p[j*3+1])*dy+(z-p[j*3+2])*dz)/(dx*dx+dy*dy+dz*dz)));
     nearest=Math.min(nearest,Math.hypot(x-p[j*3]-t*dx,y-p[j*3+1]-t*dy,z-p[j*3+2]-t*dz));
    }maxAttachmentError=Math.max(maxAttachmentError,nearest);
   }
   const before=f.instanceMatrix.array.slice(),u=c.foldAxis==='u'?.99:.5,v=c.foldAxis==='v'?.01:.5;
   a.dirt.grid.fill(.5);a.dirt.total=a.dirt.grid.length*.5;
   const dustAmount=a.hit(u,v,1);for(let i=0;i<10;i++)c.step(1/60);
   let motion=0;for(let i=0;i<before.length;i++)motion=Math.max(motion,Math.abs(before[i]-f.instanceMatrix.array[i]));
   return {id:a.carpetEntry.id,instances:f.count,finite:f.instanceMatrix.array.every(Number.isFinite),maxAttachmentError,hitMotion:motion,dustAmount,castShadow:f.castShadow,foldAxis:c.foldAxis};
  });
  metrics.push(result);assert(result.finite);assert(result.maxAttachmentError<1e-5);assert(result.hitMotion>.02);assert(result.dustAmount>0);
  await page.evaluate(()=>{const c=window.__coverhit.cloth;c.startFlip({externalClock:true});c.driveFlip(.5);c.readNodes();c.refreshGeometry();});
  await render();await page.screenshot({path:`${out}/${carpetId}-mid-flip.png`});
  assert(await page.evaluate(()=>window.__coverhit.yard.scene.getObjectByName('carpet-fringe').instanceMatrix.array.every(Number.isFinite)));
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/browser.json`,JSON.stringify({metrics,errors},null,2)+'\n');console.log(JSON.stringify({metrics,errors},null,2));
} finally {await browser.close();}
