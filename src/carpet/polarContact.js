import { CARPET_HALF_THICKNESS } from './barGeometry.js';
import { RELEASE } from './handThrow.js';
import { layerPairs } from './layerCollision.js';

export const CONTACT_THICKNESS = 2 * CARPET_HALF_THICKNESS + .002;
export const MAX_CONTACT_CORRECTION = .005;
export const CONTACT_FRICTION = 0;
export const CONTACT_RESTITUTION = .05;
const TAU = 2 * Math.PI;

// A chord can approach the axis more closely than either endpoint. These
// conservative bounds reject only edges that cannot reach the node's ray/radius.
export function polarEdgeBounds(ax,ay,az,bx,by,bz,out=new Float64Array(4),offset=0) {
  const dy=by-ay,dz=bz-az,lengthSquared=dy*dy+dz*dz;
  const t=lengthSquared>0?Math.max(0,Math.min(1,-(ay*dy+az*dz)/lengthSquared)):0;
  out[offset]=Math.hypot(ay+t*dy,az+t*dz);
  out[offset+1]=Math.max(Math.hypot(ay,az),Math.hypot(by,bz));
  out[offset+2]=Math.min(ax,bx);out[offset+3]=Math.max(ax,bx);
  return out;
}

// Bounded atan approximation (maximum error < .000012 rad). No lookup objects
// or temporary arrays on the fixed-step path; the cylindrical axis is world X.
export function polarAngle(y, z) {
  const ay = Math.abs(y), az = Math.abs(z), m = Math.max(ay, az);
  if (!m) return 0;
  const t = Math.min(ay, az) / m, s = t * t;
  let a = t * (.99997726 + s * (-.33262347 + s * (.19354346 + s * (-.11643287 + s * (.05265332 - s * .0117212)))));
  if (az > ay) a = Math.PI / 2 - a;
  if (y < 0) a = Math.PI - a;
  return z < 0 ? TAU - a : a;
}

