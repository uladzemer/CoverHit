import { it, expect, vi } from 'vitest';
import { Cloth, profileClothGrid, clothParameters, clothUv, foldDistance, crownLayout } from '../src/carpet/cloth.js';
import { advanceGameplayFrame, frameSubstepLimit, cachePhoneCleanliness } from '../src/game/frame.js';
import { loadPhysicsAmmo, amplitudeCases } from '../scripts/flip-amplitude-physics.mjs';
import { BAR_CONTACT_RADIUS, BAR_FLIP_RADIUS } from '../src/carpet/barGeometry.js';
import { wind } from '../src/scene/wind.js';
import { Vector3, BufferGeometry, BufferAttribute } from 'three';
import { carpetType } from '../src/carpet/types.js';
import { DirtMap } from '../src/carpet/dirt.js';
import { createSmoothGeometry } from '../src/carpet/smoothGeometry.js';
import { cacheNodes } from '../src/carpet/nodeAccess.js';
import { Game } from '../src/game/state.js';
import { bindClothFlip } from '../src/game/clothFlip.js';
import { polarEdgeBounds } from '../src/carpet/polarContact.js';

it.each(['lite','minimal'])('preserves exact UV endpoints, fold and uniform hanging spacing on %s', profile => {
  for(const [width,height] of [[2,3],[3,2],[2.765554,3.5],[.9,3]]) {
    const grid=profileClothGrid(width,height,profile),p=clothParameters({width,height,...grid,foldAxis:width>height?'u':'v'});
    expect(clothUv(0,0,p)).toEqual([0,1]); expect(clothUv(p.cols,p.rows,p)).toEqual([1,0]);
    const {count,crown,panelStep}=crownLayout(p);
    expect(count%2).toBe(0);
    for(let i=crown+1;i<count/2;i++)expect(foldDistance(count/2+i,p)-foldDistance(count/2+i-1,p)).toBeCloseTo(panelStep,10);
    expect(Math.max(grid.cols,grid.rows)).toBe(profile==='lite'?24:18);
  }
  expect(profileClothGrid(2,3,'full')).toEqual({});
});

it.each(['lite','minimal','full'])('bounds hitch work and preserves clocks on %s', profile=>{
  const game={update:vi.fn()},beater={update:vi.fn(),beforePhysics(){},afterPhysics(){}},cloth={profile,integrate:vi.fn(),refreshGeometry(){}};
  const remainder=advanceGameplayFrame({game,beater,cloth},.25);
  expect(cloth.integrate.mock.calls.length).toBeLessThanOrEqual(frameSubstepLimit(profile,.25));
  expect(game.update.mock.calls.reduce((s,[dt])=>s+dt,0)).toBeCloseTo(.25);
  expect(beater.update.mock.calls.reduce((s,[dt])=>s+dt,0)).toBeCloseTo(.25);
  expect(remainder).toBeLessThan(1/60);
});

it.each(['lite','minimal'])('%s advances physical time at the production 30 Hz cadence',profile=>{
  let physics=0,accumulator=0;
  const context={game:{update(){}},beater:{update(){},beforePhysics(){},afterPhysics(){}},cloth:{profile,integrate(dt){physics+=dt;},refreshGeometry(){}}};
  for(let frame=0;frame<600;frame++)accumulator=advanceGameplayFrame(context,1/30,accumulator);
  expect(physics).toBeCloseTo(20,9);
});

it('cached phone cleanliness stays exact across hits, both sides, texture updates and grid replacement',()=>{
  const dirt=new DirtMap({foldAxis:'v'}),original=dirt.halfCleanliness.bind(dirt),spy=vi.spyOn(dirt,'halfCleanliness');
  cachePhoneCleanliness(dirt);cachePhoneCleanliness(dirt);
  for(const side of [0,1,0,1])expect(dirt.halfCleanliness(side)).toBe(original(side));
  expect(spy).toHaveBeenCalledTimes(2);
  dirt.hit(.5,.2,.8);
  for(const side of [0,1])expect(dirt.halfCleanliness(side)).toBe(original(side));
  expect(spy).toHaveBeenCalledTimes(4);
  dirt.grid=dirt.grid.slice();dirt.grid[0]=0;dirt.texture.needsUpdate=true;
  expect(dirt.halfCleanliness(0)).toBe(original(0));
  dirt.foldAxis='u';expect(dirt.halfCleanliness(0)).toBe(original(0));
  dirt.texture.dispose();
});

