import { describe, it, expect } from 'vitest';
import { Game, FLIP_DURATION } from '../src/game/state.js';
import { Hud } from '../src/ui/hud.js';
describe('HUD review regressions', () => {
 it('initializes side before starting and resets score, carpets and statistics on restart', () => {
  const game = new Game(); expect(game.visibleSide).toBe(0); game.start(); game.onHit({strength:1});
  game.carpets=3; game.visibleSide=1; game.start();
  expect(game.score).toBe(0); expect(game.carpets).toBe(0); expect(game.visibleSide).toBe(0);
  expect(game.sessionStats).toEqual({attempts:0,hits:0,bestCombo:1,seconds:0});
 });
 it('waits for the first strike on every carpet, including a missed strike', () => {
  const game = new Game(); game.start(); game.update(40); expect(game.remainingSeconds).toBe(90);
  game.flip(); game.update(FLIP_DURATION); expect(game.visibleSide).toBe(1); expect(game.remainingSeconds).toBe(90);
  game.onHit({miss:true}); game.update(5); expect(game.remainingSeconds).toBe(85);
  game.setState('carpetDone'); game.nextCarpet(); expect(game.visibleSide).toBe(0);
  game.update(30); expect(game.remainingSeconds).toBe(95); expect(game.carpetStats.attempts).toBe(0);
  game.onHit({strength:1}); game.update(2); expect(game.remainingSeconds).toBe(93);
 });
 it('reports real attempts, hit points and elapsed time for carpet results', () => {
  const game=new Game(); game.start(); game.onHit({miss:true}); game.update(.5); game.onHit({strength:1,dust:.2});
  expect(game.carpetStats).toEqual({attempts:2,hits:1,bestCombo:1,seconds:.5,hitPoints:20});
 });
 it('never rounds a subthreshold cleanliness up to 90.0%', () => {
  const fill={style:{},classList:{toggle(){}},parentElement:{setAttribute(){}}};
  const hud={nodes:{percent:{},fill,flip:{classList:{toggle(){}}}},bump(){}};
  for(const value of [.899,.89999,.9]) {
   Hud.prototype.setCleanliness.call(hud,value);
   expect(hud.nodes.percent.textContent).toBe(value<.9?'89.9%':'90.0%');
   expect(hud.sideReady).toBe(value>=.9);
  }
 });
});
