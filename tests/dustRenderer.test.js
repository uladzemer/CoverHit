import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DustSystem } from '../src/fx/dust.js';

describe('GPU dust buffer ownership',()=>{
 it('keeps fixed buffers through saturation and releases only owned assets',()=>{
  const scene=new THREE.Scene(),dust=new DustSystem(scene,{capacity:300});
  const geometry=dust.geometry,position=geometry.attributes.position,origin=geometry.attributes.aorigin;
  const disposed=vi.fn();geometry.addEventListener('dispose',disposed);
  for(let i=0;i<20;i++) {dust.emit(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),.08);dust.update(1/60);}
  expect(dust.liveCount).toBe(300);expect(dust.geometry).toBe(geometry);
  expect(geometry.attributes.position).toBe(position);expect(geometry.attributes.aorigin).toBe(origin);
  expect(disposed).not.toHaveBeenCalled();
  dust.update(13);expect(dust.liveCount).toBe(0);dust.dispose();dust.dispose();expect(disposed).toHaveBeenCalledOnce();
 });
});
