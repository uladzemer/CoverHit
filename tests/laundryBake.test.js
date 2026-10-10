import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {bake,FRAMES} from '../scripts/bake-laundry.mjs';
import {Scene,Group,MeshStandardMaterial} from 'three';
import {createLaundry,laundryPlacements} from '../src/scene/yard/laundry.js';
import {optimizeYard} from '../src/scene/yard/performance.js';
import {inside,servicePad} from '../src/scene/yard/layout.js';
it('reproduces the checked-in atlas, stays finite and closes all loops',()=>{
 const {data,manifest}=bake();expect(Buffer.compare(Buffer.from(data),readFileSync('public/yard/laundry/positions.bin'))).toBe(0);expect(data.byteLength).toBeLessThan(2*1024*1024);expect(manifest.items.length).toBe(10);
 for(let shape=0;shape<4;shape++)for(let clip=0;clip<3;clip++){const start=(shape*3+clip)*FRAMES*manifest.width*4,end=start+(FRAMES-1)*manifest.width*4;expect(data.slice(start,start+manifest.width*4)).toEqual(data.slice(end,end+manifest.width*4));}
},30000);
it('keeps expanded garments in the pad and batches fallback without WebGL',()=>{
 for(const p of laundryPlacements()){expect(inside(servicePad,p.x,p.z-p.width/2)).toBe(true);expect(inside(servicePad,p.x,p.z+p.width/2)).toBe(true);expect(p.x).toBeLessThan(-1.5);}
 const root=new Scene(),l=createLaundry(root);expect(l.status).toBe('fallback');expect(l.group.children.length).toBe(2);expect(l.group.children.every(m=>m.isInstancedMesh)).toBe(true);l.dispose();expect(root.children.length).toBe(0);
});
it('preserves the live VAT instances through static courtyard optimization',()=>{
 const root=new Scene(),material=new MeshStandardMaterial(),l=createLaundry(root,material);
 const optimized=optimizeYard({root,materials:{laundry:material},backdrop:{group:new Group()}});
 expect(optimized.sources).toBe(0);expect(l.group.children.every(m=>m.visible)).toBe(true);expect(l.group.children[0].customDepthMaterial).toBeTruthy();l.dispose();
});
