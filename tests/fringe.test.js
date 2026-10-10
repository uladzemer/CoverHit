import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createFringe,fringeEdges,fringeLength} from '../src/carpet/fringe.js';
import {clothRestPosition} from '../src/carpet/cloth.js';

function fixture(foldAxis) {
 const c={cols:12,rows:16,width:foldAxis==='u'?3:2,height:foldAxis==='u'?2:3,foldAxis,time:0,wind:1,barAxis:{y:0,z:0}};
 c.positions=new Float32Array((c.cols+1)*(c.rows+1)*3);
 for(let y=0;y<=c.rows;y++)for(let x=0;x<=c.cols;x++)c.positions.set(clothRestPosition(x,y,c), (y*(c.cols+1)+x)*3);
 return c;
}
it.each(['u','v'])('attaches both dense short-end rows to moving cloth nodes on %s through hits and flips',axis=>{
 const c=fixture(axis),f=createFringe(c,{seed:'test'}),matrix=new THREE.Matrix4(),expected=new THREE.Vector3(),b=new THREE.Vector3();
 expect(f.mesh.isInstancedMesh).toBe(true);expect(f.mesh.castShadow).toBe(true);
 for(const edge of fringeEdges(c))for(const i of edge)expect(c.positions[i*3+1]).toBeLessThan(-1);
 f.shake(f.tassels.at(-20).root,1);expect(f.tassels.some(t=>t.velocity.length()>.1)).toBe(true);
 for(let frame=0;frame<120;frame++) {
  c.time+=1/60;c.flip=frame>30&&frame<80?{age:frame/60}:null;
  for(const edge of fringeEdges(c))for(const i of edge){c.positions[i*3]+=.0003;c.positions[i*3+2]=.16*Math.sin(frame*.15+i*.1);}
  f.update();
  expect(f.mesh.instanceMatrix.array.every(Number.isFinite)).toBe(true);
  for(const [i,t] of f.tassels.entries()) {
   expected.fromArray(c.positions,t.a*3).lerp(b.fromArray(c.positions,t.b*3),t.t);
   f.mesh.getMatrixAt(i,matrix);expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(expected)).toBeLessThan(1e-6);
  }
 }
 expect(f.tassels.every(t=>t.length>=.06&&t.length<=.1)).toBe(true);f.dispose();
});
it('shortens flat weave and runner wool and omits tapestry fringe',()=>{
 expect(fringeLength('palas')).toBeLessThan(fringeLength('wool'));expect(fringeLength('runner')).toBeLessThan(fringeLength('wool'));
 expect(createFringe(fixture('u'),{type:'tapestry'}).mesh).toBeNull();
});
it('keeps fringe attached and deflects it away from the pipe during a flip',()=>{
 const c=fixture('v'),f=createFringe(c);c.flip={age:.5};
 for(const edge of fringeEdges(c))for(const i of edge)c.positions.set([0,0,0],i*3);
 c.time+=1/60;f.update();const matrix=new THREE.Matrix4();f.mesh.getMatrixAt(0,matrix);expect(Math.hypot(matrix.elements[0],matrix.elements[1],matrix.elements[2])).toBeCloseTo(1);
 c.flip=null;c.time+=1/60;f.update();f.mesh.getMatrixAt(0,matrix);expect(matrix.elements[0]).not.toBe(0);f.dispose();
});
