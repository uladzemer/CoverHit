import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {moduleChoice} from '../src/scene/yard/facade.js';
// A whole metre-sized bay must survive a non-square bake; cover would crop
// off its wall boundaries and join neighbouring windows into horizontal bands.
export async function resampleFacadeModule(source,slot,width,height){
 return sharp(source).extract({left:slot%2*1024+8,top:Math.floor(slot/2)*1024+8,width:1008,height:1008}).resize(width,height,{fit:'fill'}).removeAlpha().raw().toBuffer();
}
export async function bakeFacadeImpostors(){
 const dir='public/yard/photos',manifest=JSON.parse(await readFile(`${dir}/manifest.json`));
 const config=JSON.parse(await readFile('scripts/facade-modules.json','utf8'));
 for(const family of ['panel','panel335','brick','nine','tower']){
  const floors=family==='tower'?16:family==='nine'?9:5,bays=family==='tower'?8:20;
  for(const suffix of ['albedo','windows']){
   const source=await sharp(`${dir}/${family}-${suffix}.webp`).resize(2048,2048).png().toBuffer(),atlas=Buffer.alloc(1024*1024*3),cache=new Map();
   for(let seed=0;seed<4;seed++)for(let row=0;row<floors;row++)for(let col=0;col<bays;col++){
    const slot=row===0?0:row===floors-1?3:moduleChoice(col,row,seed),left=Math.round(col*512/bays),top=Math.round((floors-1-row)*512/floors),width=Math.round((col+1)*512/bays)-left,height=Math.round((floors-row)*512/floors)-top;
    const key=`${slot}-${width}-${height}`;
    if(!cache.has(key))cache.set(key,await resampleFacadeModule(source,slot,width,height));
    const pixels=cache.get(key),brightness=suffix==='albedo'?.96+((Math.imul(col+1,1664525)^Math.imul(row+seed+1,1013904223))>>>0)%801/10000:1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<3;c++)atlas[((seed%2*512+left+x)+(Math.floor(seed/2)*512+top+y)*1024)*3+c]=Math.min(255,pixels[(y*width+x)*3+c]*brightness);
   }
   const file=`${family}-impostor-${suffix}.webp`;
   await sharp(atlas,{raw:{width:1024,height:1024,channels:3}}).webp({quality:94}).toFile(`${dir}/${file}`);
   if(!manifest.files.some(f=>f.file===file))manifest.files.push({file,sources:[config[family].source],transform:'four seeded full-building impostors baked from upright joint-aligned floor/bay modules; full bay resampling; no reflections'});
  }
 }
 await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
 let sources=await readFile('public/yard/SOURCES.md','utf8');
 for(const f of manifest.files.filter(f=>f.file.includes('-impostor-')))if(!sources.includes(`photos/${f.file}`)){const s=manifest.sources.find(s=>s.index===f.sources[0]);sources+=`\n| photos/${f.file} | ${s.author} | ${s.page} | ${s.license} |`;}await writeFile('public/yard/SOURCES.md',sources.trimEnd()+'\n');
}
if(process.argv[1]?.endsWith('bake-facade-impostors.mjs'))await bakeFacadeImpostors();
