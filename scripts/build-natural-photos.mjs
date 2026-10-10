import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
export async function buildNaturalPhotos(){
 await mkdir('artifacts/natural',{recursive:true});
 const recipe=JSON.parse(await readFile('scripts/natural-recipe.json'));
 const active=new Set([...Object.values(recipe.facades).map(c=>c.source),...recipe.cars.map(c=>c.source)]);
 for(const s of JSON.parse(await readFile('scripts/natural-sources.json')).filter(s=>active.has(s.id))){
  const file=`artifacts/natural/${s.id}.original`;try{await readFile(file);}catch{
   let response;for(let attempt=0;attempt<6;attempt++){response=await fetch(s.url.split('?')[0],{headers:{'User-Agent':'CoverHit/1.0 (licensed photo asset builder)'}});if(response.ok)break;await new Promise(r=>setTimeout(r,30000));}
   if(!response.ok)throw Error(`Commons download: ${response.status}`);await writeFile(file,Buffer.from(await response.arrayBuffer()));
  }
 }
 execFileSync('python',['scripts/build-natural-photos.py'],{stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
 await import('./finalize-natural-photos.mjs?rebuild='+Date.now());
}
if(process.argv[1]?.endsWith('build-natural-photos.mjs'))await buildNaturalPhotos();
