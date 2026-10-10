import {describe,it,expect} from 'vitest';
import {clothRestPosition,clothUv} from '../src/carpet/cloth.js';
import {carpetGeometry,foldLayout,fitCarpetSize} from '../src/carpet/assets.js';
import {BAR_HEIGHT,CARPET_GROUND_CLEARANCE,CARPET_THICKNESS} from '../src/carpet/barCollision.js';
import {DirtMap} from '../src/carpet/dirt.js';
import {Game,FLIP_DURATION} from '../src/game/state.js';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
describe('middle fold',()=>{
 it.each([['v',1.8,2.5],['u',2.6,1.6]])('preserves dimensions, equal halves, material links and continuous UVs on %s', (axis,width,height)=>{
  const p=carpetGeometry({size:{width,height}},width/height);
  expect(p.foldAxis).toBe(axis);expect(p.width).toBeCloseTo(width,12);expect(p.height).toBe(height);
  const count=axis==='u'?p.cols:p.rows;expect(count%2).toBe(0);
  const at=n=>clothRestPosition(axis==='u'?n:0,axis==='u'?0:n,p);
  const half=side=>{let length=0;for(let n=side*count/2;n<(side+1)*count/2;n++)length+=distance(at(n),at(n+1));return length;};
  expect(Math.abs(half(0)/half(1)-1)).toBeLessThan(.02);
  expect(half(0)).toBeCloseTo((axis==='u'?width:height)/2,10);
  for(let y=0;y<=p.rows;y++)for(let x=0;x<=p.cols;x++){
   const uv=clothUv(x,y,p);expect(uv.every(v=>v>=0&&v<=1)).toBe(true);
   if(x<p.cols)expect(distance(clothRestPosition(x,y,p),clothRestPosition(x+1,y,p))).toBeCloseTo(width*(clothUv(x+1,y,p)[0]-uv[0]),10);
   if(y<p.rows)expect(distance(clothRestPosition(x,y,p),clothRestPosition(x,y+1,p))).toBeCloseTo(height*(uv[1]-clothUv(x,y+1,p)[1]),10);
  }
  const middle=clothUv(axis==='u'?count/2:0,axis==='u'?0:count/2,p);
  expect(middle[axis==='u'?0:1]).toBe(.5);
  expect(at(0)[1]).toBeCloseTo(at(count)[1],10);expect(at(0)[2]).toBeLessThan(0);expect(at(count)[2]).toBeGreaterThan(0);
 });
 it('folds perpendicular to the long axis in either image orientation',()=>{
  expect(foldLayout({width:3,height:2})).toEqual({foldAxis:'u',span:2,drop:1.5});
  expect(foldLayout({width:2,height:3})).toEqual({foldAxis:'v',span:2,drop:1.5});
 });
 it.each([.3,.7,1,1.5,2,4])('preserves the 3.5 m type length at aspect %s',aspect=>{
  const p=carpetGeometry({size:{width:2.5,height:3.5}},aspect);
  expect(p.width/p.height).toBeCloseTo(aspect,12);
  expect(p.drop).toBe(1.75);
  expect(p.span).toBe(Math.min(p.width,p.height));
  expect(p.foldAxis).toBe(aspect>1?'u':'v');
 });
 it.each([.1,.7,1,1.5,10])('keeps the largest wool rug at aspect %s above the floor on the human-height rack',aspect=>{
  const size=fitCarpetSize({size:{width:2.5,height:3.5}},aspect),p=carpetGeometry({size},aspect);
  expect(p.width/p.height).toBeCloseTo(aspect,12);
  // Structural path length bounds how far a freely hanging half can descend.
  expect(BAR_HEIGHT-p.drop-CARPET_THICKNESS).toBeGreaterThanOrEqual(CARPET_GROUND_CLEARANCE+.1);
  const count=p.foldAxis==='u'?p.cols:p.rows;
  for(const end of [0,count]){
   const point=clothRestPosition(p.foldAxis==='u'?end:0,p.foldAxis==='u'?0:end,p);
   expect(BAR_HEIGHT+point[1]-CARPET_THICKNESS).toBeGreaterThanOrEqual(CARPET_GROUND_CLEARANCE);
  }
 });
});
describe('two independent dirty halves',()=>{
 it.each(['u','v'])('clips cleaning to visible half on %s even at the seam',axis=>{
  const dirt=new DirtMap({foldAxis:axis,dirtAmount:.24});
  dirt.hit(.5,.5,1);expect(dirt.halfCleanliness(0)).toBeGreaterThan(0);expect(dirt.halfCleanliness(1)).toBe(0);
  const first=dirt.halfCleanliness(0);dirt.visibleSide=1;dirt.hit(.5,.5,1);
  expect(dirt.halfCleanliness(0)).toBe(first);expect(dirt.halfCleanliness(1)).toBeGreaterThan(0);
  expect(dirt.cleanliness()).toBeCloseTo((dirt.halfCleanliness(0)+dirt.halfCleanliness(1))/2,6);
  dirt.texture.dispose();
 });
});
describe('flip rules',()=>{
 it('allows manual flips both ways, rejects reentry and ignores hits and misses while flipping',()=>{
  const game=new Game({getHalfCleanliness:()=>0});game.start();game.onHit({strength:.75});const score=game.score;
  expect(game.flip()).toBe(true);expect(game.flip()).toBe(false);expect(game.onHit({strength:1})).toBe(0);game.onHit({miss:true});expect(game.score).toBe(score);
  game.update(.6);expect(game.visibleSide).toBe(0);expect(game.flipping).toBe(true);
  game.update(FLIP_DURATION-.6);expect(game.visibleSide).toBe(1);expect(game.flipping).toBe(false);
  expect(game.flip()).toBe(true);game.update(FLIP_DURATION);expect(game.visibleSide).toBe(0);expect(game.state).toBe('playing');
 });
 it('automatically flips a clean front and completes only after both halves reach threshold',()=>{
  const halves=[0,0],game=new Game({getHalfCleanliness:side=>halves[side]});game.start();
  halves[0]=.95;game.onHit({strength:.75});expect(game.flipping).toBe(true);expect(game.carpets).toBe(0);
  game.update(FLIP_DURATION);expect(game.visibleSide).toBe(1);expect(game.state).toBe('playing');
  halves[1]=.89;game.onHit({strength:.75});expect(game.state).toBe('playing');
  halves[1]=.9;game.onHit({strength:.75});expect(game.state).toBe('carpetDone');expect(game.carpets).toBe(1);game.update(10);expect(game.carpets).toBe(1);
 });
});
