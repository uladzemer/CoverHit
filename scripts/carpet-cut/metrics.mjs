import sharp from 'sharp';

export function rgbLab(rgb) {
 const c=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
 const x=f((.4124564*c[0]+.3575761*c[1]+.1804375*c[2])/.95047);
 const y=f(.2126729*c[0]+.7151522*c[1]+.072175*c[2]);
 const z=f((.0193339*c[0]+.119192*c[1]+.9503041*c[2])/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
export const deltaE=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function ringMetrics(data,width,height,clusters) {
 const count=[0,0],leak=[0,0];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
  const d=Math.min(x,y,width-1-x,height-1-y);if(d>=12)continue;
  const ring=d<4?0:1;count[ring]++;
  const i=(y*width+x)*3,lab=rgbLab([data[i],data[i+1],data[i+2]]);
  if(clusters.some(c=>deltaE(lab,c.lab)<12))leak[ring]++;
 }
 return {outerLeakage:leak[0]/count[0],nextLeakage:leak[1]/count[1],outerPixels:count[0],nextPixels:count[1],outerLeakPixels:leak[0],nextLeakPixels:leak[1]};
}
export async function imageMetrics(file,clusters) {
 const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
 return {...ringMetrics(data,info.width,info.height,clusters),width:info.width,height:info.height};
}
// Four positions per side, 6% of the perpendicular dimension deep, exactly 3x.
export async function edgeSheet(file,output) {
 const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,tiles=[];let cellW=0,cellH=0;
 for(let side=0;side<4;side++)for(let lane=0;lane<4;lane++) {
  const horizontal=side<2,length=horizontal?w:h,depth=Math.max(1,Math.round((horizontal?h:w)*.06));
  const span=Math.max(1,Math.round(length*.12)),along=Math.min(length-span,Math.round((length-span)*lane/3));
  const region=horizontal?{left:along,top:side===0?0:h-depth,width:span,height:depth}:{left:side===2?0:w-depth,top:along,width:depth,height:span};
  let tile=sharp(await sharp(data,{raw:{width:w,height:h,channels:3}}).extract(region).png().toBuffer());
  if(!horizontal)tile=tile.rotate(side===2?90:270);
  const input=await tile.resize(span*3,depth*3,{kernel:'nearest'}).png().toBuffer();
  tiles.push({input,width:span*3,height:depth*3});cellW=Math.max(cellW,span*3);cellH=Math.max(cellH,depth*3);
 }
 const labels=Buffer.from(`<svg width="${cellW*4}" height="${(cellH+24)*4}">${['top','bottom','left','right'].map((s,i)=>`<text x="8" y="${i*(cellH+24)+18}" fill="white" font-size="16">${s}: 0%, 33%, 67%, 100%</text>`).join('')}</svg>`);
 await sharp({create:{width:cellW*4,height:(cellH+24)*4,channels:3,background:'#242424'}}).composite([...tiles.map((t,i)=>({input:t.input,left:(i%4)*cellW,top:Math.floor(i/4)*(cellH+24)+24})),{input:labels,left:0,top:0}]).png().toFile(output);
}
