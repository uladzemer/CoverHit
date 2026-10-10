import {it,expect} from 'vitest';
import {readFile,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {fitLine,lineDistance,intersectLines,validateQuad} from '../scripts/carpet-cut/fit.mjs';
import {backgroundModel,textureEnergy,cleanMask,analyzeSource} from '../scripts/carpet-cut/segment.mjs';
import {rgbLab,deltaE,imageMetrics} from '../scripts/carpet-cut/metrics.mjs';
import {rectifyCarpet} from '../scripts/carpet-image.mjs';
import {finishCut,wovenEdge} from '../scripts/carpet-cut/finish.mjs';
import {measureDecodedCutBorders} from '../scripts/carpet-borders.mjs';
import {carpetGeometry,carpetEntryType} from '../src/carpet/assets.js';

it('fits vertical/rotated boundaries despite noise and fringe outliers deterministically',()=>{
 const points=Array.from({length:160},(_,i)=>[30+.15*i+(i%3-1)*.2,i]);
 for(let i=0;i<60;i++)points.push([10+i%8,i*2.5]);
 const a=fitLine(points,{threshold:1});expect(a).toEqual(fitLine(points,{threshold:1}));
 expect(a.residual).toBeLessThan(.3);expect(lineDistance(a,[45,100])).toBeLessThan(.3);
 const cross=intersectLines({a:1,b:0,c:-40},{a:0,b:1,c:-50});expect(cross).toEqual([40,50]);
 expect(validateQuad([[0,0],[100,0],[100,200],[0,200]])).toBe(true);
 expect(validateQuad([[0,0],[100,0],[0,200],[100,200]])).toBe(false);
 expect(()=>fitLine([[0,0]])).toThrow();
});
it('models separate wall/floor clusters and retains high texture energy',async()=>{
 const input=Buffer.from('<svg width="200" height="240"><rect width="200" height="120" fill="#ddd"/><rect y="120" width="200" height="120" fill="#888"/><rect x="30" y="30" width="140" height="180" fill="#b02020"/></svg>');
 const {data,info}=await sharp(input).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const clusters=backgroundModel(data,info.width,info.height,[[30,30],[170,30],[170,210],[30,210]]);
 for(const rgb of [[221,221,221],[136,136,136]])expect(Math.min(...clusters.map(c=>deltaE(c.lab,rgbLab(rgb))))).toBeLessThan(1);
 const energy=textureEnergy(data,info.width,info.height);expect(energy[30*200+30]).toBeGreaterThan(20);
 expect(backgroundModel(data,200,240,[[0,0],[199,0],[199,239],[0,239]],true)).toEqual([]);
});
it('closes holes, rejects disconnected dust, and preserves the largest woven component',()=>{
 const w=40,h=50,mask=new Uint8Array(w*h);
 for(let y=8;y<42;y++)for(let x=8;x<32;x++)mask[y*w+x]=1;
 mask[20*w+20]=0;mask[2*w+2]=1;
 const clean=cleanMask(mask,w,h);expect(clean[20*w+20]).toBe(1);expect(clean[2*w+2]).toBe(0);expect(clean[10*w+10]).toBe(1);
});
it('rectifies a keystoned rectangle with fringe on a wall/floor background and removes leakage before polish',async()=>{
 const input=Buffer.from('<svg width="240" height="300"><rect width="240" height="150" fill="#ddd"/><rect y="150" width="240" height="150" fill="#888"/><polygon points="40,30 210,45 190,275 20,255" fill="#b02020"/><path d="M35 24L40 30M90 18L90 34M180 32L180 42" stroke="#b02020" stroke-width="3"/></svg>');
 const prior=[[40,30],[210,45],[190,275],[20,255]],analysis=await analyzeSource(input,prior);
 expect(validateQuad(analysis.corners,prior)).toBe(true);
 const finished=await finishCut(await rectifyCarpet(input,analysis.corners,{maxSize:200,oversample:2}),analysis.clusters,{maxFraction:.025,minFraction:.012});
 expect(finished.unpolished.outerLeakage).toBe(0);expect(finished.unpolished.nextLeakage).toBeLessThanOrEqual(.005);
 const encoded=await sharp(finished.data,{raw:{width:finished.width,height:finished.height,channels:3}}).webp({lossless:true}).toBuffer();
 expect((await imageMetrics(encoded,analysis.clusters)).outerLeakage).toBe(0);
});
it('woven polish is deterministic, thin, and cannot inject any external colour',()=>{
 const data=Buffer.alloc(100*150*3);for(let i=0;i<data.length;i+=3){data[i]=180;data[i+1]=70;data[i+2]=30;}
 const edge=wovenEdge(data,100,150);expect(edge).toEqual(wovenEdge(data,100,150));expect(edge.subarray((75*100+50)*3,(75*100+50)*3+3)).toEqual(data.subarray((75*100+50)*3,(75*100+50)*3+3));
 expect(edge[0]).toBeLessThan(data[0]);expect(edge[2]).toBeLessThan(40);
});

const report=JSON.parse(await readFile('public/carpets/cuts.json','utf8'));
const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const original=JSON.parse((await readFile('docs/qa/cuts/original-manifest.json','utf8')).replace(/^\uFEFF/,''));
const manifest=JSON.parse(await readFile('public/carpets/manifest.json','utf8'));
it('does not add Ammo grid nodes to any remaining museum carpet',()=>{
 for(const c of manifest) {
  const old=original.find(o=>o.id===c.id),g=carpetGeometry(carpetEntryType(c),c.aspect),p=carpetGeometry(carpetEntryType(old),old.aspect);
  expect((g.cols+1)*(g.rows+1)).toBeLessThanOrEqual((p.cols+1)*(p.rows+1));
 }
});
for(const c of report.carpets.filter(c=>c.after)) {
 const file='public/carpets/'+c.id+'.webp',present=await stat(file).then(()=>true,()=>false);
 it.skipIf(!present&&c.id.startsWith('envato-'))(`${c.id}: decoded shipped pixels meet cut acceptance`,async()=>{
  const actual=await imageMetrics(file,c.clusters);
  expect(actual.outerLeakage).toBe(0);expect(actual.nextLeakage).toBeLessThanOrEqual(.005);
  expect(actual.width).toBe(c.after.width);expect(actual.height).toBe(c.after.height);
  expect(c.unpolished.outerLeakage).toBe(0);expect(c.unpolished.nextLeakage).toBeLessThanOrEqual(.005);
  expect(c.after.straightnessResidual).toBeLessThanOrEqual(.0025);expect(c.after.cornerAngleError).toBeLessThanOrEqual(.5);
  const symmetry=config.find(entry=>entry.id===c.id)?.cut?.symmetry;
  if(symmetry?.pairs.length) {
   const borders=await measureDecodedCutBorders(file,c,symmetry.fieldCorners);
   for(const pair of symmetry.pairs)expect(borders[pair]).toBeLessThanOrEqual(.03);
  }
 });
}
