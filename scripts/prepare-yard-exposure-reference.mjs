// Read-only Git snapshot: no checkout, stash, index or branch changes.
import {cp,mkdir,symlink,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const destination=path.resolve('artifacts/exposure-baseline'),revision=process.argv[2]||'a00a80a983ee3dc3e5620caa5bcafedb0661332e';
await mkdir(destination,{recursive:true});
await cp('src',`${destination}/src`,{recursive:true});
for(const file of ['index.html','package.json'])await cp(file,`${destination}/${file}`);
for(const dir of ['node_modules','public'])try{await symlink(path.resolve(dir),`${destination}/${dir}`,'junction');}catch(e){if(e.code!=='EEXIST')throw e;}
// Snapshot all existing tracked JS sources, including lighting and the carpet
// pipeline. This keeps future current-tree edits out of the reference.
async function snapshot(directory){
 const tree=execFileSync('git',['show',`${revision}:${directory}`],{encoding:'utf8'});
 for(const line of tree.split('\n')){
  if(!line||line.startsWith('tree '))continue;
  if(line.endsWith('/'))await snapshot(`${directory}/${line.slice(0,-1)}`);
  else {const file=`${directory}/${line}`;await mkdir(path.dirname(`${destination}/${file}`),{recursive:true});await writeFile(`${destination}/${file}`,execFileSync('git',['show',`${revision}:${file}`]));}
 }
}
await snapshot('src');
await mkdir('docs/qa/exposure',{recursive:true});
await writeFile('docs/qa/exposure/reference-provenance.json',JSON.stringify({revision:execFileSync('git',['show','-s','--format=%H',revision],{encoding:'utf8'}).trim(),method:'All src files restored by git show into an ignored isolated directory; shared unchanged base assets and carpets. Optional licensed stock blocked in both renders.',command:'node node_modules/vite/bin/vite.js artifacts/exposure-baseline --host 127.0.0.1 --port 5184'},null,2)+'\n');
console.log(`Prepared ${revision} in ${destination}. Run Vite on port 5184, then node scripts/verify-yard-exposure.mjs reference.`);
