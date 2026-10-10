import {it,expect} from 'vitest';
import {separateLayerNodes,projectLayers,layerPairs,layerRequiredGaps,LAYER_GAP} from '../src/carpet/layerCollision.js';
const vec=(z=0)=>({x:()=>0,y:()=>0,z:()=>z,setValue(x,y,v){z=v;}});
const node=(z,v=0,im=1)=>{const p=vec(z),q=vec(z),velocity=vec(v);return {get_m_x:()=>p,get_m_q:()=>q,get_m_v:()=>velocity,get_m_im:()=>im};};
it('separates a tunneled front and transfers momentum with restitution .1',()=>{
 const f=node(-.1,-2),b=node(0);
 separateLayerNodes(f,b);
 expect(f.get_m_x().z()-b.get_m_x().z()).toBeCloseTo(LAYER_GAP,12);
 expect(f.get_m_v().z()).toBeCloseTo(-.9);expect(b.get_m_v().z()).toBeCloseTo(-1.1);
 expect(f.get_m_q().z()).toBe(f.get_m_x().z());
});
it('weights corrections by inverse mass and leaves separating velocities alone',()=>{
 const f=node(0,1,2),b=node(0,-1,1);separateLayerNodes(f,b);
 expect(f.get_m_x().z()).toBeCloseTo(LAYER_GAP*2/3);
 expect(b.get_m_x().z()).toBeCloseTo(-LAYER_GAP/3);
 expect(f.get_m_v().z()).toBe(1);expect(b.get_m_v().z()).toBe(-1);
 const fixed=node(0,0,0);separateLayerNodes(node(-1,-1),fixed);expect(fixed.get_m_x().z()).toBe(0);
});
it.each(['u','v'])('guarantees mirrored and neighbour gaps on both visible sides: %s',axis=>{
 const cols=6,rows=8,pairs=layerPairs(cols,rows,axis);
 expect(pairs.length).toBeGreaterThan(100);
 for(const side of [0,1]) {
  const nodes=Array.from({length:(cols+1)*(rows+1)},(_,i)=>node(Math.sin(i)*.8,-Math.cos(i)));
  const fold=nodes.filter((_,i)=>(axis==='u'?i%(cols+1)===cols/2:Math.floor(i/(cols+1))===rows/2)).map(n=>n.get_m_x().z());
  projectLayers({size:()=>nodes.length,at:i=>nodes[i]},pairs,side);
  for(const [a,b] of pairs)expect((nodes[a].get_m_x().z()-nodes[b].get_m_x().z())*(side===0?1:-1)).toBeGreaterThanOrEqual(LAYER_GAP-1e-9);
  expect(nodes.filter((_,i)=>(axis==='u'?i%(cols+1)===cols/2:Math.floor(i/(cols+1))===rows/2)).map(n=>n.get_m_x().z())).toEqual(fold);
 }
});
it('writes the batch contact impulse and correction back to Ammo nodes',()=>{
 const nodes=[node(-.1,-2),node(0)];
 projectLayers({size:()=>2,at:i=>nodes[i]},[[0,1]]);
 expect(nodes[0].get_m_x().z()-nodes[1].get_m_x().z()).toBeCloseTo(LAYER_GAP);
 expect(nodes[0].get_m_v().z()).toBeCloseTo(-.9);
 expect(nodes[1].get_m_v().z()).toBeCloseTo(-1.1);
 expect(nodes[1].get_m_q().z()).toBe(nodes[1].get_m_x().z());
});

it.each(['u','v'])('does not inflate tilted parallel panels on axis %s',axis=>{
 const cols=6,rows=8,pairs=layerPairs(cols,rows,axis);
 for(const side of [0,1]) for(const angle of [-.7,.4,.9]) {
  const vector=(x,y,z)=>({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
  const nodes=Array.from({length:(cols+1)*(rows+1)},(_,i)=>{
   const x=i%(cols+1),y=Math.floor(i/(cols+1)),d=axis==='u'?x-cols/2:y-rows/2;
   const across=(axis==='u'?y:x)*.1,along=Math.abs(d)*.1;
   const offset=Math.sign(d)*(side===0?1:-1)*LAYER_GAP/2;
   const p=vector(across,along*Math.cos(angle)-offset*Math.sin(angle),along*Math.sin(angle)+offset*Math.cos(angle));
   const q=vector(p.x(),p.y(),p.z()),v=vector(0,0,0);
   return {get_m_x:()=>p,get_m_q:()=>q,get_m_v:()=>v,get_m_im:()=>1};
  });
  const before=nodes.map(n=>n.get_m_x().z());
  projectLayers({size:()=>nodes.length,at:i=>nodes[i]},pairs,side);
  nodes.forEach((n,i)=>expect(n.get_m_x().z()).toBeCloseTo(before[i],12));
 }
});
it('isolates a NaN node while resolving healthy contacts',()=>{
 const nodes=[node(NaN,NaN),node(-.1,-2),node(0)];
 projectLayers({size:()=>3,at:i=>nodes[i]},[[0,1],[1,2],[0,2]]);
 for(const n of nodes.slice(1))for(const v of [n.get_m_x(),n.get_m_q(),n.get_m_v()])expect(Number.isFinite(v.z())).toBe(true);
 expect(nodes[1].get_m_x().z()-nodes[2].get_m_x().z()).toBeCloseTo(LAYER_GAP);
 expect(separateLayerNodes(nodes[0],nodes[1])).toBe(false);
});

it('refreshes the contact frame after resolving a dent in tilted panels',()=>{
 const cols=6,rows=8,pairs=layerPairs(cols,rows,'v');
 const nodes=Array.from({length:(cols+1)*(rows+1)},(_,i)=>{
  const x=i%(cols+1),d=Math.floor(i/(cols+1))-rows/2,y=Math.abs(d)*.1;
  const n=node(y*.3+Math.sign(d)*.01+.008*Math.sin(x+Math.abs(d)));
  n.get_m_x().x=()=>x*.1;n.get_m_x().y=()=>y;
  return n;
 });
 const list={size:()=>nodes.length,at:i=>nodes[i]};
 projectLayers(list,pairs);
 const gaps=layerRequiredGaps(list,pairs);
 pairs.forEach(([f,b],i)=>expect(nodes[f].get_m_x().z()-nodes[b].get_m_x().z()).toBeGreaterThanOrEqual(gaps[i]-1e-6));
});