it.each(['lite','minimal'])('%s render surface preserves native positions, UVs, normals and stable attributes',profile=>{
  const grid=profileClothGrid(2,3,profile),count=(grid.cols+1)*(grid.rows+1);
  const c={...grid,width:2,height:3,foldAxis:'v',profile,visibleSide:0,positions:new Float32Array(count*3),geometry:new BufferGeometry()};
  const uv=new Float32Array(count*2),normal=new Float32Array(count*3);
  for(let y=0;y<=grid.rows;y++)for(let x=0;x<=grid.cols;x++){
    const i=y*(grid.cols+1)+x;c.positions.set([x*.1,y*.1,Math.sin(x)*.1],i*3);uv.set(clothUv(x,y,c),i*2);normal.set([0,0,1],i*3);
  }
  c.geometry.setAttribute('uv',new BufferAttribute(uv,2));c.geometry.setAttribute('normal',new BufferAttribute(normal,3));
  const rendered=createSmoothGeometry(c),attributes=rendered.geometry.attributes;
  expect(attributes.position.count).toBe(count);
  expect(attributes.position.array).toEqual(c.positions);expect(attributes.uv.array).toEqual(uv);expect(attributes.normal.array).toEqual(normal);
  c.positions[0]=.7;c.visibleSide=1;rendered.update();expect(rendered.geometry.attributes.position).toBe(attributes.position);expect(attributes.position.array).toEqual(c.positions);
  rendered.geometry.dispose();c.geometry.dispose();
});

it('bulk node reads and audits follow heap growth and retain mandatory position/speed checks',()=>{
  const ammo={HEAPF32:new Float32Array(32),getPointer:v=>v.address};
  const vector=address=>({address,x:()=>ammo.HEAPF32[address/4],y:()=>ammo.HEAPF32[address/4+1],z:()=>ammo.HEAPF32[address/4+2]});
  const node={get_m_x:()=>vector(16),get_m_q:()=>vector(32),get_m_v:()=>vector(48),get_m_f:()=>vector(64),get_m_im:()=>1};
  const nodes=cacheNodes(ammo,{size:()=>1,at:()=>node}),bar={x:0,y:0,z:.06},positions=new Float32Array(3);
  nodes.at(0).get_m_x().setValue(1,2,3);nodes.copyPositions(positions);expect([...positions]).toEqual([1,2,3]);expect(nodes.findUnsafe(bar)).toBe(-1);
  ammo.HEAPF32=new Float32Array(ammo.HEAPF32);ammo.HEAPF32[4]=4.01;
  nodes.copyPositions(positions);expect(positions[0]).toBeCloseTo(4.01);expect(nodes.findUnsafe(bar,4,30,false)).toBe(0);
  ammo.HEAPF32[4]=1;ammo.HEAPF32[12]=31;expect(nodes.findUnsafe(bar,4,30,false)).toBe(0);
  ammo.HEAPF32[12]=0;ammo.HEAPF32[8]=NaN;expect(nodes.findUnsafe(bar,4,30,false)).toBe(-1);expect(nodes.findUnsafe(bar)).toBe(0);
  ammo.HEAPF32[8]=0;nodes.at(0).get_m_v().setValue(4.5,0,6);nodes.clampVelocities({y:0,z:0});
  const velocities=new Float32Array(3);nodes.copyVelocities(velocities);expect(velocities[0]).toBeCloseTo(3.6);expect(velocities[2]).toBeCloseTo(4.8);
});

it('polar edge bounds include every chord point, including chords through the pipe axis',()=>{
  expect([...polarEdgeBounds(-2,1,-1,3,1,1)]).toEqual([1,Math.sqrt(2),-2,3]);
  expect(polarEdgeBounds(0,-1,0,0,1,0)[0]).toBe(0);
  const out=new Float64Array(8);
  for(let n=0;n<30;n++){
    const a=[Math.sin(n),Math.cos(n),Math.sin(n*.3)],b=[Math.cos(n*.2),Math.sin(n*.7),Math.cos(n*.4)];
    expect(polarEdgeBounds(...a,...b,out,4)).toBe(out);
    for(let j=0;j<=100;j++){
      const t=j/100,x=a[0]*(1-t)+b[0]*t,r=Math.hypot(a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t);
      expect(r).toBeGreaterThanOrEqual(out[4]-1e-12);expect(r).toBeLessThanOrEqual(out[5]+1e-12);
      expect(x).toBeGreaterThanOrEqual(out[6]-1e-12);expect(x).toBeLessThanOrEqual(out[7]+1e-12);
    }
  }
});

