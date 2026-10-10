// Deterministic total-least-squares RANSAC; normal form avoids vertical slopes.
export function leastSquaresLine(points) {
 if(points.length<2)throw Error('Need two boundary points');
 const center=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
 let xx=0,yy=0,xy=0;
 for(const p of points){const x=p[0]-center[0],y=p[1]-center[1];xx+=x*x;yy+=y*y;xy+=x*y;}
 const theta=.5*Math.atan2(2*xy,xx-yy),a=-Math.sin(theta),b=Math.cos(theta);
 return {a,b,c:-a*center[0]-b*center[1]};
}
export const lineDistance=(line,p)=>Math.abs(line.a*p[0]+line.b*p[1]+line.c);
export function fitLine(points,{threshold=2,trim=.12}={}) {
 if(points.length<8)throw Error('Insufficient boundary support');
 let best=[];
 for(let i=0;i<96;i++) {
  const p=points[(i*17)%points.length],q=points[(i*43+Math.floor(points.length/2))%points.length];
  if(Math.hypot(p[0]-q[0],p[1]-q[1])<5)continue;
  const line=leastSquaresLine([p,q]),inside=points.filter(p=>lineDistance(line,p)<threshold);
  if(inside.length>best.length)best=inside;
 }
 if(best.length<points.length*.35)throw Error('Unreliable boundary fit');
 let line=leastSquaresLine(best);
 best.sort((p,q)=>lineDistance(line,p)-lineDistance(line,q));best=best.slice(0,Math.max(8,Math.floor(best.length*(1-trim))));
 line=leastSquaresLine(best);
 return {...line,residual:Math.sqrt(best.reduce((s,p)=>s+lineDistance(line,p)**2,0)/best.length),support:best.length/points.length};
}
export function intersectLines(p,q) {
 const det=p.a*q.b-q.a*p.b;if(Math.abs(det)<1e-8)throw Error('Parallel carpet sides');
 return [(p.b*q.c-q.b*p.c)/det,(p.c*q.a-q.c*p.a)/det];
}
export function validateQuad(corners,prior) {
 if(corners.length!==4||corners.flat().some(x=>!Number.isFinite(x)))return false;
 const cross=[];
 for(let i=0;i<4;i++) {
  const p=corners[i],q=corners[(i+1)%4],r=corners[(i+2)%4],u=[q[0]-p[0],q[1]-p[1]],v=[r[0]-q[0],r[1]-q[1]];
  cross.push(u[0]*v[1]-u[1]*v[0]);
  const angle=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/Math.hypot(...u)/Math.hypot(...v))))*180/Math.PI;
  // Perspective source corners need not be exactly square; the output must be.
  if(Math.abs(angle-90)>25)return false;
  if(prior&&Math.hypot(p[0]-prior[i][0],p[1]-prior[i][1])>Math.hypot(...u)*.08)return false;
 }
 return cross.every(v=>v>0);
}
