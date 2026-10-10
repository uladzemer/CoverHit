import sharp from 'sharp';
import {quadSize} from '../carpet-image.mjs';
import {measureBorderWidths} from '../carpet-borders.mjs';
import {ringMetrics} from './metrics.mjs';
import {wovenEdge,insetRegion} from './finish.mjs';

// Equalize only independently reviewed symmetric pairs, using inward cuts.
// Never stretch the pattern or impose equality on intrinsically unequal ends.
export async function balanceCut(file,corners,finished,clusters,{symmetry,outputAspect}={}) {
 if(!symmetry)return finished;
 const borders=await measureBorderWidths(file,corners,symmetry.fieldCorners,{maxSize:1600}),s=quadSize(corners);
 const sx=(finished.width+finished.insets[1]+finished.insets[3])/s.width,sy=(finished.height+finished.insets[0]+finished.insets[2])/s.height;
 const [t,r,b,l]=finished.insets;
 const widths=[borders.top*sy-t,borders.right*sx-r,borders.bottom*sy-b,borders.left*sx-l],extra=[0,0,0,0];
 for(const pair of symmetry.pairs) {
  const [a,b]=pair==='lr'?[3,1]:[0,2],diff=widths[a]-widths[b];
  if(diff>0)extra[a]=Math.round(diff);else extra[b]=Math.round(-diff);
 }
 for(let i=0;i<4;i++)extra[i]+=symmetry.pixelBias?.[i]??0;
 const alignAspect=()=>{if(outputAspect) {
  const width=finished.width-extra[1]-extra[3],height=finished.height-extra[0]-extra[2];
  if(width/height>outputAspect){const remaining=width-Math.round(height*outputAspect);extra[3]+=Math.floor(remaining/2);extra[1]+=Math.ceil(remaining/2);}
  else {const remaining=height-Math.round(width/outputAspect);extra[0]+=Math.floor(remaining/2);extra[2]+=Math.ceil(remaining/2);}
 }};
 alignAspect();
 let data,info,metrics;
 for(let attempt=0;attempt<=18;attempt++) {
  const region=insetRegion(finished.width,finished.height,extra);
  ({data,info}=await sharp(finished.cutData,{raw:{width:finished.width,height:finished.height,channels:3}}).extract(region).raw().toBuffer({resolveWithObject:true}));
  metrics=ringMetrics(data,info.width,info.height,clusters);
  if(!metrics.outerLeakage&&metrics.nextLeakage<=.005)break;
  if(attempt===18)throw Error('Symmetry inset exposes surround-like pixels; review corners');
  // Paired one-pixel steps preserve measured symmetry while removing ringing.
  for(let i=0;i<4;i++)extra[i]++;
  alignAspect();
 }
 const finalWidths=widths.map((w,i)=>w-extra[i]);
 return {...finished,insets:finished.insets.map((v,i)=>v+extra[i]),symmetryInsets:extra,unpolished:metrics,cutData:data,data:wovenEdge(data,info.width,info.height),width:info.width,height:info.height,borders:{left:finalWidths[3]/sx,right:finalWidths[1]/sx,top:finalWidths[0]/sy,bottom:finalWidths[2]/sy,lr:Math.abs(finalWidths[3]-finalWidths[1])/((finalWidths[3]+finalWidths[1])/2),tb:Math.abs(finalWidths[0]-finalWidths[2])/((finalWidths[0]+finalWidths[2])/2)}};
}
