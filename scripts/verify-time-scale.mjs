import {chromium} from './qa-browser.mjs';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const option=(n,d)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)||d;
const label=option('label','after'),rates=option('rates','30,60,120,144,240,uncapped,hitch').split(',');
const baseline=process.argv.includes('--baseline');
const originals=new Map();
if(baseline)for(const file of ['src/main.js','src/game/frame.js','src/scene/wind.js','src/carpet/cloth.js','src/carpet/types.js','src/carpet/assets.js','src/carpet/fringe.js','src/fx/dust.js','src/fx/dust/shaders.js','src/fx/moths.js'])originals.set(file,execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'}));
const prefix=process.cwd().replaceAll('\\','/')+'/';
const server=await createServer({configFile:false,plugins:[{name:'read-only-baseline',enforce:'pre',load(id){const key=id.replaceAll('\\','/').slice(prefix.length).split('?')[0];return originals.get(key);}}],server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--disable-frame-rate-limit','--disable-gpu-vsync']});
await mkdir('docs/qa/heavy',{recursive:true});const results=[];
try {
 for(const rate of rates){
  console.log(`Measuring ${label} ${rate} in wall-clock seconds…`);
  const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({rate})=>{
   const native=requestAnimationFrame.bind(window),pending=new Map();let id=0,due=0,ticks=0;
   const channel=new MessageChannel();
   const tick=()=>{
    const now=performance.now();
    if(window.__qaRun&&now>=due){
     const batch=[...pending.values()];pending.clear();ticks++;
     const h=rate==='uncapped'?0:1000/(rate==='hitch'?60:Number(rate));
     due=Math.max(due+h,now);
     if(rate==='hitch'&&ticks%120===0)due=now+250;
     for(const callback of batch)callback(now);
    }
    if(rate==='uncapped')native(tick);
    else if(!window.__qaRun||due-performance.now()>5)setTimeout(()=>channel.port2.postMessage(0),Math.max(1,due-performance.now()-3));
    else channel.port2.postMessage(0);
   };
   channel.port1.onmessage=tick;
   window.requestAnimationFrame=callback=>{pending.set(++id,callback);return id;};
   window.cancelAnimationFrame=id=>pending.delete(id);channel.port2.postMessage(0);Math.random=()=>.375;
  },{rate});
  await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.__coverhit,null,{polling:100,timeout:60000});
  const result=await page.evaluate(async({baseline})=>{
   const a=window.__coverhit;await a.start();await a.setCarpet('03');a.game.update=()=>{};
   a.renderPipeline.render=()=>null; // Exclude renderer load from the timing fixture.
   a.hud.update=()=>{};a.hud.setCleanliness=()=>{};a.yard.update=()=>{};
   const {panelIndices,meanZ,frequency}=await import('/scripts/heavy-probe.js');
   const {createFlight,stepFlight}=await import('/src/fx/mothFlight.js');
   const {Vector3}=await import('/node_modules/.vite/deps/three.js');
   const {createDustProbe}=await import('/scripts/dust-gpu-probe.js');
   const {laundryHem}=await import('/scripts/laundry-probe.js');
   const laundry=a.yard.root.userData.laundry;await laundry.ready;
   const c=a.cloth,ids=panelIndices(c,true),flight=createFlight({x:0,y:1.3,z:.2},19),v=new Vector3();
   let randomSeed=123;a.dust.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
   a.dust.emit(new Vector3(0,1.4,.2),new Vector3(0,0,1),.025);const probeDust=createDustProbe(a.dust);
   window.__qaRun=true;
   const start=performance.now(),startWind=a.wind.time,startCloth=c.time,startDust=a.dust.time;
   const data=[];let last=start,path=0,driftTime=null,fadeTime=null,previousDust={t:0,centre:0,faded:0},lastDustSample=-1;
   await new Promise(resolve=>{
    const sample=()=>{
     const now=performance.now(),dt=(now-last)/1000,t=(now-start)/1000;last=now;
     const old={x:flight.x,y:flight.y,z:flight.z};a.wind.velocity(v,flight.x,flight.y,flight.z);v.multiplyScalar(baseline?1:.6);stepFlight(flight,dt,v);
     path+=Math.hypot(flight.x-old.x,flight.y-old.y,flight.z-old.z);
     if(t-lastDustSample>=.05){
     lastDustSample=t;const dust=probeDust();
     if(driftTime===null&&dust.centre>=1)driftTime=previousDust.t+(t-previousDust.t)*(1-previousDust.centre)/(dust.centre-previousDust.centre);
     if(t>.4&&fadeTime===null&&dust.faded>=.9)fadeTime=previousDust.t+(t-previousDust.t)*(.9-previousDust.faded)/(dust.faded-previousDust.faded);
     previousDust={t,...dust};
     }
     data.push({t,z:meanZ(c,ids),wind:a.wind.time-startWind,cloth:c.time-startCloth,dust:a.dust.time-startDust,laundry:laundryHem(laundry,a.wind)});
     if(t<20)requestAnimationFrame(sample);else resolve();
    };requestAnimationFrame(sample);
   });
   // Interpolate measured wall-clock samples onto 60 Hz before spectral analysis.
   const resample=key=>{let j=1;return Array.from({length:1200},(_,i)=>{const t=i/60;while(j<data.length-1&&data[j].t<t)j++;const p=data[j-1],q=data[j];return p[key]+(q[key]-p[key])*Math.max(0,Math.min(1,(t-p.t)/(q.t-p.t)));});};
   const zs=resample('z'),mean=zs.reduce((s,z)=>s+z,0)/zs.length;
   const intervals=data.slice(1).map((d,i)=>d.t-data[i].t);
   return {wallSeconds:data.at(-1).t,windSeconds:data.at(-1).wind,clothSeconds:data.at(-1).cloth,dustSeconds:data.at(-1).dust,swayHz:frequency(zs),swayRms:Math.sqrt(zs.reduce((s,z)=>s+(z-mean)**2,0)/zs.length),laundryHz:frequency(resample('laundry')),driftTime,fadeTime,mothSpeed:path/data.at(-1).t,actualHz:1/(intervals.reduce((a,b)=>a+b,0)/intervals.length),data};
  },{baseline});
  results.push({rate,...result,errors});console.log(JSON.stringify({rate,...result,data:undefined,errors}));
  await page.close();
 }
 const reference=results.find(r=>r.rate==='60')||results[0],keys=['swayHz','swayRms','laundryHz','driftTime','fadeTime','mothSpeed'];
 const failures=[];
 for(const r of results)for(const key of keys)if(r[key]===null||reference[key]===null||Math.abs(r[key]/reference[key]-1)>.08)failures.push(`${r.rate}: ${key} differs by >8% or is unmeasurable`);
 for(const r of results)if(r.errors.length||Math.abs(r.clothSeconds/r.wallSeconds-1)>.08||Math.abs(r.windSeconds/r.wallSeconds-1)>.08)failures.push(`${r.rate}: clock drift/browser error`);
 for(const r of results)if(!baseline&&Number.isFinite(Number(r.rate))&&Math.abs(r.actualHz/Number(r.rate)-1)>.08)failures.push(`${r.rate}: hardware did not sustain the requested cadence within 8%`);
 await writeFile(`docs/qa/heavy/${label}-time.json`,JSON.stringify({passed:!failures.length,failures,measurement:'Wall-clock RAF; render/HUD/yard uploads excluded. Real Bullet, production frame loop, GPU dust vAlpha envelope and actual laundry VAT. CPU-bound rates report actualHz.',results},null,2));
 console.table(results.map(({data,errors,...r})=>r));console.log({failures});if(failures.length)process.exitCode=1;
}finally{await browser.close();await server.close();}
