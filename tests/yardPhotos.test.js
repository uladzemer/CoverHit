import {it,expect} from 'vitest';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import sharp from 'sharp';
import {facadeUV,facadeBox,extractWindowMask,FACADE_SERIES,createFacadeMaterial} from '../src/scene/yard/facade.js';
import {CAR_DIMENSIONS,carBodyGeometry,carTrimGeometry} from '../src/scene/yard/car.js';
import {homography,project,rectify} from '../scripts/download-yard-photos.mjs';

it('inventories every delivered photo file and includes all required credits',async()=>{
 const dir='public/yard/photos',sources=readFileSync('public/yard/SOURCES.md','utf8'),manifest=JSON.parse(readFileSync(`${dir}/manifest.json`)),credits=JSON.parse(readFileSync(`${dir}/credits.json`));
 let bytes=0;for(const file of readdirSync(dir)){expect(sources).toContain(`photos/${file}`);bytes+=statSync(`${dir}/${file}`).size;if(file.endsWith('.webp')||file.endsWith('.png')){const info=await sharp(`${dir}/${file}`).metadata();expect(Math.max(info.width,info.height)).toBeLessThanOrEqual(2048);}}
 expect(bytes).toBeLessThan(15_000_000);
 for(const c of credits){expect(Object.keys(c).sort()).toEqual(['author','license','title','url']);expect(c.author.length).toBeGreaterThan(0);expect(c.url).toMatch(/^https:\/\/commons\.wikimedia\.org\//);expect(c.license).toMatch(/^(CC BY|CC0|Public domain)/);}
 for(const s of manifest.sources.filter(s=>s.license.startsWith('CC BY')))expect(credits.some(c=>c.title===s.title&&c.license===s.license)).toBe(true);
 expect(manifest.files.filter(f=>f.file.endsWith('-albedo.webp'))).toHaveLength(10);
});
it('maps facade bays and floors in metres independently of block size',()=>{
 for(const series of Object.keys(FACADE_SERIES)){const s=FACADE_SERIES[series];expect(facadeUV(s.bay,2.7,series)).toEqual([.25,1/3]);const g=facadeBox(60,27,12,series,3),uv=g.attributes.uv,sections=Math.round(60/(s.sectionWidth||15.5));expect(uv.getX(1)-uv.getX(0)).toBeCloseTo(facadeUV(60/sections,0,series)[0],4);expect(g.attributes.facadeUv.count).toBe(uv.count);g.dispose();}
});
it('detects glass rectangles but rejects panel joints and isolated dark noise',()=>{
 const w=80,h=60,rgb=new Uint8Array(w*h*3).fill(190);
 const dark=(x,y)=>rgb.fill(40,(y*w+x)*3,(y*w+x+1)*3);
 for(let row=0;row<3;row++)for(let col=0;col<4;col++)for(let y=row*20+5;y<row*20+15;y++)for(let x=col*20+5;x<col*20+15;x++)dark(x,y);
 for(let y=0;y<h;y++)dark(20,y);dark(17,17);
 const mask=extractWindowMask(rgb,w,h);expect(mask[10*w+10]).toBe(255);expect(mask[10*w+20]).toBe(0);expect(mask[17*w+17]).toBe(0);expect(mask.filter(v=>v>0).length).toBeGreaterThan(800);
});
it('rectifies perspective corners without changing colour on a uniform image',()=>{
 const corners=[[3,4],[18,2],[17,19],[2,17]],matrix=homography(corners);
 for(const [i,[u,v]]of [[0,[0,0]],[1,[1,0]],[2,[1,1]],[3,[0,1]]]){const p=project(matrix,u,v);expect(p[0]).toBeCloseTo(corners[i][0],7);expect(p[1]).toBeCloseTo(corners[i][1],7);}
 const rgb=new Uint8Array(20*20*3).fill(123);expect(rectify(rgb,20,20,corners,8,8).every(c=>c===123)).toBe(true);
 expect(()=>homography([[0,0],[0,0],[0,0],[0,0]])).toThrow();
});
it('keeps the photo body within 3% of VAZ-2106 dimensions and the mesh budget',()=>{
 const g=carBodyGeometry(),box=g.boundingBox;
 expect(box.max.x-box.min.x).toBeCloseTo(CAR_DIMENSIONS.width,2);expect(box.max.z-box.min.z).toBeCloseTo(CAR_DIMENSIONS.length,2);expect(box.max.y).toBeCloseTo(CAR_DIMENSIONS.height,2);
 const trim=carTrimGeometry();expect((g.index?.count||g.attributes.position.count)/3+(trim.index?.count||trim.attributes.position.count)/3).toBeLessThan(12000);
 expect(CAR_DIMENSIONS.wheelbase).toBe(2.42);expect(CAR_DIMENSIONS.clearance).toBe(.17);expect([...g.attributes.position.array,...trim.attributes.position.array].every(Number.isFinite)).toBe(true);g.dispose();trim.dispose();
});
it('creates fallback facade materials without a DOM or network',()=>{const m=createFacadeMaterial('nine',{color:'#aaa'});expect(m.map).toBeNull();expect(m.userData.photoReady).toBeUndefined();m.dispose();});
it('keeps the modular maps and baked impostors below 200 MB including mipmaps',async()=>{
 const files=['car-atlas.webp','concrete-detail-normal.webp',...['panel','panel335','brick','nine','tower'].flatMap(s=>['albedo','windows','impostor-albedo','impostor-windows'].map(k=>`${s}-${k}.webp`))];let bytes=0;
 for(const f of files){const info=await sharp(`public/yard/photos/${f}`).metadata();bytes+=info.width*info.height*4*4/3;}
 expect(bytes).toBeLessThan(200_000_000);
});
