import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {bakeFacadeImpostors} from './bake-facade-impostors.mjs';
// Assets are rebuilt from original pixels, never from already corrected atlases.
export async function buildFacadeModules(){
 await mkdir('artifacts/facades2',{recursive:true});
 const manifest=JSON.parse(await readFile('public/yard/photos/manifest.json'));
 for(const s of manifest.sources.filter(s=>s.series)){
  const file=`artifacts/facades2/${s.index}.source`;
  try{await readFile(file);}catch{
   try{await writeFile(file,await readFile(`artifacts/photos/${s.index}.source`));}catch{
    const r=await fetch(s.url,{headers:{'User-Agent':'CoverHit facade rectification QA'},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${s.title}: ${r.status}`);await writeFile(file,Buffer.from(await r.arrayBuffer()));
   }
  }
 }
 execFileSync('python',['scripts/rectify-facades.py'],{stdio:'inherit'});
 for(const s of manifest.sources.filter(s=>s.series))for(const suffix of ['albedo','windows']){
  const file=`${s.series}-${suffix}.webp`;
  await sharp(`artifacts/facades2/${s.series}-${suffix}.png`).webp({quality:96,effort:5}).toFile(`public/yard/photos/${file}`);
  const item=manifest.files.find(f=>f.file===file);item.transform='LSD line-family refined four-corner homography; Lanczos4; mild unsharp; upright floor/bay modules, 8px gutters, no reflections; bounded baked window variants';
  const config=JSON.parse(await readFile('scripts/facade-modules.json','utf8'));item.sources=[config[s.series].source];
 }
 let concrete;try{concrete=await readFile('artifacts/facades2/concrete.jpg');}catch{concrete=await readFile('public/yard/photos/concrete-reference.webp');}
 const {data,info}=await sharp(concrete).resize(512,512).greyscale().raw().toBuffer({resolveWithObject:true});
 const normals=Buffer.alloc(info.width*info.height*3),at=(x,y)=>data[((y+info.height)%info.height)*info.width+(x+info.width)%info.width]/255;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*3;normals[i]=128+(at(x-1,y)-at(x+1,y))*90;normals[i+1]=128+(at(x,y+1)-at(x,y-1))*90;normals[i+2]=255;}
 await sharp(normals,{raw:{width:info.width,height:info.height,channels:3}}).webp({quality:98}).toFile('public/yard/photos/concrete-detail-normal.webp');
 if(!manifest.files.some(f=>f.file==='concrete-detail-normal.webp'))manifest.files.push({file:'concrete-detail-normal.webp',sources:['polyhaven'],transform:'CC0 concrete_slab_wall_02, central-difference detail normal; 3.5m upright repeat'});
 manifest.version=2;manifest.facadeModules={size:1024,gutter:8,atlas:2048,columns:2,rows:2,slots:['ground','typical-a','typical-b','top'],mirrored:false};
 await writeFile('public/yard/photos/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 let sources=await readFile('public/yard/SOURCES.md','utf8');if(!sources.includes('photos/concrete-detail-normal.webp'))sources+='\n| photos/concrete-detail-normal.webp | Amal Kumar / Poly Haven | https://polyhaven.com/a/concrete_slab_wall_02 | CC0 |\n';await writeFile('public/yard/SOURCES.md',sources);
 await bakeFacadeImpostors();
 const current=JSON.parse(await readFile('public/yard/photos/manifest.json'));
 const lines=(await readFile('public/yard/SOURCES.md','utf8')).split('\n').map(line=>{
  const match=line.match(/^\| photos\/([^ |]+) \|/),file=current.files.find(f=>f.file===match?.[1]);if(!file)return line;
  const refs=file.sources.map(id=>id==='polyhaven'?{author:'Amal Kumar / Poly Haven',page:'https://polyhaven.com/a/concrete_slab_wall_02',license:'CC0'}:current.sources.find(s=>s.index===id));
  return `| photos/${file.file} | ${refs.map(s=>s.author).join('; ')} | ${refs.map(s=>s.page).join('; ')} | ${refs.map(s=>s.license).join('; ')} |`;
 });
 await writeFile('public/yard/SOURCES.md',lines.join('\n'));
 execFileSync('python',['scripts/rectify-facades.py','--verify'],{stdio:'inherit'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildFacadeModules();
