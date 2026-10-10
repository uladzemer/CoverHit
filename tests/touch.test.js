import { describe, it, expect } from 'vitest';
import { pointerAim, inputModality } from '../src/input/touch.js';
describe('touch aim and modality', () => {
 const rect = {left:10,top:20,width:400,height:800};
 it('offsets touch by CSS pixels before normalizing the aim ray', () => {
  expect(pointerAim({clientX:210,clientY:468,pointerType:'touch'},rect)).toEqual({x:210,y:420,nx:0,ny:0});
  expect(pointerAim({clientX:210,clientY:468,pointerType:'mouse'},rect).ny).toBeCloseTo(-.12);
  expect(pointerAim({clientX:210,clientY:468,pointerType:'touch'},rect,-24).y).toBe(444);
 });
 it('keeps the offset within the canvas', () => { expect(pointerAim({clientX:0,clientY:30,pointerType:'touch'},rect)).toEqual({x:10,y:20,nx:-1,ny:1}); });
 it('switches hybrid hints in both directions', () => {
  expect(inputModality('',true)).toBe('touch'); expect(inputModality('',false)).toBe('mouse');
  expect(inputModality('touch',false,'mouse')).toBe('touch'); expect(inputModality('mouse',true,'touch')).toBe('mouse');
  expect(inputModality('pen',true,'touch')).toBe('pen');
 });
});
