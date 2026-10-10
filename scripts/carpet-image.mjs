import sharp from 'sharp';

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points) {
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const half=ps=>{const h=[];for(const p of ps){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};
  return [...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];
}
export function quadSize(corners) {
  const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  return {width:Math.round((d(corners[0],corners[1])+d(corners[3],corners[2]))/2),height:Math.round((d(corners[0],corners[3])+d(corners[1],corners[2]))/2)};
}
export async function detectCarpetQuad(file) {
  const meta=await sharp(file).metadata();
  const {data,info}=await sharp(file).resize({width:400,height:400,fit:'inside'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h,channels:n}=info;
  const border=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<4||y<4||x>=w-4||y>=h-4)border.push(Array.from(data.slice((y*w+x)*n,(y*w+x)*n+3)));
  const bg=[0,1,2].map(k=>border.map(p=>p[k]).sort((a,b)=>a-b)[Math.floor(border.length/2)]);
  const mask=new Uint8Array(w*h);
  for(let i=0;i<mask.length;i++) {
    const rgb=Array.from(data.slice(i*n,i*n+3)), high=Math.max(...rgb), low=Math.min(...rgb);
    const distance=Math.hypot(...rgb.map((v,k)=>v-bg[k]));
    mask[i]=distance>48 && (high-low>18 || distance>95) ? 1:0;
  }
  let largest=[];
  for(let i=0;i<mask.length;i++)if(mask[i]) {
    const component=[i];mask[i]=0;
    for(let q=0;q<component.length;q++) {
      const j=component[q],x=j%w,y=Math.floor(j/w);
      for(const k of [x>0?j-1:-1,x<w-1?j+1:-1,y>0?j-w:-1,y<h-1?j+w:-1])if(k>=0&&mask[k]){mask[k]=0;component.push(k);}
    }
    if(component.length>largest.length)largest=component;
  }
  if(largest.length<w*h*.08)throw new Error('No confident carpet region; configure four corners manually');
  const outline=hull(largest.map(i=>[i%w,Math.floor(i/w)]));
  while(outline.length>4) {
    let best=0,area=Infinity;
    for(let i=0;i<outline.length;i++){const a=Math.abs(cross(outline[(i+outline.length-1)%outline.length],outline[i],outline[(i+1)%outline.length]));if(a<area){area=a;best=i;}}
    outline.splice(best,1);
  }
  const start=outline.reduce((best,p,i)=>p[0]+p[1]<outline[best][0]+outline[best][1]?i:best,0);
  const ordered=[...outline.slice(start),...outline.slice(0,start)];
  return ordered.map(([x,y])=>[Math.round(x*meta.width/w),Math.round(y*meta.height/h)]);
}
export async function debugQuad(file,corners,output) {
  const {width,height}=await sharp(file).metadata();
  const overlay=Buffer.from(`<svg width="${width}" height="${height}"><polygon points="${corners.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#00ff44" stroke-width="7"/>${corners.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="12" fill="red"/><text x="${x+14}" y="${y+25}" font-size="32" fill="#00ff44">${i+1}</text>`).join('')}</svg>`);
  await sharp(await sharp(file).composite([{input:overlay}]).png().toBuffer()).resize({height:800}).jpeg({quality:90}).toFile(output);
}
// Solve the destination-to-source homography, then bilinearly sample original pixels.
export function carpetHomography(corners) {
  const {width,height}=quadSize(corners);
  const dest=[[0,0],[width-1,0],[width-1,height-1],[0,height-1]], matrix=[];
  for(let i=0;i<4;i++) {
    const [x,y]=dest[i],[u,v]=corners[i];
    matrix.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);
  }
  for(let k=0;k<8;k++) {
    let pivot=k;for(let j=k+1;j<8;j++)if(Math.abs(matrix[j][k])>Math.abs(matrix[pivot][k]))pivot=j;
    [matrix[k],matrix[pivot]]=[matrix[pivot],matrix[k]];
    const div=matrix[k][k];if(Math.abs(div)<1e-10)throw new Error('Degenerate carpet corners');
    for(let c=k;c<=8;c++)matrix[k][c]/=div;
    for(let j=0;j<8;j++)if(j!==k){const f=matrix[j][k];for(let c=k;c<=8;c++)matrix[j][c]-=f*matrix[k][c];}
  }
  const a=matrix.map(r=>r[8]);
  return (x,y)=>{const z=a[6]*x+a[7]*y+1;return [(a[0]*x+a[1]*y+a[2])/z,(a[3]*x+a[4]*y+a[5])/z];};
}
export async function rectifyCarpet(file,corners,{maxSize=Infinity,oversample=1}={}) {
  const {width,height}=quadSize(corners),project=carpetHomography(corners);
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
  for(const [x,y] of corners)if(x<0||y<0||x>=info.width||y>=info.height)throw new Error('Corner outside image');
  const scale=Math.min(1,maxSize/Math.max(width,height)),rw=Math.round(width*scale*oversample),rh=Math.round(height*scale*oversample);
  const result=Buffer.alloc(rw*rh*3);
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++) {
    const projected=project(x*(width-1)/(rw-1),y*(height-1)/(rh-1)),u=Math.max(0,Math.min(info.width-1,projected[0])),v=Math.max(0,Math.min(info.height-1,projected[1]));
    const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
    const a=(iy*info.width+ix)*info.channels,b=(iy*info.width+Math.min(ix+1,info.width-1))*info.channels,c=(Math.min(iy+1,info.height-1)*info.width+ix)*info.channels,d=(Math.min(iy+1,info.height-1)*info.width+Math.min(ix+1,info.width-1))*info.channels;
    for(let k=0;k<3;k++) {
      result[(y*rw+x)*3+k]=(data[a+k]*(1-fx)+data[b+k]*fx)*(1-fy)+(data[c+k]*(1-fx)+data[d+k]*fx)*fy;
    }
  }
  return sharp(result,{raw:{width:rw,height:rh,channels:3}}).resize(Math.round(width*scale),Math.round(height*scale),{kernel:'lanczos3'});
}
