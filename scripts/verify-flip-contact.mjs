import {chromium} from './qa-browser.mjs';
import {createServer} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {contactThresholds,contactBudget,sampleContactPairs} from '../src/carpet/contactMetrics.js';
const sourceHash=createHash('sha256').update(await readFile('src/carpet/cloth.js')).update(await readFile('src/carpet/polarContact.js')).update(await readFile('src/carpet/contactMetrics.js')).digest('hex');
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/qa/flipcontact';await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];const errors=[];
try {
 for(const variant of (process.argv.find(a=>a.startsWith('--dt='))?.slice(5)||'60,144').split(',')) {
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(count=>{window.requestAnimationFrame=()=>1;Math.random=()=>.375;window.contactFlips=count.flips;window.contactClusters=count.clusters;window.contactProfile=count.profile;window.contactCollarExtra=count.collarExtra;window.contactHandoff=true;window.contactFlipIterations=count.flipIterations;},{flips:Number(process.argv.find(a=>a.startsWith('--flips='))?.slice(8)??20),clusters:process.argv.includes('--clusters'),profile:process.argv.includes('--profile'),collarExtra:Number(process.argv.find(a=>a.startsWith('--collar-extra='))?.slice(15)||0),handoff:true,flipIterations:Number(process.argv.find(a=>a.startsWith('--flip-iterations='))?.slice(18)||0)});
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
  const result=await page.evaluate(async variant=>{
   const {advanceGameplayFrame}=await import('/src/game/frame.js');
   const {clothRestPosition}=await import('/src/carpet/cloth.js');
   const {sampleContactPairs}=await import('/src/carpet/contactMetrics.js');
   const {wind:qaWind}=await import('/src/scene/wind.js');
   const {BAR_RADIUS,CARPET_THICKNESS}=await import('/src/carpet/barCollision.js');
   const {ClothContact}=await import('/src/carpet/selfCollisionOracle.js');
   const a=window.__coverhit;await a.start();await a.setCarpet('05');const c=a.cloth;c.wind=1;if(window.contactClusters){
    c.body.generateClusters(32);
    const start=c.startFlip.bind(c),finish=c.finishFlip.bind(c);
    c.startFlip=options=>{c.body.get_m_cfg().set_collisions(0x01|0x20|0x40);return start(options);};
    c.finishFlip=()=>{finish();c.body.get_m_cfg().set_collisions(0x01);};
   }
   if(window.contactCollarExtra){
    const original=c.projectBar.bind(c),saved=new Float64Array(c.barWrap.length);
    c.projectBar=()=>{
     if(!c.flip)return original();
     for(let i=0;i<c.barWrap.length;i++){
      const wrap=c.barWrap[i];saved[i]=wrap.minY;
      const along=c.foldAxis==='u'?i%(c.cols+1):Math.floor(i/(c.cols+1)),middle=(c.foldAxis==='u'?c.cols:c.rows)/2;
      if(Math.abs(along-middle)!==2||c.flip.initialSides[i]>=0)continue;
      const column=c.foldAxis==='u'?Math.floor(i/(c.cols+1)):i%(c.cols+1),count=c.foldAxis==='u'?c.rows:c.cols;
      const phase=c.flip.leading===0?column/count:1-column/count,t=Math.max(0,Math.min(1,(c.flip.age-.35-phase*c.flip.spread)/.4)),ease=t*t*(3-2*t),lift=Math.sin(Math.PI*ease)**2;
      const radius=Math.max(.0361,Math.hypot(wrap.minY-c.barAxis.y,wrap.minZ))+window.contactCollarExtra*lift;
      wrap.minY=c.barAxis.y+Math.sqrt(Math.max(0,radius*radius-wrap.minZ*wrap.minZ));
     }
     original();for(let i=0;i<c.barWrap.length;i++)c.barWrap[i].minY=saved[i];
    };
   }
   const mesh=a.beater.carpetMeshGetter(),beater={update(){},beforePhysics(){},afterPhysics(){}};
   let acc=0,frame=0,maxSpeed=0,maxEnergy=0,minClearance=Infinity,maxExtent=0,steps=0;
   const clearances=[];let events=0,minContactClearance=Infinity,maxCorrection=0,contactMs=0,contactSteps=0;const penetrations=[],eventRows={},examples=[];let pairEvents=0,pairMinClearance=Infinity;const pairExamples=[];const pairPenetrations=[],pairNormals=new Float64Array(c.nodes.size()*3);
   let sampleMs=0;const baseline=[],flipCpu=[],baselineFrame=[],flipFrame=[],flips=[],frames=[];
   const oracle=new ClothContact(c.cols,c.rows,Math.max(c.width/c.cols,c.height/c.rows),c.foldAxis);
   let outsideContactMs=0,outsideContactCalls=0,outsideSteps=0;
   const contactProject=c.selfContact.project.bind(c.selfContact);
   c.selfContact.project=(...args)=>{const active=!!c.flip,t=performance.now();const result=contactProject(...args);if(!active){outsideContactCalls++;outsideContactMs+=performance.now()-t;}return result;};
   const profile={};
   if(window.contactProfile)for(const name of ['capture','read','build','visit','hanging','buildEdges','visitEdges','edge','resolveEdge','project','resolve','allowance']){
    const original=c.selfContact[name].bind(c.selfContact);
    c.selfContact[name]=(...args)=>{const t=performance.now();const result=original(...args);const p=profile[name]??={calls:0,ms:0};p.calls++;p.ms+=performance.now()-t;return result;};
   }
   let integratingFlip=false,maxHandoffCorrection=0,maxPolarCorrection=0;const stepContactPush=new Float64Array(c.nodes.size());
   if(window.contactHandoff){
    const original=c.projectLayers.bind(c),positions=new Float64Array(c.nodes.size()*3);
    c.projectLayers=()=>{
     if(!integratingFlip||c.flip)return original();
     let qaStart=performance.now();for(let i=0;i<c.nodes.size();i++){const p=c.nodes.at(i).get_m_x(),k=i*3;positions[k]=p.x();positions[k+1]=p.y();positions[k+2]=p.z();}sampleMs+=performance.now()-qaStart;
     const result=original();
     qaStart=performance.now();for(let i=0;i<c.nodes.size();i++){const p=c.nodes.at(i).get_m_x(),k=i*3,push=Math.hypot(p.x()-positions[k],p.y()-positions[k+1],p.z()-positions[k+2]);maxHandoffCorrection=Math.max(maxHandoffCorrection,push);stepContactPush[i]+=push;}sampleMs+=performance.now()-qaStart;
     return result;
    };
   }
   const integrate=c.integrate.bind(c);
   c.integrate=dt=>{
    const active=!!c.flip;if(window.contactFlipIterations)c.solverConfig.set_piterations(active?window.contactFlipIterations:Math.max(16,c.iterations));let qaStart=performance.now();stepContactPush.fill(0);sampleMs+=performance.now()-qaStart;const t=performance.now(),beforeSample=sampleMs;integratingFlip=active;integrate(dt);integratingFlip=false;const cpu=performance.now()-t-(sampleMs-beforeSample);
    qaStart=performance.now();if(active)for(let i=0;i<stepContactPush.length;i++)maxCorrection=Math.max(maxCorrection,stepContactPush[i]);sampleMs+=performance.now()-qaStart;
    if(active)flipCpu.push(cpu);else{baseline.push(cpu);outsideSteps++;}
    steps++;let energy=0;
    for(let i=0;i<c.nodes.size();i++) {
     const n=c.nodes.at(i),p=n.get_m_x(),v=n.get_m_v();
     const speed=Math.hypot(v.x(),v.y(),v.z());maxSpeed=Math.max(maxSpeed,speed);
     maxExtent=Math.max(maxExtent,Math.abs(p.x()-c.bar.x),Math.abs(p.y()-c.barAxis.y),Math.abs(p.z()-c.barAxis.z));
     if(active)minClearance=Math.min(minClearance,Math.hypot(p.y()-c.barAxis.y,p.z()-c.barAxis.z)-(BAR_RADIUS+CARPET_THICKNESS));
     if(n.get_m_im()>0)energy+=.5*speed*speed/n.get_m_im();
    }
    maxEnergy=Math.max(maxEnergy,energy);
   };
   c.onContactSubstep=()=>{
    const sampleStart=performance.now();
    const active=!!c.flip;
    if(active){
     maxPolarCorrection=Math.max(maxPolarCorrection,c.selfContact.metrics.maxCorrection);stepContactPush.set(c.selfContact.used);
     maxCorrection=Math.max(maxCorrection,c.selfContact.metrics.maxCorrection);
     contactMs+=c.selfContact.metrics.ms;contactSteps++;
     oracle.sample(c.nodes,(i,t,gap)=>{
      const tri=oracle.triangles,axis=c.foldAxis==='u'?i%(c.cols+1):Math.floor(i/(c.cols+1)),middle=(c.foldAxis==='u'?c.cols:c.rows)/2;
      const a=tri[t*3],other=c.foldAxis==='u'?a%(c.cols+1):Math.floor(a/(c.cols+1));
      if((axis-middle)*(other-middle)>=0)return;
      const clearance=gap-.014;minContactClearance=Math.min(minContactClearance,clearance);clearances.push(clearance);
      if(gap<.014){const depth=.014-gap;penetrations.push(depth);if(depth>.003){events++;if(examples.length<30)examples.push({age:c.flip.age,i,t,gap,node:Array.from(oracle.p.slice(i*3,i*3+3)),vertices:Array.from(oracle.triangles.slice(t*3,t*3+3))});eventRows[axis]=(eventRows[axis]??0)+1;}}
     });
     sampleContactPairs(oracle.p,c.cols,c.rows,c.foldAxis,Math.max(c.width/c.cols,c.height/c.rows),pairNormals,(i,j,gap)=>{
      pairMinClearance=Math.min(pairMinClearance,gap-.014);
      if(gap<.007){const depth=.014-gap;pairPenetrations.push(depth);if(depth>.003){pairEvents++;if(c.selfContact.im[i]===0&&c.selfContact.im[j]===0&&pairExamples.length<20)pairExamples.push({age:c.flip.age,i,j,gap,positions:[...oracle.p.slice(i*3,i*3+3),...oracle.p.slice(j*3,j*3+3)]});}}
     });
    }
    sampleMs+=performance.now()-sampleStart;
   };
   function measureFrame(game,elapsed) {
    qaWind.update(elapsed);
    const active=!!c.flip,t=performance.now(),beforeSample=sampleMs;
    acc=advanceGameplayFrame({game,beater,cloth:c,mesh},elapsed,acc);
    (active?flipFrame:baselineFrame).push(performance.now()-t-(sampleMs-beforeSample));
   }
   function step(){const elapsed=variant==='144'?1/144:variant==='30'?1/30:variant==='hitch'&&frame%120===119?.25:1/60;frame++;measureFrame({update(){}},elapsed);}
   function advance(seconds){const target=c.time+seconds;while(c.time<target-1e-9)step();}
   advance(2);
   for(let j=0;j<Number(window.contactFlips??20);j++) {
    const style=j%2?'corner':'both';c.wind=1;
    c.startFlip({seed:`wave-${j}`,style});const gesture=c.flip;
    if(c.startFlip())throw Error('Flip reentry accepted');
    const cols=c.foldAxis==='u'?c.rows:c.cols,indices=Array.from({length:cols+1},(_,column)=>c.foldAxis==='u'?column*(c.cols+1)+c.cols/2-1:(c.rows/2-1)*(c.cols+1)+column);
    const times=new Array(cols+1).fill(null),hemTimes=new Array(cols+1).fill(null),columnTimes=new Array(cols+1).fill(null);
    const hem=Array.from({length:cols+1},(_,column)=>c.foldAxis==='u'?column*(c.cols+1)+(gesture.from===0?0:c.cols):(gesture.from===0?0:c.rows)*(c.cols+1)+column);
    const rawFrames=j<2?[{style,age:0,side:c.visibleSide,positions:Array.from(c.positions)}]:null;
    while(c.flip) {
     step();const f=c.flip??c.lastFlip;
     for(let column=0;column<=cols;column++) {
      const p=c.nodes.at(indices[column]).get_m_x();
      if(times[column]===null&&(p.z()-c.barAxis.z)*(gesture.from===0?-1:1)<-.004)times[column]=f.age;
      let sum=0,n=0;
      for(let along=0;along<(c.foldAxis==='u'?c.cols:c.rows)/2;along++) {
       const material=gesture.from===0?along:(c.foldAxis==='u'?c.cols:c.rows)-along;
       const index=c.foldAxis==='u'?column*(c.cols+1)+material:material*(c.cols+1)+column;
       sum+=c.nodes.at(index).get_m_x().z()-c.barAxis.z;n++;
      }
      if(columnTimes[column]===null&&sum/n>.004)columnTimes[column]=f.age;
      const h=c.nodes.at(hem[column]).get_m_x();
      if(hemTimes[column]===null&&(h.z()-c.barAxis.z)*(gesture.from===0?-1:1)<-.004)hemTimes[column]=f.age;
     }
     if(rawFrames)rawFrames.push({style,age:f.age,side:c.visibleSide,positions:Array.from(c.positions)});
    }
    if(rawFrames)for(let k=0;k<9;k++)frames.push(rawFrames[Math.round(k*(rawFrames.length-1)/8)]);

    const ordered=gesture.leading===0?times:times.slice().reverse();
    const complete=ordered.every(v=>v!==null),monotonic=complete&&ordered.every((v,i)=>i===0||v>=ordered[i-1]-1e-8);
    const spread=complete?Math.max(...ordered)-Math.min(...ordered):0;
    advance(2);
    let restError=0,halfBottom=[0,0],counts=[0,0],crownError=0;
    for(let i=0;i<c.nodes.size();i++) {
     const x=i%(c.cols+1),y=Math.floor(i/(c.cols+1)),rest=clothRestPosition(x,y,c,c.bar,c.visibleSide),p=c.nodes.at(i).get_m_x();
     restError+=Math.hypot(p.x()-rest[0],p.y()-rest[1],p.z()-rest[2])**2;
     const along=c.foldAxis==='u'?x:y,count=c.foldAxis==='u'?c.cols:c.rows;
     if(along===0||along===count){const side=along===0?0:1;halfBottom[side]+=p.y();counts[side]++;}
     if(Math.abs(along-count/2)<=2)crownError=Math.max(crownError,Math.hypot(p.y()-rest[1],p.z()-rest[2]));
    }
    const halfDifference=Math.abs(halfBottom[0]/counts[0]-halfBottom[1]/counts[1]);
    flips.push({style,leading:gesture.leading,crossingTimes:times,columnCrossingTimes:columnTimes,hemCrossingTimes:hemTimes,monotonic,spread,restRms:Math.sqrt(restError/c.nodes.size()),crownError,halfDifference,finalSide:c.visibleSide});
   }
   const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
   const gameFlips=[];
   penetrations.sort((a,b)=>a-b);pairPenetrations.sort((a,b)=>a-b);
   clearances.sort((a,b)=>a-b);const clearanceStats={min:clearances[0]??null,p1:clearances[Math.floor(clearances.length*.01)]??null,median:clearances[Math.floor(clearances.length*.5)]??null,p99:clearances[Math.floor(clearances.length*.99)]??null};
   const p99=Math.max(penetrations[Math.floor((penetrations.length-1)*.99)]??0,pairPenetrations[Math.floor((pairPenetrations.length-1)*.99)]??0);
   return {variant,flipIterations:window.contactFlipIterations,handoffMeasured:window.contactHandoff,maxHandoffCorrection,maxPolarCorrection,collarExtra:window.contactCollarExtra,profile,examples,pairExamples,windOn:c.wind===1,windTime:qaWind.time,clearanceStats,outsideContactMs:outsideSteps?outsideContactMs/outsideSteps:0,outsideContactCalls,pairEvents,pairMinClearance,pairPenetrationCount:pairPenetrations.length,eventRows,events:events+pairEvents,p99,minContactClearance,maxCorrection,contactMs:contactMs/contactSteps,contactSteps,gameFlips,width:c.width,height:c.height,cols:c.cols,rows:c.rows,foldAxis:c.foldAxis,axis:c.barAxis,nodeCount:c.nodes.size(),steps,minClearance,maxSpeed,maxEnergy,maxExtent,recoveries:c.watchdogRecoveries??0,baselineMs:mean(baseline),flipMs:mean(flipCpu),addedMs:mean(flipCpu)-mean(baseline),baselineFrameMs:mean(baselineFrame),flipFrameMs:mean(flipFrame),addedFrameMs:mean(flipFrame)-mean(baselineFrame),flips,frames};
  },variant);
  const {frames,...metrics}=result;
  if(variant==='60'&&!process.argv.includes('--no-images')) {
   await writeFile(`${out}/positions.json`,JSON.stringify({cols:result.cols,rows:result.rows,frames}));
   for(const style of ['both','corner']) {
    const selected=frames.filter(f=>f.style===style);
    for(const view of ['front','side']) {
     const w=360,h=330;let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w*3}" height="${h*3}"><rect width="100%" height="100%" fill="#f4f2ed"/>`;
     for(let j=0;j<selected.length;j++) {
      const f=selected[j],ox=j%3*w,oy=Math.floor(j/3)*h;
      const xy=i=>{const k=i*3;return [ox+w/2+(view==='front'?f.positions[k]:f.positions[k+2])*75,oy+80-(f.positions[k+1]-result.axis.y)*75];};
      svg+=`<text x="${ox+12}" y="${oy+24}" font-size="16">${style} ${view} ${f.age.toFixed(2)}s</text>`;
      if(view==='front')svg+=`<path d="M${ox+40},${oy+80}h280" stroke="#666" stroke-width="4"/>`;
      else svg+=`<circle cx="${ox+w/2}" cy="${oy+80}" r="3" fill="#666"/>`;
      for(let y=0;y<=result.rows;y++)for(let x=0;x<=result.cols;x++) {
       const i=y*(result.cols+1)+x,p=xy(i);
       for(const n of [x<result.cols?i+1:-1,y<result.rows?i+result.cols+1:-1])if(n>=0) {
        const q=xy(n);svg+=`<path d="M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}" stroke="${y<result.rows/2?'#c25a40':'#376c9e'}" stroke-width=".65" fill="none"/>`;
       }
      }
     }
     svg+='</svg>';await sharp(Buffer.from(svg)).png().toFile(`${out}/${style}-${view}.png`);
     const captures=[];
     for(const f of selected) {
      await page.evaluate(({f,view})=>{
       const a=window.__coverhit,c=a.cloth;
       c.positions.set(f.positions);c.setVisibleSide(f.side);c.refreshGeometry();
       const mesh=a.beater.carpetMeshGetter();mesh.updateWorldMatrix(true,false);
       const target=a.lookTarget.clone();
       if(view==='side') {target.set(0,c.barAxis.y-c.drop*.4,c.barAxis.z);mesh.localToWorld(target);a.camera.position.copy(target).add(target.clone().set(4,.2,.2));}
       else a.camera.position.copy(a.baseCamera);
       a.camera.lookAt(target);a.camera.updateMatrixWorld();a.renderPipeline.render(0);
      },{f,view});
      const png=await page.locator('canvas').first().screenshot();
      captures.push({input:await sharp(png).resize(400,280).toBuffer(),left:(captures.length%3)*400,top:Math.floor(captures.length/3)*280});
     }
     await sharp({create:{width:1200,height:840,channels:3,background:'#f4f2ed'}}).composite(captures).png().toFile(`${out}/${style}-${view}-rendered.png`);

    }
   }
  }
  results.push(metrics);console.log(JSON.stringify({variant:metrics.variant,monotonicThrows:metrics.flips.filter(f=>f.monotonic).length,profile:metrics.profile,eventRows:metrics.eventRows,events:metrics.events,p99:metrics.p99,minContactClearance:metrics.minContactClearance,maxCorrection:metrics.maxCorrection,contactMs:metrics.contactMs,minClearance:metrics.minClearance,maxSpeed:metrics.maxSpeed,maxEnergy:metrics.maxEnergy,recoveries:metrics.recoveries,addedMs:metrics.addedMs,addedFrameMs:metrics.addedFrameMs,waveSpread:metrics.flips.map(f=>f.spread),gameFlips:metrics.gameFlips}));await page.close();
 }
 const penetrationPassed=errors.length===0&&results.every(r=>r.events===0&&r.p99<=.001);
 const physicsPassed=errors.length===0&&results.every(contactThresholds);
 const budgetPassed=results.every(r=>contactBudget(r.addedFrameMs));
 const passed=physicsPassed&&budgetPassed;
 await writeFile(`${out}/metrics${process.argv.includes('--profile')?'-profile':process.argv.includes('--clusters')?'-clusters':''}.json`,JSON.stringify({sourceHash,passed,penetrationPassed,physicsPassed,budgetPassed,errors,results},null,2));if(!passed)process.exitCode=1;
}finally{await browser.close();await server.close();}
