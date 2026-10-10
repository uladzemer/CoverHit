export function contactThresholds({events,p99,maxCorrection,minClearance,maxSpeed,maxExtent,recoveries}) {
  return [events,p99,maxCorrection,minClearance,maxSpeed,maxExtent,recoveries].every(Number.isFinite) && events===0 && p99>=0 && p99<=.001 && maxCorrection>=0 && maxCorrection<=.005001 && minClearance>=-1e-6 && maxSpeed<=6.00001 && maxExtent<4 && recoveries===0;
}
export function contactBudget(addedFrameMs) { return Number.isFinite(addedFrameMs) && addedFrameMs<=3; }
// Independent node-pair QA. Only overlapping projected grid footprints are
// comparable; distant points on the same infinite tangent plane are not contact.
export function sampleContactPairs(points,cols,rows,axis,spacing,normals,visit) {
  const stride=cols+1,count=(cols+1)*(rows+1),middle=(axis==='u'?cols:rows)/2;
  for(let i=0;i<count;i++){
    const x=i%stride,y=Math.floor(i/stride),along=axis==='u'?x:y;
    const xmin=axis==='u'&&along>middle?middle+1:0,xmax=axis==='u'&&along<middle?middle-1:cols;
    const ymin=axis==='v'&&along>middle?middle+1:0,ymax=axis==='v'&&along<middle?middle-1:rows;
    const a=(y*stride+Math.max(xmin,x-1))*3,b=(y*stride+Math.min(xmax,x+1))*3,c=(Math.max(ymin,y-1)*stride+x)*3,d=(Math.min(ymax,y+1)*stride+x)*3;
    const ux=points[b]-points[a],uy=points[b+1]-points[a+1],uz=points[b+2]-points[a+2],vx=points[d]-points[c],vy=points[d+1]-points[c+1],vz=points[d+2]-points[c+2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);
    if(l<1e-12){nx=ny=0;nz=l=1;}
    normals[i*3]=nx/l;normals[i*3+1]=ny/l;normals[i*3+2]=nz/l;
  }
  for(let i=0;i<count;i++){
    const x=i%stride,y=Math.floor(i/stride),side=Math.sign((axis==='u'?x:y)-middle),k=i*3;
    if(!side)continue;
    for(let j=i+1;j<count;j++){
      const xx=j%stride,yy=Math.floor(j/stride);
      if(Math.sign((axis==='u'?xx:yy)-middle)!==-side || Math.max(Math.abs(x-xx),Math.abs(y-yy))<=3)continue;
      const q=j*3,dx=points[k]-points[q],dy=points[k+1]-points[q+1],dz=points[k+2]-points[q+2],r2=dx*dx+dy*dy+dz*dz;
      if(r2>spacing*spacing)continue;
      const sign=normals[k]*normals[q]+normals[k+1]*normals[q+1]+normals[k+2]*normals[q+2]<0?-1:1;
      const nx=normals[k]+sign*normals[q],ny=normals[k+1]+sign*normals[q+1],nz=normals[k+2]+sign*normals[q+2],l=Math.hypot(nx,ny,nz);
      const gap=Math.abs(dx*nx+dy*ny+dz*nz)/l;
      if(r2-gap*gap<=spacing*spacing*.25)visit(i,j,gap);
    }
  }
}
