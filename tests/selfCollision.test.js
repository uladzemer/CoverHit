import {it,expect} from 'vitest';
import {ClothContact,CONTACT_THICKNESS,MAX_CONTACT_CORRECTION} from '../src/carpet/selfCollisionOracle.js';
const vector=(x=0,y=0,z=0)=>({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
const node=(x,y,z)=>{const p=vector(x,y,z),q=vector(x,y,z),v=vector();return {get_m_x:()=>p,get_m_q:()=>q,get_m_v:()=>v,get_m_im:()=>1};};
function sheets(){
 const nodes=Array.from({length:45},(_,i)=>{const x=i%5,y=Math.floor(i/5);return node(x*.05,Math.abs(y-4)*.05,Math.sign(y-4)*.008);});
 return {nodes,list:{size:()=>nodes.length,at:i=>nodes[i]},contact:new ClothContact(4,8,.05)};
}
it('preserves geometric order when parallel sheets cross, in both directions',()=>{
 for(const sign of [-1,1]){
  const {nodes,list,contact}=sheets();
  for(const n of nodes){const p=n.get_m_x();p.setValue(p.x(),p.y(),p.z()*sign);}contact.capture(list);
  for(const n of nodes){const p=n.get_m_x();p.setValue(p.x(),p.y(),p.z()*-.1);}
  contact.project(list);
  expect((nodes[42].get_m_x().z()-nodes[2].get_m_x().z())*sign).toBeGreaterThan(CONTACT_THICKNESS-.001);
  expect(contact.metrics.maxCorrection).toBeLessThanOrEqual(MAX_CONTACT_CORRECTION+1e-12);
 }
});
it('Coulomb friction drags the other sheet without increasing kinetic energy',()=>{
 const c=new ClothContact(4,8,.05);c.im.fill(1);
 c.v[0]=2;c.v[2]=-1;
 const before=c.v.reduce((s,v)=>s+v*v,0);
 c.resolve(0,40,40,40,1,0,0,0,0,1,.001);
 expect(c.v[120]).toBeGreaterThan(0);expect(c.v[0]).toBeLessThan(2);
 expect(c.v.reduce((s,v)=>s+v*v,0)).toBeLessThan(before);
});
it('friction leaves separating motion untouched and history shifts invent no velocity',()=>{
 const {nodes,list,contact}=sheets();contact.capture(list);
 nodes[42].get_m_v().setValue(0,0,1);nodes[2].get_m_v().setValue(0,0,-1);
 const before=nodes.reduce((s,n)=>s+n.get_m_v().z()**2,0);contact.project(list);
 expect(nodes.reduce((s,n)=>s+Math.hypot(n.get_m_v().x(),n.get_m_v().y(),n.get_m_v().z())**2,0)).toBeLessThanOrEqual(before+1e-10);
 for(const n of nodes)expect(n.get_m_q().z()).toBeCloseTo(n.get_m_x().z(),12);
});
it('includes distant nodes of the same half and excludes the linked neighbourhood',()=>{
 const c=new ClothContact(8,8,.05);
 expect(c.remote(0,3)).toBe(false);expect(c.remote(0,4)).toBe(true);
 expect(c.remote(0,27)).toBe(false);expect(c.remote(0,36)).toBe(true);
});
it('detects a node inside a triangle even when every opposing vertex is distant',()=>{
 const {nodes,list,contact}=sheets();contact.cell=.3;
 for(let i=0;i<nodes.length;i++){
  const row=Math.floor(i/5),shift=row<4?.1:0;
  nodes[i].get_m_x().setValue(i%5*.2+shift,Math.abs(row-4)*.2-shift,Math.sign(row-4)*.008);
 }
 contact.capture(list);
 for(let i=0;i<nodes.length;i++){const p=nodes[i].get_m_x();p.setValue(p.x(),p.y(),p.z()*.1);}
 expect(Math.hypot(nodes[0].get_m_x().x()-nodes[40].get_m_x().x(),nodes[0].get_m_x().y()-nodes[40].get_m_x().y())).toBeGreaterThan(CONTACT_THICKNESS*5);
 contact.project(list);
 expect(contact.metrics.contacts).toBeGreaterThan(0);
 expect(nodes[0].get_m_x().z()).toBeLessThan(-.004);
});
it('pipe-blocked impulse directions cannot inject kinetic energy',()=>{
 for(let trial=0;trial<100;trial++){
  const c=new ClothContact(4,8,.05);c.im.fill(1);c.bar={y:0,z:0};c.barRadius=.036;
  c.p[2]=.037;c.p[122]=.08;
  for(let k=0;k<c.v.length;k++)c.v[k]=Math.sin(k*3+trial)*2;
  const before=c.v.reduce((s,v)=>s+v*v,0);
  c.resolve(0,40,40,40,1,0,0,0,0,-1,.001);
  expect(c.v.reduce((s,v)=>s+v*v,0)).toBeLessThanOrEqual(before+1e-9);
 }
});
it('uses geometric normal pressure for friction when contact has no closing velocity',()=>{
 const c=new ClothContact(4,8,.05);c.im.fill(1);c.v[0]=2;
 c.resolve(0,40,40,40,1,0,0,0,0,1,.001);
 expect(c.v[120]).toBeGreaterThan(0);expect(c.v[0]).toBeLessThan(2);
 expect(c.v.reduce((s,v)=>s+v*v,0)).toBeLessThan(4);
});

it('retains remote same-sheet folds outside the two-sheet overlap AABB',()=>{
 const c=new ClothContact(8,8,.05),nodes=Array.from({length:81},(_,i)=>{
  const x=i%9,y=Math.floor(i/9);
  return node(Math.abs(x-4)*.05,y*.05,y<4?(x<4?-.008:.008):10);
 }),list={size:()=>nodes.length,at:i=>nodes[i]};
 for(const n of nodes)n.get_m_v().setValue(.03,0,0);
 c.capture(list);
 for(let i=0;i<36;i++){const p=nodes[i].get_m_x();p.setValue(p.x(),p.y(),p.z()*.1);}
 c.project(list);
 expect(c.active[0]&2).toBe(2);
 expect(c.metrics.contacts).toBeGreaterThan(0);
 expect(nodes[8].get_m_x().z()-nodes[0].get_m_x().z()).toBeGreaterThan(.01);
});

it('redistributes push-out when one contact vertex has exhausted its budget',()=>{
 const c=new ClothContact(4,8,.05);c.im.fill(1);c.used[40]=MAX_CONTACT_CORRECTION;
 c.resolve(0,40,40,40,1,0,0,0,0,1,.003);
 expect(c.p[2]).toBeCloseTo(.003,12);
 expect(c.p[122]).toBe(0);
 expect(c.used[0]).toBeLessThanOrEqual(MAX_CONTACT_CORRECTION);
});
