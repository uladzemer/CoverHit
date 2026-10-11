import { CARPET_THICKNESS } from './barGeometry.js';

export const LAYER_GAP = 2 * CARPET_THICKNESS + .002;

// This solver moves along z, so its contact frame must remain a well-conditioned
// graph over xy. Limit its slope to 60 degrees; an edge-on/folded patch cannot
// define a z separation plane. This bounds the reciprocal without bounding or
// hiding a bad position after the correction has already stretched the links.
export function layerContactNormal(cross) {
  const length = Math.hypot(...cross);
  if (!Number.isFinite(length) || length < 1e-12) return [0, 0, 1];
  const sign = cross[2] < 0 ? -1 : 1;
  const n = cross.map(v => v / length * sign);
  if (n[2] >= .5) return n;
  const tangent = Math.hypot(n[0], n[1]);
  return [n[0] / tangent * Math.sqrt(.75), n[1] / tangent * Math.sqrt(.75), .5];
}

// The fold line is shared, not a pair of separate surfaces. All other nodes
// have an opposite-half partner and a clipped 3x3 neighbourhood.
export function layerPairs(cols, rows, axis) {
  const pairs = [];
  for (let y=0;y<=rows;y++) for (let x=0;x<=cols;x++) {
    if ((axis==='u' ? x-cols/2 : y-rows/2)<=0) continue;
    const bx=axis==='u'?cols-x:x, by=axis==='v'?rows-y:y;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const xx=bx+dx, yy=by+dy;
      if(xx<0||xx>cols||yy<0||yy>rows || (axis==='u'?xx-cols/2:yy-rows/2)>=0) continue;
      pairs.push([y*(cols+1)+x, yy*(cols+1)+xx]);
    }
  }
  pairs.grid={cols,rows,axis};
  return pairs;
}

// Keep the local tangent offset out of neighbour constraints. Solving the
// resulting plane equation for z retains monotone outward cleanup.
const workspaces=new WeakMap();
function workspace(nodes,pairs) {
  const count=nodes.size();let w=workspaces.get(pairs);
  if(!w || w.count!==count) {
    w={count,points:new Float64Array(count*3),surface:new Float64Array(count*3),normals:new Float64Array(count*3),
      gaps:new Float64Array(pairs.length),updated:new Float64Array(pairs.length),active:new Int32Array(pairs.length),z:new Float64Array(count),v:new Float64Array(count),mass:new Float64Array(count),original:new Float64Array(count),wrappers:new Array(count)};
    workspaces.set(pairs,w);
  }
  return w;
}
export function layerRequiredGaps(nodes,pairs,side=0,output=null) {
  const w=workspace(nodes,pairs),{points,surface,normals}=w,grid=pairs.grid;
  const gaps=output ?? w.gaps;
  if(nodes.copyPositions)nodes.copyPositions(points);
  else for(let i=0;i<w.count;i++) {
    const p=nodes.at(i).get_m_x(),k=i*3;
    points[k]=p.x();points[k+1]=p.y();points[k+2]=p.z();
  }
  if(grid) {
    const {cols,rows,axis}=grid,stride=cols+1;
    for(let i=0;i<w.count;i++) {
      const x=i%stride,y=Math.floor(i/stride),j=((axis==='v'?rows-y:y)*stride+(axis==='u'?cols-x:x))*3;
      for(let k=0;k<3;k++)surface[i*3+k]=(points[i*3+k]+points[j+k])*.5;
    }
    for(let i=0;i<w.count;i++) {
      const x=i%stride,y=Math.floor(i/stride),low=axis==='u'?x<cols/2:y<rows/2;
      const xmin=axis==='u'&&!low?cols/2+1:0,xmax=axis==='u'&&low?cols/2-1:cols;
      const ymin=axis==='v'&&!low?rows/2+1:0,ymax=axis==='v'&&low?rows/2-1:rows;
      const a=(y*stride+Math.max(xmin,x-1))*3,b=(y*stride+Math.min(xmax,x+1))*3;
      const c=(Math.max(ymin,y-1)*stride+x)*3,d=(Math.min(ymax,y+1)*stride+x)*3;
      const ux=surface[b]-surface[a],uy=surface[b+1]-surface[a+1],uz=surface[b+2]-surface[a+2];
      const vx=surface[d]-surface[c],vy=surface[d+1]-surface[c+1],vz=surface[d+2]-surface[c+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const length=Math.hypot(nx,ny,nz),sign=nz<0?-1:1;
      if(!Number.isFinite(length)||length<1e-12){nx=ny=0;nz=1;}
      else {
        nx=nx/length*sign;ny=ny/length*sign;nz=nz/length*sign;
        if(nz<.5){const tangent=Math.hypot(nx,ny);nx=nx/tangent*Math.sqrt(.75);ny=ny/tangent*Math.sqrt(.75);nz=.5;}
      }
      normals[i*3]=nx;normals[i*3+1]=ny;normals[i*3+2]=nz;
    }
  }
  for(let j=0;j<pairs.length;j++) {
    const f=pairs[j][side]*3,b=pairs[j][1-side]*3;
    gaps[j]=grid?(LAYER_GAP-normals[f]*(points[f]-points[b])-normals[f+1]*(points[f+1]-points[b+1]))/normals[f+2]:LAYER_GAP;
  }
  return gaps;
}

function move(node, dz) {
  const p=node.get_m_x(), q=node.get_m_q();
  const x=p.x(),y=p.y(),z=p.z()+dz,qx=q.x(),qy=q.y(),qz=q.z()+dz;
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(qx)||!Number.isFinite(qy)||!Number.isFinite(qz))return;
  p.setValue(x,y,z);
  // Shift solver history by the correction, without inventing a velocity.
  q.setValue(qx,qy,qz);
}