export class PolarContact {
  constructor(cols, rows, spacing, axis = 'v', profile = 'full') {
    this.cols = cols; this.rows = rows; this.axis = axis;
    this.count = (cols + 1) * (rows + 1); this.spacing = spacing;
    this.nx = (axis === 'u' ? rows : cols) + 3; this.nt = profile==='full'?96:48;
    const n = this.count, bins = this.nx * this.nt;
    this.p = new Float64Array(n * 3); this.origin = new Float64Array(n * 3);
    this.previous = new Float64Array(n * 3); this.ready = false;
    this.normal = new Float64Array(n*3);
    this.v = new Float64Array(n * 3); this.im = new Float64Array(n);
    this.r = new Float64Array(n); this.ry = new Float64Array(n); this.rz = new Float64Array(n);
    this.theta = new Float64Array(n); this.used = new Float64Array(n);
    this.gridX = new Int32Array(n); this.gridY = new Int32Array(n); this.sheet = new Int8Array(n);
    this.bin = new Int32Array(n); this.ids = new Int32Array(n);
    this.counts = new Int32Array(bins); this.offsets = new Int32Array(bins + 1); this.cursor = new Int32Array(bins);
    // A bit alone cannot identify a changing neighbour: retain its ID too.
    this.neighbour = new Int32Array(n); this.neighbour.fill(-1);
    this.above = new Uint8Array(n);
    this.lastNeighbour = new Int32Array(n); this.lastNeighbour.fill(-1);
    this.lastAbove = new Uint8Array(n); this.nearest = new Float64Array(n);
    this.layers = layerPairs(cols, rows, axis);
    // Hanging panels are a z graph: use uniform xy cells rather than crowded
    // angular bins near theta=pi. The same capped separator handles both paths.
    this.hangingRows = Math.ceil(8 / spacing) + 2;
    this.hangingHead = new Int32Array(this.nx * this.hangingRows);
    this.hangingNext = new Int32Array(n);
    this.hangingBin = new Int32Array(n);
    const edgeCount = axis === 'u' ? cols * (rows + 1) : rows * (cols + 1);
    this.edges = new Int32Array(edgeCount * 2);
    this.edgeBounds = new Float64Array(edgeCount * 4);
    this.edgeBoundsReady=false;
    for (let y = 0, e = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
      if (axis === 'u' ? x === cols : y === rows) continue;
      const a = y * (cols + 1) + x;
      this.edges[e++] = a; this.edges[e++] = a + (axis === 'u' ? 1 : cols + 1);
    }
    this.edgeHead = new Int32Array(bins);
    this.edgeNext = new Int32Array(edgeCount * this.nt * 4);
    this.edgeId = new Int32Array(this.edgeNext.length);
    this.metrics = { maxCorrection: 0, contacts: 0, ms: 0 };
    for (let i = 0; i < n; i++) {
      const x = this.gridX[i] = i % (cols + 1), y = this.gridY[i] = Math.floor(i / (cols + 1));
      this.sheet[i] = Math.sign((axis === 'u' ? x - cols / 2 : y - rows / 2));
    }
  }
  remote(a, b) {
    return Math.abs(this.gridX[a] - this.gridX[b]) > 3 || Math.abs(this.gridY[a] - this.gridY[b]) > 3;
  }
  capture(nodes) {
    if(nodes.copyPositions)nodes.copyPositions(this.previous);
    else for(let i=0;i<this.count;i++){const p=nodes.at(i).get_m_x(),k=i*3;this.previous[k]=p.x();this.previous[k+1]=p.y();this.previous[k+2]=p.z();}
    this.ready=true;
  }
  read(nodes, flip) {
    const middle = (this.axis === 'u' ? this.cols : this.rows) / 2;
    const bulk=nodes.copyPositions && nodes.copyVelocities;
    if(bulk){nodes.copyPositions(this.p);this.origin.set(this.p);nodes.copyVelocities(this.v);}
    for (let i = 0; i < this.count; i++) {
      const n = nodes.at(i), k = i * 3;
      if(!bulk){const p=n.get_m_x(),v=n.get_m_v();
        this.origin[k] = this.p[k] = p.x(); this.origin[k + 1] = this.p[k + 1] = p.y(); this.origin[k + 2] = this.p[k + 2] = p.z();
        this.v[k] = v.x(); this.v[k + 1] = v.y(); this.v[k + 2] = v.z();
      }
      const along = this.axis === 'u' ? this.gridX[i] : this.gridY[i];
      this.im[i] = flip && Math.abs(along - middle) <= 2 ? 0 : n.get_m_im();
      if(flip && this.ready && Math.abs(along-middle)<=2){this.v[k+1]=(this.p[k+1]-this.previous[k+1])/this.dt;this.v[k+2]=(this.p[k+2]-this.previous[k+2])/this.dt;}
    }
    if (flip && flip.age < RELEASE) for (let g = 0; g < flip.grips.length; g++) this.im[flip.grips[g].i] = 0;
  }
  build() {
    this.counts.fill(0);
    this.hangingHead.fill(-1);
    const { p, bar, nx, nt, spacing } = this;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3, y = p[k + 1] - bar.y, z = p[k + 2] - bar.z;
      const r = this.r[i] = Math.sqrt(y * y + z * z);
      this.ry[i] = r > 1e-12 ? y / r : 1; this.rz[i] = r > 1e-12 ? z / r : 0;
      const t = this.theta[i] = polarAngle(y, z);
      const x = Math.max(0, Math.min(nx - 1, Math.floor((p[k] - this.x0) / spacing)));
      const b = this.bin[i] = x * nt + Math.min(nt - 1, Math.floor(t * nt / TAU));
      this.counts[b]++;
      this.hangingBin[i] = -1;
      if (p[k + 1] < bar.y - .08) {
        const row = Math.max(0, Math.min(this.hangingRows - 1, Math.floor((p[k + 1] - bar.y + 4) / spacing)));
        const h = this.hangingBin[i] = x * this.hangingRows + row;
        this.hangingNext[i] = this.hangingHead[h]; this.hangingHead[h] = i;
      }
    }
    const stride=this.cols+1,middle=(this.axis==='u'?this.cols:this.rows)/2;
    for(let i=0;i<this.count;i++){
      const x=this.gridX[i],y=this.gridY[i],along=this.axis==='u'?x:y;
      const xmin=this.axis==='u'&&along>middle?middle+1:0,xmax=this.axis==='u'&&along<middle?middle-1:this.cols;
      const ymin=this.axis==='v'&&along>middle?middle+1:0,ymax=this.axis==='v'&&along<middle?middle-1:this.rows;
      const a=(y*stride+Math.max(xmin,x-1))*3,b=(y*stride+Math.min(xmax,x+1))*3,c=(Math.max(ymin,y-1)*stride+x)*3,d=(Math.min(ymax,y+1)*stride+x)*3;
      const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[d]-p[c],vy=p[d+1]-p[c+1],vz=p[d+2]-p[c+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const len=Math.hypot(nx,ny,nz),sign=nz<0?-1:1,k=i*3;
      if(len>1e-12){nx=nx/len*sign;ny=ny/len*sign;nz=nz/len*sign;if(nz<.5){const t=Math.hypot(nx,ny);nx=nx/t*Math.sqrt(.75);ny=ny/t*Math.sqrt(.75);nz=.5;}}
      else{nx=ny=0;nz=1;}
      this.normal[k]=nx;this.normal[k+1]=ny;this.normal[k+2]=nz;
    }
    let offset = 0;
    for (let b = 0; b < this.counts.length; b++) { this.offsets[b] = this.cursor[b] = offset; offset += this.counts[b]; }
    this.offsets[this.counts.length] = offset;
    for (let i = 0; i < this.count; i++) this.ids[this.cursor[this.bin[i]]++] = i;
    for (let b = 0; b < this.counts.length; b++) {
      const start = this.offsets[b], end = this.offsets[b + 1];
      for (let k = start + 1; k < end; k++) {
        const id = this.ids[k]; let j = k;
        while (j > start && this.r[this.ids[j - 1]] > this.r[id]) { this.ids[j] = this.ids[j - 1]; j--; }
        this.ids[j] = id;
      }
    }
  }
  move(i, d, ny, nz) {
    const k = i * 3;
    this.p[k + 1] += d * ny; this.p[k + 2] += d * nz; this.used[i] += Math.abs(d);
  }
  allowance(i, ny, nz) {
    let budget = MAX_CONTACT_CORRECTION - this.used[i];
    if (!(this.radius > 0)) return budget;
    const k = i * 3, y = this.p[k + 1] - this.bar.y, z = this.p[k + 2] - this.bar.z;
    const dot = y * ny + z * nz;
    if (dot >= 0) return budget;
    const clearance = y * y + z * z - this.radius * this.radius;
    if (clearance <= 0) return 0;
    const discriminant = dot * dot - clearance;
    if (discriminant > 0) budget = Math.min(budget, Math.max(0, -dot - Math.sqrt(discriminant)));
    return budget;
  }
  buildEdges() {
    this.edgeHead.fill(-1); let entry = 0;
    for (let e = 0; e < this.edges.length / 2; e++) {
      const a = this.edges[e * 2], b = this.edges[e * 2 + 1];
      if (Math.max(this.p[a * 3 + 1], this.p[b * 3 + 1]) < this.bar.y - .08) continue;
      polarEdgeBounds(this.p[a*3],this.p[a*3+1]-this.bar.y,this.p[a*3+2]-this.bar.z,
        this.p[b*3],this.p[b*3+1]-this.bar.y,this.p[b*3+2]-this.bar.z,this.edgeBounds,e*4);
      const start = this.theta[a]; let end = this.theta[b];
      if (end - start > Math.PI) end -= TAU; if (end - start < -Math.PI) end += TAU;
      const lo = Math.floor(Math.min(start, end) * this.nt / TAU), hi = Math.floor(Math.max(start, end) * this.nt / TAU);
      const xa = Math.min(this.nx-1,Math.max(0,Math.floor((Math.min(this.p[a*3],this.p[b*3])-this.spacing*.55-this.x0)/this.spacing)));
      const xb = Math.max(0,Math.min(this.nx-1,Math.floor((Math.max(this.p[a*3],this.p[b*3])+this.spacing*.55-this.x0)/this.spacing)));
      for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) for (let t = lo; t <= hi; t++) {
        if (entry === this.edgeNext.length) throw new Error('Polar edge occupancy capacity exceeded');
        const bin = x * this.nt + (t + this.nt) % this.nt;
        this.edgeId[entry] = e; this.edgeNext[entry] = this.edgeHead[bin]; this.edgeHead[bin] = entry++;
      }
    }
    this.edgeBoundsReady=true;
  }
  edge(i, e) {
    if(this.edgeBoundsReady){
      const k=e*4,r=this.r[i],x=this.p[i*3],pad=this.spacing*.55;
      // Earlier edge contacts can move either endpoint within the shared budget.
      const radialPad=.06+MAX_CONTACT_CORRECTION+1e-6;
      if(r<this.edgeBounds[k]-radialPad || r>this.edgeBounds[k+1]+radialPad || x<this.edgeBounds[k+2]-pad || x>this.edgeBounds[k+3]+pad)return;
    }
    const a = this.edges[e * 2], b = this.edges[e * 2 + 1];
    if(!(this.im[i]+this.im[a]+this.im[b]))return;
    if (!this.remote(i, a) || !this.remote(i, b)) return;
    const p = this.p, k = i * 3, ak = a * 3, bk = b * 3;
    const ny = this.ry[i], nz = this.rz[i], ay = p[ak + 1] - this.bar.y, az = p[ak + 2] - this.bar.z;
    const uy = p[bk + 1] - p[ak + 1], uz = p[bk + 2] - p[ak + 2], den = uy * nz - uz * ny;
    if (Math.abs(den) < 1e-9) return;
    const t = -(ay * nz - az * ny) / den;
    if (t < 0 || t > 1) return;
    const x = p[ak] * (1-t) + p[bk] * t;
    if (Math.abs(p[k] - x) > this.spacing * .55) return;
    const radius = (ay + t*uy)*ny + (az + t*uz)*nz;
    if (radius <= 0) return;
    const gap = this.r[i] - radius, cosine = Math.abs(den) / Math.hypot(uy, uz);
    if (cosine < .3 || Math.abs(gap) > .06) return;
    const thickness = CONTACT_THICKNESS / cosine, sign = gap >= 0 ? 1 : -1;
    const length=Math.hypot(uy,uz),orientation=(-uz*ny+uy*nz)>=0?sign:-sign;
    this.resolveEdge(i, a, b, t, ny*sign, nz*sign, gap*sign, thickness,-uz/length*orientation,uy/length*orientation);
  }
  resolveEdge(i, a, b, t, ny, nz, gap, thickness,contactNy=ny,contactNz=nz) {
    const wa = 1-t, wb = t;
    const mi = this.im[i], ma = this.im[a], mb = this.im[b], sum = mi + wa*wa*ma + wb*wb*mb;
    if (!sum) return;
    const v=this.v,k=i*3,ak=a*3,bk=b*3;
    const vy=v[k+1]-wa*v[ak+1]-wb*v[bk+1],vz=v[k+2]-wa*v[ak+2]-wb*v[bk+2];
    const cosine=Math.max(.3,ny*contactNy+nz*contactNz),vn=vy*contactNy+vz*contactNz;
    const normal=Math.max(0,-Math.max(0,(gap-thickness)*cosine)/this.dt-vn)*(gap<thickness?1+CONTACT_RESTITUTION:1)/sum;
    if(gap>=thickness&&!normal)return;
    const availableI = this.allowance(i, ny, nz), availableA = this.allowance(a, -ny, -nz), availableB = this.allowance(b, -ny, -nz);
    let push = Math.max(0, thickness-gap)/sum;
    if(mi)push=Math.min(push,availableI/mi);
    if(ma&&wa)push=Math.min(push,availableA/(ma*wa));
    if(mb&&wb)push=Math.min(push,availableB/(mb*wb));
    this.move(i,push*mi,ny,nz);this.move(a,-push*ma*wa,ny,nz);this.move(b,-push*mb*wb,ny,nz);
    const jy=normal*contactNy,jz=normal*contactNz;
    v[k+1]+=mi*jy;v[k+2]+=mi*jz;
    v[ak+1]-=ma*wa*jy;v[ak+2]-=ma*wa*jz;
    v[bk+1]-=mb*wb*jy;v[bk+2]-=mb*wb*jz;
    if(push||normal)this.metrics.contacts++;
  }
  visitEdges() {
    this.buildEdges();
    for (let i = 0; i < this.count; i++) {
      if (this.hangingBin[i] >= 0) continue;
      const b = this.bin[i];
      for(let e=this.edgeHead[b];e>=0;e=this.edgeNext[e])this.edge(i,this.edgeId[e]);
    }
  }
  resolve(a, b, ny, nz, gap, thickness=CONTACT_THICKNESS) {
    const depth = thickness - gap;
    if (!(depth > -.08)) return;
    const ia=this.im[a],ib=this.im[b],physicalMass=ia+ib;
    if(!physicalMass)return;
    const k=a*3,l=b*3,v=this.v;
    const vn=(v[k+1]-v[l+1])*ny+(v[k+2]-v[l+2])*nz;
    const normal=Math.max(0,-Math.max(0,gap-thickness)/this.dt-vn)*(gap<thickness?1+CONTACT_RESTITUTION:1)/physicalMass;
    if(depth<=0&&!normal)return;
    const availableA = this.allowance(a, ny, nz), availableB = this.allowance(b, -ny, -nz);
    const ma = availableA > 1e-12 ? this.im[a] : 0, mb = availableB > 1e-12 ? this.im[b] : 0, sum = ma + mb;
    let da = sum?Math.min(availableA, Math.max(0, depth) * ma / sum):0;
    let db = sum?Math.min(availableB, Math.max(0, depth) * mb / sum):0;
    if (ma) da = Math.min(availableA, Math.max(0, depth) - db);
    if (mb) db = Math.min(availableB, Math.max(0, depth) - da);
    this.move(a, da, ny, nz); this.move(b, -db, ny, nz);
    v[k+1]+=ia*normal*ny;v[k+2]+=ia*normal*nz;
    v[l+1]-=ib*normal*ny;v[l+2]-=ib*normal*nz;
    if(da || db || normal)this.metrics.contacts++;
  }
  pair(i, j) {
    if (j <= i || !this.remote(i, j)) return;
    const k = i * 3, l = j * 3;
    if (Math.abs(this.p[k] - this.p[l]) > this.spacing * .55) return;
    if(Math.max(this.p[k+1],this.p[l+1])<this.bar.y-.08){
      if(Math.abs(this.p[k+1]-this.p[l+1])>this.spacing*.55)return;
      const n=this.normal,nx=(n[k]+n[l])/(n[k+2]+n[l+2]),ny=(n[k+1]+n[l+1])/(n[k+2]+n[l+2]);
      const gap=this.p[k+2]-this.p[l+2]+nx*(this.p[k]-this.p[l])+ny*(this.p[k+1]-this.p[l+1]);let sign=gap>=0?1:-1;
      if(this.ready){const old=this.previous[k+2]-this.previous[l+2]+nx*(this.previous[k]-this.previous[l])+ny*(this.previous[k+1]-this.previous[l+1]);if(Math.abs(old)>.0001)sign=old>0?1:-1;}
      const thickness=CONTACT_THICKNESS*Math.sqrt(1+nx*nx+ny*ny);
      if(Math.abs(gap)<thickness+.015)this.resolve(i,j,0,sign,gap*sign,thickness);
      return;
    }
    let angle = Math.abs(this.theta[i] - this.theta[j]); if (angle > Math.PI) angle = TAU - angle;
    if (angle * Math.min(this.r[i], this.r[j]) > this.spacing * .55) return;
    let sign = this.r[i] >= this.r[j] ? 1 : -1;
    if (Math.abs(this.r[i] - this.r[j]) < .002) {
      if (this.lastNeighbour[i] === j) sign = this.lastAbove[i] ? 1 : -1;
      else if (this.lastNeighbour[j] === i) sign = this.lastAbove[j] ? -1 : 1;
    }
    const distance=Math.abs(this.r[i]-this.r[j]);
    if(distance<this.nearest[i]){this.nearest[i]=distance;this.neighbour[i]=j;this.above[i]=sign>0?1:0;}
    if(distance<this.nearest[j]){this.nearest[j]=distance;this.neighbour[j]=i;this.above[j]=sign<0?1:0;}
    const ny = this.ry[i] * sign, nz = this.rz[i] * sign;
    const gap = (this.p[k + 1] - this.p[l + 1]) * ny + (this.p[k + 2] - this.p[l + 2]) * nz;
    if (Math.abs(gap) < CONTACT_THICKNESS + .015) this.resolve(i, j, ny, nz, gap);
  }
  visit() {
    for (let i = 0; i < this.count; i++) {
      if (this.hangingBin[i] >= 0) {
        const b = this.hangingBin[i], x = Math.floor(b / this.hangingRows), y = b % this.hangingRows;
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || x + dx >= this.nx) continue;
          for (let dy = -1; dy <= 1; dy++) {
            if (y + dy < 0 || y + dy >= this.hangingRows) continue;
            const h = (x + dx) * this.hangingRows + y + dy;
            for (let j = this.hangingHead[h]; j >= 0; j = this.hangingNext[j]) this.pair(i, j);
          }
        }
        continue;
      }
      const b = this.bin[i], x = Math.floor(b / this.nt), t = b % this.nt;
      for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= this.nx) continue;
        for (let dt = -1; dt <= 1; dt++) {
          const bin = (x + dx) * this.nt + (t + dt + this.nt) % this.nt;
          for (let e = this.offsets[bin]; e < this.offsets[bin + 1]; e++) this.pair(i, this.ids[e]);
        }
      }
    }
  }
  hanging() {
    for (let e = 0; e < this.layers.length; e++) {
      const a = this.layers[e][0], b = this.layers[e][1];
      if(Math.max(this.p[a*3+1],this.p[b*3+1])<this.bar.y-.08)this.pair(Math.min(a,b),Math.max(a,b));
    }
  }
  project(nodes, bar, radius = 0, sides = null, flip = null, dt = 1 / 60) {
    const start = performance.now(); this.bar = bar; this.dt = dt; this.flip = flip; this.radius = radius;
    if(!this.ready)this.capture(nodes);
    this.read(nodes, flip); this.used.fill(0); this.metrics.contacts = 0;
    this.lastNeighbour.set(this.neighbour);this.lastAbove.set(this.above);this.nearest.fill(Infinity);
    this.x0 = (bar.x ?? 0) - this.spacing * (this.nx - 2) / 2;
    // Uniform xy bins already contain every valid mirrored/neighbour graph
    // pair. Visiting the material-neighbour list again duplicated those solves.
    this.build();this.visit();this.visitEdges();
    let max = 0;
    for (let i = 0; i < this.count; i++) {
      const n = nodes.at(i), k = i * 3, p = n.get_m_x(), q = n.get_m_q();
      const dy = this.p[k + 1] - this.origin[k + 1], dz = this.p[k + 2] - this.origin[k + 2];
      if (dy || dz) { p.setValue(this.p[k], this.p[k + 1], this.p[k + 2]); q.setValue(q.x(), q.y() + dy, q.z() + dz); }
      if (this.im[i]) n.get_m_v().setValue(this.v[k], this.v[k + 1], this.v[k + 2]);
      max = Math.max(max, this.used[i]);
    }
    this.metrics.maxCorrection = max; this.metrics.ms = performance.now() - start;
    return this.metrics;
  }
}
