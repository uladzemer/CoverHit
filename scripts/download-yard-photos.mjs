import {mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {correctPhotos} from './correct-yard-photos.mjs';
import {buildFacadeModules} from './build-facade-modules.mjs';

const OUT='public/yard/photos',CACHE='artifacts/photos';
const UA='CoverHit/1.0 (personal educational courtyard game; polite photo asset builder)';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export const SOURCES=[
 {index:0,title:'Schiguli WAS-2101 (side).jpg',output:'car-side.webp'},
 {index:1,title:'Schiguli WAS-2101 (front).jpg',output:'car-front.webp'},
 {index:2,title:'Lada 1600 -- Front.JPG',output:'car-detail.webp'},
 {index:3,title:'Lada 1600 -- Rear.JPG',output:'car-rear.webp'},
 {index:4,title:'Lada 1200.svg',output:'car-outline.png'},
 {index:5,title:'Moscow car show 2025-08-03 VAZ-2101 beige 0.jpg',output:'car-beige.webp'},
 {index:9,title:'Gastello Street, Moscow - 5159.jpg',output:'nine-reference.webp'},
 {index:7,title:'Domo en strato Fabriĉnaja 17 (Tjumeno).jpg',series:'panel',corners:[[748,56],[855,81],[855,289],[747,276]],sourceBays:2},
 {index:8,title:'A house at Lenina street (Bor).JPG',series:'brick',corners:[[264,259],[488,72],[492,447],[264,502]],sourceBays:4},
 {index:6,title:'Apartment building in Pavlovspy Posad.jpg',series:'nine',corners:[[464,250],[615,164],[616,362],[464,406]],sourceBays:4},
 {index:10,title:'Moscow Kantemitovskaya street 2021-09.jpg',series:'tower',corners:[[706,48],[906,80],[907,162],[706,142]],sourceBays:4},
 {index:11,title:'Valday, Novgorod Oblast, Russia - panoramio (990).jpg',series:'panel335',corners:[[314,274],[419,297],[419,425],[314,411]],sourceBays:4},
];
// Destination unit-square -> source quadrilateral, solved once per crop.
export function homography(corners){
 const rows=[];
 for(let i=0;i<4;i++){const [u,v]=[[0,0],[1,0],[1,1],[0,1]][i],[x,y]=corners[i];rows.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y]);}
 for(let col=0;col<8;col++){let pivot=col;for(let j=col+1;j<8;j++)if(Math.abs(rows[j][col])>Math.abs(rows[pivot][col]))pivot=j;[rows[col],rows[pivot]]=[rows[pivot],rows[col]];const d=rows[col][col];if(Math.abs(d)<1e-9)throw Error('Degenerate crop quadrilateral');for(let k=col;k<9;k++)rows[col][k]/=d;for(let j=0;j<8;j++)if(j!==col){const f=rows[j][col];for(let k=col;k<9;k++)rows[j][k]-=f*rows[col][k];}}
 return [...rows.map(r=>r[8]),1];
}
export function project(h,u,v){const d=h[6]*u+h[7]*v+1;return [(h[0]*u+h[1]*v+h[2])/d,(h[3]*u+h[4]*v+h[5])/d];}
export function rectify(rgb,width,height,corners,outWidth=512,outHeight=512){
 const h=homography(corners),out=new Uint8Array(outWidth*outHeight*3);
 for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++){
  const [sx,sy]=project(h,(x+.5)/outWidth,(y+.5)/outHeight),px=Math.max(0,Math.min(width-2,sx)),py=Math.max(0,Math.min(height-2,sy)),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
  for(let c=0;c<3;c++){const at=(dx,dy)=>rgb[((iy+dy)*width+ix+dx)*3+c];out[(y*outWidth+x)*3+c]=(at(0,0)*(1-fx)+at(1,0)*fx)*(1-fy)+(at(0,1)*(1-fx)+at(1,1)*fx)*fy;}
 }
 return out;
}
async function request(url){
 for(let attempt=0;attempt<4;attempt++){
  await sleep(1500);const r=await fetch(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(45000)});
  if(r.ok)return r;if(r.status!==429&&r.status!==503)throw Error(`${r.status}: ${url}`);
  await sleep(Math.min(30000,5000*(attempt+1)));
 }
 throw Error(`Rate limited: ${url}`);
}
const strip=s=>(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
async function resolveSources(){
 let cached=[];try{cached=JSON.parse(await readFile(`${CACHE}/sources.json`,'utf8'));}catch{}
 const missing=SOURCES.filter(s=>!cached.some(r=>r.title===s.title));
 if(missing.length){
  const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata',titles:missing.map(s=>'File:'+s.title).join('|')});
  const data=await (await request(u)).json();
  for(const page of Object.values(data.query.pages)){const info=page.imageinfo?.[0];if(!info)throw Error(`Missing Commons file: ${page.title}`);cached.push({title:page.title.slice(5),...info});}
  await writeFile(`${CACHE}/sources.json`,JSON.stringify(cached,null,2)+'\n');
 }
 return SOURCES.map(s=>{
  const info=cached.find(r=>r.title===s.title),meta=info.extmetadata,license=strip(meta.LicenseShortName?.value);
  if(!/^(CC0|Public domain|CC BY(?:-SA)? [234]\.[05])$/.test(license))throw Error(`Rejected licence: ${s.title}: ${license}`);
  return {...s,url:info.url.split('?')[0],page:info.descriptionurl,author:strip(meta.Artist?.value),license};
 });
}
async function sourceImage(s){
 const file=`${CACHE}/${s.index}.source`;let bytes;
 try{bytes=await readFile(file);await sharp(bytes).metadata();}catch{bytes=Buffer.from(await(await request(s.url)).arrayBuffer());await writeFile(file,bytes);}
 return sharp(bytes).rotate().resize({width:1000,height:750,fit:'inside'}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
}
function normals(rgb,width,height){
 const out=new Uint8Array(rgb.length),at=(x,y)=>{const i=(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*3;return(rgb[i]*.2126+rgb[i+1]*.7152+rgb[i+2]*.0722)/255;};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const gx=at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1)-at(x-1,y-1)-2*at(x-1,y)-at(x-1,y+1),gy=at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1)-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1),n=Math.hypot(gx*.15,gy*.15,1),i=(y*width+x)*3;
  out[i]=128-gx*.15/n*127;out[i+1]=128+gy*.15/n*127;out[i+2]=128+127/n;
 }return out;
}
function inPolygon(x,y,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [a,b]=polygon[i],[c,d]=polygon[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
async function processCar(records,inventory){
 const raw=await sourceImage(records.find(s=>s.index===0));
 const width=768,height=256;
 let side=rectify(raw.data,raw.info.width,raw.info.height,[[4,278],[542,258],[546,449],[4,486]],width,height);
 const rgba=new Uint8Array(width*height*4);
 // Manual silhouette hints exclude roof rack, parked cars and grass. Wheel crops
 // stay in the reference image; the runtime body has physical wheel cut-outs.
 const silhouette=[[0,.57],[.08,.45],[.27,.43],[.37,.12],[.45,.05],[.69,.06],[.81,.41],[.96,.48],[1,.51],[.99,.84],[.88,.85],[.82,.76],[.79,.99],[.11,.99],[.07,.89],[.03,.83]];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,j=i*3,k=i*4;rgba[k]=side[j];rgba[k+1]=side[j+1];rgba[k+2]=side[j+2];const grass=y/height>.80&&side[j+1]-side[j]>6&&side[j+1]-side[j+2]>8;rgba[k+3]=inPolygon(x/width,y/height,silhouette)&&!grass?255:0;
 }
 await sharp(rgba,{raw:{width,height,channels:4}}).webp({quality:90}).toFile(`${OUT}/car-side.webp`);
 // The mesh supplies the silhouette: replace excluded background with paint,
 // rather than projecting grass or other cars onto its fenders and roof.
 for(let i=0;i<width*height;i++)if(!rgba[i*4+3])side.set([189,190,185],i*3);
 const frontSource=await sourceImage(records.find(s=>s.index===1)),rearSource=await sourceImage(records.find(s=>s.index===3));
 const front=rectify(frontSource.data,frontSource.info.width,frontSource.info.height,[[20,380],[383,380],[374,480],[27,480]],128,256);
 const rear=rectify(rearSource.data,rearSource.info.width,rearSource.info.height,[[394,342],[918,231],[930,376],[407,460]],128,256);
 const windshield=rectify(frontSource.data,frontSource.info.width,frontSource.info.height,[[114,215],[307,215],[339,297],[49,297]],256,128);
 const rearGlass=rectify(rearSource.data,rearSource.info.width,rearSource.info.height,[[213,56],[606,26],[695,157],[226,224]],256,128);
 const top=Buffer.alloc(1024*256*3);for(let i=0;i<top.length;i+=3){const l=188+(i*7%5);top[i]=l;top[i+1]=l+1;top[i+2]=l-5;}
 const atlas=await sharp({create:{width:1024,height:512,channels:3,background:'#bdbdb6'}}).composite([{input:Buffer.from(side),raw:{width:768,height:256,channels:3},left:0,top:0},{input:Buffer.from(front),raw:{width:128,height:256,channels:3},left:768,top:0},{input:Buffer.from(rear),raw:{width:128,height:256,channels:3},left:896,top:0},{input:top,raw:{width:1024,height:256,channels:3},left:0,top:256},{input:Buffer.from(windshield),raw:{width:256,height:128,channels:3},left:0,top:256},{input:Buffer.from(rearGlass),raw:{width:256,height:128,channels:3},left:256,top:256}]).webp({quality:92}).toBuffer();
 await writeFile(`${OUT}/car-atlas.webp`,atlas);inventory.push({file:'car-atlas.webp',sources:[0,1,3],transform:'manual crop homography, photo projection atlas; mirrored opposite side'});
 for(const s of records.filter(s=>s.output&&s.index!==0)){
  await sourceImage(s);const bytes=await readFile(`${CACHE}/${s.index}.source`);
  const image=sharp(bytes).rotate().resize({width:640,height:480,fit:'inside'});
  await(s.index===4?image.png():image.webp({quality:85})).toFile(`${OUT}/${s.output}`);
 }
 for(const s of records.filter(s=>s.output))inventory.push({file:s.output,sources:[s.index],transform:s.index===0?'manual polygon alpha cutout':'reference, resized; not uploaded to GPU'});
}
function inventoryFacade(s,inventory){
 for(const suffix of ['albedo','windows','normal','roughness'])inventory.push({file:`${s.series}-${suffix}.webp`,sources:[s.index],transform:['normal','roughness'].includes(suffix)?'retained legacy derivative reference; not uploaded to GPU':'joint-aligned floor/bay modules; generated by build-facade-modules.mjs'});
}
export async function buildPhotos(){
 await mkdir(OUT,{recursive:true});await mkdir(CACHE,{recursive:true});
 const records=await resolveSources(),inventory=[];
 await processCar(records,inventory);
 for(const s of records.filter(s=>s.series))inventoryFacade(s,inventory);
 // Supplementary CC0 panel-seam reference from Poly Haven (not a second runtime layer).
 const id='concrete_slab_wall_02';let concrete;
 try{concrete=await readFile(`${CACHE}/concrete.jpg`);}catch{const files=await(await request(`https://api.polyhaven.com/files/${id}`)).json();concrete=Buffer.from(await(await request(files.Diffuse['1k'].jpg.url)).arrayBuffer());await writeFile(`${CACHE}/concrete.jpg`,concrete);}
 await sharp(concrete).resize(512,512).webp({quality:85}).toFile(`${OUT}/concrete-reference.webp`);
 inventory.push({file:'concrete-reference.webp',sources:['polyhaven'],transform:'CC0 reference; not uploaded to GPU'});
 const credits=records.filter(s=>s.license.startsWith('CC BY')).map(s=>({title:s.title,author:s.author,url:s.page,license:s.license}));
 await writeFile(`${OUT}/credits.json`,JSON.stringify(credits,null,2)+'\n');
 await writeFile(`${OUT}/manifest.json`,JSON.stringify({version:1,sources:records,files:inventory},null,2)+'\n');
 const sourceLines=records.map(s=>`| Original: ${s.title} | ${s.author} | [Commons](${s.page}) / [original](${s.url}) | ${s.license} |`);
 const fileLines=inventory.map(f=>`| photos/${f.file} | ${f.sources.map(i=>i==='polyhaven'?'Amal Kumar / Poly Haven':records.find(s=>s.index===i)?.author).join('; ')} | ${f.sources.map(i=>i==='polyhaven'?`https://polyhaven.com/a/${id}`:records.find(s=>s.index===i)?.page).join('; ')} | ${f.sources.map(i=>i==='polyhaven'?'CC0':records.find(s=>s.index===i)?.license).join('; ')} |`);
 const marker='<!-- photos-provenance -->',end='<!-- /photos-provenance -->';let doc=await readFile('public/yard/SOURCES.md','utf8'),after='';if(doc.includes(marker)){const start=doc.indexOf(marker),finish=doc.indexOf(end,start);if(finish>=0)after=doc.slice(finish+end.length);doc=doc.slice(0,start);}
 doc+=`\n${marker}\n## Photo materials (2026-10-10)\n\nSource originals remain in ignored artifacts/photos; transformations are reproducible with node scripts/download-yard-photos.mjs. CC BY-SA derivatives retain their source licence. These photographs supersede the earlier procedural-only vehicle description.\n\n| File / original | Author | URL | Licence |\n| --- | --- | --- | --- |\n${sourceLines.concat(fileLines).join('\n')}\n\n- photos/manifest.json: local source metadata, crop corners and derivative inventory.\n- photos/credits.json: CC-BY / CC-BY-SA attribution consumed by the UI stream.\n`;
 await writeFile('public/yard/SOURCES.md',(doc+end+'\n'+after).trimEnd()+'\n');
 let bytes=0;for(const file of await readdir(OUT))bytes+=(await stat(`${OUT}/${file}`)).size;
 if(bytes>15_000_000)throw Error(`Photo files exceed budget: ${bytes}`);
 await buildFacadeModules();
 await correctPhotos({fresh:true});
 console.log('Photo directory bytes:',bytes);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildPhotos();
