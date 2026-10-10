import { it, expect, vi } from 'vitest';
import { Cloth, clothRestPosition, unsafeClothNode } from '../src/carpet/cloth.js';
import { layerContactNormal, layerRequiredGaps, layerPairs, projectLayers } from '../src/carpet/layerCollision.js';
import { advanceGameplayFrame, MAX_SUBSTEPS } from '../src/game/frame.js';

const vector = (x=0,y=0,z=0) => ({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
const node = (p) => {
  const x=vector(...p),q=vector(...p),v=vector(),f=vector();
  return {get_m_x:()=>x,get_m_q:()=>q,get_m_v:()=>v,get_m_f:()=>f,get_m_im:()=>1};
};

it.each([0,1e-8,1e-5,-1e-5])('keeps edge-on contact frames well conditioned at nz=%s', z => {
  const n=layerContactNormal([0,1,z]);
  expect(n.every(Number.isFinite)).toBe(true);
  expect(n[2]).toBeGreaterThanOrEqual(.5);
  expect(Math.hypot(...n)).toBeCloseTo(1);
});
it('retains regular normals and handles degenerate/non-finite frames',()=>{
  expect(layerContactNormal([0,3,4])).toEqual([0,.6,.8]);
  for(const n of [[0,0,0],[NaN,1,0],[Infinity,0,1]])expect(layerContactNormal(n)).toEqual([0,0,1]);
});
it('does not inflate edge-on panels through reciprocal-normal refinement',()=>{
  const cols=6,rows=8,pairs=layerPairs(cols,rows,'v');
  const nodes=Array.from({length:(cols+1)*(rows+1)},(_,i)=>{
    const x=i%(cols+1),d=Math.floor(i/(cols+1))-rows/2;
    // Previously nz ~= 1e-5 demanded kilometres of horizontal separation.
    return node([x*.1,Math.abs(d)*1e-6,Math.abs(d)*.1+Math.sign(d)*.013]);
  });
  const list={size:()=>nodes.length,at:i=>nodes[i]};
  expect(Math.max(...layerRequiredGaps(list,pairs))).toBeLessThan(.23);
  for(let i=0;i<100;i++)projectLayers(list,pairs);
  for(const n of nodes)expect(Math.abs(n.get_m_x().z())).toBeLessThan(1);
});

function mockCloth(side=1) {
  const c=Object.assign(Object.create(Cloth.prototype),{cols:4,rows:4,width:2,height:2,foldAxis:'v',bar:{x:0,y:0,z:.06},visibleSide:side,hitPulses:[{}],flip:{age:.2},previousBeaterPose:{},positions:new Float32Array(75)});
  const nodes=Array.from({length:25},(_,i)=>node(clothRestPosition(i%5,Math.floor(i/5),c,c.bar,side)));
  c.body={get_m_nodes:()=>({size:()=>nodes.length,at:i=>nodes[i]}),activate:vi.fn(),updateBounds:vi.fn(),updateNormals:vi.fn()};
  return {c,nodes};
}
it.each(['extent','speed','position','velocity','history','force'])('restores an unsafe %s in the same read, preserving side and dirt',kind=>{
  const {c,nodes}=mockCloth(), dirt={pixels:new Uint8Array([1,2,3])};c.dirt=dirt;
  const n=nodes[7];
  if(kind==='extent')n.get_m_x().setValue(4.01,0,0);
  if(kind==='speed')n.get_m_v().setValue(20,20,20);
  if(kind==='position')n.get_m_x().setValue(NaN,0,0);
  if(kind==='velocity')n.get_m_v().setValue(0,Infinity,0);
  if(kind==='history')n.get_m_q().setValue(0,0,NaN);
  if(kind==='force')n.get_m_f().setValue(Infinity,0,0);
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try {
    c.readNodes();expect(c.watchdogRecoveries).toBe(1);expect(c.visibleSide).toBe(1);expect(c.dirt).toBe(dirt);
    expect(c.flip).toBeNull();expect(c.hitPulses).toEqual([]);
    nodes.forEach((n,i)=>{
      const rest=clothRestPosition(i%5,Math.floor(i/5),c,c.bar,1);
      for(const p of [n.get_m_x(),n.get_m_q()])expect([p.x(),p.y(),p.z()]).toEqual(rest);
      expect(unsafeClothNode(n,c.bar)).toBe(false);
      rest.forEach((v,k)=>expect(c.positions[3*i+k]).toBeCloseTo(v,6));
    });
    n.get_m_x().setValue(10,0,0);c.readNodes();expect(warn).toHaveBeenCalledTimes(1);expect(c.watchdogRecoveries).toBe(2);
  } finally {warn.mockRestore();}
});
it('leaves a healthy cloth untouched and accepts threshold boundaries',()=>{
  const {c,nodes}=mockCloth(0);expect(c.watchdog()).toBe(false);
  const n=nodes[0];n.get_m_x().setValue(4,0,0);n.get_m_v().setValue(30,0,0);
  expect(unsafeClothNode(n,c.bar)).toBe(false);
});
it('bounds hitch catch-up and preserves elapsed input/game clocks',()=>{
  const game={update:vi.fn()},beater={update:vi.fn(),beforePhysics(){},afterPhysics(){}},cloth={integrate:vi.fn(),refreshGeometry(){}};
  const context={game,beater,cloth};
  const remainder=advanceGameplayFrame(context,.25,1/120);
  expect(cloth.integrate).toHaveBeenCalledTimes(MAX_SUBSTEPS);expect(remainder).toBe(0);
  expect(game.update).toHaveBeenCalledWith(.25);expect(beater.update).toHaveBeenCalledWith(.25);
});
