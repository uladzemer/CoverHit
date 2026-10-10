import {it,expect,vi} from 'vitest';
import {Game,FLIP_DURATION} from '../src/game/state.js';
import {bindClothFlip} from '../src/game/clothFlip.js';
import {advanceGameplayFrame} from '../src/game/frame.js';
import {Cloth} from '../src/carpet/cloth.js';
import {createStrikeLog} from '../src/game/strikeLog.js';

function setup(options={}) {
 const game=new Game(options);
 const cloth=Object.assign(Object.create(Cloth.prototype),{
  visibleSide:0,positions:new Float32Array(),time:0,hitPulses:[],
  nodes:{size:()=>0},anchored:new Set(),cols:4,rows:4,foldAxis:'v',
  body:{get_m_nodes:()=>({size:()=>0})},world:{stepSimulation(){}},
  projectBar:vi.fn(),projectLayers:vi.fn(),driveFlip:vi.fn(),readNodes(){},refreshGeometry(){},
  setVisibleSide(side){this.visibleSide=side;}
 });
 const dirt={};bindClothFlip(game,()=>({cloth,dirt}));game.start();game.timerStarted=true;
 const beater={update(){},beforePhysics(){},afterPhysics(){}};
 return {game,cloth,dirt,beater};
}
it.each([0,.5,1.199])('does not auto-flip with %s seconds left',remaining=>{
 const {game}=setup({getHalfCleanliness:side=>side===0?1:0});
 game.remainingSeconds=remaining;game.checkClean();
 expect(game.flipping).toBe(false);expect(game.autoFlipped.size).toBe(0);
 game.update(remaining);expect(game.state).toBe('gameOver');expect(game.flipping).toBe(false);
});
it('allows an auto-flip at exactly the duration boundary',()=>{
 const {game,cloth}=setup({getHalfCleanliness:side=>side===0?1:0});
 game.remainingSeconds=FLIP_DURATION;game.checkClean();expect(game.flipping).toBe(true);
 game.update(FLIP_DURATION);expect(game.state).toBe('gameOver');expect(cloth.flip).toBeNull();expect(cloth.visibleSide).toBe(game.visibleSide);
});
it.each(['gameOver','carpetDone','restart'])('finishes an active flip on %s',transition=>{
 const {game,cloth,dirt}=setup();game.flip();game.update(.3);
 if(transition==='restart')game.start();
 else if(transition==='gameOver'){game.remainingSeconds=.1;game.update(.1);}
 else game.setState('carpetDone');
 expect(game.flipping).toBe(false);expect(game.flipRemaining).toBe(0);
 expect(cloth.flip).toBeNull();expect(cloth.driveFlip).toHaveBeenLastCalledWith(1);
 expect(cloth.visibleSide).toBe(game.visibleSide);expect(dirt.visibleSide).toBe(game.visibleSide);
 game.update(2);expect(cloth.flip).toBeNull();
});
it.each([1/144,1/60,.1,.7])('keeps sides and flip age synchronized at frame interval %s',dt=>{
 const context=setup();context.game.flip();let accumulator=0;
 for(let time=0;time<FLIP_DURATION+.1;time+=dt){
  accumulator=advanceGameplayFrame(context,dt,accumulator);
  expect(context.cloth.visibleSide).toBe(context.game.visibleSide);
  if(context.game.flipping)expect(context.cloth.flip.age).toBeCloseTo(FLIP_DURATION-context.game.flipRemaining,12);
  else expect(context.cloth.flip).toBeNull();
 }
 expect(context.game.visibleSide).toBe(1);
 expect(context.cloth.projectBar).toHaveBeenCalled();expect(context.cloth.projectLayers).toHaveBeenCalled();
});
it('keeps debug logging disabled in production unless the debug parameter is present',()=>{
 expect(createStrikeLog()).toBeNull();expect(createStrikeLog({search:'?nodebug'})).toBeNull();
 expect(createStrikeLog({dev:true})).not.toBeNull();expect(createStrikeLog({search:'?debug'})).not.toBeNull();
});
it('retains the last 32 hits and misses while preserving the previous hit interval',()=>{
 const log=createStrikeLog({dev:true});log.hit({time:1,wall:2});
 for(let i=0;i<100;i++)log.miss(i);
 expect(log.entries).toHaveLength(32);expect(log.entries[0]).toEqual({time:68,miss:true});
 log.hit({time:102,wall:104});expect(log.entries.at(-1)).toMatchObject({interval:101,wallInterval:102});
 for(let i=0;i<100;i++)log.hit({time:i+103,wall:i+105});
 expect(log.entries).toHaveLength(32);expect(log.entries[0].time).toBe(171);
});
