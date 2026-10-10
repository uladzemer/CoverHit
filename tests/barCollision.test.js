import {it,expect} from 'vitest';
import {projectBarNode,clampNodeVelocity,barHitScale,BAR_CONTACT_RADIUS,BAR_RADIUS,CARPET_THICKNESS} from '../src/carpet/barCollision.js';
import {Cloth,clothRestPosition} from '../src/carpet/cloth.js';
const vector=(x=0,y=0,z=0)=>({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
const node=(y,z,vy,vz)=>{const p=vector(2,y,z),q=vector(),v=vector(1,vy,vz);return {get_m_x:()=>p,get_m_q:()=>q,get_m_v:()=>v};};
const axis={y:3,z:.2},radius=BAR_CONTACT_RADIUS;
it.each([-1,1])('projects penetrated nodes onto their rest side %s and removes inward velocity',side=>{
 for(const [dy,dz] of [[0,0],[.01,.01],[-.02,-.01],[0,-side*.09]]) {
  const n=node(axis.y+dy,axis.z+dz,-2,-side*4);
  expect(projectBarNode(n,axis,side)).toBe(true);
  const p=n.get_m_x(),v=n.get_m_v(),y=p.y()-axis.y,z=p.z()-axis.z;
  expect(Math.hypot(y,z)).toBeGreaterThanOrEqual(radius);
  expect(z*side).toBeGreaterThan(0);
  expect(y*v.y()+z*v.z()).toBeGreaterThanOrEqual(-1e-10);
  expect(p.x()).toBe(2);expect(v.x()).toBe(1);
  expect(n.get_m_q().y()).toBe(p.y());expect(n.get_m_q().z()).toBe(p.z());
  expect(projectBarNode(n,axis,side)).toBe(false);
 }
});
it('projects crown upwards and leaves outside nodes untouched',()=>{
 const n=node(3,.2,-4,0);projectBarNode(n,axis,0);
 expect(n.get_m_x().y()).toBeGreaterThan(3+radius);expect(n.get_m_v().y()).toBe(0);
 const outside=node(2,.5,2,3);expect(projectBarNode(outside,axis,1)).toBe(false);
 expect(outside.get_m_v().z()).toBe(3);
});
it('attenuates near-bar strikes and bounds velocity before tunnelling one step',()=>{
 expect(barHitScale({y:3,z:.2},axis)).toBe(.2);
 expect(barHitScale({y:2.75,z:.2},axis)).toBe(1);
 const n=node(3,.27,100,-100);clampNodeVelocity(n,axis);const v=n.get_m_v();
 expect(Math.hypot(v.x(),v.y(),v.z())).toBeCloseTo(.9);
 expect(.9/60).toBeLessThan(radius);
});
it.each(['u','v'])('keeps crown facets outside the pipe on axis %s after a collapsed wrap',foldAxis=>{
 const c=Object.assign(Object.create(Cloth.prototype),{width:3,height:3,cols:60,rows:60,foldAxis,barAxis:{y:0,z:0},barRadius:BAR_RADIUS,carpetThickness:CARPET_THICKNESS,visibleSide:0,barWrap:[]});
 const nodes=[];
 for(let y=0;y<=c.rows;y++)for(let x=0;x<=c.cols;x++){
  const r=clothRestPosition(x,y,c,{x:0,y:0,z:.06}),n=node(r[1]-.08,r[2]*.1,-10,-10);
  c.barWrap.push({minY:r[1]>=-1e-8?r[1]:-Infinity,minZ:Math.abs(r[2])});nodes.push(n);
 }
 c.body={get_m_nodes:()=>({size:()=>nodes.length,at:i=>nodes[i]})};
 c.projectBar();
 const edgeClearance=(a,b)=>{
  const dy=b.y()-a.y(),dz=b.z()-a.z(),denom=dy*dy+dz*dz;
  const t=denom?Math.max(0,Math.min(1,-(a.y()*dy+a.z()*dz)/denom)):0;
  return Math.hypot(a.y()+t*dy,a.z()+t*dz);
 };
 for(let y=0;y<c.rows;y++)for(let x=0;x<c.cols;x++){
  const i=y*(c.cols+1)+x;
  for(const [a,b] of [[i,i+1],[i,i+c.cols+1],[i+1,i+c.cols+1]]){
   expect(edgeClearance(nodes[a].get_m_x(),nodes[b].get_m_x())).toBeGreaterThanOrEqual(BAR_CONTACT_RADIUS-1e-10);
  }
 }
});
