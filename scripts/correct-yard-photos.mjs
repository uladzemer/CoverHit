import sharp from 'sharp';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const DIR='public/yard/photos';
export const luminance=(r,g,b)=>(r*.2126+g*.7152+b*.0722)/255;
export function decalResidual(rgb,width=1024,channels=4){
 let residual=0,total=0;
 for(let y=112;y<212;y++)for(let x=250;x<665;x++){
  // Body paint only: chrome handles and door seams are deliberately excluded.
  if(x>545&&y>160||(y>119&&y<137&&(x>375&&x<413||x>535&&x<580))||Math.abs(x-417)<4||Math.abs(y-143)<3)continue;
  const i=(y*width+x)*channels,r=rgb[i],g=rgb[i+1],b=rgb[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
  if(max-min>40||luminance(r,g,b)<.24)residual++;total++;
 }
 return residual/total;
}
export async function cleanCar(input){
 const {data,info}=await sharp(input).removeAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info;
 const original=Buffer.from(data),mask=new Uint8Array(w*h);
 for(let y=99;y<218;y++)for(let x=0;x<768;x++){
  const i=(y*w+x)*3,r=data[i],g=data[i+1],b=data[i+2];
  const stripe=x>328+(212-y)*1.05&&x<552+(212-y)*1.05;
  const number=x>266&&x<340&&y>116&&y<176;
  if(stripe||number||Math.max(r,g,b)-Math.min(r,g,b)>45)mask[y*w+x]=255;
 }
 const expanded=await sharp(mask,{raw:{width:w,height:h,channels:1}}).dilate(5).greyscale().raw().toBuffer();
 // Interpolate the unmarked paint's row illumination. This avoids carrying
 // the luminance of black lettering into the replacement low-frequency field.
 for(let y=99;y<223;y++)for(let x=0;x<768;x++)if(expanded[y*w+x]){
  const sample=sx=>{const i=(y*w+sx)*3;return luminance(original[i],original[i+1],original[i+2])*255;};
  let left=x,right=x;while(left>1&&expanded[y*w+left])left--;while(right<766&&expanded[y*w+right])right++;
  const t=(x-left)/Math.max(1,right-left);
  const shade=Math.max(115,Math.min(205,sample(left)*(1-t)+sample(right)*t));
  const noise=((Math.imul(x+1,73856093)^Math.imul(y+1,19349663))>>>0)%5-2;
  for(let c=0;c<3;c++)data[(y*w+x)*3+c]=shade+noise;
 }
 // Restore fine panel geometry independently of the removed graphic.
 for(let y=111;y<210;y++)for(const x of [230,417])for(let dx=0;dx<2;dx++)data.fill(99,(y*w+x+dx)*3,(y*w+x+dx+1)*3);
 for(let x=20;x<751;x++)for(let c=0;c<3;c++)data[(143*w+x)*3+c]*=.78;
 // Chrome handles retain their photo detail; no decal overlaps these crops.
 for(const [x0,y0,x1,y1]of [[375,120,413,136],[535,120,580,136]])for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*3,l=Math.round(luminance(original[i],original[i+1],original[i+2])*255);data.fill(l,i,i+3);}
 // Roof-rack feet, grille stripes, sponsor sticker and all number plates.
 for(const [x0,y0,x1,y1,value]of [[350,12,378,30,194],[502,12,535,30,194],[768,0,896,18,188],[800,175,865,251,183],[944,22,994,128,177],[942,145,1007,185,174]])for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)data.fill(value,(y*w+x)*3,(y*w+x+1)*3);
 // Coloured strip across the source windshield upper edge.
 for(let y=256;y<270;y++)for(let x=0;x<256;x++)for(let c=0;c<3;c++)data[(y*w+x)*3+c]=data[((y+20)*w+x)*3+c];
 const rgba=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const j=y*w+x,i=j*3,k=j*4;data.copy(rgba,k,i,i+3);
  // Alpha is a paint-remapping mask, not transparency (material is opaque).
  let paint=y>=384||y>=256&&x>=512||y<256&&(x<768?(y>=109||y<30||x<230||x>590):y<20||y>130);
  if(y>=120&&y<136&&(x>=375&&x<413||x>=535&&x<580))paint=false;
  // Nonzero sentinel preserves glass RGB through WebP's transparent-pixel
  // optimisation. The shader thresholds the sentinel back to zero.
  rgba[k+3]=paint?255:16;
 }
 return {rgba,width:w,height:h,mask:expanded,residual:decalResidual(rgba,w)};
}
export async function normalizeFacade(input){
 const {data,info}=await sharp(input).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height}=info,means=[0,0,0];let n=0;
 for(let i=0;i<data.length;i+=3){const l=luminance(data[i],data[i+1],data[i+2]);if(l>.30&&l<.88){for(let c=0;c<3;c++)means[c]+=data[i+c];n++;}}
 const neutral=means.reduce((a,b)=>a+b,0)/3,gains=means.map(m=>neutral/m);
 for(let i=0;i<data.length;i+=3)for(let c=0;c<3;c++)data[i+c]=Math.min(240,data[i+c]*gains[c]);
 const low=await sharp(data,{raw:{width,height,channels:3}}).greyscale().blur(32).raw().toBuffer();
 for(let i=0;i<width*height;i++){
  const gain=Math.max(.7,Math.min(1.65,132/Math.max(70,low[i])));
  for(let c=0;c<3;c++)data[i*3+c]=Math.min(230,data[i*3+c]*gain);
 }
 // Equal boundary texels with an eight-pixel blend preserve upright repeats.
 for(let x=0;x<width;x++)for(let y=0;y<8;y++)for(let c=0;c<3;c++){const a=(y*width+x)*3+c,b=((height-1-y)*width+x)*3+c,mean=(data[a]+data[b])/2,t=(8-y)/8;data[a]=data[a]*(1-t)+mean*t;data[b]=data[b]*(1-t)+mean*t;}
 return {data,width,height,gains};
}
export async function correctPhotos({fresh=false}={}){
 const cache='artifacts/exposure-source';await mkdir(cache,{recursive:true});await mkdir('docs/qa/exposure',{recursive:true});
 const source=async file=>{const saved=`${cache}/${file}`;if(fresh)await copyFile(`${DIR}/${file}`,saved);else try{await readFile(saved);}catch{await copyFile(`${DIR}/${file}`,saved);}return saved;};
 const car=await cleanCar(await source('car-atlas.webp'));
 await sharp(car.rgba,{raw:{width:car.width,height:car.height,channels:4}}).webp({quality:95,alphaQuality:100}).toFile(`${DIR}/car-atlas.webp`);
 const side=await sharp(`${DIR}/car-atlas.webp`).extract({left:0,top:0,width:768,height:256}).png().toBuffer();await sharp(side).webp({quality:95}).toFile(`${DIR}/car-side.webp`);
 const facades={};
 const currentManifest=JSON.parse(await readFile(`${DIR}/manifest.json`));
 for(const series of ['panel','panel335','brick','nine','tower']){
  const modular=currentManifest.version>=2;
  const result=modular?{gains:[1,1,1]}:await normalizeFacade(await source(`${series}-albedo.webp`));
  if(!modular)await sharp(result.data,{raw:{width:result.width,height:result.height,channels:3}}).webp({quality:94}).toFile(`${DIR}/${series}-albedo.webp`);
  const {data}=await sharp(`${DIR}/${series}-albedo.webp`).removeAlpha().raw().toBuffer({resolveWithObject:true});let sum=0;const means=[0,0,0];for(let i=0;i<data.length;i+=3){sum+=luminance(...data.subarray(i,i+3));for(let c=0;c<3;c++)means[c]+=data[i+c]/255;}facades[series]={luminance:sum/(data.length/3),channels:means.map(v=>v/(data.length/3)),whiteBalanceGains:result.gains};
 }
 const shipped=await sharp(`${DIR}/car-atlas.webp`).ensureAlpha().raw().toBuffer();
 const report={car:{decalResidual:decalResidual(shipped),threshold:.01,method:'Colour/known lettering mask, five-pixel dilation, interpolated unmarked row luminance + deterministic noise; reconstructed panel lines; photographic handles/glass retained.'},facades};
 await writeFile('docs/qa/exposure/assets.json',JSON.stringify(report,null,2)+'\n');
 if(report.car.decalResidual>=report.car.threshold)throw Error('Civilian paint decal residual exceeds threshold');
 const manifest=JSON.parse(await readFile(`${DIR}/manifest.json`));for(const f of manifest.files){if(f.file==='car-atlas.webp'||f.file==='car-side.webp')f.transform=f.transform.split('; civilian')[0]+'; civilian decal removal, alpha paint mask';if(f.file.endsWith('-albedo.webp'))f.transform=f.transform.split('; neutral gray-world')[0]+'; neutral gray-world balance and blurred luminance division';}await writeFile(`${DIR}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(report));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await correctPhotos();
