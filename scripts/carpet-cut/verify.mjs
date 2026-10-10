import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import {carpetGeometry,carpetEntryType} from '../../src/carpet/assets.js';

const manifest=JSON.parse(await readFile('public/carpets/manifest.json','utf8'));
const local=await readFile('public/carpets/manifest.local.json','utf8').then(JSON.parse,()=>[]);
const files=[...manifest,...local].flatMap(c=>[c.file,c.thumb]).concat('manifest.json','cuts.json',...(local.length?['manifest.local.json']:[]));
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile('public/carpets/'+file)).digest('hex')])));
const before=await hashes(),start=performance.now();
const output=execSync('npm run build',{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});console.log(output);
const buildSeconds=(performance.now()-start)/1000,after=await hashes();
const different=files.filter(f=>before[f]!==after[f]);if(different.length)throw Error('Non-deterministic output: '+different.join(', '));
const carpetSeconds=Number(output.match(/Carpet build: ([\d.]+) s/)?.[1]);
if(!(carpetSeconds<60))throw Error('Carpet build exceeds 60 seconds');
const original=JSON.parse((await readFile('docs/qa/cuts/original-manifest.json','utf8')).replace(/^\uFEFF/,''));
const grid=manifest.map(c=>{
 const old=original.find(o=>o.id===c.id),g=carpetGeometry(carpetEntryType(c),c.aspect),p=carpetGeometry(carpetEntryType(old),old.aspect);
 const row={id:c.id,beforeNodes:(p.cols+1)*(p.rows+1),afterNodes:(g.cols+1)*(g.rows+1),cellError:Math.abs(c.aspect*g.rows/g.cols-1)};
 if(row.afterNodes>row.beforeNodes)throw Error(c.id+': Ammo grid grew');return row;
});
const assetBytes=(await Promise.all(manifest.flatMap(c=>[c.file,c.thumb]).concat('manifest.json').map(f=>stat('public/carpets/'+f)))).reduce((n,s)=>n+s.size,0);
const evidence={carpetSeconds,buildSeconds,deterministic:true,hashedFiles:files.length,assetBytes,assetMiB:assetBytes/1024/1024,grid,runtimeAdded:{drawCalls:0,triangles:0,shaderWork:0,ammoNodes:0},limits:'Offline pipeline only; no GPU timer or live CPU frame benchmark was run. Grid node counts establish unchanged/decreased solver work topology, not measured milliseconds.'};
await writeFile('docs/qa/cuts/verification.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
