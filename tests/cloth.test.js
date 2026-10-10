import { FLIP_DURATION } from '../src/game/state.js';
import { describe, it, expect } from "vitest";
import { Cloth, clothParameters, impulseWeight } from "../src/carpet/cloth.js";
import * as THREE from 'three';
import {
  chargeAt,
  strengthAt,
  swingArc,
  SWING_SECONDS,
  IMPACT_SECONDS,
} from "../src/input/beater.js";

describe("Ammo cloth pure parameter mapping", () => {
  it('conserves bounded hit momentum across the initial kick and contact pulse, excluding anchors', () => {
    const vector=(x=0,y=0,z=0)=>({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
    const nodes=Array.from({length:3},(_,i)=>({p:vector(i*.1,0,0),v:vector(),force:0,get_m_x(){return this.p;},get_m_v(){return this.v;}}));
    const cloth=Object.assign(Object.create(Cloth.prototype),{mass:2,wind:0,time:0,anchored:new Set([0]),hitPulses:[],vector:vector(),positions:new Float32Array(9)});
    cloth.body={get_m_nodes:()=>({size:()=>nodes.length,at:i=>nodes[i]}),activate(){},addForce(force,i){nodes[i].force+=force.z();}};
    cloth.world={stepSimulation(dt){for(const n of nodes) {n.v.setValue(0,0,n.v.z()+n.force*dt/(cloth.mass/nodes.length));n.force=0;}}};
    cloth.applyImpulse(new THREE.Vector3(.1,0,0),new THREE.Vector3(0,0,-1),10,.4);
    const momentum=()=>nodes.reduce((sum,n)=>sum+n.v.z()*cloth.mass/nodes.length,0);
    const initial=momentum();expect(initial).toBeLessThan(0);
    for(let i=0;i<20;i++) cloth.integrate(1/60);
    expect(momentum()).toBeCloseTo(-2.4,6);
    expect(Math.abs(initial)).toBeLessThan(Math.abs(momentum()));
    expect(nodes[0].v.z()).toBe(0);expect(cloth.hitPulses).toHaveLength(0);
  });
  it("uses 1320 nodes, heavy wool mass and a stiff solver", () => {
    const p = clothParameters();
    expect((p.cols + 1) * (p.rows + 1)).toBe(1320);
    expect(p.mass).toBe(5);
    expect(p.iterations).toBe(12);
    expect(clothParameters({ mass: 6 }).mass).toBe(6);
  });
  it("rejects malformed dimensions and requires initialized Ammo", () => {
    for (const options of [
      { width: 0 },
      { height: NaN },
      { cols: 2.5 },
      { rows: 1 },
      { mass: -1 },
      { iterations: 0 },
    ])
      expect(() => clothParameters(options)).toThrow(RangeError);
    expect(() => new Cloth()).toThrow("Await loadAmmo");
  });
  it("localizes the impulse without negative or invalid weights", () => {
    expect(impulseWeight(0, 0.4)).toBe(1);
    expect(impulseWeight(0.2, 0.4)).toBeCloseTo(0.25);
    expect(impulseWeight(0.4, 0.4)).toBe(0);
    expect(impulseWeight(1, 0)).toBe(0);
    expect(impulseWeight(NaN, 0.4)).toBe(0);
  });
});
describe("hold/release swing math", () => {
  it("makes a quick click a light tap and caps full charge at 0.6 seconds", () => {
    expect(strengthAt(chargeAt(0))).toBe(0.25);
    expect(chargeAt(0.3)).toBeCloseTo(0.75);
    expect(strengthAt(chargeAt(0.6))).toBe(1);
    expect(chargeAt(10)).toBe(1);
    expect(chargeAt(-1)).toBe(0);
  });
  it("accelerates toward impact then rebounds and recovers within the combo window", () => {
    const initial = swingArc(0, 0.7),
      middle = swingArc(IMPACT_SECONDS / 2, 0.7),
      impact = swingArc(IMPACT_SECONDS, 0.7);
    expect(initial.angle).toBeGreaterThan(1);
    expect(middle.depth).toBeGreaterThan(0.5);
    expect(impact.depth).toBe(0);
    expect(impact.angle).toBeCloseTo(0);
    expect(impact.impact).toBe(true);
    expect(swingArc(SWING_SECONDS, 0.7).depth).toBeCloseTo(0.63);
    expect(0.22 + SWING_SECONDS).toBeCloseTo(0.5);
  });
});

it('defaults native self collision off while retaining opt-in',()=>{
 expect(clothParameters().clusterSelfCollision).toBe(false);
 expect(clothParameters({clusterSelfCollision:true}).clusterSelfCollision).toBe(true);
});
it('projects the bar during a flip and uses spatial contact throughout a flip',()=>{
 const vector=(x=0,y=0,z=0)=>({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
 const nodes=Array.from({length:25},(_,i)=>{
  const x=vector(i%5,0,0),q=vector(),v=vector();
  return {get_m_x:()=>x,get_m_q:()=>q,get_m_v:()=>v,get_m_im:()=>1};
 });
 const c=Object.assign(Object.create(Cloth.prototype),{width:2,height:2,cols:4,rows:4,foldAxis:'v',barAxis:{y:0,z:0},barWrap:[],visibleSide:0,nodes:{size:()=>25,at:i=>nodes[i]},layerContacts:[[0,24]]});
 c.barWrap=nodes.map(()=>({minY:0,minZ:.04}));
 c.flip={age:0,from:0,to:1,leading:0,spread:.2,sides:new Int8Array(25).fill(-1),initialSides:new Int8Array(25).fill(-1),crossed:new Float64Array(25).fill(Infinity),arrived:new Float64Array(25).fill(Infinity)};
 c.projectBar();
 for(const n of nodes)expect(Math.hypot(n.get_m_x().y(),n.get_m_x().z())).toBeGreaterThan(.035);
 let contacted=false;
 c.selfContact={project(n){expect(n).toBe(c.nodes);contacted=true;}};
 c.projectLayers();expect(contacted).toBe(true);
});
