import {chromium} from './qa-browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.QA_OUT||'docs/qa/layers';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.QA_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__coverhit,null,{timeout:60000});
 await page.evaluate(async()=>{await window.__coverhit.start();await window.__coverhit.setCarpet('09');});
 const result=await page.evaluate(async()=>{
  const {Cloth}=await import('/src/carpet/cloth.js');const {layerRequiredGaps}=await import('/src/carpet/layerCollision.js');
  const a=window.__coverhit;
  const run=(clusterSelfCollision,foldAxis)=>{
   const c=new Cloth({ammo:a.cloth.A,width:foldAxis==='u'?3.5:2.5,height:foldAxis==='u'?2.5:3.5,foldAxis,wind:0,clusterSelfCollision});
   const nodes=c.body.get_m_nodes();let violations=0,barViolations=0,maxBackDisplacement=0,steps=0;const times=[];
   const sample=()=>{
    // Kinematic flip poses are deliberately outside the dynamic constraints.
    if(c.flip)return;
    const side=c.visibleSide,gaps=layerRequiredGaps(nodes,c.layerContacts,side);
    c.layerContacts.forEach((pair,j)=>{if(nodes.at(pair[side]).get_m_x().z()-nodes.at(pair[1-side]).get_m_x().z()<gaps[j]-1e-6)violations++;});
    for(let i=0;i<nodes.size();i++){const p=nodes.at(i).get_m_x();if(Math.hypot(p.y()-c.barAxis.y,p.z()-c.barAxis.z)<c.barContactRadius-1e-6)barViolations++;}
   };
   const step=()=>{const t=performance.now();c.integrate(1/60);times.push(performance.now()-t);sample();steps++;};
   for(let i=0;i<90;i++)step();
   const bottom=[];
   for(let i=0;i<nodes.size();i++)if((foldAxis==='u'?i%(c.cols+1):Math.floor(i/(c.cols+1)))===0)bottom.push([i,nodes.at(i).get_m_x().z()]);
   for(let hit=0;hit<30;hit++) {
    let best=Infinity,index=0;
    for(let i=0;i<nodes.size();i++){
     const d=foldAxis==='u'?i%(c.cols+1)-c.cols/2:Math.floor(i/(c.cols+1))-c.rows/2;
     if((c.visibleSide===0?d:-d)<=0)continue;
     const p=nodes.at(i).get_m_x(),score=Math.hypot(p.x(),p.y()-(c.barAxis.y-c.drop*.55));
     if(score<best){best=score;index=i;}
    }
    const p=nodes.at(index).get_m_x(),point=a.beater.headCenter.clone().set(p.x(),p.y(),p.z());
    c.applyImpulse(point,point.clone().set(0,0,-1),1,.36);
    for(let j=0;j<30;j++){step();if(hit===0)for(const [i,z] of bottom)maxBackDisplacement=Math.max(maxBackDisplacement,Math.abs(nodes.at(i).get_m_x().z()-z));}
    if(hit===14){c.startFlip();for(let j=0;j<130;j++)step();} // 1.65 s throw plus 0.5 s settling
   }
   c.startFlip();for(let j=0;j<130;j++)step(); // 1.65 s throw plus 0.5 s settling
   times.sort((a,b)=>a-b);
   const result={clusterSelfCollision,foldAxis,hits:30,steps,violations,barViolations,maxBackDisplacement,meanStepMs:times.reduce((a,b)=>a+b,0)/times.length,p95StepMs:times[Math.floor(times.length*.95)]};
   c.dispose();return result;
  };
  return [run(false,'v'),run(true,'v'),run(false,'u'),run(true,'u')];
 });
 console.log(JSON.stringify(result,null,2));
 await writeFile(`${out}/browser.json`,JSON.stringify({result,errors},null,2));
 for(const r of result){assert.equal(r.violations,0);assert.equal(r.barViolations,0);assert(r.maxBackDisplacement>.02);}
 // Side-view evidence on the live rendered carpet; synchronous physics prevents
 // RAF timing and scoring/automatic flips from changing the strike experiment.
 await page.evaluate(()=>{
  const a=window.__coverhit,c=a.cloth;c.wind=0;c.integrateOriginal=c.integrate.bind(c);c.integrate=()=>{};
  for(let i=0;i<90;i++)c.integrateOriginal(1/60);c.refreshGeometry();
  const center=a.beater.headCenter.clone().set(0,c.barAxis.y-c.drop*.5,0);a.beater.carpetMeshGetter().localToWorld(center);
  a.baseCamera.copy(center).add(center.clone().set(3,.2,.6));a.lookTarget.copy(center);a.camera.position.copy(a.baseCamera);a.camera.lookAt(center);
 });
 await page.screenshot({path:`${out}/side-before.png`});
 await page.evaluate(()=>{
  const a=window.__coverhit,c=a.cloth,nodes=c.body.get_m_nodes();let best=Infinity,index=0;
  for(let i=0;i<nodes.size();i++){const d=c.foldAxis==='u'?i%(c.cols+1)-c.cols/2:Math.floor(i/(c.cols+1))-c.rows/2;if(d<=0)continue;const p=nodes.at(i).get_m_x(),score=Math.hypot(p.x(),p.y()-(c.barAxis.y-c.drop*.55));if(score<best){best=score;index=i;}}
  const p=nodes.at(index).get_m_x(),point=a.beater.headCenter.clone().set(p.x(),p.y(),p.z());c.applyImpulse(point,point.clone().set(0,0,-1),1,.36);
  for(let i=0;i<20;i++)c.integrateOriginal(1/60);c.refreshGeometry();
 });
 await page.screenshot({path:`${out}/side-after.png`});
 assert.equal(errors.length,0);
} finally {await browser.close();}
