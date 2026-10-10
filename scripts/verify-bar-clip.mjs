import {chromium} from './qa-browser.mjs';
import {BAR_RADIUS} from '../src/carpet/barCollision.js';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.QA_OUT||'docs/qa/bar-clip',fold=process.env.QA_OUT||'docs/qa/fold';
await mkdir(out,{recursive:true});await mkdir(fold,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(async()=>{const a=window.__coverhit;await a.start();await a.setCarpet('05');a.cloth.wind=0;});
 // A separate native patch tests SDF_RS contact with projection completely absent.
 const contact=await page.evaluate(async()=>{
  const {Cloth}=await import('/src/carpet/cloth.js');
  const A=window.__coverhit.cloth.A;
  const run=(flags,anchorDisablesCollision)=>{
   const c=new Cloth({ammo:A,width:2,height:3,cols:8,rows:12,wind:0});
   c.world.removeSoftBody(c.body);
   const h=new A.btSoftBodyHelpers(),axis=c.barAxis;
   const corners=[[-.02,.02],[.02,.02],[-.02,-.02],[.02,-.02]].map(([x,y])=>new A.btVector3(x,axis.y+y,axis.z+.10));
   const b=h.CreatePatch(c.world.getWorldInfo(),...corners,2,2,0,true);
   b.setTotalMass(.1,false);b.get_m_cfg().set_collisions(flags);b.get_m_cfg().set_piterations(24);b.get_m_cfg().set_citerations(12);
   // Zero anchor influence isolates collision suppression from the anchor force.
   if(anchorDisablesCollision!==undefined)b.appendAnchor(0,c.barBody,anchorDisablesCollision,0);
   A.castObject(b,A.btCollisionObject).getCollisionShape().setMargin(.005);
   c.world.addSoftBody(b,1,-1);
   const zero=new A.btVector3(0,0,0);c.world.setGravity(zero);c.world.getWorldInfo().set_m_gravity(zero);
   for(let i=0;i<4;i++)b.get_m_nodes().at(i).get_m_v().setValue(0,0,-1);
   for(let i=0;i<12;i++)c.world.stepSimulation(1/60,0);
   const z=Array.from({length:3},(_,i)=>b.get_m_nodes().at(i+1).get_m_x().z()-axis.z);
   c.world.removeSoftBody(b);A.destroy(b);A.destroy(h);corners.forEach(v=>A.destroy(v));A.destroy(zero);c.dispose();
   return z;
  };
  return {enabled:run(1),disabled:run(0),anchoredEnabled:run(1,false),anchorSuppressed:run(1,true)};
 });
 assert(contact.enabled.every(z=>z>BAR_RADIUS),JSON.stringify(contact));
 assert(contact.disabled.every(z=>z<0),JSON.stringify(contact));
 assert(contact.anchoredEnabled.every(z=>z>0),JSON.stringify(contact));
 assert(contact.anchorSuppressed.every(z=>z<0),JSON.stringify(contact));
 const metrics=[];
 const ids=await page.evaluate(async()=>{const entries=await (await fetch('/carpets/manifest.json')).json(),local=await fetch('/carpets/manifest.local.json');if(local.ok)entries.push(...await local.json());return entries.map(e=>e.id);});
 for(const id of ids) {
  await page.evaluate(async id=>{const a=window.__coverhit;await a.setCarpet(id);a.cloth.wind=0;},id);
  await page.waitForTimeout(600);
  metrics.push(await page.evaluate(()=>{const a=window.__coverhit,c=a.cloth;return {id:a.carpetEntry.id,aspect:a.carpetEntry.aspect,width:c.width,height:c.height,axis:c.foldAxis,span:c.span,drop:c.drop};}));
 }
 assert(metrics.every(m=>Math.abs(m.width/m.height/m.aspect-1)<1e-10&&m.axis===(m.aspect>1?'u':'v')&&m.drop>=1.1&&m.drop<=1.75));
 const landscape=metrics.find(m=>m.aspect>1),portrait=metrics.find(m=>m.aspect<1);
 for(const [name,m] of [['landscape',landscape],['portrait',portrait]]) {
  await page.evaluate(async id=>{await window.__coverhit.setCarpet(id);window.__coverhit.cloth.wind=0;},m.id);
  await page.waitForTimeout(1000);await page.screenshot({path:`${fold}/crosswise-${name}.png`});
 }
 await page.evaluate(async()=>{await window.__coverhit.setCarpet('05');window.__coverhit.cloth.wind=0;});
 await page.waitForTimeout(1000);await page.screenshot({path:`${fold}/front-rest.png`});
 const stress=await page.evaluate(()=>{
  const c=window.__coverhit.cloth,nodes=c.body.get_m_nodes();
  // Deterministic full-strength hits, no scoring or automatic flip to change sides.
  let worstInside=0,maxSpeed=0;
  for(let hit=0;hit<40;hit++) {
   const target=c.vector;
   const desiredY=c.barAxis.y-.08-(hit%5)*.045,desiredX=((hit%7)-3)*c.span/12;
   let best=Infinity,index=0;
   for(let i=0;i<nodes.size();i++) {
    const d=c.foldAxis==='u'?i%(c.cols+1)-c.cols/2:Math.floor(i/(c.cols+1))-c.rows/2;
    if(d<=0||c.anchored.has(i))continue;
    const p=nodes.at(i).get_m_x(),score=Math.hypot(p.x()-desiredX,p.y()-desiredY);
    if(score<best){best=score;index=i;}
   }
   const p=nodes.at(index).get_m_x(),point=window.__coverhit.beater.headCenter.clone().set(p.x(),p.y(),p.z());
   c.applyImpulse(point,point.clone().set(0,0,-1),1,.3);
   for(let step=0;step<12;step++) {
    c.integrate(1/60);let inside=0;
    for(let i=0;i<nodes.size();i++) {const n=nodes.at(i),p=n.get_m_x(),v=n.get_m_v();if(Math.hypot(p.y()-c.barAxis.y,p.z()-c.barAxis.z)<c.barContactRadius-1e-7)inside++;maxSpeed=Math.max(maxSpeed,Math.hypot(v.x(),v.y(),v.z()));}
    worstInside=Math.max(worstInside,inside);
   }
  }
  c.refreshGeometry();return {hits:40,steps:480,worstInside,maxSpeed,radius:c.barContactRadius};
 });
 assert.equal(stress.worstInside,0);assert(stress.maxSpeed<=6.00001);
 await page.screenshot({path:`${out}/after-40-hits.png`});
 await page.evaluate(()=>{
  const a=window.__coverhit,c=a.cloth;a.game.prepareCarpet();a.game.nextMoth=Infinity;a.strikeLog.length=0;
  // Isolate this physics stress from round completion; flip rules have their own probe.
  a.pointerQARestoreClean=a.game.checkClean;a.game.checkClean=()=>false;a.game.remainingSeconds=600;
  a.pointerQA={steps:0,inside:0,wrongSide:0,hits:0,misses:0,log:[]};
  // The dev strike log is a 32-entry ring buffer, not a lifetime hit counter.
  a.pointerQAUnsubscribe=a.beater.onHit(event=>{a.pointerQA.hits++;a.pointerQA.log.push({uv:event.uv.toArray(),strength:event.strength,physicalContact:event.physicalContact});});
  a.pointerQARestoreMiss=a.beater.onMiss;a.beater.onMiss=()=>{a.pointerQA.misses++;a.pointerQARestoreMiss();};
  const project=c.projectBar.bind(c);
  c.projectBar=()=>{project();a.pointerQA.steps++;const nodes=c.body.get_m_nodes();
   for(let i=0;i<nodes.size();i++){const p=nodes.at(i).get_m_x(),dy=p.y()-c.barAxis.y,dz=p.z()-c.barAxis.z;
    if(Math.hypot(dy,dz)<c.barContactRadius-1e-7)a.pointerQA.inside++;
    const d=c.foldAxis==='u'?i%(c.cols+1)-c.cols/2:Math.floor(i/(c.cols+1))-c.rows/2;
    if(Math.abs(dy)<c.barContactRadius&&d*dz<0)a.pointerQA.wrongSide++;
   }
  };
 });
 const targetAt=hit=>page.evaluate(hit=>{
   const a=window.__coverhit,c=a.cloth,indices=c.geometry.index.array;let point=null,best=Infinity;
   // Shoot inside a triangle, not at a shared vertex where ray precision and
   // tiny camera sway can choose the opposite sheet or fall between facets.
   for(let j=0;j<indices.length;j+=3) {
    const ids=[indices[j],indices[j+1],indices[j+2]];
    if(ids.some(i=>(c.foldAxis==='u'?i%(c.cols+1)-c.cols/2:Math.floor(i/(c.cols+1))-c.rows/2)<=0))continue;
    const p=[0,1,2].map(axis=>ids.reduce((sum,i)=>sum+c.positions[i*3+axis],0)/3),dy=p[1]-c.barAxis.y;
    if(dy>-.08||dy<-.29)continue;
    const score=Math.abs(p[0]-((hit%5)-2)*c.span/14)+Math.abs(dy+.18);
    if(score<best){best=score;point=p;}
   }
   if(!point)throw Error('No crown target');
   const v=a.beater.headCenter.clone().fromArray(point);a.beater.carpetMeshGetter().localToWorld(v);v.project(a.camera);
   return {x:(v.x+1)*640,y:(1-v.y)*450};
  },hit);
 for(let hit=0;hit<40;hit++) {
  const target=await targetAt(hit);
  await page.mouse.move(target.x,target.y);await page.mouse.down();await page.waitForTimeout(650);
  // Aim is captured at release; follow the moving crown before locking the ray.
  const release=await targetAt(hit);await page.mouse.move(release.x,release.y);
  await page.mouse.up();await page.waitForTimeout(300);
 }
 const pointer=await page.evaluate(()=>({...window.__coverhit.pointerQA,side:window.__coverhit.game.visibleSide,flipping:window.__coverhit.game.flipping}));
 await writeFile(`${out}/pointer.json`,JSON.stringify(pointer,null,2));
 assert.equal(pointer.hits,40);assert.equal(pointer.inside,0);assert.equal(pointer.wrongSide,0);
 await page.evaluate(()=>{const a=window.__coverhit;a.game.checkClean=a.pointerQARestoreClean;delete a.pointerQARestoreClean;a.game.autoFlipped.add(a.game.visibleSide);a.pointerQAUnsubscribe();a.beater.onMiss=a.pointerQARestoreMiss;});
 await page.screenshot({path:`${out}/after-40-beater-hits.png`});
 await page.keyboard.press('f');await page.waitForTimeout(500);await page.screenshot({path:`${fold}/mid-flip.png`});
 await page.waitForFunction(()=>!window.__coverhit.game.flipping);await page.waitForTimeout(800);await page.screenshot({path:`${fold}/after-flip.png`});
 assert.equal(errors.length,0);
 await writeFile(`${out}/browser.json`,JSON.stringify({contact,stress,pointer,metrics,errors},null,2));
 await writeFile(`${fold}/crosswise.json`,JSON.stringify({metrics,errors},null,2));
 console.log(JSON.stringify({contact,stress,pointer,metrics,errors},null,2));
} finally {await browser.close();}
