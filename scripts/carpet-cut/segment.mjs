import sharp from 'sharp';
import {rgbLab,deltaE} from './metrics.mjs';
import {fitLine,intersectLines,leastSquaresLine,validateQuad} from './fit.mjs';

function insideQuad(x,y,q) {
 return q.every((a,i)=>{const b=q[(i+1)%4];return (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])>=0;});
}
export function textureEnergy(data,w,h) {
 const energy=new Float32Array(w*h),luma=new Float32Array(w*h);
 for(let i=0;i<luma.length;i++)luma[i]=.2126*data[i*3]+.7152*data[i*3+1]+.0722*data[i*3+2];
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++) {
  let sum=0,sq=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const v=luma[(y+dy)*w+x+dx];sum+=v;sq+=v*v;}
  energy[y*w+x]=Math.sqrt(Math.max(0,sq/25-(sum/25)**2));
 }
 return energy;
}
export function backgroundModel(data,w,h,prior,fullBleed=false) {
 if(fullBleed)return [];
 const energy=textureEnergy(data,w,h),samples=[];
 const depth=Math.max(3,Math.round(Math.min(w,h)*.035));
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2) {
  if(Math.min(x,y,w-1-x,h-1-y)>=depth||insideQuad(x,y,prior)||energy[y*w+x]>9)continue;
  samples.push(rgbLab(Array.from(data.subarray((y*w+x)*3,(y*w+x)*3+3))));
 }
 if(samples.length<12)return [];
 samples.sort((a,b)=>a[0]-b[0]);
 let centers=[.15,.5,.85].map(t=>samples[Math.floor((samples.length-1)*t)]),groups;
 for(let iteration=0;iteration<10;iteration++) {
  groups=centers.map(()=>[]);for(const p of samples){let k=0;for(let j=1;j<centers.length;j++)if(deltaE(p,centers[j])<deltaE(p,centers[k]))k=j;groups[k].push(p);}
  centers=groups.map((g,i)=>g.length?g.reduce((a,p)=>a.map((v,k)=>v+p[k]/g.length),[0,0,0]):centers[i]);
 }
 const clusters=groups.map((g,i)=>({lab:centers[i],fraction:g.length/samples.length})).filter(c=>c.fraction>.12);
 // A photographic frame at the image perimeter is not the rug's surround.
 // Keep only clusters also observed just outside the reviewed woven rectangle.
 const adjacent=[];
 for(let side=0;side<4;side++) {
  const a=prior[side],b=prior[(side+1)%4],length=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[(b[1]-a[1])/length,-(b[0]-a[0])/length];
  for(let j=0;j<100;j++)for(const depth of [2,4,6]) {
   const t=.05+.9*j/99,x=Math.round(a[0]+(b[0]-a[0])*t+normal[0]*depth),y=Math.round(a[1]+(b[1]-a[1])*t+normal[1]*depth);
   if(x<0||y<0||x>=w||y>=h||energy[y*w+x]>9)continue;
   adjacent.push(rgbLab(Array.from(data.subarray((y*w+x)*3,(y*w+x)*3+3))));
  }
 }
 const supported=clusters.filter(c=>adjacent.filter(p=>deltaE(p,c.lab)<12).length>adjacent.length*.04);
 return supported.length?supported:clusters;
}
function morph(mask,w,h,dilate) {
 const result=new Uint8Array(mask.length);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++) {
  let v=dilate?0:1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const p=mask[(y+dy)*w+x+dx];v=dilate?Math.max(v,p):Math.min(v,p);}result[y*w+x]=v;
 }
 return result;
}
export function cleanMask(mask,w,h) {
 mask=morph(morph(morph(morph(mask,w,h,true),w,h,false),w,h,false),w,h,true);
 const visited=new Uint8Array(mask.length);let largest=[];
 const flood=(start,value)=>{const queue=[start];visited[start]=1;for(let j=0;j<queue.length;j++){const i=queue[j],x=i%w,y=Math.floor(i/w);for(const n of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(n>=0&&!visited[n]&&mask[n]===value){visited[n]=1;queue.push(n);}}return queue;};
 for(let i=0;i<mask.length;i++)if(mask[i]&&!visited[i]){const c=flood(i,1);if(c.length>largest.length)largest=c;}
 mask=new Uint8Array(mask.length);for(const i of largest)mask[i]=1;
 visited.fill(0);for(let i=0;i<mask.length;i++)if(!mask[i]&&!visited[i]){const c=flood(i,0);if(!c.some(j=>j%w===0||j%w===w-1||j<w||j>=w*(h-1)))for(const j of c)mask[j]=1;}
 return mask;
}
export async function analyzeSource(file,corners,{fullBleed=false,manual=false,keepEnds=false}={}) {
 const meta=await sharp(file).metadata();
 const {data,info}=await sharp(file).resize({width:700,height:700,fit:'inside',withoutEnlargement:true}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,sx=w/meta.width,sy=h/meta.height,prior=corners.map(([x,y])=>[x*sx,y*sy]);
 if(fullBleed)return {corners,method:'full-bleed prior (no visible background)',clusters:[],lines:[],points:[],sourceWidth:meta.width,sourceHeight:meta.height};
 const clusters=backgroundModel(data,w,h,prior,fullBleed),energy=textureEnergy(data,w,h),raw=new Uint8Array(w*h);
 for(let i=0;i<raw.length;i++){const lab=rgbLab(Array.from(data.subarray(i*3,i*3+3))),distance=clusters.length?Math.min(...clusters.map(c=>deltaE(lab,c.lab))):100;raw[i]=distance>16||(distance>7&&energy[i]>12)?1:0;}
 const mask=cleanMask(raw,w,h),points=[],lines=[];
 for(let side=0;side<4;side++) {
  const a=prior[side],b=prior[(side+1)%4],length=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[-(b[1]-a[1])/length,(b[0]-a[0])/length],ps=[];
  const pixel=(p)=>{const x=Math.round(p[0]),y=Math.round(p[1]);return x<0||y<0||x>=w||y>=h?-1:y*w+x;};
  // Prior-local transitions reject nearby picture frames and internal motifs.
  const range=Math.max(5,Math.min(w,h)*.025);
  for(let lane=0;lane<160;lane++) {
   const t=.025+.95*lane/159,base=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];let best=null;
   for(let d=-range;d<=range;d+=.5) {
    const p=[base[0]+normal[0]*d,base[1]+normal[1]*d],outside=pixel([p[0]-normal[0]*2,p[1]-normal[1]*2]),inside=pixel([p[0]+normal[0]*2,p[1]+normal[1]*2]);
    if(outside<0||inside<0||mask[outside]||!mask[inside])continue;
    const difference=Math.hypot(...[0,1,2].map(k=>data[inside*3+k]-data[outside*3+k]));
    const score=difference-Math.abs(d)*3;if(!best||score>best.score)best={p,score};
   }
   if(best)ps.push(best.p.map((v,k)=>v/(k===0?sx:sy)));
  }
  points.push(ps);
  try{lines.push(fitLine(ps,{threshold:1.6/Math.min(sx,sy)}));}catch{lines.push(null);}
 }
 let fitted=corners,method='manual prior';
 if(!manual&&!fullBleed&&lines.every((l,i)=>l||keepEnds&&i%2===0)) {
  const used=lines.map((l,i)=>keepEnds&&i%2===0?leastSquaresLine([corners[i],corners[(i+1)%4]]):l);
  const q=used.map((l,i)=>intersectLines(used[(i+3)%4],l));
  if(validateQuad(q,corners)&&q.every(([x,y])=>x>=0&&y>=0&&x<meta.width&&y<meta.height)){fitted=q;method=keepEnds?'fit sides / reviewed woven ends':'automatic line fit';}
 }
 if(fullBleed)method='full-bleed prior (no visible background)';
 return {corners:fitted,method,clusters,lines,points,sourceWidth:meta.width,sourceHeight:meta.height};
}
