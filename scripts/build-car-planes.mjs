import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {CAR_PROFILE} from '../src/scene/yard/car.js';

// The exposure-cleaned atlas remains the source; never run decal cleanup on
// this transparency atlas (its alpha is coverage, not the old paint mask).
export async function buildCarPlanes(){
 const {data}=await sharp('public/yard/photos/car-atlas.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const out=Buffer.alloc(1024*512*4);
 const inside=(x,y)=>{let hit=false;for(let i=0,j=CAR_PROFILE.length-1;i<CAR_PROFILE.length;j=i++){const a=CAR_PROFILE[i],b=CAR_PROFILE[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 const sourceX=x=>{const dst=[0,161,196,292,504,590,607,767],src=[0,120,232,294,511,580,597,767];let k=0;while(k<dst.length-2&&x>dst[k+1])k++;return src[k]+(x-dst[k])/(dst[k+1]-dst[k])*(src[k+1]-src[k]);};
 const sourceOutline=[[0,.57],[.08,.45],[.27,.43],[.37,.12],[.45,.05],[.69,.06],[.81,.41],[.96,.48],[1,.51],[.99,.84],[.88,.85],[.82,.76],[.79,.99],[.11,.99],[.07,.89],[.03,.83]];
 const inSource=(x,y)=>{let hit=false;for(let i=0,j=sourceOutline.length-1;i<sourceOutline.length;j=i++){const a=sourceOutline[i],b=sourceOutline[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 for(let y=0;y<256;y++)for(let x=0;x<768;x++){
  const length=(x/767-.5)*4.17,height=(1-y/255)*1.4;
  // Roof and sill landmarks are exact horizontal lines, wheel centres at .31m.
  const sy=y<199?32+y/199*(214-32):214+(y-199)/56*41;
  const sx=sourceX(x),i=(Math.min(255,Math.round(sy))*1024+Math.round(sx))*4,k=(y*1024+x)*4;
  data.copy(out,k,i,i+3);
  const arch=[-1.21,1.21].some(cx=>Math.hypot(length-cx,height-.31)<.322);
  const edge=Math.min(1,Math.max(0,(2.085-Math.abs(length))/.035));
  const grass=data[i+1]-data[i]>6&&data[i+1]-data[i+2]>8;
  out[k+3]=inside(length,height)&&inSource(sx/768,sy/256)&&!arch&&!grass?Math.round(255*edge):0;
 }
 for(const start of [768,896])for(let y=0;y<256;y++)for(let x=0;x<128;x++){
  const i=(y*1024+start+x)*4;data.copy(out,i,i,i+3);
  out[i+3]=Math.round(255*Math.min(1,x/3,(127-x)/3,y/3,(255-y)/3));
 }
 // A circular rim crop shares the flat-plane atlas, so it costs no extra draw.
 const rim=await sharp('public/yard/photos/car-atlas.webp').extract({left:85,top:178,width:70,height:70}).resize(128,128).ensureAlpha().raw().toBuffer();
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,k=((y+256)*1024+x+768)*4;rim.copy(out,k,i,i+3);out[k+3]=Math.hypot(x-63.5,y-63.5)<62?255:0;}
 await sharp(out,{raw:{width:1024,height:512,channels:4}}).webp({quality:96,alphaQuality:100}).toFile('public/yard/photos/car-flat-atlas.webp');
 const p='public/yard/photos/manifest.json',manifest=JSON.parse(await readFile(p));
 const entry={file:'car-flat-atlas.webp',sources:[0,1,3,4],transform:'civilian cleaned photo; piecewise wheelbase landmark rectification (2.42m); manual body silhouette and wheel-arch alpha; flat side/end cards; circular photo rim crop'};
 const old=manifest.files.findIndex(f=>f.file===entry.file);if(old<0)manifest.files.push(entry);else manifest.files[old]=entry;
 manifest.carPlanes={wheelbase:2.42,wheelRadius:.31,sideOffset:.818,curvedProjection:false,sourceWheelCentres:[120,597],targetWheelCentres:[161,607],sourceSill:214,targetSill:199};
 await writeFile(p,JSON.stringify(manifest,null,2)+'\n');
 const sources='public/yard/SOURCES.md';let doc=await readFile(sources,'utf8');const refs=entry.sources.map(id=>manifest.sources.find(s=>s.index===id)),line=`| photos/car-flat-atlas.webp | ${refs.map(s=>s.author).join('; ')} | ${refs.map(s=>s.page).join('; ')} | ${refs.map(s=>s.license).join('; ')} |`;doc=doc.includes('| photos/car-flat-atlas.webp |')?doc.replace(/^\| photos\/car-flat-atlas\.webp \|.*$/m,line):doc+'\n'+line+'\n';await writeFile(sources,doc);
}
if(process.argv[1]?.endsWith('build-car-planes.mjs'))await buildCarPlanes();
