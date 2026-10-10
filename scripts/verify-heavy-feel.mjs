import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {measureHit} from './heavy-probe.js';
if(process.argv.includes('--baseline')){
 const {registerHooks}=await import('node:module');const {execFileSync}=await import('node:child_process');
 const originals=new Map();
 for(const file of ['src/carpet/cloth.js','src/carpet/types.js','src/scene/wind.js'])originals.set(new URL('../'+file,import.meta.url).href,execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'}));
 registerHooks({load(url,context,next){return originals.has(url)?{format:'module',source:originals.get(url),shortCircuit:true}:next(url,context);}});
}
const {loadPhysicsAmmo,amplitudeCases}=await import('./flip-amplitude-physics.mjs');
const {createWind}=await import('../src/scene/wind.js');
const label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)||'after';
const ammo=await loadPhysicsAmmo(),results=[];
for(const test of await amplitudeCases(ammo,['03','06','01'])){
  const c=test.create();const r=measureHit(c,Vector3);c.dispose();
  const hem=test.create();const h=measureHit(hem,Vector3,true);hem.dispose();
  results.push({id:test.id,...r,hemHit:{peak:h.peak,period:h.period,frequency:h.frequency,decay:h.decay}});
}
console.table(results.map(({samples,hemHit,...r})=>r));
console.table(results.map(r=>({id:r.id,hemPeak:r.hemHit.peak,hemPeriod:r.hemHit.period,hemFrequency:r.hemHit.frequency,hemDecay:r.hemHit.decay})));
await mkdir('docs/qa/heavy',{recursive:true});
await writeFile(`docs/qa/heavy/${label}-physics.json`,JSON.stringify(results,null,2));
const wind=createWind(464),v=new Vector3();let sum=0,min=Infinity,max=0;
for(let i=0;i<36000;i++){wind.update(1/60);const speed=wind.velocity(v,0,0,0).length();sum+=speed;min=Math.min(min,speed);max=Math.max(max,speed);}
console.log('Ground wind (600 s):',{mean:sum/36000,min,max});
await writeFile(`docs/qa/heavy/${label}-wind.json`,JSON.stringify({mean:sum/36000,min,max},null,2));
try {const timing=JSON.parse(await readFile(`docs/qa/heavy/${label}-time.json`));console.table(timing.results.map(({rate,swayHz,swayRms,laundryHz,driftTime,fadeTime,mothSpeed})=>({rate,swayHz,swayRms,laundryHz,driftTime,fadeTime,mothSpeed})));}catch(error){if(error.code!=='ENOENT')throw error;}
if(label!=='before'&&results.some(r=>r.peak<.18||r.peak>.35||!r.period||r.period<2.2||r.period>3.2||r.decay<4||r.decay>6||r.recoveries))process.exitCode=1;