export function separateLayerNodes(front, back, gap=LAYER_GAP, restitution=.1) {
  const penetration=gap-(front.get_m_x().z()-back.get_m_x().z());
  if(!(penetration >= -1e-7) || !Number.isFinite(penetration)) return false;
  const a=front.get_m_im(), b=back.get_m_im(), sum=a+b;
  if(!sum || !Number.isFinite(sum)) return false;
  if(penetration>0) {
    move(front,penetration*a/sum);
    move(back,-penetration*b/sum);
  }
  const va=front.get_m_v(), vb=back.get_m_v(), relative=va.z()-vb.z();
  if(Number.isFinite(relative)&&relative<0) {
    const impulse=-(1+restitution)*relative/sum;
    va.setValue(va.x(),va.y(),va.z()+impulse*a);
    vb.setValue(vb.x(),vb.y(),vb.z()-impulse*b);
  }
  return true;
}

export function projectLayers(nodes, pairs, side=0, refinement=0, contactGaps=null, correctionLimit=Infinity) {
  if(typeof correctionLimit!=='number'||correctionLimit<0)correctionLimit=Infinity;
  // Read/write WASM once per node, not once per constraint per iteration.
  const {count,z,v,mass,original,wrappers,active}=workspace(nodes,pairs);
  for(let i=0;i<count;i++) {
    const node=wrappers[i]=nodes.at(i);
    original[i]=z[i]=node.get_m_x().z();v[i]=node.get_m_v().z();mass[i]=node.get_m_im();
  }
  const gaps=contactGaps ?? layerRequiredGaps(nodes,pairs,side);
  // Separated sheets need neither sweeps nor a second normal construction.
  // Use the same bounded contact planes as the narrow solve, including a
  // velocity-contact tolerance, so this cannot miss a moving near contact.
  let activeCount=0;
  for(let j=0;j<pairs.length;j++) {
    const pair=pairs[j];
    if(gaps[j]-z[pair[side]]+z[pair[1-side]]>=-1e-7)active[activeCount++]=j;
  }
  if(!activeCount)return;
  for(let pass=0;pass<6;pass++) {
    let worst=0;
    for(let a=0;a<activeCount;a++) {
      const j=active[a];
      const pair=pairs[j];
      const f=pair[side], b=pair[1-side], depth=gaps[j]-z[f]+z[b], sum=mass[f]+mass[b];
      if(!(depth>=-1e-7)||!sum||!Number.isFinite(depth)||!Number.isFinite(sum))continue;
      worst=Math.max(worst,depth);
      if(depth>0){z[f]+=depth*mass[f]/sum;z[b]-=depth*mass[b]/sum;}
      const relative=v[f]-v[b];
      if(Number.isFinite(relative)&&relative<0){const impulse=-1.1*relative/sum;v[f]+=impulse*mass[f];v[b]-=impulse*mass[b];}
    }
    if(worst<1e-7)break;
  }
  // Monotone outward cleanup guarantees every neighbour constraint, even after
  // deep penetration. Each correction only increases other contact gaps.
  for(let a=0;a<activeCount;a++) {
    const j=active[a];
    const pair=pairs[j];
    const f=pair[side],b=pair[1-side],depth=gaps[j]-z[f]+z[b],sum=mass[f]+mass[b];
    if(depth>1e-12 && sum && Number.isFinite(depth) && Number.isFinite(sum)){z[f]+=(depth+1e-9)*mass[f]/sum;z[b]-=(depth+1e-9)*mass[b]/sum;}
  }
  for(let i=0;i<count;i++) {
    if(Number.isFinite(z[i])&&Number.isFinite(original[i])&&z[i]!==original[i])move(wrappers[i],Math.max(-correctionLimit,Math.min(correctionLimit,z[i]-original[i])));
    const velocity=wrappers[i].get_m_v();
    if(v[i]!==velocity.z()&&Number.isFinite(velocity.x())&&Number.isFinite(velocity.y())&&Number.isFinite(v[i]))velocity.setValue(velocity.x(),velocity.y(),v[i]);
  }
  // Neighbour corrections can bend the mid-surface. Refresh its linearized
  // frame until the corrected geometry also satisfies the normal gap.
  // A tight pipe collar can require more refinement than broad, loose folds.
  if(pairs.grid && refinement<24 && correctionLimit===Infinity) {
    const updated=layerRequiredGaps(nodes,pairs,side,workspace(nodes,pairs).updated);
    for(let j=0;j<pairs.length;j++)if(updated[j]-z[pairs[j][side]]+z[pairs[j][1-side]]>5e-7){
      projectLayers(nodes,pairs,side,refinement+1,updated);break;
    }
  }
}
