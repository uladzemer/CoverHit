import {it,expect} from 'vitest';
import sharp from 'sharp';
import {carBodyGeometry,carTrimGeometry,carPhotoGeometry} from '../src/scene/yard/car.js';
import {facadeBox,FACADE_SERIES} from '../src/scene/yard/facade.js';

it('keeps side photographic triangles coplanar and the entire vehicle below 2k triangles',()=>{
 const cards=carPhotoGeometry(),p=cards.attributes.position;
 // First side quad: every vertex has the same lateral coordinate. No fender,
 // door or glasshouse vertex can deform the photographic side.
 for(let i=0;i<6;i++)expect(p.getX(i)).toBeCloseTo(-.818,6);
 const parts=[carBodyGeometry(),carTrimGeometry(),cards];
 expect(parts.reduce((sum,g)=>sum+(g.index?.count||g.attributes.position.count)/3,0)).toBeLessThanOrEqual(2000);
 for(const g of parts)g.dispose();
});

it('has equal 2.7m floors and upright half-texel-inset UVs in all facade families',()=>{
 for(const family of ['panel','panel335','brick','nine']){
  const bay=FACADE_SERIES[family].bay,g=facadeBox(4*bay,13.5,4*bay,family,11),p=g.attributes.position,uv=g.attributes.facadeUv;
  for(let row=0;row<5;row++)for(let col=0;col<4;col++){
   const i=(row*4+col)*6;
   expect((p.getY(i+2)-p.getY(i))*13.5).toBeCloseTo(2.7,5);
   expect((p.getX(i+1)-p.getX(i))*4*bay).toBeCloseTo(bay,5);
   expect(uv.getX(i+1)-uv.getX(i)).toBeCloseTo(1007/2048,6);
   expect(uv.getY(i+2)-uv.getY(i)).toBeCloseTo(1007/2048,6);
  }
  g.dispose();
 }
});

it('uses coverage alpha for the car cards, leaving the roof background and wheel arches clear',async()=>{
 const {data,info}=await sharp('public/yard/photos/car-flat-atlas.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const alpha=(x,y)=>data[(y*info.width+x)*4+3];
 expect(alpha(30,10)).toBe(0);expect(alpha(161,199)).toBe(0);expect(alpha(607,199)).toBe(0);
 expect(alpha(450,150)).toBeGreaterThan(240);
});
