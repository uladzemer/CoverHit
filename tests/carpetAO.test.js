import {it,expect} from 'vitest';
import * as THREE from 'three';
import {layerAO,createLayerOcclusion,configureCarpetShadow} from '../src/carpet/occlusion.js';
import {layerPairs} from '../src/carpet/layerCollision.js';
import {clothParameters,clothRestPosition,clothUv} from '../src/carpet/cloth.js';
import {createThicknessStrip} from '../src/carpet/thickness.js';

it('matches distance endpoints and releases perpendicular or open panels',()=>{
  expect(layerAO(.02,1)).toBeCloseTo(.35);
  expect(layerAO(.25,1)).toBe(1);
  expect(layerAO(.135,1)).toBeCloseTo(.675);
  expect(layerAO(.02,0)).toBe(1);
  expect(layerAO(.02,1,0)).toBe(1);
  expect(layerAO(.02,.5)).toBeGreaterThan(layerAO(.02,1));
  for(const d of [NaN,Infinity,-Infinity])expect(layerAO(d)).toBe(1);
});

it.each(['u','v'])('updates finite AO, opens hems and retains valid thickness on %s folds',foldAxis=>{
  const c={...clothParameters({cols:12,rows:16}),foldAxis,barAxis:new THREE.Vector3(0,0,0)};
  c.span=foldAxis==='u'?c.height:c.width;c.drop=(foldAxis==='u'?c.width:c.height)/2;
  c.layerContacts=layerPairs(c.cols,c.rows,foldAxis);
  const positions=[],uv=[],indices=[];
  for(let y=0;y<=c.rows;y++)for(let x=0;x<=c.cols;x++){
    positions.push(...clothRestPosition(x,y,c));uv.push(...clothUv(x,y,c));
    if(x<c.cols&&y<c.rows){const i=y*(c.cols+1)+x;indices.push(i,i+c.cols+1,i+1,i+1,i+c.cols+1,i+c.cols+2);}
  }
  c.geometry=new THREE.BufferGeometry();c.positions=new Float32Array(positions);
  c.geometry.setAttribute('position',new THREE.BufferAttribute(c.positions,3));
  c.geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));
  c.geometry.setIndex(indices);c.geometry.computeVertexNormals();
  const update=createLayerOcclusion(c),strip=createThicknessStrip(c);
  update();
  const at=(x,y)=>c.geometry.attributes.clothOcclusion.getX(y*(c.cols+1)+x);
  expect(foldAxis==='u'?at(0,c.rows/2):at(c.cols/2,0))
    .toBeGreaterThan(foldAxis==='u'?at(3,c.rows/2):at(c.cols/2,4));
  for(let frame=0;frame<20;frame++){
    for(let i=0;i<c.positions.length;i+=3)c.positions[i+2]+=.001*Math.sin(frame+i);
    c.geometry.computeVertexNormals();update();strip.update();
    expect([...c.geometry.attributes.clothOcclusion.array].every(v=>Number.isFinite(v)&&v>=.35&&v<=1)).toBe(true);
    expect([...strip.mesh.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
  }
  c.positions[0]=NaN;update();
  expect([...c.geometry.attributes.clothOcclusion.array].every(Number.isFinite)).toBe(true);
  strip.dispose();c.geometry.dispose();
});

it('fits the rack shadow envelope with millimetre bias at 2048',()=>{
  const sun=new THREE.DirectionalLight();sun.position.set(-32,4,-43);
  const bar=new THREE.Vector3(0,2.15,0);
  configureCarpetShadow(sun,bar,4);
  expect(sun.shadow.mapSize.x).toBe(2048);
  expect(sun.shadow.normalBias).toBeLessThan(.006);
  sun.shadow.updateMatrices(sun);
  for(const x of [-2.4,2.4])for(const y of [0,2.55])for(const z of [-1.4,1.4]){
    const p=new THREE.Vector3(x,y,z).project(sun.shadow.camera);
    expect(Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))).toBeLessThanOrEqual(1.00001);
  }
});
