import {it,expect} from 'vitest';
import {advanceGameplayFrame} from '../src/game/frame.js';
import {Cloth,clothParameters} from '../src/carpet/cloth.js';
import {carpetType} from '../src/carpet/types.js';
import {createWind,WIND_RESPONSE} from '../src/scene/wind.js';
import {Vector3} from 'three';

it('retains wall-clock physics at 30/60/120/144/240 Hz and a 250 ms hitch',()=>{
 for(const hz of [30,60,120,144,240]){
  let accumulator=0,physics=0,wall=0;
  const context={game:{update(dt){wall+=dt;}},beater:{update(){},beforePhysics(){},afterPhysics(){}},cloth:{integrate(dt){physics+=dt;},refreshGeometry(){}}};
  for(let frame=0;frame<hz*20;frame++)accumulator=advanceGameplayFrame(context,1/hz,accumulator);
  accumulator=advanceGameplayFrame(context,.25,accumulator);
  expect(physics).toBeCloseTo(20.25,8);expect(wall).toBeCloseTo(20.25,8);expect(accumulator).toBeLessThan(1/60);
 }
});
it('advances the hand clock between hitch solves instead of repeating its future pose',()=>{
 let age=0;const samples=[];
 const context={game:{update(dt){age+=dt;}},beater:{update(){},beforePhysics(){},afterPhysics(){}},cloth:{integrate(){samples.push(age);},refreshGeometry(){}}};
 advanceGameplayFrame(context,.25);
 expect(samples).toHaveLength(15);expect(samples[0]).toBeCloseTo(1/60);expect(samples.at(-1)).toBeCloseTo(.25);
 expect(new Set(samples).size).toBe(15);
});
it('uses actual area rather than a nominal or easy-gameplay mass',()=>{
 for(const [id,density] of [['wool',3.25],['palas',1.5],['runner',2]]){
  const p=clothParameters({...carpetType(id),width:2,height:3});expect(p.mass).toBeCloseTo(density*6);expect(p.structuralDamping).toBeGreaterThan(0);
 }
 expect(()=>clothParameters({arealDensity:-1})).toThrow();
 expect(WIND_RESPONSE).toEqual({carpet:.35,fringe:.8,laundry:1,vegetation:.8,dust:.5,moths:.6});
});
it('has sheltered wind, calm spells and repeatable gusts over ten minutes',()=>{
 const w=createWind(464),v=new Vector3();let sum=0,min=Infinity,max=0;
 for(let i=0;i<36000;i++){w.update(1/60);const speed=w.velocity(v,0,0,0).length();sum+=speed;min=Math.min(min,speed);max=Math.max(max,speed);}
 expect(sum/36000).toBeGreaterThanOrEqual(.5);expect(sum/36000).toBeLessThanOrEqual(1);expect(min).toBeLessThan(.25);expect(max).toBeGreaterThan(1.5);expect(max).toBeLessThanOrEqual(2.201);
});
it('structural damping dissipates local flutter while retaining uniform motion and momentum',()=>{
 const vector=(x,y,z)=>({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
 const velocities=Array.from({length:9},(_,i)=>vector(i%2?1:-1,0,2));
 const c=Object.assign(Object.create(Cloth.prototype),{cols:2,rows:2,structuralDamping:.8,anchored:new Set(),nodes:{size:()=>9,at:i=>({get_m_v:()=>velocities[i]})}});
 const sum=()=>velocities.reduce((s,v)=>s+v.x(),0),energy=()=>velocities.reduce((s,v)=>s+v.x()**2,0),before=sum(),initial=energy();
 c.dampStructure(1/60);expect(sum()).toBeCloseTo(before,10);expect(energy()).toBeLessThan(initial);expect(velocities.every(v=>v.z()===2)).toBe(true);
});
