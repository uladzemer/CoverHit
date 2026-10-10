import sharp from 'sharp';
import {readFile,writeFile,mkdir,stat,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {processCarpet} from './carpet-cut/process.mjs';
export async function buildCarpets({root=fileURLToPath(new URL('../',import.meta.url))}={}) {
const source=path.join(root,'assets-src/carpets'),out=path.join(root,'public/carpets'),debug=path.join(source,'_debug');
await Promise.all([mkdir(out,{recursive:true}),mkdir(debug,{recursive:true})]);
const config=JSON.parse(await readFile(path.join(root,'scripts/carpets.config.json'),'utf8'));
const manifest=[],previews=[];
const reports=[],started=performance.now();
for(const c of config) {
 if(c.enabled===false){await Promise.all([`${c.id}.webp`,`${c.id}.thumb.webp`].map(name=>rm(path.join(out,name),{force:true})));reports.push({id:c.id,status:'disabled',reason:c.cut?.reason??c.cropNote});continue;}
 const file=path.join(source,c.source);
 try{await stat(file);}catch(error){if(error.code==='ENOENT'&&c.id.startsWith('envato-')){await Promise.all([`${c.id}.webp`,`${c.id}.thumb.webp`].map(name=>rm(path.join(out,name),{force:true})));reports.push({id:c.id,status:'missing optional source'});console.log(`${c.id}: optional licensed source absent`);continue;}throw error;}
 const cut=await processCarpet(file,c);reports.push(cut.report);
 const full=cut.encoded;
 const meta=await sharp(full).metadata(),fileName=`${c.id}.webp`,thumb=`${c.id}.thumb.webp`;
 await writeFile(path.join(out,fileName),full);
 await sharp(full).resize({width:256,height:256,fit:'inside'}).webp({quality:80}).toFile(path.join(out,thumb));
 const i=manifest.length;
 previews.push({input:await sharp(full).resize(280,300,{fit:'contain',background:'#aaa'}).jpeg().toBuffer(),left:i%5*280,top:Math.floor(i/5)*330});
 previews.push({input:Buffer.from(`<svg width="280" height="30"><text x="10" y="22" font-size="18">${c.id}</text></svg>`),left:i%5*280,top:Math.floor(i/5)*330+300});
 manifest.push({id:c.id,title:c.title,archetype:c.archetype,type:c.type,aspect:meta.width/meta.height,width:meta.width,height:meta.height,file:fileName,thumb,credit:c.credit,license:c.license,sourceUrl:c.sourceUrl,...(c.easy?{easy:true}:{}),...(c.size?{size:c.size}:{})});
 console.log(`${c.id}: ${cut.report.method}; ${meta.width} x ${meta.height}; outer ${(cut.report.after.outerLeakage*100).toFixed(4)}%, next ${(cut.report.after.nextLeakage*100).toFixed(4)}%; inset ${cut.report.insets.join('/')}; ${cut.report.encoding}`);
}
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest.filter(c=>!c.id.startsWith('envato-')),null,2)+'\n');
const local=manifest.filter(c=>c.id.startsWith('envato-'));
if(local.length) await writeFile(path.join(out,'manifest.local.json'),JSON.stringify(local,null,2)+'\n');
else await rm(path.join(out,'manifest.local.json'),{force:true});
await sharp({create:{width:1400,height:Math.ceil(manifest.length/5)*330,channels:3,background:'#ccc'}}).composite(previews).jpeg().toFile(path.join(debug,'restored.jpg'));
const bytes=(await Promise.all(manifest.filter(c=>!c.id.startsWith('envato-')).flatMap(c=>[c.file,c.thumb]).concat('manifest.json').map(f=>stat(path.join(out,f))))).reduce((n,s)=>n+s.size,0);
console.log(`Museum carpets: ${(bytes/1024/1024).toFixed(2)} MiB`);
if(bytes>8*1024*1024)throw Error('Museum carpet asset budget exceeded');
await writeFile(path.join(out,'cuts.json'),JSON.stringify({version:1,carpets:reports},null,2)+'\n');
console.log(`Carpet build: ${((performance.now()-started)/1000).toFixed(2)} s; baked edges add zero runtime draw calls or shader work.`);

return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildCarpets();
