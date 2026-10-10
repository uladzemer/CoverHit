import {it,expect} from 'vitest';
import * as THREE from 'three';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {createYard} from '../src/scene/yard.js';
import {BAR_HEIGHT,BAR_RADIUS} from '../src/carpet/barCollision.js';
it('builds the complete fallback yard in Node and preserves the cloth bar',()=>{
 const scene=new THREE.Scene(),yard=createYard(scene,{barLength:3.7});
 expect(yard.barPosition.toArray()).toEqual([0,BAR_HEIGHT,0]);expect(yard.barLength).toBe(3.7);
 yard.update(1/60);yard.update(NaN);yard.configureGround();
 let found=false,instances=0,draws=0;const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
 scene.traverse(o=>{if(!o.isMesh)return;draws++;if(o.isInstancedMesh){instances+=o.count;for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);matrix.decompose(p,q,s);expect(matrix.elements.every(Number.isFinite)).toBe(true);if(Math.abs(p.y-BAR_HEIGHT)<1e-5&&Math.abs(s.x-BAR_RADIUS)<1e-5&&Math.abs(s.y-3.7)<1e-5)found=true;}}});
 expect(found).toBe(true);expect(instances).toBeGreaterThan(1500);expect(draws).toBeLessThan(75);
});
it('documents every shipped file and stays within the 25 MB CC0 budget',()=>{
 const sources=readFileSync('public/yard/SOURCES.md','utf8'),files=readdirSync('public/yard').filter(file=>statSync(`public/yard/${file}`).isFile());
 let bytes=0;for(const file of files){expect(sources).toContain(file);bytes+=statSync(`public/yard/${file}`).size;}
 expect(bytes).toBeLessThanOrEqual(25_000_000);
 const manifest=JSON.parse(readFileSync('public/yard/manifest.json','utf8'));
 expect(manifest).toHaveLength(22);expect(sources).toContain('CC0-1.0');
 for(const r of manifest){expect(files).toContain(r.file);expect(r.url).toMatch(/^https:\/\/dl.polyhaven.org\//);}
});