it.each(['lite','minimal'])('real Ammo %s survives 225 s, hits and both monotonic hand throws without pipe tunnelling',async profile=>{
  const ammo=await loadPhysicsAmmo(),cases=await amplitudeCases(ammo,['05']);
  const original=cases[0].create();
  const dimensions={width:original.width,height:original.height,cols:original.cols,rows:original.rows,foldAxis:original.foldAxis}; original.dispose();
  const c=new Cloth({...carpetType('wool'),...dimensions, ammo, profile, barPosition:new Vector3(0,0,.06)});
  const dt=1/30,steps=Math.round(225/dt),across=c.foldAxis==='u'?c.rows:c.cols,along=c.foldAxis==='u'?c.cols:c.rows;
  const game=new Game({rng:()=>.5}),dirt={};game.start();bindClothFlip(game,()=>({cloth:c,dirt}));
  const context={game,cloth:c,beater:{update(){},beforePhysics(){},afterPhysics(){}}};let accumulator=0;
  let peak=-Infinity,throws=0,violations=0,maxExtent=0,maxSpeed=0,active=null,crossings=[];
  try {
    for(let step=0;step<steps;step++) {
      const time=step*dt;
      if(step%Math.round(3*1/dt)===0 && time<110){const index=c.foldAxis==='u'?Math.floor(c.rows/2)*(c.cols+1)+c.cols: c.rows*(c.cols+1)+Math.floor(c.cols/2);const p=c.nodes.at(index).get_m_x();c.applyImpulse(new Vector3(p.x(),p.y(),p.z()),new Vector3(0,0,-1),.9,.36);}
      if((time>=120&&throws===0 || time>=180&&throws===1)&&!c.flip){c.startFlip({externalClock:true,style:throws?'corner':'both',seed:'phone-perf'});game.flip();active=c.flip;crossings=Array(across+1).fill(null);throws++;}
      wind.update(dt); accumulator=advanceGameplayFrame(context,dt,accumulator);
      for(let i=0;i<c.nodes.size();i++){
        const n=c.nodes.at(i),p=n.get_m_x(),v=n.get_m_v();
        const radius=Math.hypot(p.y()-c.barAxis.y,p.z()-c.barAxis.z);
        if(radius<(c.flip?BAR_FLIP_RADIUS:BAR_CONTACT_RADIUS)-1e-6)violations++;
        maxExtent=Math.max(maxExtent,Math.abs(p.x()-c.bar.x),Math.abs(p.y()-c.barAxis.y),Math.abs(p.z()-c.barAxis.z));maxSpeed=Math.max(maxSpeed,Math.hypot(v.x(),v.y(),v.z()));
      }
      if(active){
        for(let col=0;col<=across;col++){
          const hem=c.foldAxis==='u'?col*(c.cols+1)+(active.from?along:0):(active.from?along:0)*(c.cols+1)+col;
          peak=Math.max(peak,c.positions[hem*3+1]-c.barAxis.y);
          const crown=c.foldAxis==='u'?col*(c.cols+1)+along/2-1:(along/2-1)*(c.cols+1)+col;
          if(crossings[col]===null && (c.positions[crown*3+2]-c.barAxis.z)*(active.from?-1:1)>.004)crossings[col]=active.age;
        }
        if(!c.flip){
          expect(crossings.every(Number.isFinite)).toBe(true);
          const ordered=active.leading?crossings.toReversed():crossings;
          for(let i=1;i<ordered.length;i++)expect(ordered[i]).toBeGreaterThanOrEqual(ordered[i-1]-1e-8);
          expect(peak).toBeGreaterThanOrEqual(.45);active=null;peak=-Infinity;
        }
      }
    }
    expect(throws).toBe(2);expect(violations).toBe(0);expect(maxExtent).toBeLessThan(4);expect(maxSpeed).toBeLessThanOrEqual(9.00001);expect(c.watchdogRecoveries??0).toBe(0);expect(c.selfContact.dt).toBe(1/30);
  } finally { c.dispose(); }
},120000);
