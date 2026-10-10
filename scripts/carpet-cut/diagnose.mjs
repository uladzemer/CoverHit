import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {analyzeSource} from './segment.mjs';
import {edgeSheet,imageMetrics} from './metrics.mjs';
import {rectifyCarpet} from '../carpet-image.mjs';
import {measureBorderWidths} from '../carpet-borders.mjs';

const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const audit=JSON.parse(await readFile('scripts/carpets.audit.json','utf8'));
await mkdir('docs/qa/cuts',{recursive:true});
const results=[],previews=[];
for(const c of config) {
 const file='assets-src/carpets/'+c.source;
 if(!await stat(file).then(()=>true,()=>false)){results.push({id:c.id,status:'missing optional source'});continue;}
 const analysis=await analyzeSource(file,c.corners,{fullBleed:c.cut?.fullBleed??['envato-6325SWE','envato-EPRJ58X'].includes(c.id),manual:true});
 let before='public/carpets/'+c.id+'.webp';
 if(!await stat(before).then(()=>true,()=>false))before=await (await rectifyCarpet(file,c.corners,{maxSize:2048})).png().toBuffer();
 await edgeSheet(before,`docs/qa/cuts/${c.id}-before.png`);
 const metrics=await imageMetrics(before,analysis.clusters);
 const border=audit[c.id]?.fieldCorners?await measureBorderWidths(file,c.corners,audit[c.id].fieldCorners):null;
 results.push({id:c.id,before:metrics,clusters:analysis.clusters,borderBefore:border,note:audit[c.id]?.note});
 previews.push({input:await sharp(before).resize(240,300,{fit:'contain',background:'#aaa'}).png().toBuffer(),left:(previews.length%5)*240,top:Math.floor(previews.length/5)*300});
 console.log(c.id,JSON.stringify(metrics));
}
await writeFile('docs/qa/cuts/before.json',JSON.stringify(results,null,2)+'\n');
await sharp({create:{width:1200,height:Math.ceil(previews.length/5)*300,channels:3,background:'#aaa'}}).composite(previews).png().toFile('docs/qa/cuts/envato-overview-before.png');
