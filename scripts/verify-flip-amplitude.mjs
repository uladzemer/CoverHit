import {mkdir,writeFile} from 'node:fs/promises';
import {loadPhysicsAmmo,amplitudeCases,measureThrow,physicsSourceHash} from './flip-amplitude-physics.mjs';
const ammo=await loadPhysicsAmmo(),results=[];
for(const test of await amplitudeCases(ammo))for(const hz of [60,30])for(const style of ['both','corner']) {
  const c=test.create();
  const {samples,...result}=measureThrow(c,style,hz);
  results.push({carpet:test.id,type:test.type,...result});c.dispose();
}
console.table(results.map(r=>({carpet:r.carpet,type:r.type,style:r.style,hz:r.hz,peak:r.peak.toFixed(3),sweep:r.sweep.toFixed(3),duration:r.duration.toFixed(3),crestSpread:r.crestEndSpread.toFixed(3),crownSpread:r.spread.toFixed(3),jump:r.jump.toFixed(3)})));
const passed=results.every(r=>r.peak>=.55&&r.sweep>=1.6&&r.duration>=1.2&&r.duration<=1.7&&(r.hz!==60||r.jump<=.35)&&r.spread>=(r.style==='corner'?.25:.15)&&r.crestEndSpread>=(r.style==='corner'?.25:.15)&&r.extent<3&&r.speed<=9.00001&&!r.recoveries);
await mkdir('docs/qa/flipamp',{recursive:true});await writeFile('docs/qa/flipamp/physics.json',JSON.stringify({sourceHash:await physicsSourceHash(),passed,results},null,2));
if(!passed)process.exitCode=1;
