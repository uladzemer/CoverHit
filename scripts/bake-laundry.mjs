import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {laundry,laundryHeight} from '../src/scene/yard/layout.js';

export const COLS=12,ROWS=16,FRAMES=151,FPS=30;
export const ITEMS=[['bed-sheet',.44,1.15,0],['duvet-cover',.44,1.25,0],['towel-blue',.3,.72,0],['towel-cream',.3,.8,0],['shirt',.4,.67,1],['trousers',.32,.97,2],['pyjama-top',.4,.7,1],['sock-left',.13,.28,0],['sock-right',.13,.28,0],['pillowcase',.3,.48,0]];
const smooth=t=>t*t*(3-2*t);
/** Damped Verlet + structural/shear/bending distance constraints, offline only. */
export function simulate(shape,level,seed=464){
 const seedPhase=((seed>>>0)^464)*.001;
 const count=COLS*ROWS,p=new Float64Array(count*3),old=new Float64Array(count*3),rest=new Float64Array(count*3),links=[];
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
  const i=(y*COLS+x)*3,u=x/(COLS-1),v=y/(ROWS-1);
  const width=shape===1?(v<.3?1:.67):1;
  p[i]=(u-.5)*width;p[i+1]=-v-.045*Math.sin(u*Math.PI);p[i+2]=.015*Math.sin(u*19)*v;
  if(shape===3){p[i]=u-.5;p[i+1]=-.2*Math.sin(u*Math.PI)+(v-.5)*.008;p[i+2]=0;}
 }
 old.set(p);rest.set(p);
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1],[2,0],[0,2]]){
  if(x+dx<0||x+dx>=COLS||y+dy>=ROWS)continue;
  const a=(y*COLS+x)*3,b=((y+dy)*COLS+x+dx)*3;links.push([a,b,Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2]),dx===2||dy===2?.25:1]);
 }
 const pinned=i=>shape===3?(i/3%COLS===0||i/3%COLS===COLS-1):(i===0||i===(COLS-1)*3);
 const result=[];
 for(let frame=0;frame<FRAMES+180;frame++){
  for(let sub=0;sub<2;sub++){
   const t=(frame+sub/2)/FPS,h=1/(FPS*2),speed=[.5,2.5,5][level],pulse=1+.23*Math.sin(t*Math.PI*2/5)+.12*Math.sin(t*Math.PI*4/5);
   for(let i=0;i<p.length;i+=3){if(pinned(i))continue;const v=Math.floor(i/3/COLS)/(ROWS-1);
    for(let k=0;k<3;k++){const pos=p[i+k],acc=k===1?-9.81:k===2?speed*pulse*(.55+.3*Math.sin(t*3.77+p[i]*5+v*2+seedPhase)):.15*Math.sin(t*2.51+v*7+seedPhase);p[i+k]+=(pos-old[i+k])*.985+acc*h*h;old[i+k]=pos;}
   }
   for(let iter=0;iter<9;iter++){
    for(const [a,b,len,stiff] of links){const dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],d=Math.hypot(dx,dy,dz),wa=pinned(a)?0:1,wb=pinned(b)?0:1;
     if(d<1e-10||wa+wb===0)continue;const f=(d-len)/d*stiff/(wa+wb);
     p[a]+=dx*f*wa;p[a+1]+=dy*f*wa;p[a+2]+=dz*f*wa;p[b]-=dx*f*wb;p[b+1]-=dy*f*wb;p[b+2]-=dz*f*wb;
    }
    for(let i=0;i<p.length;i+=3)if(pinned(i))for(let k=0;k<3;k++)p[i+k]=rest[i+k];
   }
  }
  if(frame>=180)result.push(Float32Array.from(p));
 }
 // Match the end state exactly; normals are derived from the closed positions.
 for(let f=FRAMES-16;f<FRAMES;f++){const w=smooth((f-(FRAMES-16))/15);for(let i=0;i<p.length;i++)result[f][i]=result[f][i]*(1-w)+result[0][i]*w;}
 return result;
}
export function bake(){
 const width=COLS*ROWS,height=FRAMES*3*4,data=new Uint8Array(width*height*4),bounds={min:[-.8,-1.4,-.8],max:[.8,.2,1.4]};
 for(let shape=0;shape<4;shape++)for(let clip=0;clip<3;clip++){
  const frames=simulate(shape,clip);
  for(let f=0;f<FRAMES;f++)for(let v=0;v<width;v++){
   const dst=(((shape*3+clip)*FRAMES+f)*width+v)*4;
   for(let k=0;k<3;k++){const value=frames[f][v*3+k];if(!Number.isFinite(value)||value<bounds.min[k]||value>bounds.max[k])throw Error(`Bake bounds ${shape}/${clip}: ${value}`);data[dst+k]=Math.round((value-bounds.min[k])/(bounds.max[k]-bounds.min[k])*255);}data[dst+3]=255;
  }
 }
 return {data,manifest:{version:1,seed:464,format:'rgba8-bounds',file:'positions.bin',width,height,cols:COLS,rows:ROWS,frames:FRAMES,fps:FPS,duration:5,bounds,templates:['sheet','shirt','trousers','rope'],clips:['calm','breeze','strong'],items:ITEMS.map(([name,width,height,template],i)=>({name,width,height,template,line:i%2,slot:Math.floor(i/2),phase:i*.371,pins:[0,COLS-1],restTransform:{position:[laundry.lines[i%2],laundryHeight(laundry.from+.25+Math.floor(i/2)*(laundry.to-laundry.from-.5)/4),laundry.from+.25+Math.floor(i/2)*(laundry.to-laundry.from-.5)/4],rotationY:Math.PI/2,scale:[width,height,.32]}}))}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {data,manifest}=bake();await mkdir('public/yard/laundry',{recursive:true});await writeFile('public/yard/laundry/positions.bin',data);await writeFile('public/yard/laundry/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(`Laundry VAT: ${data.byteLength} bytes`);}
