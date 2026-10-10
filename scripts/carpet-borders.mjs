import {rectifyCarpet,carpetHomography,quadSize} from './carpet-image.mjs';

// Invert the crop projection for independently reviewed source landmarks.
export function sourceToCrop(corners,point) {
 const project=carpetHomography(corners),size=quadSize(corners);
 let x=size.width/2,y=size.height/2;
 for(let i=0;i<12;i++) {
  const p=project(x,y),px=project(x+1,y),py=project(x,y+1),ex=point[0]-p[0],ey=point[1]-p[1];
  const a=px[0]-p[0],b=py[0]-p[0],c=px[1]-p[1],d=py[1]-p[1],det=a*d-b*c;
  x+=(d*ex-b*ey)/det;y+=(-c*ex+a*ey)/det;
 }
 return [x,y];
}
export const borderMismatch=(a,b)=>Math.abs(a-b)/((a+b)/2);

export function cutFieldLandmarks(report,fieldCorners) {
 const size=quadSize(report.corners),sx=(report.after.width+report.insets[1]+report.insets[3])/size.width,sy=(report.after.height+report.insets[0]+report.insets[2])/size.height;
 return fieldCorners.map(p=>sourceToCrop(report.corners,p)).map(([x,y])=>[x*sx-report.insets[3],y*sy-report.insets[0]]);
}
export async function measureDecodedCutBorders(file,report,fieldCorners) {
 const {width:w,height:h}=report.after;
 return measureBorderWidths(file,[[0,0],[w-1,0],[w-1,h-1],[0,h-1]],cutFieldLandmarks(report,fieldCorners),{maxSize:1600});
}

// Track a reviewed enclosing-field boundary in RGB edge profiles. Search hints
// identify which of several nested woven frames to measure, not its exact width.
export async function measureBorderWidths(file,corners,fieldCorners,{maxSize=Infinity}={}) {
 const image=await rectifyCarpet(file,corners,{maxSize});
 const {data,info}=await image.resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).raw().toBuffer({resolveWithObject:true});
 const size=quadSize(corners),sx=info.width/size.width,sy=info.height/size.height;
 const field=fieldCorners.map(p=>sourceToCrop(corners,p)).map(([x,y])=>[x*sx,y*sy]);
 const sides=[[field[0],field[3],0,false],[field[1],field[2],0,true],[field[0],field[1],1,false],[field[3],field[2],1,true]];
 const pixel=(x,y,k)=>data[(Math.max(0,Math.min(info.height-1,Math.round(y)))*info.width+Math.max(0,Math.min(info.width-1,Math.round(x))))*3+k];
 const widths=sides.map(([a,b,axis,reverse])=>{
  const lanes=[];
  for(let lane=0;lane<41;lane++) {
   const t=.2+.6*lane/40,p=a.map((v,k)=>v+(b[k]-v)*t),center=p[axis];
   let best=Math.round(center),score=-Infinity;
   for(let n=Math.round(center)-8;n<=Math.round(center)+8;n++) {
    if(n<3||n>=(axis===0?info.width:info.height)-3)continue;
    // Three-pixel local averages suppress photographed pile noise.
    const rgb=[0,1,2].map(k=>{
     let low=0,high=0;
     for(let offset=1;offset<=3;offset++){low+=pixel(axis===0?n-offset:p[0],axis===1?n-offset:p[1],k);high+=pixel(axis===0?n+offset:p[0],axis===1?n+offset:p[1],k);}
     return (high-low)/3;
    });
    const edge=Math.hypot(...rgb);
    if(edge>score){score=edge;best=n;}
   }
   lanes.push(reverse?(axis===0?info.width:info.height)-1-best:best);
  }
  lanes.sort((a,b)=>a-b);return lanes[20]/(axis===0?sx:sy);
 });
 const [left,right,top,bottom]=widths;
 return {left,right,top,bottom,lr: borderMismatch(left,right),tb:borderMismatch(top,bottom),width:size.width,height:size.height};
}
