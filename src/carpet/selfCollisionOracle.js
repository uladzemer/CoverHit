import { CARPET_HALF_THICKNESS } from './barGeometry.js';

export const CONTACT_THICKNESS = 2 * CARPET_HALF_THICKNESS + .002;
export const MAX_CONTACT_CORRECTION = .01;
export const CONTACT_FRICTION = .5;

// Persistent, allocation-free broad phase. Material coordinates are used only
// to exclude linked neighbours, never to choose which surface is outside.
export class ClothContact {
  constructor(cols, rows, spacing, axis='v') {
    this.cols=cols;this.rows=rows;this.axis=axis;this.stride=cols+1;
    this.count=(cols+1)*(rows+1);this.cell=1.5*spacing;this.spacing=spacing;this.pairCell=.75*spacing;this.normal=new Float64Array(this.count*3);
    this.gridX=new Uint16Array(this.count);this.gridY=new Uint16Array(this.count);
    for(let i=0;i<this.count;i++){this.gridX[i]=i%this.stride;this.gridY[i]=Math.floor(i/this.stride);}
    const n=this.count;
    this.origin=new Float64Array(n*3);this.p=new Float64Array(n*3);this.previous=new Float64Array(n*3);
    this.v=new Float64Array(n*3);this.im=new Float64Array(n);
    this.used=new Float64Array(n);
    this.bounds=new Float64Array(12);this.overlap=new Float64Array(6);
    this.active=new Uint8Array(n);this.sheet=new Int8Array(n);
    for(let i=0;i<n;i++)this.sheet[i]=Math.sign((axis==='u'?this.gridX[i]:this.gridY[i])-(axis==='u'?cols:rows)/2);
    this.pairX=new Int32Array(n);this.pairY=new Int32Array(n);this.pairZ=new Int32Array(n);this.next=new Int32Array(n);this.cx=new Int32Array(n);this.cy=new Int32Array(n);this.cz=new Int32Array(n);
    const capacity=cols*rows*2*128;
    this.faceHead=new Int32Array(8192);this.faceOffsets=new Int32Array(8193);this.faceCounts=new Int32Array(8192);
    this.faceId=new Int32Array(capacity);this.faceX=new Int32Array(capacity);this.faceY=new Int32Array(capacity);this.faceZ=new Int32Array(capacity);
    this.sortedId=new Int32Array(capacity);this.sortedX=new Int32Array(capacity);this.sortedY=new Int32Array(capacity);this.sortedZ=new Int32Array(capacity);
    this.head=new Int32Array(1<<Math.ceil(Math.log2(n*4)));this.mask=this.head.length-1;
    this.triangles=new Int32Array(cols*rows*6);this.frames=new Float64Array(cols*rows*2*24);
    let t=0;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
      const a=y*this.stride+x,b=a+1,c=a+this.stride,d=c+1;
      for(const tri of [[a,c,b],[b,c,d]]) {
        for(let k=0;k<3;k++){this.triangles[t*3+k]=tri[k];}
        t++;
      }
    }
    this.gradientWork=new Float64Array(12);this.impulseWork=new Float64Array(12);this.ready=false;this.metrics={maxCorrection:0,contacts:0,ms:0};
  }
  hash(x,y,z){return ((x*73856093)^(y*19349663)^(z*83492791))&this.mask;}
  capture(nodes) {
    for(let i=0;i<this.count;i++) {
      const p=nodes.at(i).get_m_x(),k=i*3;
      this.previous[k]=p.x();this.previous[k+1]=p.y();this.previous[k+2]=p.z();
    }
    this.ready=true;
  }
  remote(a,b) {
    return Math.abs(this.gridX[a]-this.gridX[b])>3 || Math.abs(this.gridY[a]-this.gridY[b])>3;
  }
  build() {
    this.head.fill(-1);this.faceCounts.fill(0);this.faceOffsets.fill(0);let entry=0;
    const {triangles,frames,previous:o}=this;
    const bounds=this.bounds,overlap=this.overlap,dt=this.predictDt||0,pad=3*CONTACT_THICKNESS;
    for(let s=0;s<2;s++)for(let k=0;k<3;k++){bounds[s*6+k*2]=Infinity;bounds[s*6+k*2+1]=-Infinity;}
    for(let i=0;i<this.count;i++){
      const side=this.sheet[i];if(!side)continue;
      const b=side<0?0:6,k=i*3;
      for(let q=0;q<3;q++){
        const v=this.p[k+q],pred=v+this.v[k+q]*dt;
        bounds[b+q*2]=Math.min(bounds[b+q*2],v,pred);
        bounds[b+q*2+1]=Math.max(bounds[b+q*2+1],v,pred);
      }
    }
    for(let k=0;k<3;k++){overlap[k*2]=Math.max(bounds[k*2],bounds[6+k*2])-pad;overlap[k*2+1]=Math.min(bounds[k*2+1],bounds[7+k*2])+pad;}
    let separation2=0;
    for(let k=0;k<3;k++){
      const gap=Math.max(0,bounds[k*2]-bounds[7+k*2],bounds[6+k*2]-bounds[k*2+1]);
      separation2+=gap*gap;
    }
    const possible=separation2<=pad*pad;
    for(let i=0;i<this.count;i++){
      const k=i*3;
      this.active[i]=possible&&this.p[k]>=overlap[0]&&this.p[k]<=overlap[1]&&this.p[k+1]>=overlap[2]&&this.p[k+1]<=overlap[3]&&this.p[k+2]>=overlap[4]&&this.p[k+2]<=overlap[5]?1:0;
    }
    const {p,cell,cx,cy,cz,next,head}=this;
    this.updateNormals();
    for(let i=0;i<this.count;i++) {
      cx[i]=Math.floor(p[i*3]/cell);cy[i]=Math.floor(p[i*3+1]/cell);cz[i]=Math.floor(p[i*3+2]/cell);
      const px=this.pairX[i]=Math.floor(p[i*3]/this.pairCell),py=this.pairY[i]=Math.floor(p[i*3+1]/this.pairCell),pz=this.pairZ[i]=Math.floor(p[i*3+2]/this.pairCell);
      const h=this.hash(px,py,pz);next[i]=head[h];head[h]=i;
    }
    // Coarse node hash retains remote same-sheet folds outside cross-sheet overlap.
    for(let i=0;i<this.count;i++){
      if(this.active[i]&1)continue;
      const vk=i*3;
      if(this.v[vk]*this.v[vk]+this.v[vk+1]*this.v[vk+1]+this.v[vk+2]*this.v[vk+2]<.02*.02)continue;
      const k=i*3,x=this.pairX[i],y=this.pairY[i],z=this.pairZ[i];
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        const xx=x+dx,yy=y+dy,zz=z+dz;
        for(let j=head[this.hash(xx,yy,zz)];j>=0;j=next[j]){
          if(j===i||this.sheet[i]!==this.sheet[j]||!this.remote(i,j)||this.pairX[j]!==xx||this.pairY[j]!==yy||this.pairZ[j]!==zz)continue;
          const q=j*3,rx=p[k]-p[q],ry=p[k+1]-p[q+1],rz=p[k+2]-p[q+2];
          if(rx*rx+ry*ry+rz*rz<=this.spacing*this.spacing){this.active[i]|=2;this.active[j]|=2;}
        }
      }
    }
    let candidates=0;
    for(let i=0;i<this.count;i++)candidates+=this.active[i]!==0;
    this.hasCandidates=candidates>0;
    if(!candidates)return;
    for(let t=0;t<triangles.length/3;t++) {
      const a=triangles[t*3]*3,b=triangles[t*3+1]*3,c=triangles[t*3+2]*3,f=t*24;
      const oux=o[b]-o[a],ouy=o[b+1]-o[a+1],ouz=o[b+2]-o[a+2],ovx=o[c]-o[a],ovy=o[c+1]-o[a+1],ovz=o[c+2]-o[a+2];
      frames[f+13]=ouy*ovz-ouz*ovy;frames[f+14]=ouz*ovx-oux*ovz;frames[f+15]=oux*ovy-ouy*ovx;
      for(let k=0;k<3;k++){
        const dt=this.predictDt||0;
        frames[f+18+k*2]=Math.min(this.p[a+k],this.p[b+k],this.p[c+k],this.p[a+k]+this.v[a+k]*dt,this.p[b+k]+this.v[b+k]*dt,this.p[c+k]+this.v[c+k]*dt);
        frames[f+19+k*2]=Math.max(this.p[a+k],this.p[b+k],this.p[c+k],this.p[a+k]+this.v[a+k]*dt,this.p[b+k]+this.v[b+k]*dt,this.p[c+k]+this.v[c+k]*dt);
      }
      if(!((this.active[a/3]|this.active[b/3]|this.active[c/3])&2) && (frames[f+19]<overlap[0]||frames[f+18]>overlap[1]||frames[f+21]<overlap[2]||frames[f+20]>overlap[3]||frames[f+23]<overlap[4]||frames[f+22]>overlap[5]))continue;
      const pad=CONTACT_THICKNESS+.02,cell=this.cell;
      const xmin=Math.floor((frames[f+18]-pad)/cell),xmax=Math.floor((frames[f+19]+pad)/cell),ymin=Math.floor((frames[f+20]-pad)/cell),ymax=Math.floor((frames[f+21]+pad)/cell),zmin=Math.floor((frames[f+22]-pad)/cell),zmax=Math.floor((frames[f+23]+pad)/cell);
      for(let x=xmin;x<=xmax;x++)for(let y=ymin;y<=ymax;y++)for(let z=zmin;z<=zmax;z++){
        if(entry>=this.faceId.length)throw new Error('Contact hash capacity exceeded');
        const h=((x*73856093)^(y*19349663)^(z*83492791))&8191;
        this.faceId[entry]=t;this.faceX[entry]=x;this.faceY[entry]=y;this.faceZ[entry]=z;this.faceCounts[h]++;entry++;
      }
    }

    // Counting-sort entries into contiguous buckets, preserving the old reverse
    // insertion order so geometric tie-breaking remains deterministic.
    let offset=0;
    for(let h=0;h<8192;h++){
      this.faceOffsets[h]=offset;offset+=this.faceCounts[h];this.faceHead[h]=offset;
    }
    this.faceOffsets[8192]=offset;
    for(let e=0;e<entry;e++){
      const h=((this.faceX[e]*73856093)^(this.faceY[e]*19349663)^(this.faceZ[e]*83492791))&8191;
      const at=--this.faceHead[h];
      this.sortedId[at]=this.faceId[e];this.sortedX[at]=this.faceX[e];this.sortedY[at]=this.faceY[e];this.sortedZ[at]=this.faceZ[e];
    }

  }
  // Four-point constraint: one node against a barycentric surface point.
  // Normal/friction impulses cannot increase kinetic energy (restitution zero).
  projectDirection(i,x,y,z,out,k){
    if(this.bar){
      const dy=this.p[i*3+1]-this.bar.y,dz=this.p[i*3+2]-this.bar.z,r=Math.hypot(dy,dz);
      if(r>1e-10 && r<this.barRadius+MAX_CONTACT_CORRECTION+.002){
        const ry=dy/r,rz=dz/r,inward=Math.min(0,y*ry+z*rz);
        y-=inward*ry;z-=inward*rz;
      }
    }
    out[k]=x;out[k+1]=y;out[k+2]=z;
    return x*x+y*y+z*z;
  }
  resolve(i,a,b,c,wa,wb,wc,nx,ny,nz,depth) {
    const {im,p,v,used,gradientWork:g,impulseWork:h}=this;
    const gi=this.projectDirection(i,nx,ny,nz,g,0),ga=this.projectDirection(a,-nx,-ny,-nz,g,3);
    const gb=wb?this.projectDirection(b,-nx,-ny,-nz,g,6):0,gc=wc?this.projectDirection(c,-nx,-ny,-nz,g,9):0;
    const denom=im[i]*gi+im[a]*wa*wa*ga+im[b]*wb*wb*gb+im[c]*wc*wc*gc;
    if(!(denom>1e-12)||!Number.isFinite(depth))return;
    let pressure=0,remaining=Math.max(0,depth);
    // A saturated vertex must not freeze the entire four-point constraint.
    // Redistribute the remaining normal push to vertices with budget left.
    for(let pass=0;pass<4&&remaining>1e-10;pass++){
      const mi=MAX_CONTACT_CORRECTION-used[i]>1e-9?im[i]:0;
      const ma=MAX_CONTACT_CORRECTION-used[a]>1e-9?im[a]:0;
      const mb=MAX_CONTACT_CORRECTION-used[b]>1e-9?im[b]:0;
      const mc=MAX_CONTACT_CORRECTION-used[c]>1e-9?im[c]:0;
      const movable=mi*gi+ma*wa*wa*ga+mb*wb*wb*gb+mc*wc*wc*gc;
      if(movable<1e-12)break;
      let push=remaining/movable;
      if(mi&&gi)push=Math.min(push,(MAX_CONTACT_CORRECTION-used[i])/(mi*Math.sqrt(gi)));
      if(ma&&wa&&ga)push=Math.min(push,(MAX_CONTACT_CORRECTION-used[a])/(ma*wa*Math.sqrt(ga)));
      if(mb&&wb&&gb)push=Math.min(push,(MAX_CONTACT_CORRECTION-used[b])/(mb*wb*Math.sqrt(gb)));
      if(mc&&wc&&gc)push=Math.min(push,(MAX_CONTACT_CORRECTION-used[c])/(mc*wc*Math.sqrt(gc)));
      push=Math.max(0,push);
      this.displace(i,push*mi,g[0],g[1],g[2]);
      this.displace(a,push*ma*wa,g[3],g[4],g[5]);
      if(wb)this.displace(b,push*mb*wb,g[6],g[7],g[8]);
      if(wc)this.displace(c,push*mc*wc,g[9],g[10],g[11]);
      remaining-=push*movable;pressure+=push;
    }
    const lambda=pressure;
    const k=i*3,ak=a*3,bk=b*3,ck=c*3;
    let vx=v[k]-wa*v[ak]-wb*v[bk]-wc*v[ck],vy=v[k+1]-wa*v[ak+1]-wb*v[bk+1]-wc*v[ck+1],vz=v[k+2]-wa*v[ak+2]-wb*v[bk+2]-wc*v[ck+2];
    if(!Number.isFinite(vx+vy+vz))return;
    const vn=vx*nx+vy*ny+vz*nz,j=Math.max(0,(this.allowedNormal??0)-vn)/denom;
    vx-=vn*nx;vy-=vn*ny;vz-=vn*nz;
    const speed=Math.hypot(vx,vy,vz),friction=speed>1e-12?Math.min(CONTACT_FRICTION*Math.max(j,lambda/(this.stepDt||1/60)),speed/denom)/speed:0;
    const jx=j*nx-friction*vx,jy=j*ny-friction*vy,jz=j*nz-friction*vz;
    this.projectDirection(i,jx*im[i],jy*im[i],jz*im[i],h,0);
    this.projectDirection(a,-jx*im[a]*wa,-jy*im[a]*wa,-jz*im[a]*wa,h,3);
    if(wb)this.projectDirection(b,-jx*im[b]*wb,-jy*im[b]*wb,-jz*im[b]*wb,h,6);
    if(wc)this.projectDirection(c,-jx*im[c]*wc,-jy*im[c]*wc,-jz*im[c]*wc,h,9);
    // The coupled pipe reaction and friction impulse must not add kinetic energy.
    let linear=0,quadratic=0;
    for(let q=0;q<3;q++){
      if(im[i]){linear+=v[k+q]*h[q]/im[i];quadratic+=h[q]*h[q]/im[i];}
      if(im[a]){linear+=v[ak+q]*h[3+q]/im[a];quadratic+=h[3+q]*h[3+q]/im[a];}
      if(wb&&im[b]){linear+=v[bk+q]*h[6+q]/im[b];quadratic+=h[6+q]*h[6+q]/im[b];}
      if(wc&&im[c]){linear+=v[ck+q]*h[9+q]/im[c];quadratic+=h[9+q]*h[9+q]/im[c];}
    }
    const scale=quadratic>0?Math.max(0,Math.min(1,-2*linear/quadratic)):0;
    for(let q=0;q<3;q++){
      v[k+q]+=scale*h[q];v[ak+q]+=scale*h[3+q];
      if(wb)v[bk+q]+=scale*h[6+q];if(wc)v[ck+q]+=scale*h[9+q];
    }
    this.metrics.contacts++;
  }
  displace(i,d,x,y,z){const k=i*3;this.p[k]+=d*x;this.p[k+1]+=d*y;this.p[k+2]+=d*z;this.used[i]+=Math.abs(d)*Math.hypot(x,y,z);}
  impulse(i,d,x,y,z){const k=i*3;this.v[k]+=d*x;this.v[k+1]+=d*y;this.v[k+2]+=d*z;}
  triangle(i,t,solve=true) {
    const {p,previous:o,triangles}=this,k=i*3,tk=t*3;
    const a=triangles[tk],b=triangles[tk+1],c=triangles[tk+2];
    if(!this.remote(i,a)||!this.remote(i,b)||!this.remote(i,c))return Infinity;
    if(solve && !(this.active[i]&(this.sheet[i]===this.sheet[a]?3:1)))return Infinity;
    const ak=a*3,bk=b*3,ck=c*3;
    const f=t*24,frames=this.frames;
    const padding=this.predictDt?this.cell:CONTACT_THICKNESS+.02;
    if(p[k]<frames[f+18]-padding||p[k]>frames[f+19]+padding||p[k+1]<frames[f+20]-padding||p[k+1]>frames[f+21]+padding||p[k+2]<frames[f+22]-padding||p[k+2]>frames[f+23]+padding)return Infinity;
    const ux=p[bk]-p[ak],uy=p[bk+1]-p[ak+1],uz=p[bk+2]-p[ak+2];
    const vx=p[ck]-p[ak],vy=p[ck+1]-p[ak+1],vz=p[ck+2]-p[ak+2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const len=Math.hypot(nx,ny,nz);if(len<1e-10)return Infinity;nx/=len;ny/=len;nz/=len;
    const dx=p[k]-p[ak],dy=p[k+1]-p[ak+1],dz=p[k+2]-p[ak+2];
    const uu=ux*ux+uy*uy+uz*uz,uv=ux*vx+uy*vy+uz*vz,vv=vx*vx+vy*vy+vz*vz;
    const du=dx*ux+dy*uy+dz*uz,dv=dx*vx+dy*vy+dz*vz,den=uu*vv-uv*uv;
    let wb=(du*vv-dv*uv)/den,wc=(dv*uu-du*uv)/den,wa=1-wb-wc;
    if(wa<0||wb<0||wc<0){
      if(!this.predictDt)return Infinity;
      const dt=this.predictDt,v=this.v;
      const pux=ux+(v[bk]-v[ak])*dt,puy=uy+(v[bk+1]-v[ak+1])*dt,puz=uz+(v[bk+2]-v[ak+2])*dt;
      const pvx=vx+(v[ck]-v[ak])*dt,pvy=vy+(v[ck+1]-v[ak+1])*dt,pvz=vz+(v[ck+2]-v[ak+2])*dt;
      const pdx=dx+(v[k]-v[ak])*dt,pdy=dy+(v[k+1]-v[ak+1])*dt,pdz=dz+(v[k+2]-v[ak+2])*dt;
      const puu=pux*pux+puy*puy+puz*puz,puv=pux*pvx+puy*pvy+puz*pvz,pvv=pvx*pvx+pvy*pvy+pvz*pvz;
      const pdu=pdx*pux+pdy*puy+pdz*puz,pdv=pdx*pvx+pdy*pvy+pdz*pvz,pden=puu*pvv-puv*puv;
      wb=(pdu*pvv-pdv*puv)/pden;wc=(pdv*puu-pdu*puv)/pden;wa=1-wb-wc;
      if(wa<0||wb<0||wc<0)return Infinity;
    }
    const distance=dx*nx+dy*ny+dz*nz;
    if(solve===false)return Math.abs(distance);
    const onx=frames[f+13],ony=frames[f+14],onz=frames[f+15];
    const old=(o[k]-wa*o[ak]-wb*o[bk]-wc*o[ck])*onx+(o[k+1]-wa*o[ak+1]-wb*o[bk+1]-wc*o[ck+1])*ony+(o[k+2]-wa*o[ak+2]-wb*o[bk+2]-wc*o[ck+2])*onz;
    const oux=o[bk]-o[ak],ouy=o[bk+1]-o[ak+1],ouz=o[bk+2]-o[ak+2],ovx=o[ck]-o[ak],ovy=o[ck+1]-o[ak+1],ovz=o[ck+2]-o[ak+2];
    const odx=o[k]-o[ak],ody=o[k+1]-o[ak+1],odz=o[k+2]-o[ak+2];
    const ouu=oux*oux+ouy*ouy+ouz*ouz,ouv=oux*ovx+ouy*ovy+ouz*ovz,ovv=ovx*ovx+ovy*ovy+ovz*ovz;
    const odu=odx*oux+ody*ouy+odz*ouz,odv=odx*ovx+ody*ovy+odz*ovz,oden=ouu*ovv-ouv*ouv;
    const ob=(odu*ovv-odv*ouv)/oden,oc=(odv*ouu-odu*ouv)/oden;
    const wasInside=ob>=0&&oc>=0&&ob+oc<=1;
    const rotating=this.bar && Math.hypot(p[k+1]-this.bar.y,p[k+2]-this.bar.z)<.25;
    const sign=!rotating&&wasInside&&Math.abs(old)>1e-10?Math.sign(old):Math.sign(distance)||1;
    const gap=distance*sign;
    if(this.predictDt){
      const rel=(this.v[k]-wa*this.v[ak]-wb*this.v[bk]-wc*this.v[ck])*nx*sign+
        (this.v[k+1]-wa*this.v[ak+1]-wb*this.v[bk+1]-wc*this.v[ck+1])*ny*sign+
        (this.v[k+2]-wa*this.v[ak+2]-wb*this.v[bk+2]-wc*this.v[ck+2])*nz*sign;
      if(solve==='query')return gap+rel*this.predictDt;
      this.allowedNormal=-Math.max(0,gap-CONTACT_THICKNESS)/this.predictDt;
      if(rel<this.allowedNormal)this.resolve(i,a,b,c,wa,wb,wc,nx*sign,ny*sign,nz*sign,0);
      this.allowedNormal=0;
    } else if(solve==='query')return gap;
    else if(gap<CONTACT_THICKNESS && (Math.abs(distance)<this.cell || old*distance<0))this.resolve(i,a,b,c,wa,wb,wc,nx*sign,ny*sign,nz*sign,CONTACT_THICKNESS-gap);
    return gap;
  }
  updateNormals(){
    const {p,normal:n,cols,rows,stride,axis,gridX,gridY}=this,middle=(axis==='u'?cols:rows)/2;
    for(let i=0;i<this.count;i++){
      const x=gridX[i],y=gridY[i],along=axis==='u'?x:y;
      const xmin=axis==='u'&&along>middle?middle+1:0,xmax=axis==='u'&&along<middle?middle-1:cols;
      const ymin=axis==='v'&&along>middle?middle+1:0,ymax=axis==='v'&&along<middle?middle-1:rows;
      const a=(y*stride+Math.max(xmin,x-1))*3,b=(y*stride+Math.min(xmax,x+1))*3,c=(Math.max(ymin,y-1)*stride+x)*3,d=(Math.min(ymax,y+1)*stride+x)*3;
      const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[d]-p[c],vy=p[d+1]-p[c+1],vz=p[d+2]-p[c+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz);
      if(len<1e-12){nx=ny=0;nz=len=1;}
      n[i*3]=nx/len;n[i*3+1]=ny/len;n[i*3+2]=nz/len;
    }
  }
  pairs(i,j) {
    if(j<=i||!this.remote(i,j))return;
    const {p,previous:o,normal:n}=this,k=i*3,l=j*3;
    const dx=p[k]-p[l],dy=p[k+1]-p[l+1],dz=p[k+2]-p[l+2],r2=dx*dx+dy*dy+dz*dz;
    if(r2>this.spacing*this.spacing)return;
    const orientation=n[k]*n[l]+n[k+1]*n[l+1]+n[k+2]*n[l+2]<0?-1:1;
    let nx=n[k]+orientation*n[l],ny=n[k+1]+orientation*n[l+1],nz=n[k+2]+orientation*n[l+2];
    const len=Math.hypot(nx,ny,nz);if(len<1e-12)return;nx/=len;ny/=len;nz/=len;
    const distance=dx*nx+dy*ny+dz*nz;
    if(r2-distance*distance>this.spacing*this.spacing*.25)return;
    // Triangle sweeps retain crossing history. Vertex proximity chooses the
    // current geometric side, so rotating normals cannot invert that history.
    const sign=Math.sign(distance)||1;
    const gap=distance*sign;
    if(gap<CONTACT_THICKNESS)this.resolve(i,j,j,j,1,0,0,nx*sign,ny*sign,nz*sign,CONTACT_THICKNESS-gap);
  }
  visit(solve=true, sample=null,reverse=false) {
    const {cx,cy,cz,head,next}=this;
    for(let scan=0;scan<this.count;scan++) {
      const i=reverse?this.count-1-scan:scan;
      if(solve&&!this.active[i])continue;
      const x=cx[i],y=cy[i],z=cz[i],h=((x*73856093)^(y*19349663)^(z*83492791))&8191;
      let nearest=-1,worst=CONTACT_THICKNESS;
      for(let e=this.faceOffsets[h];e<this.faceOffsets[h+1];e++) {
        if(this.sortedX[e]!==x||this.sortedY[e]!==y||this.sortedZ[e]!==z)continue;
        const t=this.sortedId[e],gap=this.triangle(i,t,solve?'query':false);
        if(solve && gap<worst){worst=gap;nearest=t;}
        if(sample && Number.isFinite(gap))sample(i,t,gap);
      }
      if(nearest>=0)this.triangle(i,nearest,true);
      if(solve && !this.predictDt) {
        const k=i*3,cell=this.pairCell,radius=this.spacing*.5+CONTACT_THICKNESS;
        const xmin=Math.floor((this.p[k]-radius)/cell),xmax=Math.floor((this.p[k]+radius)/cell),ymin=Math.floor((this.p[k+1]-radius)/cell),ymax=Math.floor((this.p[k+1]+radius)/cell),zmin=Math.floor((this.p[k+2]-radius)/cell),zmax=Math.floor((this.p[k+2]+radius)/cell);
        for(let xx=xmin;xx<=xmax;xx++)for(let yy=ymin;yy<=ymax;yy++)for(let zz=zmin;zz<=zmax;zz++){
          for(let j=head[this.hash(xx,yy,zz)];j>=0;j=next[j])if(this.pairX[j]===xx&&this.pairY[j]===yy&&this.pairZ[j]===zz)this.pairs(i,j);
        }
      }


    }
  }
  read(nodes) {
    for(let i=0;i<this.count;i++) {
      const n=nodes.at(i),p=n.get_m_x(),v=n.get_m_v(),k=i*3;
      this.p[k]=p.x();this.p[k+1]=p.y();this.p[k+2]=p.z();
      this.origin[k]=p.x();this.origin[k+1]=p.y();this.origin[k+2]=p.z();
      this.v[k]=v.x();this.v[k+1]=v.y();this.v[k+2]=v.z();this.im[i]=n.get_m_im();
    }
  }
  predict(nodes,dt){
    this.stepDt=dt;this.read(nodes);
    this.predictDt=dt;this.build();this.used.fill(0);this.visit();this.predictDt=0;
    if(!this.hasCandidates)return;
    for(let i=0;i<this.count;i++)nodes.at(i).get_m_v().setValue(this.v[i*3],this.v[i*3+1],this.v[i*3+2]);
  }
  project(nodes,bar=null,radius=0,sides=null,flip=null) {
    this.bar=bar;this.barRadius=radius;
    const start=performance.now();if(!this.ready)this.capture(nodes);
    this.read(nodes);this.used.fill(0);this.metrics.contacts=0;
    if(flip){
      const middle=(this.axis==='u'?this.cols:this.rows)/2;
      for(let i=0;i<this.count;i++){
        const along=this.axis==='u'?this.gridX[i]:this.gridY[i];
        if(Math.abs(along-middle)<=1)this.im[i]=0;

      }

    }
    this.build();
    if(!this.hasCandidates){this.metrics.maxCorrection=0;this.metrics.ms=performance.now()-start;return this.metrics;}
    for(let iteration=0;iteration<3;iteration++){
      this.updateNormals();this.visit(true,null,iteration%2===1);
      if(bar)for(let i=0;i<this.count;i++){
        const k=i*3,dy=this.p[k+1]-bar.y,dz=this.p[k+2]-bar.z,d=Math.hypot(dy,dz);
        if(d<radius){const ny=d>1e-10?dy/d:1,nz=d>1e-10?dz/d:0;this.p[k+1]=bar.y+ny*(radius+1e-6);this.p[k+2]=bar.z+nz*(radius+1e-6);}
      }
    }
    let max=0;
    for(let i=0;i<this.count;i++) {
      const n=nodes.at(i),p=n.get_m_x(),q=n.get_m_q(),k=i*3;
      const dx=this.p[k]-p.x(),dy=this.p[k+1]-p.y(),dz=this.p[k+2]-p.z();
      q.setValue(q.x()+dx,q.y()+dy,q.z()+dz);p.setValue(this.p[k],this.p[k+1],this.p[k+2]);
      n.get_m_v().setValue(this.v[k],this.v[k+1],this.v[k+2]);max=Math.max(max,Math.hypot(dx,dy,dz));
    }
    this.metrics.maxCorrection=max;this.metrics.ms=performance.now()-start;
    return this.metrics;
  }
  sample(nodes,callback){this.read(nodes);this.build();this.visit(false,callback);}
}
