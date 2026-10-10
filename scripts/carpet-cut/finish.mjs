import sharp from 'sharp';
import {ringMetrics} from './metrics.mjs';

export function insetRegion(width,height,insets) {
 const [top,right,bottom,left]=insets;
 return {left,top,width:width-left-right,height:height-top-bottom};
}
// Search each side independently: no edge painting may hide a failed cut.
export function adaptiveInset(data,w,h,clusters,{maxFraction=.012,minFraction=.003}={}) {
 const insets=[0,0,0,0],limits=[h,w,h,w].map(n=>Math.ceil(n*maxFraction));
 // Cache classification once. Inset searches repeatedly inspect overlapping bands.
 const bg=new Uint8Array(w*h);
 const margin=Math.ceil(Math.max(w,h)*maxFraction)+14;
 if(clusters.length)for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(Math.min(x,y,w-1-x,h-1-y)<margin)bg[y*w+x]=matchesBackground(data,(y*w+x)*3,clusters)?1:0;
 const sample=(side,along,depth)=>{
  const x=side===0||side===2?along:side===1?w-1-depth:depth;
  const y=side===1||side===3?along:side===0?depth:h-1-depth;
  return (y*w+x)*3;
 };
 // Inspect a full twelve-pixel band, not a sample of favorable edge positions.
 const isBackground=(i)=>{
  // Use the same Lab metric as the independent decoded-output audit.
  return bg[i/3];
 };
 for(let side=0;side<4;side++) {
  const depthLength=side%2?w:h;
  // Horizontal sides run across width; vertical sides run across height.
  const alongLength=side%2?h:w;
  let chosen=Math.ceil(depthLength*minFraction),found=false;
  for(let depth=chosen;depth<=limits[side];depth++) {
   let outer=0,next=0,total=0;
   const cornerMargin=Math.max(...limits)+12;
   for(let d=0;d<12;d++)for(let along=cornerMargin;along<alongLength-cornerMargin;along++) {
    if(isBackground(sample(side,along,depth+d))){if(d<4)outer++;else next++;}if(d>=4)total++;
   }
   if(!outer&&next/Math.max(1,total)<=.005){chosen=depth;found=true;break;}
  }
  insets[side]=chosen;
  if(!found&&clusters.length)insets[side]=limits[side]+1;
 }
 // Recheck the complete rectangular perimeter, including all four corners.
 for(let iteration=0;iteration<Math.max(...limits);iteration++) {
  const r=insetRegion(w,h,insets),bad=[false,false,false,false];
  for(let s=0;s<4;s++)for(let d=0;d<4;d++)for(let n=0;n<(s%2?r.height:r.width);n++) {
   const x=s%2?(s===1?r.left+r.width-1-d:r.left+d):r.left+n;
   const y=s%2?r.top+n:(s===0?r.top+d:r.top+r.height-1-d);
   if(bg[y*w+x])bad[s]=true;
  }
  if(!bad.some(Boolean))break;
  let changed=false;for(let s=0;s<4;s++)if(bad[s]&&insets[s]<=limits[s]){insets[s]++;changed=true;}if(!changed)break;
 }
 const region=insetRegion(w,h,insets);
 return {insets,region,withinBudget:insets.every((n,i)=>n<=limits[i])};
}
import {rgbLab,deltaE} from './metrics.mjs';
const matchesBackground=(data,i,clusters)=>{
 if(!clusters.length)return false;
 const lab=rgbLab([data[i],data[i+1],data[i+2]]);return clusters.some(c=>deltaE(lab,c.lab)<12);
};
export function wovenEdge(data,w,h) {
 const result=Buffer.from(data),wx=Math.max(1,Math.round(w*.004)),wy=Math.max(1,Math.round(h*.004));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
  const d=Math.min(Math.min(x,w-1-x)/wx,Math.min(y,h-1-y)/wy);if(d>=1)continue;
  const i=(y*w+x)*3,luma=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
  const hash=((x*73856093)^(y*19349663))>>>0,noise=(hash%101/100-.5)*.018;
  const strength=(1-d)*(.08+noise)+(x%2===y%2?.008:0);
  for(let k=0;k<3;k++)result[i+k]=Math.round((data[i+k]*.97+luma*.03)*(1-strength));
 }
 return result;
}
export async function finishCut(image,clusters,options={}) {
 const {data,info}=await image.raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height;
 const inset=adaptiveInset(data,w,h,clusters,options);
 const {data:cut,info:size}=await sharp(data,{raw:{width:w,height:h,channels:3}}).extract(inset.region).raw().toBuffer({resolveWithObject:true});
 const unpolished=ringMetrics(cut,size.width,size.height,clusters);
 return {...inset,unpolished,cutData:cut,data:wovenEdge(cut,size.width,size.height),width:size.width,height:size.height};
}
