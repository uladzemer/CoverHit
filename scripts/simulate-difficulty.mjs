import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {rotationEntries,carpetGeometry,carpetEntryType} from '../src/carpet/assets.js';
import {DirtMap} from '../src/carpet/dirt.js';
import {seededRandom} from '../src/carpet/random.js';
import {difficultyFor} from '../src/game/difficulty.js';
const museum=JSON.parse(await readFile('public/carpets/manifest.json','utf8'));
const local=await readFile('public/carpets/manifest.local.json','utf8').then(JSON.parse).catch(()=>[]);
function simulate(entry,number,seed=null){
 const type=carpetEntryType(entry),layout=carpetGeometry(type,entry.aspect),difficulty=difficultyFor(number);
 const dirt=new DirtMap({width:layout.width,height:layout.height,foldAxis:layout.foldAxis,dirtAmount:(entry.easy ? .95 : type.dirtAmount)*difficulty.dirtAmount});
 const shared=seed===null?null:seededRandom('random:'+seed),halves=[];
 for(let side=0;side<2;side++){
  const random=shared??seededRandom('difficulty:'+side);dirt.visibleSide=side;let hits=0;
  while(dirt.halfCleanliness(side)<difficulty.threshold&&hits<500){let u=random(),v=random();if(layout.foldAxis==='u')u=side===0?.5+u/2:u/2;else v=(v+side)/2;dirt.hit(u,v,.75);hits++;}
  assert(hits<500);halves.push(hits);
 }
 dirt.texture.dispose();return {id:entry.id,number,width:layout.width,height:layout.height,halves,hits:halves[0]+halves[1],seconds:difficulty.seconds};
}
const rotations=[];
for(const [name,entries] of [['museum',rotationEntries(museum)],['local',rotationEntries([...museum,...local])]]){
 const rounds=entries.slice(0,8).map((entry,i)=>simulate(entry,i+1));
 for(const r of rounds){assert(r.hits<=difficultyFor(r.number).expectedHits);assert(r.seconds>=1.6*(r.hits/1.1+1.2));}
 assert(rounds[0].hits>=22&&rounds[0].hits<=30);
 const seeds=Array.from({length:30},(_,seed)=>simulate(entries[0],1,seed));
 const mean=seeds.reduce((s,r)=>s+r.hits,0)/30;assert(mean>=22&&mean<=30);
 rotations.push({name,rounds,firstCarpetThirtySeedMean:mean});
}
const out=process.env.QA_OUT||'docs/qa/size';
await mkdir(out,{recursive:true});await writeFile(`${out}/difficulty.json`,JSON.stringify(rotations,null,2));
console.log(JSON.stringify(rotations,null,2));
