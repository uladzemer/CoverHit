import {it,expect} from 'vitest';
import {readFile,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {measureBorderWidths,borderMismatch} from '../scripts/carpet-borders.mjs';
const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const audit=JSON.parse(await readFile('scripts/carpets.audit.json','utf8'));

for(const c of config) {
 const file='assets-src/carpets/'+c.source;
 const present=await stat(file).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
 it.skipIf(!present)(`${c.id}: border symmetry and reviewed frame remain stable`,async()=>{
  const meta=await sharp(file).metadata();
  for(const [x,y] of c.corners){expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(x).toBeLessThan(meta.width);expect(y).toBeLessThan(meta.height);}
  const review=audit[c.id];expect(review).toBeDefined();
  if(c.enabled===false){expect(c.cut?.reason??review.note).toMatch(/Disabled|no complete enclosing border/);return;}
  const measured=await measureBorderWidths(file,c.corners,review.fieldCorners);
  for(const side of ['left','right','top','bottom']) {
   expect(measured[side]).toBeGreaterThan(0);
   expect(Math.abs(measured[side]-review.expectedWidths[side])/review.expectedWidths[side]).toBeLessThan(.02);
  }
  if(c.id==='envato-RBFEDY2'){expect(measured.lr).toBeLessThan(.02);expect(measured.tb).toBeLessThan(.02);}
  else {
   // Handmade/worn frames have intrinsic asymmetry: lock the independently
   // reviewed widths instead of trimming intact woven borders to fake equality.
   expect(measured.lr).toBeLessThanOrEqual(review.maxMismatch.lr);
   expect(measured.tb).toBeLessThanOrEqual(review.maxMismatch.tb);
  }
 },30000);
}
it('detects a cropped narrow right border independently of configured output size',async()=>{
 const svg=Buffer.from('<svg width="400" height="500"><rect width="400" height="500" fill="#202050"/><rect x="40" y="40" width="320" height="420" fill="#b04020"/></svg>');
 const field=[[40,40],[360,40],[360,460],[40,460]];
 const good=await measureBorderWidths(svg,[[0,0],[399,0],[399,499],[0,499]],field);
 const bad=await measureBorderWidths(svg,[[0,0],[379,0],[379,499],[0,499]],field);
 expect(good.lr).toBeLessThan(.03);expect(good.tb).toBeLessThan(.03);
 expect(bad.lr).toBeGreaterThan(.5);expect(borderMismatch(100,101)).toBeLessThan(.02);
});
