import {chromium} from './qa-browser.mjs';
import {createServer} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sourceHash=createHash('sha256').update(await readFile('src/carpet/cloth.js')).update(await readFile('src/carpet/polarContact.js')).digest('hex');
import sharp from 'sharp';
const out=process.env.QA_OUT||'docs/qa/flipwave';await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];const errors=[];
try {
 for(const variant of (process.argv.find(a=>a.startsWith('--dt='))?.slice(5)||'60,144,30,hitch').split(',')) {
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;Math.random=()=>.375;});
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
  const result=await page.evaluate(async variant=>{
   const {advanceGameplayFrame}=await import('/src/game/frame.js');
   const {clothRestPosition}=await import('/src/carpet/cloth.js');
   const {BAR_RADIUS,CARPET_THICKNESS}=await import('/src/carpet/barCollision.js');
   const a=window.__coverhit;await a.start();await a.setCarpet('05');const c=a.cloth;c.wind=0;
   const mesh=a.beater.carpetMeshGetter(),beater={update(){},beforePhysics(){},afterPhysics(){}};
   let acc=0,frame=0,maxSpeed=0,maxEnergy=0,minClearance=Infinity,maxExtent=0,steps=0;
   let stepContactMs=0,stepContacts=0;const outsideZoneCosts=[];
   for(const method of ['project']){
    const original=c.selfContact[method].bind(c.selfContact);
    c.selfContact[method]=(...args)=>{const before=c.selfContact.metrics.contacts,t=performance.now();const r=original(...args);stepContactMs+=performance.now()-t;stepContacts+=method==='project'?c.selfContact.metrics.contacts:Math.max(0,c.selfContact.metrics.contacts-before);return r;};
   }
   const baseline=[],flipCpu=[],baselineFrame=[],flipFrame=[],flips=[],frames=[];
   const integrate=c.integrate.bind(c);
   c.integrate=dt=>{
    const active=!!c.flip,t=performance.now();stepContactMs=0;stepContacts=0;integrate(dt);if(active&&!stepContacts)outsideZoneCosts.push(stepContactMs);const cpu=performance.now()-t;
    if(active)flipCpu.push(cpu);else baseline.push(cpu);
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
   function measureFrame(game,elapsed) {
    const active=!!c.flip,t=performance.now();
    acc=advanceGameplayFrame({game,beater,cloth:c,mesh},elapsed,acc);
    (active?flipFrame:baselineFrame).push(performance.now()-t);
   }
   function step(){const elapsed=variant==='144'?1/144:variant==='30'?1/30:variant==='hitch'&&frame%120===119?.25:1/60;frame++;measureFrame({update(){}},elapsed);}
   function advance(seconds){const target=c.time+seconds;while(c.time<target-1e-9)step();}
   advance(2);
   for(let j=0;j<20;j++) {
    const style=j%2?'corner':'both';c.wind=j>9?1:0;
    c.startFlip({seed:`wave-${j}`,style});const gesture=c.flip;
    if(c.startFlip())throw Error('Flip reentry accepted');
    const cols=c.foldAxis==='u'?c.rows:c.cols,indices=Array.from({length:cols+1},(_,column)=>c.foldAxis==='u'?column*(c.cols+1)+c.cols/2-1:(c.rows/2-1)*(c.cols+1)+column);
    const times=new Array(cols+1).fill(null),hemTimes=new Array(cols+1).fill(null),columnTimes=new Array(cols+1).fill(null);
    const hem=Array.from({length:cols+1},(_,column)=>c.foldAxis==='u'?column*(c.cols+1)+(gesture.from===0?0:c.cols):(gesture.from===0?0:c.rows)*(c.cols+1)+column);
    let nextFrame=0;
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
     if(j<2&&nextFrame<9&&f.age>=nextFrame*1.65/8) {
      frames.push({style,age:f.age,side:c.visibleSide,positions:Array.from(c.positions)});nextFrame++;
     }
    }
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
   const startFlip=c.startFlip.bind(c);
   for(let j=0;j<20;j++) {
    c.startFlip=opts=>startFlip({...opts,style:j%2?'corner':'both',seed:`external-${j}`});
    a.game.flip();let spreadTimes=new Array(c.cols+1).fill(null);
    while(a.game.flipping) {
     const elapsed=variant==='144'?1/144:variant==='30'?1/30:variant==='hitch'&&frame%120===119?.25:1/60;frame++;
     measureFrame(a.game,elapsed);
     const f=c.flip??c.lastFlip;
     for(let x=0;x<=c.cols;x++) {
      const i=(c.rows/2-1)*(c.cols+1)+x,p=c.nodes.at(i).get_m_x();
      if(spreadTimes[x]===null&&(p.z()-c.barAxis.z)*(f.from===0?-1:1)<-.004)spreadTimes[x]=1.65-a.game.flipRemaining;
     }
     if(a.game.flipping&&a.game.onHit({strength:1})!==0)throw Error('Hit accepted during flip');
    }
    gameFlips.push({style:j%2?'corner':'both',spread:Math.max(...spreadTimes)-Math.min(...spreadTimes),complete:spreadTimes.every(v=>v!==null),side:a.game.visibleSide,clothSide:c.visibleSide});
    if(a.game.flipping)throw Error('Flip did not finish');
   }
   advance(2);
   c.startFlip=startFlip;
   return {variant,outsideZoneContactMs:outsideZoneCosts.length?mean(outsideZoneCosts)*(variant==='144'?60/144:variant==='30'?2:1):0,outsideZoneSteps:outsideZoneCosts.length,gameFlips,width:c.width,height:c.height,cols:c.cols,rows:c.rows,foldAxis:c.foldAxis,axis:c.barAxis,nodeCount:c.nodes.size(),steps,minClearance,maxSpeed,maxEnergy,maxExtent,recoveries:c.watchdogRecoveries??0,baselineMs:mean(baseline),flipMs:mean(flipCpu),addedMs:mean(flipCpu)-mean(baseline),baselineFrameMs:mean(baselineFrame),flipFrameMs:mean(flipFrame),addedFrameMs:mean(flipFrame)-mean(baselineFrame),flips,frames};
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
  results.push(metrics);console.log(JSON.stringify({variant:metrics.variant,monotonicThrows:metrics.flips.filter(f=>f.monotonic).length,outsideZoneContactMs:metrics.outsideZoneContactMs,minClearance:metrics.minClearance,maxSpeed:metrics.maxSpeed,maxEnergy:metrics.maxEnergy,recoveries:metrics.recoveries,addedMs:metrics.addedMs,addedFrameMs:metrics.addedFrameMs,waveSpread:metrics.flips.map(f=>f.spread),gameFlips:metrics.gameFlips}));await page.close();
 }
 const passed=errors.length===0&&results.every(r=>r.minClearance>=-1e-6&&r.maxSpeed<=9.00001&&r.maxEnergy<100&&r.maxExtent<3&&!r.recoveries&&r.addedFrameMs<=3&&r.outsideZoneContactMs*(r.variant==='144'?144/60:r.variant==='30'?.5:1)<=.5&&r.gameFlips.every(f=>f.complete&&f.side===f.clothSide)&&r.flips.every(f=>f.monotonic&&f.spread>=(f.style==='corner'?.2:.12)&&f.restRms<.15&&f.crownError<.01&&f.halfDifference<.035));
 await writeFile(`${out}/metrics.json`,JSON.stringify({sourceHash,passed,errors,results},null,2));if(!passed)process.exitCode=1;
}finally{await browser.close();await server.close();}
