import {it,expect,vi} from 'vitest';
import {handThrow,handPosition,RELEASE} from '../src/carpet/handThrow.js';
import {Cloth,clothRestPosition} from '../src/carpet/cloth.js';
import {crownSide,BAR_CONTACT_RADIUS} from '../src/carpet/barCollision.js';
import {projectLayers,LAYER_GAP} from '../src/carpet/layerCollision.js';
import {Game,FLIP_DURATION} from '../src/game/state.js';
const vector=(x=0,y=0,z=0)=>({x:()=>x,y:()=>y,z:()=>z,setValue(a,b,c){x=a;y=b;z=c;}});
const node=point=>{const x=vector(...point),q=vector(...point),v=vector();return {get_m_x:()=>x,get_m_q:()=>q,get_m_v:()=>v,get_m_im:()=>1};};
function cloth(axis='v',side=0) {
 const c=Object.assign(Object.create(Cloth.prototype),{width:2,height:3,cols:12,rows:16,foldAxis:axis,visibleSide:side,bar:{x:0,y:0,z:.06},barAxis:{y:0,z:0},anchored:new Set(),hitPulses:[],positions:new Float32Array(13*17*3)});
 const nodes=Array.from({length:13*17},(_,i)=>node(clothRestPosition(i%13,Math.floor(i/13),c,c.bar,side)));
 c.nodes={size:()=>nodes.length,at:i=>nodes[i]};c.readNodes();return {c,nodes};
}
it.each(['u','v'])('chooses reproducible grip patches on the back hem for %s in both directions',axis=>{
 for(const side of [0,1]) {
  const {c}=cloth(axis,side),a=handThrow(c,'repeat','both'),b=handThrow(c,'repeat','both');expect(a).toEqual(b);expect(a.grips).toHaveLength(6);
  for(const g of a.grips)expect(axis==='u'?g.i%13:Math.floor(g.i/13)).toBe(side===0?0:axis==='u'?12:16);
  expect(a.delay).toBeGreaterThanOrEqual(.04);expect(a.delay).toBeLessThanOrEqual(.12);expect(a.lead).toBeGreaterThanOrEqual(.03);expect(a.lead).toBeLessThanOrEqual(.1);
 }
});
it('uses about 30 percent corner throws without consuming global randomness',()=>{
 const {c}=cloth(),spy=vi.spyOn(Math,'random').mockImplementation(()=>{throw Error('unseeded RNG');});
 try {let corners=0;for(let i=0;i<1000;i++)if(handThrow(c,`distribution-${i}`).style==='corner')corners++;expect(corners).toBeGreaterThan(250);expect(corners).toBeLessThan(350);}finally{spy.mockRestore();}
});
it.each(['u','v'])('driveFlip writes only the grip nodes and stops after release on %s',axis=>{
 const {c,nodes}=cloth(axis);c.startFlip({seed:'test',style:'both'});c.flip.age=.55;
 const original=nodes.map(n=>[n.get_m_x().x(),n.get_m_x().y(),n.get_m_x().z()]);c.driveFlip(.55/FLIP_DURATION);
 const driven=new Set(c.flip.grips.map(g=>g.i));
 nodes.forEach((n,i)=>{if(!driven.has(i))expect([n.get_m_x().x(),n.get_m_x().y(),n.get_m_x().z()]).toEqual(original[i]);});
 c.flip.age=RELEASE;const positions=nodes.map(n=>n.get_m_x().y());c.driveFlip(1);expect(nodes.map(n=>n.get_m_x().y())).toEqual(positions);
});
it('scoops below the starting hem, clears the crown and lands on the opposite side',()=>{
 const start=[0,-1.7,-.04],axis={y:0,z:0};expect(handPosition(start,axis,.2,0,.05)[1]).toBeLessThan(start[1]);
 expect(handPosition(start,axis,.6,0,.05)[1]).toBeGreaterThan(.29);
 const end=handPosition(start,axis,RELEASE,0,.05);expect(end[1]).toBeCloseTo(start[1]-.055);expect(end[2]).toBeGreaterThan(0);
});
it('cannot change sides below the crown or inside the hysteresis band',()=>{
 const n=node([0,0,.2]);expect(crownSide(n,{y:0,z:0},-1)).toBe(-1);
 n.get_m_x().setValue(0,BAR_CONTACT_RADIUS+.01,.003);expect(crownSide(n,{y:0,z:0},-1)).toBe(-1);
 n.get_m_x().setValue(0,BAR_CONTACT_RADIUS+.01,.005);expect(crownSide(n,{y:0,z:0},-1)).toBe(1);
 expect(crownSide(n,{y:0,z:0},1)).toBe(1);
});
it('keeps resting layer separation unconditional even if an obsolete fade argument is passed',()=>{
 const front=node([0,-1,0]),back=node([0,-1,0]),nodes={size:()=>2,at:i=>[front,back][i]},pairs=[[0,1]];
 projectLayers(nodes,pairs,0,0,null,()=>0);
 expect(front.get_m_x().z()-back.get_m_x().z()).toBeCloseTo(LAYER_GAP);
});
it('switches visible side at crown passage while hits remain gated until release and settling',()=>{
 const game=new Game();game.start();game.flipCrownPassed=()=>true;game.flipSettled=()=>false;
 const throwEvent=vi.fn(),end=vi.fn();game.on('flipThrow',throwEvent);game.on('flipEnd',end);game.flip();game.update(.65);
 expect(game.visibleSide).toBe(1);expect(game.flipping).toBe(true);expect(game.onHit({strength:1})).toBe(0);
 game.update(.3);expect(throwEvent).toHaveBeenCalledTimes(1);game.update(.45);expect(game.flipping).toBe(true);
 game.flipSettled=()=>true;game.update(.01);expect(game.flipping).toBe(false);expect(end).toHaveBeenCalledTimes(1);
});
it('finishes at the release timeout even when the speed stays above the settle threshold',()=>{
 const game=new Game();game.start();game.flipSettled=()=>false;game.flip();game.update(FLIP_DURATION);expect(game.flipping).toBe(false);expect(game.visibleSide).toBe(1);
});
it('restores crown anchor weights at flip end',()=>{
 const {c}=cloth();c.geometry={index:{array:[],needsUpdate:false}};c.anchorHandles=[{set_m_influence:vi.fn()}];c.startFlip();c.finishFlip();expect(c.anchorHandles[0].set_m_influence).toHaveBeenCalledWith(1);expect(c.flip).toBeNull();expect(c.visibleSide).toBe(1);
});
